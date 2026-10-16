import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, orgWide } from "@/lib/scoped-query";
import RouteDayStats from "@/lib/models/RouteDayStats";
import SymxEmployee from "@/lib/models/SymxEmployee";

const pacificDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MIN_STOPS = 8; // a driver needs this many stops in a zip before we judge them there

// GET ?days=30 — delivery areas (zip) with how drivers perform in each, as minutes behind/ahead of plan per stop.
export async function GET(req: NextRequest) {
    try { await requirePermission("Performance", "view"); }
    catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const days = Math.min(120, Math.max(7, parseInt(new URL(req.url).searchParams.get("days") || "30", 10) || 30));
        const since = addDays(pacificDay(), -(days - 1));
        const rows = await RouteDayStats.find({ ...siteFilter(scope), date: { $gte: since } }, { transporterId: 1, date: 1, areas: 1, avgDeltaMin: 1 }).lean() as any[];

        const tids = [...new Set(rows.map((r) => String(r.transporterId).toUpperCase()))];
        const emps = tids.length ? await orgWide(SymxEmployee.find({ transporterId: { $in: tids } }, { transporterId: 1, firstName: 1, lastName: 1 }), "name drivers on area report").lean() as any[] : [];
        const nameBy = new Map(emps.map((e: any) => [String(e.transporterId).toUpperCase(), `${e.firstName || ""} ${e.lastName || ""}`.trim()]));

        // Each driver's own average pace, so an area is judged relative to the driver (fair to slow/fast drivers).
        const drv = new Map<string, { sum: number; stops: number }>();
        rows.forEach((r) => (r.areas || []).forEach((a: any) => {
            const t = String(r.transporterId).toUpperCase();
            const d = drv.get(t) || drv.set(t, { sum: 0, stops: 0 }).get(t)!;
            d.sum += a.deltaSum; d.stops += a.stops;
        }));
        const drvAvg = (t: string) => { const d = drv.get(t); return d && d.stops ? d.sum / d.stops : 0; };

        const zips = new Map<string, { zip: string; city: string; stops: number; packages: number; sum: number; drivers: Map<string, { stops: number; sum: number; days: Set<string> }> }>();
        rows.forEach((r) => (r.areas || []).forEach((a: any) => {
            const t = String(r.transporterId).toUpperCase();
            const z = zips.get(a.zip) || zips.set(a.zip, { zip: a.zip, city: a.city || "", stops: 0, packages: 0, sum: 0, drivers: new Map() }).get(a.zip)!;
            if (!z.city && a.city) z.city = a.city;
            z.stops += a.stops; z.packages += a.packages; z.sum += a.deltaSum;
            const d = z.drivers.get(t) || z.drivers.set(t, { stops: 0, sum: 0, days: new Set() }).get(t)!;
            d.stops += a.stops; d.sum += a.deltaSum; d.days.add(r.date);
        }));

        const areas = [...zips.values()].map((z) => ({
            zip: z.zip, city: z.city, stops: z.stops, packages: z.packages,
            avgDeltaMin: Math.round((z.sum / Math.max(1, z.stops)) * 10) / 10,
            drivers: [...z.drivers.entries()].map(([t, d]) => ({
                tid: t, name: nameBy.get(t) || t, stops: d.stops, days: d.days.size,
                avgDeltaMin: Math.round((d.sum / d.stops) * 10) / 10,
                // negative = faster here than they usually are
                vsOwnAvg: Math.round((d.sum / d.stops - drvAvg(t)) * 10) / 10,
                enough: d.stops >= MIN_STOPS,
            })).sort((a, b) => a.vsOwnAvg - b.vsOwnAvg),
        })).sort((a, b) => b.stops - a.stops);

        return NextResponse.json({ days, minStops: MIN_STOPS, areas, hasData: areas.length > 0 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
