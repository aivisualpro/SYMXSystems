import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import CdfFeedback from "@/lib/models/CdfFeedback";
import CdfDriverDay from "@/lib/models/CdfDriverDay";

/**
 * Chrome extension -> SYMX. Receives the CDF deep-dive rows for one station
 * (Amazon performance portal, `da_dsp_daily_cdf_deep_dive`), keeps only the
 * negative feedback, and upserts one record per tracking id. Discussion
 * fields are never touched by a re-sync.
 */
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
};
const KEY = process.env.CORTEX_SYNC_KEY || "symx-ext-route-sync-2026";

function humanize(code: string): string {
    const s = String(code || "").replace(/^sonorus_/, "").replace(/_/g, " ").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export async function POST(req: NextRequest) {
    if (req.headers.get("x-extension-key") !== KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    const body = await req.json().catch(() => null);
    const stationCode = String(body?.stationCode || "").trim().toUpperCase();
    const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
    const links: Record<string, { itineraryId?: string; stopIndex?: number }> = body?.links || {};
    const daily: any[] = Array.isArray(body?.daily) ? body.daily : [];
    if (!stationCode) return NextResponse.json({ error: "stationCode required" }, { status: 400, headers: CORS });

    try {
        await connectToDatabase();
        const site = await Site.findOne({ code: stationCode }, { _id: 1, code: 1, amazon: 1 }).lean() as any;
        if (!site) return NextResponse.json({ error: `Unknown station ${stationCode}` }, { status: 404, headers: CORS });

        const ops = rows
            .filter((r) => r && r.tracking_id && (r.negative_feedback_flag === 1 || r.level_2_negative_feedback_flag === 1))
            .map((r) => {
                const link = links[r.tracking_id] || {};
                const reasons = [humanize(r.level_2_negative_feedback), humanize(r.level_3_negative_feedback)].filter(Boolean);
                const deliveredAt = r.delivery_date_utc ? new Date(String(r.delivery_date_utc).replace(" ", "T") + "Z") : undefined;
                return {
                    updateOne: {
                        filter: { siteId: site._id, trackingId: String(r.tracking_id) },
                        update: {
                            $set: {
                                stationCode,
                                deliveryId: r.delivery_id || "",
                                transporterId: String(r.transporter_id || "").trim().toUpperCase(),
                                driverName: r.da_name || "",
                                deliveryDate: String(r.delivery_date || ""),
                                ...(deliveredAt && !isNaN(deliveredAt.getTime()) ? { deliveredAt } : {}),
                                scorecardWeek: String(r.delivery_week || ""),
                                level2: r.level_2_negative_feedback || "",
                                level3: r.level_3_negative_feedback || "",
                                reasons,
                                shipmentReason: r.shipment_reason || "",
                                serviceAreaId: site.amazon?.serviceAreaId || "",
                                capturedAt: new Date(),
                                ...(link.itineraryId ? { itineraryId: link.itineraryId } : {}),
                                ...(typeof link.stopIndex === "number" ? { stopIndex: link.stopIndex } : {}),
                            },
                            $setOnInsert: { siteId: site._id, status: "open" },
                        },
                        upsert: true,
                    },
                };
            });
        // Per-driver/day response counts (the denominator for trend rates).
        const dayOps = daily
            .filter((d) => d && d.transporterId && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || "")))
            .map((d) => ({
                updateOne: {
                    filter: { siteId: site._id, transporterId: String(d.transporterId).trim().toUpperCase(), date: String(d.date) },
                    update: {
                        $set: { stationCode, driverName: d.driverName || "", responses: Number(d.responses) || 0, negatives: Number(d.negatives) || 0, positives: Number(d.positives) || 0 },
                        $setOnInsert: { siteId: site._id },
                    },
                    upsert: true,
                },
            }));
        if (dayOps.length) await CdfDriverDay.bulkWrite(dayOps as any, { ordered: false });

        let created = 0;
        if (ops.length) {
            const res = await CdfFeedback.bulkWrite(ops as any, { ordered: false });
            created = res.upsertedCount || 0;
        }
        return NextResponse.json({ ok: true, station: stationCode, negative: ops.length, created, days: dayOps.length }, { headers: CORS });
    } catch (e: any) {
        console.error("[CDF Sync]", e);
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500, headers: CORS });
    }
}

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }); }
