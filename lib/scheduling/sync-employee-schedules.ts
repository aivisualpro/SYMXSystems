import mongoose from "mongoose";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";
import RouteType, { routeTypeStartTime } from "@/lib/models/RouteType";
import { getWeekDates } from "@/lib/schedule-generation";
import { isScheduledOn, isSchedulableStatus } from "./employment-window";

// ── Keep one employee's schedule rows in step with their record ───────
//
// Adding someone used to leave them invisible until a human remembered to
// regenerate the week, which is how a new hire ends up with no shifts and
// nobody notices until the day they turn up.
//
// This fills in the weeks that ALREADY EXIST at their station — it does
// not create new weeks. Generating week 40 because someone was hired in
// week 35 would invent a schedule nobody asked for.

const DAY_FIELDS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;
const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export interface SyncResult {
  created: number;
  removed: number;
  weeks: string[];
}

/**
 * Create the rows this employee should have, and remove ones they should
 * not.
 *
 * Removal is deliberately narrow: only FUTURE rows, and only where nothing
 * has been recorded against them. A past shift is a fact about what
 * happened, and a future one someone has already messaged about or marked
 * off is a decision — deleting either because a status changed today
 * would erase work rather than tidy up.
 */
export async function syncEmployeeSchedules(
  employee: {
    _id: any;
    transporterId?: string;
    status?: string;
    primarySiteId?: any;
    hiredDate?: any;
    terminationDate?: any;
    resignationDate?: any;
    reactivatedDate?: any;
    [key: string]: any;
  },
  opts: { userId?: string } = {}
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, removed: 0, weeks: [] };

  if (!employee?.transporterId || !employee.primarySiteId) return result;
  const siteId = employee.primarySiteId;

  // Weeks that exist at this station. Nothing is created beyond these.
  const weeks = await SymxAvailableWeek.find({ siteId }, { week: 1 }).lean();
  if (weeks.length === 0) return result;

  const weekKeys = (weeks as any[]).map((w) => w.week).filter(Boolean);

  const existing = await SymxEmployeeSchedule.find(
    { transporterId: employee.transporterId, yearWeek: { $in: weekKeys }, siteId },
    { yearWeek: 1, date: 1, status: 1, shiftNotification: 1, futureShift: 1, weekConfirmation: 1 }
  ).lean();

  const haveByDay = new Set(
    (existing as any[]).map((r) => `${r.yearWeek}|${new Date(r.date).toISOString().slice(0, 10)}`)
  );

  const routeTypes = await RouteType.find({}).lean();
  const rtById = new Map((routeTypes as any[]).map((rt) => [String(rt._id), rt]));
  const offType = (routeTypes as any[]).find(
    (rt) => String(rt.name || "").trim().toLowerCase() === "off"
  );

  const userObjectId =
    opts.userId && /^[a-f\d]{24}$/i.test(opts.userId)
      ? new mongoose.Types.ObjectId(opts.userId)
      : undefined;

  const toCreate: any[] = [];

  for (const yearWeek of weekKeys) {
    const dates = getWeekDates(yearWeek);
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const key = `${yearWeek}|${date.toISOString().slice(0, 10)}`;
      if (haveByDay.has(key)) continue;
      if (!isScheduledOn(employee as any, date)) continue;

      const dayId = employee[DAY_FIELDS[i]] ? String(employee[DAY_FIELDS[i]]) : null;
      const matched = dayId ? rtById.get(dayId) : null;
      const typeId = matched?._id
        ? String(matched._id)
        : offType?._id
        ? String(offType._id)
        : undefined;

      toCreate.push({
        transporterId: employee.transporterId,
        siteId,
        employeeId: employee._id,
        weekDay: DAY_NAMES[i],
        yearWeek,
        date,
        typeId,
        startTime: routeTypeStartTime(matched, siteId),
        dayBeforeConfirmation: "",
        dayOfConfirmation: "",
        weekConfirmation: "",
        van: "",
        ...(userObjectId ? { createdBy: userObjectId } : {}),
      });
      if (!result.weeks.includes(yearWeek)) result.weeks.push(yearWeek);
    }
  }

  if (toCreate.length > 0) {
    await SymxEmployeeSchedule.insertMany(toCreate, { ordered: false });
    result.created = toCreate.length;
  }

  // ── Remove rows they should no longer have ──
  // Only future, only untouched. Anything already messaged about,
  // confirmed, or given a status represents a decision someone made.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const removable = (existing as any[]).filter((r) => {
    const d = new Date(r.date);
    if (d < today) return false;
    if (isScheduledOn(employee as any, d)) return false;
    const untouched =
      !r.status &&
      !(r.shiftNotification || []).length &&
      !(r.futureShift || []).length &&
      !r.weekConfirmation;
    return untouched;
  });

  if (removable.length > 0) {
    await SymxEmployeeSchedule.deleteMany({
      _id: { $in: removable.map((r: any) => r._id) },
    });
    result.removed = removable.length;
  }

  return result;
}

/** True when a status change should trigger a resync. */
export function statusChangeNeedsSync(before?: string, after?: string): boolean {
  if (before === after) return false;
  return isSchedulableStatus(before) !== isSchedulableStatus(after);
}
