import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { toAlertRow, evaluateAlerts, buildSummary, buildCloseout } from "@/lib/efficiency-alerts";

/**
 * Called by the extension after a scheduled capture finishes. Evaluates the
 * station's routes for the day and posts new issues to that station's Slack
 * channel (Site.slackWebhookUrl). Each issue is posted once per route.
 */
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
};
const KEY = process.env.CORTEX_SYNC_KEY || "symx-ext-route-sync-2026";

function nowPacificMinutes(): number {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value) % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value);
    return h * 60 + m;
}

async function postSlack(url: string, text: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) throw new Error(`Slack ${res.status}`);
}

export async function POST(req: NextRequest) {
    if (req.headers.get("x-extension-key") !== KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    const body = await req.json().catch(() => ({}));
    const { serviceAreaId, date } = body || {};
    const final = !!body.final;
    const dryRun = !!body.dryRun;
    const slot: string = typeof body.slot === "string" ? body.slot : "";
    const closeout = /^\d{2}:\d{2}$/.test(slot) && slot >= "22:00";
    if (!serviceAreaId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
        return NextResponse.json({ error: "serviceAreaId and date (YYYY-MM-DD) required" }, { status: 400, headers: CORS });
    }
    try {
        await connectToDatabase();
        const site = await Site.findOne({ "amazon.serviceAreaId": String(serviceAreaId).trim() }).lean() as any;
        if (!site) return NextResponse.json({ error: "Unknown station" }, { status: 404, headers: CORS });
        if (!site.slackWebhookUrl || site.slackAlertsEnabled === false) {
            return NextResponse.json({ ok: true, posted: 0, skipped: "Slack not configured for this station" }, { headers: CORS });
        }

        const day = new Date(`${date}T00:00:00.000Z`);
        const recs = await SYMXRoute.find({ siteId: site._id, date: day }).lean() as any[];
        const routeRecs = recs.filter((r) => (r.type || "").trim().toLowerCase() === "route");
        const ids = [...new Set(routeRecs.map((r) => String(r.transporterId || "").trim().toUpperCase()))];
        const emps = await SymxEmployee.find({ transporterId: { $in: ids } }, { transporterId: 1, firstName: 1, lastName: 1 }).lean() as any[];
        const nameBy = new Map(emps.map((e) => [String(e.transporterId || "").trim().toUpperCase(), `${e.firstName} ${e.lastName}`]));
        const rows = routeRecs.map((r) => toAlertRow(r, nameBy.get(String(r.transporterId || "").trim().toUpperCase()) || r.transporterId));

        const alerts = evaluateAlerts(rows, nowPacificMinutes(), final);
        const summary = final ? buildSummary(site.code, date, rows) : null;
        const closeoutMsg = closeout ? buildCloseout(site.code, rows, slot, !!body.final) : null;
        if (dryRun) return NextResponse.json({ ok: true, dryRun: true, alerts, summary, closeoutMsg }, { headers: CORS });

        let posted = 0;
        if (alerts.length) {
            // One message per run, grouped, so a busy hour is one ping not twenty.
            await postSlack(site.slackWebhookUrl, `*${site.code} — ${alerts.length} new issue${alerts.length > 1 ? "s" : ""}*\n` + alerts.map((a) => a.text).join("\n"));
            posted = alerts.length;
            await Promise.all(alerts.map((a) => SYMXRoute.updateOne({ _id: a.rowId }, { $addToSet: { alertsSent: a.key } })));
        }
        if (closeoutMsg) await postSlack(site.slackWebhookUrl, closeoutMsg);
        if (summary) await postSlack(site.slackWebhookUrl, summary);
        return NextResponse.json({ ok: true, posted, summary: !!summary }, { headers: CORS });
    } catch (e: any) {
        console.error("[Cortex Alerts]", e);
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500, headers: CORS });
    }
}

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }); }
