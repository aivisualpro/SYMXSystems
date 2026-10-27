import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { authorizeAction } from "@/lib/rbac";
import { getRequestScope, siteFilter, resolveWriteSiteId, findScopedById } from "@/lib/scoped-query";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import ScheduleStartOverride from "@/lib/models/ScheduleStartOverride";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import RouteType from "@/lib/models/RouteType";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** GET ?dates=2026-10-25,2026-10-26 → { overrides: [{ date, typeId, startTime }] } */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "view");
  } catch (e: any) {
    return NextResponse.json({ error: e.name === "ForbiddenError" ? e.message : "Unauthorized" }, { status: e.name === "ForbiddenError" ? 403 : 401 });
  }
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    const S = siteFilter(scope, { includeUnassigned: true });
    const dates = (new URL(req.url).searchParams.get("dates") || "").split(",").filter((d) => DATE_RE.test(d));
    if (!dates.length) return NextResponse.json({ overrides: [] });
    const rows = (await ScheduleStartOverride.find({ date: { $in: dates }, ...S }, { date: 1, typeId: 1, startTime: 1 }).lean()) as any[];
    return NextResponse.json({ overrides: rows.map((r) => ({ date: r.date, typeId: r.typeId, startTime: r.startTime })) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

/**
 * POST { scope: "person" | "all", date, typeId, startTime, scheduleId?, reset? }
 *  - person: change this one schedule row's start time only.
 *  - all:    set the start time for everyone on that type that day AND remember it,
 *            so later assignments to that type that day use it. reset=true removes the
 *            remembered time and puts the type's default back.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "edit");
  } catch (e: any) {
    return NextResponse.json({ error: e.name === "ForbiddenError" ? e.message : "Unauthorized" }, { status: e.name === "ForbiddenError" ? 403 : 401 });
  }
  try {
    const auth = await authorizeAction("Scheduling", "edit");
    if (!auth.authorized) return auth.response;
    await connectToDatabase();
    const scope = await getRequestScope();
    const S = siteFilter(scope, { includeUnassigned: true });

    const body = await req.json().catch(() => ({}));
    const mode = body.scope === "all" ? "all" : "person";
    const startTime = String(body.startTime || "").trim();
    const reset = !!body.reset;
    const performedBy = (auth as any).session?.email || (auth as any).session?.user?.email || "";

    if (mode === "person") {
      if (!body.scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
      if (!startTime) return NextResponse.json({ error: "Enter a start time" }, { status: 400 });
      const existing = (await findScopedById<any>(SymxEmployeeSchedule, body.scheduleId, scope)) as any;
      if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
      await SymxEmployeeSchedule.updateOne({ _id: existing._id }, { $set: { startTime } });
      const dateObj = existing.date ? new Date(existing.date) : null;
      await ScheduleAuditLog.create({
        yearWeek: existing.yearWeek || "",
        transporterId: existing.transporterId,
        employeeName: body.employeeName || "",
        action: "start_time_changed",
        field: "startTime",
        oldValue: existing.startTime || "",
        newValue: startTime,
        date: existing.date,
        dayOfWeek: dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "",
        performedBy,
        performedByName: performedBy,
      });
      return NextResponse.json({ success: true, updated: 1 });
    }

    // mode === "all"
    const date = String(body.date || "");
    const typeId = String(body.typeId || "");
    if (!DATE_RE.test(date) || !typeId) return NextResponse.json({ error: "date and typeId required" }, { status: 400 });
    if (!reset && !startTime) return NextResponse.json({ error: "Enter a start time" }, { status: 400 });

    let siteId = resolveWriteSiteId(scope, null);
    if (!siteId && body.scheduleId) {
      const ref = (await findScopedById<any>(SymxEmployeeSchedule, body.scheduleId, scope)) as any;
      if (ref?.siteId) siteId = String(ref.siteId);
    }
    if (!siteId) return NextResponse.json({ error: "Pick a single station first" }, { status: 400 });

    let newTime = startTime;
    if (reset) {
      await ScheduleStartOverride.deleteOne({ siteId, date, typeId } as any);
      const rt = (await RouteType.findById(typeId, { startTime: 1 }).lean()) as any;
      newTime = rt?.startTime || "";
    } else {
      await ScheduleStartOverride.updateOne(
        { siteId, date, typeId } as any,
        { $set: { startTime: newTime, updatedBy: performedBy } },
        { upsert: true }
      );
    }

    const res = await SymxEmployeeSchedule.updateMany(
      {
        ...S,
        siteId,
        typeId,
        date: { $gte: new Date(date + "T00:00:00.000Z"), $lte: new Date(date + "T23:59:59.999Z") },
      } as any,
      { $set: { startTime: newTime } }
    );
    return NextResponse.json({ success: true, updated: res.modifiedCount ?? 0, startTime: newTime });
  } catch (e: any) {
    console.error("[schedules/start-time]", e);
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
