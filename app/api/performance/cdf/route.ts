import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import CdfFeedback from "@/lib/models/CdfFeedback";
import SYMXRoute from "@/lib/models/SYMXRoute";

async function guard(level: "view" | "edit") {
    try {
        await requirePermission("Performance", level);
        return null;
    } catch (e: any) {
        if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

const NOT_WORKING = new Set(["off", "call out", "callout", "reduction", "vto", "no show", "ncns"]);
const pacificDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// GET ?days=30 — every negative feedback item in the window, each tagged with
// whether that driver is working today (so dispatch knows who to talk to now).
export async function GET(req: NextRequest) {
    const denied = await guard("view");
    if (denied) return denied;
    try {
        await connectToDatabase();
        const scope = await getRequestScope();
        const S = siteFilter(scope);
        const { searchParams } = new URL(req.url);
        const days = Math.min(120, Math.max(1, parseInt(searchParams.get("days") || "30", 10) || 30));
        const today = pacificDay();
        const since = pacificDay(new Date(Date.now() - days * 86400000));

        const items = await CdfFeedback.find({ ...S, deliveryDate: { $gte: since } }).sort({ deliveryDate: -1, deliveredAt: -1 }).lean() as any[];

        const tids = [...new Set(items.map((i) => i.transporterId).filter(Boolean))];
        const todayRoutes = tids.length
            ? await SYMXRoute.find(
                { ...S, date: new Date(`${today}T00:00:00.000Z`), transporterId: { $in: tids } },
                { transporterId: 1, type: 1, routeNumber: 1, waveTime: 1, attendance: 1 }
            ).lean() as any[]
            : [];
        const todayBy = new Map<string, any>();
        todayRoutes.forEach((r) => todayBy.set(String(r.transporterId).trim().toUpperCase(), r));

        const counts: Record<string, number> = {};
        items.forEach((i) => { counts[i.transporterId] = (counts[i.transporterId] || 0) + 1; });

        return NextResponse.json({
            today,
            items: items.map((i) => {
                const r = todayBy.get(String(i.transporterId).trim().toUpperCase());
                const type = String(r?.type || "").trim();
                const absent = String(r?.attendance || "").toLowerCase() === "absent";
                const working = !!r && !!type && !NOT_WORKING.has(type.toLowerCase()) && !absent;
                return {
                    ...i,
                    _id: String(i._id),
                    siteId: i.siteId ? String(i.siteId) : "",
                    driverCount: counts[i.transporterId] || 1,
                    today: r ? { working, type, routeNumber: r.routeNumber || "", waveTime: r.waveTime || "", absent } : { working: false, type: "", routeNumber: "", waveTime: "", absent: false },
                };
            }),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}

// PATCH { id, status, outcome?, note? } — record that the matter was (or was not) discussed.
export async function PATCH(req: NextRequest) {
    const denied = await guard("edit");
    if (denied) return denied;
    try {
        const session: any = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const id = String(body.id || "");
        const status = String(body.status || "");
        if (!id || !["open", "discussed", "dismissed"].includes(status)) {
            return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
        }
        await connectToDatabase();
        const scope = await getRequestScope();
        const S = siteFilter(scope);
        const set: any = { status, outcome: String(body.outcome || ""), note: String(body.note || "").slice(0, 2000) };
        if (status === "open") {
            set.discussedAt = undefined; set.discussedBy = ""; set.discussedById = "";
        } else {
            set.discussedAt = new Date();
            set.discussedBy = session.name || session.email || "Staff";
            set.discussedById = String(session.userId || session.id || "");
        }
        const updated = await CdfFeedback.findOneAndUpdate({ _id: id, ...S }, { $set: set }, { new: true }).lean();
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
    }
}
