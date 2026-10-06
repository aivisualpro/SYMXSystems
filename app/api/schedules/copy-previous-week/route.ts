import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { authorizeAction } from "@/lib/rbac";
import connectToDatabase from "@/lib/db";
import { getRequestScope, resolveWriteSiteId } from "@/lib/scoped-query";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SYMXRoute from "@/lib/models/SYMXRoute";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import RouteType, { routeTypeStartTime } from "@/lib/models/RouteType";
import SymxUser from "@/lib/models/SymxUser";

// Same session-name-then-DB fallback the main schedules route uses for audit entries.
async function resolvePerformer(session: any): Promise<{ email: string; name: string }> {
  const email = session?.email || "unknown";
  if (session?.name && session.name.length > 1) return { email, name: session.name };
  try {
    const user = await SymxUser.findOne({ email: email.toLowerCase() }, { name: 1 }).lean() as any;
    if (user?.name) return { email, name: user.name };
  } catch { }
  return { email, name: email };
}

const bodySchema = z.object({ yearWeek: z.string().regex(/^\d{4}-W\d{2}$/) });

// Same previous-week rule the GET handler uses for its trailing-days check.
function prevYearWeekOf(yearWeek: string): string {
  const m = yearWeek.match(/(\d{4})-W(\d{2})/)!;
  let yr = parseInt(m[1]);
  let wk = parseInt(m[2]) - 1;
  if (wk <= 0) { yr--; wk = 52; }
  return `${yr}-W${String(wk).padStart(2, "0")}`;
}

// POST /api/schedules/copy-previous-week — { yearWeek }
// Copies each driver's shift TYPE (and its start time) from the same weekday
// of the previous week onto this week, for the one station in view. Only
// touches days where last week actually had a shift type set; everything else
// is left exactly as it is. Start times are re-resolved from this station's
// current Default Routes (not copied blindly) unless the shift is a
// cross-station label, which keeps the other station's start time.
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Scheduling", "edit");
    if (!auth.authorized) return auth.response;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "A valid yearWeek is required" }, { status: 400 });
    const { yearWeek } = parsed.data;
    const prevYearWeek = prevYearWeekOf(yearWeek);

    await connectToDatabase();
    const scope = await getRequestScope();
    const siteId = resolveWriteSiteId(scope, null);
    if (!siteId) {
      return NextResponse.json({ error: "Select a single station before copying last week's schedule." }, { status: 400 });
    }
    const siteObjectId = new mongoose.Types.ObjectId(siteId);

    const [thisWeek, lastWeek, routeTypes] = await Promise.all([
      SymxEmployeeSchedule.find({ yearWeek, siteId: siteObjectId }).lean() as Promise<any[]>,
      SymxEmployeeSchedule.find({ yearWeek: prevYearWeek, siteId: siteObjectId }).lean() as Promise<any[]>,
      RouteType.find({}).lean() as Promise<any[]>,
    ]);

    if (thisWeek.length === 0) {
      return NextResponse.json({ error: "This week has no schedule yet — generate it first." }, { status: 400 });
    }
    if (lastWeek.length === 0) {
      return NextResponse.json({ error: `No schedule found for ${prevYearWeek} at this station.` }, { status: 404 });
    }

    const rtById = new Map(routeTypes.map((rt) => [String(rt._id), rt]));
    const key = (tid: string, d: Date) => `${tid}|${new Date(d).getUTCDay()}`;
    const lastByKey = new Map<string, any>();
    for (const s of lastWeek) if (s.typeId && rtById.has(String(s.typeId))) lastByKey.set(key(s.transporterId, s.date), s);

    const performer = await resolvePerformer(auth.session);
    const scheduleOps: any[] = [];
    const routeOps: any[] = [];
    const auditDocs: any[] = [];
    const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const cur of thisWeek) {
      const prev = lastByKey.get(key(cur.transporterId, cur.date));
      if (!prev) continue;
      const rt = rtById.get(String(prev.typeId))!;
      const isCross = !!prev.crossStationSiteId;
      const startTime = isCross ? (prev.startTime || "") : routeTypeStartTime(rt, siteId);
      const crossStationSiteId = isCross ? prev.crossStationSiteId : "";

      // Skip no-ops so the audit log only shows real changes.
      if (
        String(cur.typeId || "") === String(prev.typeId) &&
        (cur.startTime || "") === startTime &&
        (cur.crossStationSiteId || "") === crossStationSiteId
      ) continue;

      scheduleOps.push({
        updateOne: { filter: { _id: cur._id }, update: { $set: { typeId: String(prev.typeId), startTime, crossStationSiteId } } },
      });

      const isOff = (rt.routeStatus || "").trim().toLowerCase() === "off";
      if (!isOff) {
        routeOps.push({
          updateOne: {
            filter: { transporterId: cur.transporterId, date: cur.date, siteId: siteObjectId },
            update: { $set: { typeId: String(prev.typeId), scheduleId: String(cur._id), weekDay: cur.weekDay || "", yearWeek } },
          },
        });
      }

      const oldRt = cur.typeId ? rtById.get(String(cur.typeId)) : null;
      auditDocs.push({
        yearWeek,
        transporterId: cur.transporterId,
        employeeName: "",
        action: "type_changed",
        field: "type",
        oldValue: oldRt?.name || "",
        newValue: `${rt.name}${startTime ? ` (${startTime})` : ""} — copied from ${prevYearWeek}`,
        date: cur.date,
        dayOfWeek: FULL_DAYS[new Date(cur.date).getUTCDay()],
        performedBy: performer.email,
        performedByName: performer.name,
      });
    }

    if (scheduleOps.length > 0) await SymxEmployeeSchedule.bulkWrite(scheduleOps, { ordered: false });
    if (routeOps.length > 0) await SYMXRoute.bulkWrite(routeOps, { ordered: false });
    if (auditDocs.length > 0) await ScheduleAuditLog.insertMany(auditDocs);

    return NextResponse.json({ updated: scheduleOps.length, from: prevYearWeek });
  } catch (error: any) {
    console.error("Error copying previous week:", error);
    return NextResponse.json({ error: error.message || "Failed to copy previous week" }, { status: 500 });
  }
}
