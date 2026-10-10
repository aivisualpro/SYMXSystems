import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import CdfFeedback from "@/lib/models/CdfFeedback";
import CdfDriverDay from "@/lib/models/CdfDriverDay";

const pacificDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);
const weekStart = (day: string) => { const d = new Date(day + "T12:00:00Z"); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10); };

type Verdict = "not-discussed" | "too-early" | "improving" | "no-change" | "worse" | "clean";

/** Compare feedback in the 14 days before the last discussion with the days since. */
function judge(items: { deliveryDate: string }[], lastDisc: string | null, today: string): { verdict: Verdict; before: number; after: number; daysAfter: number } {
    if (!lastDisc) return { verdict: "not-discussed", before: 0, after: 0, daysAfter: 0 };
    const before = items.filter((i) => i.deliveryDate >= addDays(lastDisc, -14) && i.deliveryDate < lastDisc).length;
    const after = items.filter((i) => i.deliveryDate >= lastDisc).length;
    const daysAfter = Math.min(14, Math.max(0, daysBetween(lastDisc, today)));
    if (daysAfter < 7) return { verdict: "too-early", before, after, daysAfter };
    if (after === 0 && daysAfter >= 14) return { verdict: "clean", before, after, daysAfter };
    const rateBefore = before / 2;               // per week
    const rateAfter = after / (daysAfter / 7);   // per week
    if (rateBefore === 0) return { verdict: after === 0 ? "no-change" : "worse", before, after, daysAfter };
    if (rateAfter <= rateBefore * 0.7) return { verdict: "improving", before, after, daysAfter };
    if (rateAfter >= rateBefore * 1.3) return { verdict: "worse", before, after, daysAfter };
    return { verdict: "no-change", before, after, daysAfter };
}

// GET ?weeks=8 — station weekly series + per-driver frequency and
// before/after-discussion comparison.
export async function GET(req: NextRequest) {
    try { await requirePermission("Performance", "view"); }
    catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const S = siteFilter(scope);
        const weeks = Math.min(26, Math.max(4, parseInt(new URL(req.url).searchParams.get("weeks") || "8", 10) || 8));
        const today = pacificDay();
        const since = addDays(weekStart(today), -7 * (weeks - 1));

        const [items, dayRows] = await Promise.all([
            CdfFeedback.find({ ...S, deliveryDate: { $gte: since } }).sort({ deliveryDate: 1 }).lean() as Promise<any[]>,
            CdfDriverDay.find({ ...S, date: { $gte: since } }).lean() as Promise<any[]>,
        ]);

        // Station weekly series
        const weekKeys: string[] = [];
        for (let i = 0; i < weeks; i++) weekKeys.push(addDays(since, 7 * i));
        const series = weekKeys.map((w) => ({ week: w, negatives: 0, responses: 0, discussed: 0 }));
        const idx = new Map(series.map((s, i) => [s.week, i]));
        items.forEach((i) => { const k = idx.get(weekStart(i.deliveryDate)); if (k !== undefined) { series[k].negatives++; if (i.status !== "open") series[k].discussed++; } });
        dayRows.forEach((d) => { const k = idx.get(weekStart(d.date)); if (k !== undefined) series[k].responses += d.responses || 0; });

        // Per driver
        const byDriver = new Map<string, any[]>();
        items.forEach((i) => { const k = i.transporterId || i.driverName; (byDriver.get(k) || byDriver.set(k, []).get(k)!).push(i); });
        const resp30 = new Map<string, number>();
        const d30 = addDays(today, -30);
        dayRows.forEach((d) => { if (d.date > d30) resp30.set(d.transporterId, (resp30.get(d.transporterId) || 0) + (d.responses || 0)); });

        const drivers = [...byDriver.entries()].map(([tid, list]) => {
            const neg30 = list.filter((i) => i.deliveryDate > d30).length;
            const neg30prev = list.filter((i) => i.deliveryDate <= d30 && i.deliveryDate > addDays(d30, -30)).length;
            const spark = weekKeys.map((w) => list.filter((i) => weekStart(i.deliveryDate) === w).length);
            const discDates = list.filter((i) => i.status !== "open" && i.discussedAt).map((i) => pacificDay(new Date(i.discussedAt)));
            const lastDisc = discDates.length ? discDates.sort().slice(-1)[0] : null;
            const j = judge(list, lastDisc, today);
            const responses = resp30.get(tid) || 0;
            return {
                transporterId: tid, name: list[list.length - 1].driverName || tid, total: list.length, neg30, neg30prev,
                responses30: responses, rate30: responses ? Math.round((neg30 / responses) * 1000) / 10 : null,
                spark, lastDiscussed: lastDisc, discussions: new Set(discDates).size,
                open: list.filter((i) => i.status === "open").length,
                verdict: j.verdict, before: j.before, after: j.after, daysAfter: j.daysAfter,
                timeline: list.map((i) => ({ date: i.deliveryDate, tba: i.trackingId, reasons: i.reasons, status: i.status, discussedAt: i.discussedAt, discussedBy: i.discussedBy, outcome: i.outcome })).reverse(),
            };
        }).sort((a, b) => b.neg30 - a.neg30 || b.total - a.total);

        return NextResponse.json({ today, series, drivers });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
