import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import SYMXRoute from "@/lib/models/SYMXRoute";
import { epochToClockTime, epochToHHMM, durationMsToHMM } from "@/lib/cortex-time";
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
    "amazonOutLunch",
    "amazonInLunch",
    "actualReturnTime",
] as const;

function computeCortexFields(itineraryDetails: any, stops: any[]): Record<string, string | number> {
    const fields: Record<string, string | number> = {};
    const td = itineraryDetails?.transporterTimeAttributes || {};

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
    // The trailing RETURN / BACK_TO_ORIGIN entry sometimes still carries the
    // route code (not null) but has no planned time and only RETURN tasks —
    // that is not a customer stop either.
    const isReturnOnly = (s: any) => {
        const tasks: any[] = Array.isArray(s?.tasks) ? s.tasks : [];
        return tasks.length > 0 && tasks.every((t: any) => /RETURN|BACK_TO_ORIGIN/i.test(String(t?.taskType || "")));
    };
    const customerStops = realStops.filter((s: any) => s.sequenceNumber > 1 && !isReturnOnly(s));

    // PLANNED first/last follow the planned route order (sequence): the page's
    // "stop N" is sequence N+1 because sequence 1 is the pickup.
    const firstStop = customerStops[0] || null;
    const lastStop = customerStops.length ? customerStops[customerStops.length - 1] : null;

    // ACTUAL first/last follow the clock, not the plan: drivers go out of order,
    // so the first/last actual delivery is the earliest/latest execution time
    // across every stop. A stop holds many tasks (one per package); prefer
    // drop-offs so pickups at the stop don't skew the times.
    const actualTimes: number[] = [];
    for (const stop of customerStops) {
        const tasks: any[] = Array.isArray(stop?.tasks) ? stop.tasks : [];
        const drops = tasks.filter((t: any) => t?.taskType === "DROP_OFF");
        for (const t of (drops.length ? drops : tasks)) {
            const n = Number(t?.actualExecutionTime);
            if (Number.isFinite(n) && n > 0) actualTimes.push(n);
        }
    }
    const firstTaskActual = actualTimes.length ? Math.min(...actualTimes) : undefined;
    const lastTaskActual = actualTimes.length ? Math.max(...actualTimes) : undefined;

    const plannedFirst = epochToClockTime(firstStop?.expectedStartTime);
    if (plannedFirst) fields.plannedFirstStop = plannedFirst;
    const actualFirst = epochToClockTime(firstTaskActual);
    if (actualFirst) fields.actualFirstStop = actualFirst;

    const plannedLast = epochToClockTime(lastStop?.expectedStartTime);
    if (plannedLast) fields.plannedLastStop = plannedLast;
    const actualLast = epochToClockTime(lastTaskActual);
    if (actualLast) fields.actualLastStop = actualLast;

    // Cortex reports an outbound stem of 0 for some drivers (e.g. several routes
    // in one block). The stem is simply departure -> first delivery, so derive it.
    if (!fields.actualOutboundStem && firstTaskActual && td.actualDepartureTime) {
        const depMs = Number(td.actualDepartureTime);
        const depSec = depMs >= 1e14 ? depMs / 1e6 : depMs >= 1e11 ? depMs / 1e3 : depMs;
        const diffMs = (firstTaskActual - depSec) * 1000;
        if (diffMs > 0 && diffMs < 6 * 3600 * 1000) {
            const stem = durationMsToHMM(diffMs);
            if (stem) fields.actualOutboundStem = stem;
        }
    }

    // Amazon's own "last stop" time (what the driver list shows as "Last:
    // Delivery at …"). Preferred over the stop-by-stop calculation when present.
    const lastExec = epochToClockTime(itineraryDetails?.lastStopExecutionTime);
    if (lastExec) fields.actualLastStop = lastExec;

    // Meal break (driver-specific, from the itinerary itself).
    const meal = (Array.isArray(itineraryDetails?.breaks) ? itineraryDetails.breaks : []).find(
        (b: any) => b?.type === "MEAL" && b?.state === "OFF" && b?.timeStampOn && b?.timeStampOff
    );
    if (meal) {
        const outL = epochToHHMM(meal.timeStampOn);
        const inL = epochToHHMM(meal.timeStampOff);
        if (outL) fields.amazonOutLunch = outL;
        if (inL) fields.amazonInLunch = inL;
    }

    if (Array.isArray(itineraryDetails?.rescueActions)) {
        fields.stopsRescued = itineraryDetails.rescueActions.length;
    }

    // ── Return to station ──
    // Cortex fills returnToStationTime once the driver is back; the closing
    // RETURN task on the last stop is the fallback when it is only in the stops.
    let returnedAt = epochToClockTime(td.returnToStationTime);
    if (!returnedAt) {
        for (const s of realStops.slice().reverse()) {
            const rt = (Array.isArray(s?.tasks) ? s.tasks : []).find((t: any) => /RETURN|BACK_TO_ORIGIN/i.test(String(t?.taskType || "")) && Number(t?.actualExecutionTime) > 0);
            if (rt) { returnedAt = epochToClockTime(rt.actualExecutionTime); break; }
        }
    }
    if (returnedAt) fields.actualReturnTime = returnedAt;

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
        const logout = epochToHHMM(td.sessionEndTime ?? itineraryDetails?.sessionEndTime);
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
                itineraryId: itineraryDetails.itineraryId || "",
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
            itineraryId: itineraryDetails.itineraryId || "",
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
