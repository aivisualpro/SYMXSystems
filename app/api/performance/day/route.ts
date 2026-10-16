import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, orgWide } from "@/lib/scoped-query";
import RouteDayStats from "@/lib/models/RouteDayStats";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";

const pacificDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// GET ?date=YYYY-MM-DD — every driver's day at a glance (pace, breaks, delivery quality, pickups).
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
        const date = new URL(req.url).searchParams.get("date") || pacificDay();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });

        const stats = await RouteDayStats.find({ ...S, date }).lean() as any[];
        const day = new Date(`${date}T00:00:00.000Z`);
        const routes = await SYMXRoute.find({ ...S, date: day }, { transporterId: 1, routeNumber: 1, employeeName: 1, wst: 1, onRoadPickups: 1, onRoadPickupsDone: 1, packageCount: 1 }).lean() as any[];
        const routeBy = new Map(routes.map((r) => [String(r.transporterId).toUpperCase(), r]));
        const tids = stats.map((s) => String(s.transporterId).toUpperCase());
        const emps = tids.length ? await orgWide(SymxEmployee.find({ transporterId: { $in: tids } }, { transporterId: 1, firstName: 1, lastName: 1 }), "name drivers on day detail").lean() as any[] : [];
        const nameBy = new Map(emps.map((e: any) => [String(e.transporterId).toUpperCase(), `${e.firstName || ""} ${e.lastName || ""}`.trim()]));

        const rows = stats.map((s) => {
            const t = String(s.transporterId).toUpperCase();
            const r = routeBy.get(t);
            const by = s.deliveredBy || {};
            const total = Object.values(by).reduce((a: number, b: any) => a + Number(b), 0) as number;
            const pct = (k: string) => (total ? Math.round(((by[k] || 0) / total) * 100) : 0);
            return {
                tid: t, name: nameBy.get(t) || r?.employeeName || t,
                routeCode: r?.routeNumber || s.routeCode, wst: r?.wst || "",
                stops: s.stops, packages: s.packages, stopsPerHour: s.stopsPerHour, avgGapMin: s.avgGapMin,
                avgDeltaMin: s.avgDeltaMin, endDeltaMin: s.endDeltaMin, worstDeltaMin: s.worstDeltaMin, onTimePct: s.onTimePct,
                shiftHours: s.shiftHours,
                meal: { flag: s.mealFlag, startMin: s.mealStartMin, minutes: s.mealMinutes, afterStop: s.mealAfterStop },
                rest: { flag: s.restFlag, count: s.restCount, expected: s.restExpected },
                quality: { doorstepPct: pct("DOORSTEP"), receptionistPct: pct("RECEPTIONIST"), householdPct: pct("HOUSEHOLD_MEMBER"), notDelivered: s.notDelivered || 0, pickupFailed: s.pickupFailed || 0, by },
                pickups: r?.onRoadPickups || 0, pickupsDone: r?.onRoadPickupsDone || 0,
            };
        }).sort((a, b) => b.endDeltaMin - a.endDeltaMin);

        const n = rows.length || 1;
        return NextResponse.json({
            date, rows,
            kpi: {
                drivers: rows.length,
                avgStopsPerHour: Math.round((rows.reduce((a, r) => a + r.stopsPerHour, 0) / n) * 10) / 10,
                behindAtEnd: rows.filter((r) => r.endDeltaMin > 15).length,
                mealIssues: rows.filter((r) => ["late", "short", "missing"].includes(r.meal.flag)).length,
                restIssues: rows.filter((r) => r.rest.flag === "missing").length,
                pickups: rows.reduce((a, r) => a + r.pickups, 0),
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
