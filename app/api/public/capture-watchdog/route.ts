import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Capture watchdog. Call every ~15 minutes (Vercel cron on Pro, or a free
 * external pinger such as cron-job.org). For each active station with Slack
 * configured it checks whether the extension delivered data after the most
 * recent scheduled capture slot, and posts ONE alert per outage plus a
 * "back online" message when captures resume.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`.
 * Add `&test=1&station=DXC8` to post a test message to that station's Slack.
 */

// Must mirror SCHEDULE_TIMES in chrome-extension/background.js (Pacific).
const SLOTS = ["08:45", "12:30", "15:00", "18:00", "22:00", "22:30", "23:00"];
const GRACE_MIN = 25;
const OFF_AFTER_HOURS = 72; // station silent this long = presumed closed, don't nag

function pacificNow() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return { date: `${g("year")}-${g("month")}-${g("day")}`, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")) };
}

async function postSlack(url: string, text: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) throw new Error(`Slack ${res.status}`);
}

const fmtPT = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit" }).format(d);

export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    const url = new URL(req.url);
    const ok = !!secret && (req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret);
    if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    try {
        await connectToDatabase();
        const sites = await Site.find({ status: "active" }).lean() as any[];

        // Manual Slack test for one station.
        if (url.searchParams.get("test")) {
            const code = (url.searchParams.get("station") || "").toUpperCase();
            const s = sites.find((x) => String(x.code).toUpperCase() === code);
            if (!s?.slackWebhookUrl) return NextResponse.json({ ok: false, error: "Station not found or no Slack webhook" }, { status: 400 });
            await postSlack(s.slackWebhookUrl, `:white_check_mark: *${s.code}* — SYMX Slack connection test. Alerts and capture-watchdog messages will appear here.`);
            return NextResponse.json({ ok: true, tested: s.code });
        }

        const now = pacificNow();
        const nowMs = Date.now();
        // Most recent slot that is at least GRACE_MIN old.
        const due = [...SLOTS].reverse().find((s) => {
            const [h, m] = s.split(":").map(Number);
            return h * 60 + m + GRACE_MIN <= now.min;
        });
        const results: any[] = [];

        for (const s of sites) {
            const code = s.code;
            const enabled = s.slackWebhookUrl && s.slackAlertsEnabled !== false && s.amazon?.serviceAreaId;
            if (!enabled) { results.push({ code, skipped: "no Slack / service area" }); continue; }
            const last: Date | null = s.lastCaptureAt ? new Date(s.lastCaptureAt) : null;

            // Recovery: previously alerted and a capture has arrived since.
            if (s.watchdogAlertedSlot && last && last.getTime() > new Date(s.watchdogAlertedAt || 0).getTime()) {
                await postSlack(s.slackWebhookUrl, `:white_check_mark: *${code}* — capture is back online (last data ${fmtPT(last)} PT).`);
                await Site.updateOne({ _id: s._id }, { $set: { watchdogAlertedSlot: "" }, $unset: { watchdogAlertedAt: "" } });
                results.push({ code, recovered: true });
                continue;
            }
            if (!due) { results.push({ code, skipped: "no slot due yet" }); continue; }
            if (s.watchdogAlertedSlot) { results.push({ code, status: "already alerted" }); continue; }
            if (!last) { results.push({ code, skipped: "never captured" }); continue; }
            if (nowMs - last.getTime() > OFF_AFTER_HOURS * 3600e3) { results.push({ code, skipped: "silent >72h, presumed closed" }); continue; }

            const [h, m] = due.split(":").map(Number);
            const slotMs = nowMs - (now.min - (h * 60 + m)) * 60000;
            if (last.getTime() >= slotMs - 5 * 60000) { results.push({ code, status: "ok" }); continue; }

            const key = `${now.date} ${due}`;
            await postSlack(
                s.slackWebhookUrl,
                `:rotating_light: *${code}* — no capture since ${fmtPT(last)} PT (the ${due} PT run didn't arrive). ` +
                `Check the capture computer: Chrome open, Cortex signed in, SYMX Route Fetch extension on. Efficiency data is going stale.`,
            );
            await Site.updateOne({ _id: s._id }, { $set: { watchdogAlertedSlot: key, watchdogAlertedAt: new Date() } }, { strict: false });
            results.push({ code, alerted: key });
        }
        return NextResponse.json({ ok: true, due: due || null, results });
    } catch (e: any) {
        console.error("[capture-watchdog]", e);
        return NextResponse.json({ ok: false, error: e.message || "Failed" }, { status: 500 });
    }
}
