import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, orgWide } from "@/lib/scoped-query";
import RouteContribution from "@/lib/models/RouteContribution";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";

const pacificDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// GET ?days=14 — routes whose deliveries were split between drivers, who covered, and a leaderboard.
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
        const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") || "14", 10) || 14));
        const today = pacificDay();
        const since = addDays(today, -(days - 1));

        const rows = await RouteContribution.find({ ...S, date: { $gte: since, $lte: today } }).lean() as any[];

        // Planned owner of each route/day (who was scheduled on it)
        const routes = await SYMXRoute.find(
            { ...S, date: { $gte: new Date(`${since}T00:00:00.000Z`), $lte: new Date(`${today}T00:00:00.000Z`) } },
            { date: 1, routeNumber: 1, transporterId: 1, employeeName: 1, siteId: 1 }
        ).lean() as any[];
        const ownerOf = new Map<string, { tid: string; name: string }>();
        routes.forEach((r) => {
            if (!r.routeNumber || !r.transporterId) return;
            ownerOf.set(`${String(r.siteId)}|${new Date(r.date).toISOString().slice(0, 10)}|${String(r.routeNumber).toUpperCase()}`, { tid: String(r.transporterId).toUpperCase(), name: r.employeeName || "" });
        });

        const tids = [...new Set(rows.map((r) => String(r.transporterId).toUpperCase()))];
        const emps = tids.length
            ? await orgWide(SymxEmployee.find({ transporterId: { $in: tids } }, { transporterId: 1, firstName: 1, lastName: 1 }), "name drivers on rescue report").lean() as any[]
            : [];
        const nameBy = new Map<string, string>(emps.map((e: any) => [String(e.transporterId).toUpperCase(), `${e.firstName || ""} ${e.lastName || ""}`.trim()]));
        const nm = (tid: string) => nameBy.get(tid) || tid;

        // Group by route/day
        const groups = new Map<string, any[]>();
        rows.forEach((r) => {
            const k = `${String(r.siteId)}|${r.date}|${String(r.routeCode).toUpperCase()}`;
            (groups.get(k) || groups.set(k, []).get(k)!).push(r);
        });

        const handoffs: any[] = [];
        const board = new Map<string, { tid: string; name: string; packages: number; stops: number; routes: number; days: Set<string> }>();
        let totalDeliveries = 0, rescuedDeliveries = 0;

        for (const [k, list] of groups) {
            const [siteId, date, routeCode] = k.split("|");
            const total = list.reduce((a, r) => a + (r.completedDeliveries || 0), 0);
            totalDeliveries += total;
            const sorted = [...list].sort((a, b) => (b.completedDeliveries || 0) - (a.completedDeliveries || 0));
            const planned = ownerOf.get(k);
            const ownerTid = planned?.tid || String(sorted[0].transporterId).toUpperCase();
            const covering = sorted.filter((r) => String(r.transporterId).toUpperCase() !== ownerTid && (r.completedDeliveries || 0) > 0);
            if (!covering.length) continue;
            const ownerRow = list.find((r) => String(r.transporterId).toUpperCase() === ownerTid);
            const ownerDelivered = ownerRow?.completedDeliveries || 0;
            const covered = covering.reduce((a, r) => a + (r.completedDeliveries || 0), 0);
            rescuedDeliveries += covered;
            handoffs.push({
                date, routeCode,
                total,
                owner: { tid: ownerTid, name: planned?.name || nm(ownerTid), delivered: ownerDelivered, ranRoute: !!ownerRow, scheduled: !!planned },
                pickups: list.reduce((a, r) => a + (r.onRoadPickups || 0), 0) / Math.max(1, 1),
                coveredBy: covering.map((r) => ({ tid: String(r.transporterId).toUpperCase(), name: nm(String(r.transporterId).toUpperCase()), delivered: r.completedDeliveries || 0, stops: r.completedStops || 0 })),
                covered,
                coveredPct: total ? Math.round((covered / total) * 100) : 0,
            });
            covering.forEach((r) => {
                const t = String(r.transporterId).toUpperCase();
                const b = board.get(t) || board.set(t, { tid: t, name: nm(t), packages: 0, stops: 0, routes: 0, days: new Set() }).get(t)!;
                b.packages += r.completedDeliveries || 0; b.stops += r.completedStops || 0; b.routes += 1; b.days.add(date);
            });
        }

        handoffs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.covered - a.covered));
        const leaderboard = [...board.values()].map((b) => ({ tid: b.tid, name: b.name, packages: b.packages, stops: b.stops, routes: b.routes, days: b.days.size }))
            .sort((a, b) => b.packages - a.packages);
        const routeCount = groups.size;

        return NextResponse.json({
            today, days,
            kpi: {
                routes: routeCount,
                handoffRoutes: handoffs.length,
                rescuedPackages: rescuedDeliveries,
                rescuedPct: totalDeliveries ? Math.round((rescuedDeliveries / totalDeliveries) * 1000) / 10 : 0,
                ownerDidNotRun: handoffs.filter((h) => !h.owner.ranRoute).length,
            },
            handoffs,
            leaderboard,
            hasData: rows.length > 0,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
