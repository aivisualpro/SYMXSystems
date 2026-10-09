import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import SYMXRoute from "@/lib/models/SYMXRoute";
import { epochToClockTime, durationMsToHMM } from "@/lib/cortex-time";
import { mergeCortexFields } from "@/lib/cortex-merge";

/**
 * ══════════════════════════════════════════════════════════════
 * PUBLIC API — Chrome Extension Cortex Sync
 * ══════════════════════════════════════════════════════════════
 * Receives a scraped Amazon Cortex itinerary (from the driver-day
 * itinerary API, not route-summaries) and auto-fills 8 of the 9
 * manually-entered Efficiency screen fields on the matching SYMXRoute.
 * `deliveryCompletionTime` is intentionally excluded — it's a manual
 * dispatcher-entered field (when the driver calls in finished), not
 * derivable from Cortex.
 *
 * Unlike /api/public/extension-sync, this endpoint ACTUALLY validates
 * the x-extension-key header — that route accepts the header but never
 * checks it.
 *
 * Never overwrites a dispatcher-entered value: if a field already holds
 * a value that wasn't itself written by a previous Cortex sync, and the
 * new Cortex value disagrees, it's recorded in `cortexConflicts` for the
 * Efficiency screen to surface, not silently applied.
 * ══════════════════════════════════════════════════════════════
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
};

// Shared secret embedded in the extension's background.js. Same trust
// model as extension-sync's key (a string baked into distributed extension
// code isn't a real secret), but at least this endpoint enforces it.
const CORTEX_SYNC_KEY = process.env.CORTEX_SYNC_KEY || "symx-ext-route-sync-2026";

const AUTO_FIELDS = [
    "actualDepartureTime",
    "plannedOutboundStem",
    "actualOutboundStem",
    "plannedFirstStop",
    "actualFirstStop",
    "plannedLastStop",
    "actualLastStop",
    "stopsRescued",
    "appSignIn",
    "plannedEndTime",
    "amazonAppLogout",
] as const;

function computeCortexFields(itineraryDetails: any, stops: any[]): Record<string, string | number> {
    const fields: Record<string, string | number> = {};
    const td = itineraryDetails?.transporterTimeAttributes || {};
    const routes0 = itineraryDetails?.routes?.[0] || {};
    const rdp = routes0.routeDeliveryProgress || {};
    const totalStops: number = typeof rdp.totalStops === "number" ? rdp.totalStops : 0;

    const actualDeparture = epochToClockTime(td.actualDepartureTime);
    if (actualDeparture) fields.actualDepartureTime = actualDeparture;

    const plannedStem = durationMsToHMM(td.plannedOutboundStemTime);
    if (plannedStem) fields.plannedOutboundStem = plannedStem;

    const actualStem = durationMsToHMM(td.actualOutboundStemTime);
    if (actualStem) fields.actualOutboundStem = actualStem;

    // Real customer stops only: Amazon appends a BACK_TO_ORIGIN / RETURN
    // pair after the last delivery, both marked with routeCode: null —
    // filter those out rather than trusting "last entry in the array".
    const realStops = (Array.isArray(stops) ? stops : [])
        .filter((s: any) => s && s.routeCode != null && typeof s.sequenceNumber === "number")
        .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);

    // sequenceNumber 1 is the warehouse PICK_UP — not a customer stop.
    const firstStop = realStops.find((s: any) => s.sequenceNumber > 1) || null;
    // Sequence 1 is the warehouse pickup, so the page's "stop N" is sequence N+1.
    // Matching sequenceNumber to totalStops therefore landed one stop early.
    // The last customer stop is simply the highest real sequence number.
    const lastStop = realStops.length > 1 ? realStops[realStops.length - 1] : null;

    // A stop can hold many tasks (one per package). Use the earliest execution
    // time for the first stop and the latest for the last, not whichever task
    // happens to be listed first.
    const execTimes = (stop: any): number[] =>
        (Array.isArray(stop?.tasks) ? stop.tasks : [])
            .map((t: any) => Number(t?.actualExecutionTime))
            .filter((n: number) => Number.isFinite(n) && n > 0);
    const firstTimes = execTimes(firstStop);
    const lastTimes = execTimes(lastStop);
    const firstTaskActual = firstTimes.length ? Math.min(...firstTimes) : undefined;
    const lastTaskActual = lastTimes.length ? Math.max(...lastTimes) : undefined;

    const plannedFirst = epochToClockTime(firstStop?.expectedStartTime);
    if (plannedFirst) fields.plannedFirstStop = plannedFirst;
    const actualFirst = epochToClockTime(firstTaskActual);
    if (actualFirst) fields.actualFirstStop = actualFirst;

    const plannedLast = epochToClockTime(lastStop?.expectedStartTime);
    if (plannedLast) fields.plannedLastStop = plannedLast;
    const actualLast = epochToClockTime(lastTaskActual);
    if (actualLast) fields.actualLastStop = actualLast;

    if (Array.isArray(itineraryDetails?.rescueActions)) {
        fields.stopsRescued = itineraryDetails.rescueActions.length;
    }

    // ── App sign-in and planned end of work block ──
    // itineraryStartTime = when the driver signed in to the app; scheduleEndTime
    // = the planned end of the block (verified against the Cortex page:
    // 11:00am sign-in, 9:35pm planned end).
    const appIn = epochToClockTime(itineraryDetails?.itineraryStartTime);
    if (appIn) fields.appSignIn = appIn;
    const plannedEnd = epochToClockTime(itineraryDetails?.scheduleEndTime);
    if (plannedEnd) fields.plannedEndTime = plannedEnd;

    // ── Real app logout (not the planned schedule end) ──
    if (itineraryDetails?.driverSessionEnded) {
        const logout = epochToClockTime(td.sessionEndTime ?? itineraryDetails?.sessionEndTime);
        if (logout) fields.amazonAppLogout = logout;
    }

    return fields;
}

export async function POST(req: NextRequest) {
    const key = req.headers.get("x-extension-key");
    if (key !== CORTEX_SYNC_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
    }

    const { serviceAreaId, date, itineraryDetails, stops } = body || {};
    if (!serviceAreaId || !date || !itineraryDetails) {
        return NextResponse.json(
            { error: "serviceAreaId, date, and itineraryDetails are required" },
            { status: 400, headers: CORS_HEADERS }
        );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400, headers: CORS_HEADERS });
    }

    try {
        await connectToDatabase();

        const site = await Site.findOne(
            { "amazon.serviceAreaId": String(serviceAreaId).trim() },
            { _id: 1, code: 1 }
        ).lean() as any;
        if (!site) {
            return NextResponse.json(
                { error: `No station configured for serviceAreaId ${serviceAreaId}` },
                { status: 404, headers: CORS_HEADERS }
            );
        }

        const transporterId = String(itineraryDetails.transporterId || "").trim().toUpperCase();
        if (!transporterId) {
            return NextResponse.json(
                { error: "itineraryDetails.transporterId missing" },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const dateObj = new Date(`${date}T00:00:00.000Z`);

        const existing = await SYMXRoute.findOne({ transporterId, date: dateObj, siteId: site._id }) as any;
        if (!existing) {
            return NextResponse.json({
                ok: false,
                skipped: true,
                reason: `No route found for transporter ${transporterId} on ${date} at ${site.code}`,
            }, { headers: CORS_HEADERS });
        }

        // Older extension builds sent an empty stops list; the real one is nested in itineraryDetails.
        const stopList = Array.isArray(stops) && stops.length ? stops : (Array.isArray(itineraryDetails.stops) ? itineraryDetails.stops : []);
        const computed = computeCortexFields(itineraryDetails, stopList);
        // Legacy cleanup: earlier syncs wrote the first planned REST BREAK into
        // "Pln 1st". If the stored value is exactly that and was never typed or
        // synced as real data, treat it as empty so the true value replaces it.
        const effectiveExisting: any = existing.toObject ? existing.toObject() : { ...existing };
        const ownedFields: string[] = Array.isArray(existing.cortexSyncedFields) ? existing.cortexSyncedFields : [];
        const legacyPlannedFirst = epochToClockTime(itineraryDetails?.plannedBreaks?.[0]?.plannedStart);
        if (legacyPlannedFirst && effectiveExisting.plannedFirstStop === legacyPlannedFirst && !ownedFields.includes("plannedFirstStop")) {
            effectiveExisting.plannedFirstStop = "";
        }
        const { setOps, updated: updatedFields, conflicts: newConflictFields } =
            mergeCortexFields(effectiveExisting, computed, AUTO_FIELDS);

        await SYMXRoute.updateOne({ _id: existing._id }, { $set: setOps });

        return NextResponse.json({
            ok: true,
            station: site.code,
            transporterId,
            updated: updatedFields,
            conflicts: newConflictFields,
        }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error("[Cortex Sync] Error:", error);
        return NextResponse.json(
            { error: error.message || "Sync failed" },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}
