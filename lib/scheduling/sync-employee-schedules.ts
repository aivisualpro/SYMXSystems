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
  /** Why nothing happened, when nothing happened for a fixable reason. */
  skippedReason?: string;
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
  opts: {
    userId?: string;
    /**
     * The transporter ID this employee had before the update, when it
     * changed. Their existing rows are keyed by the OLD value, so without
     * this a correction would leave the old rows stranded and the person
     * would appear twice on the schedule — once under each ID.
     */
    previousTransporterId?: string;
    /**
     * The employee's primarySiteId before this update, when it changed.
     * A station transfer moves the roster forward, not history — past
     * rows at the old station stay put on purpose. But a FUTURE row at
     * the old station that nobody has messaged about or confirmed is not
     * history, it's a leftover default. Left alone, the employee reads as
     * scheduled at BOTH stations for the same day, and — before the
     * {transporterId,date,siteId} compound index (migration 15) — a
     * generate-week at the new station for that date would even collide
     * on the old global {transporterId,date} unique index with a raw
     * E11000 surfaced straight to whoever clicked Generate.
     */
    previousSiteId?: string;
  } = {}
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, removed: 0, weeks: [] };

  // Both are required, and their absence is worth naming rather than
  // returning quietly: schedules are keyed by transporterId, so an
  // employee without one cannot be scheduled at all — and the person who
  // just created them has no way to know that from silence.
  if (!employee?.transporterId) {
    result.skippedReason = "no Transporter ID — schedules are keyed by it";
    return result;
  }
  if (!employee.primarySiteId) {
    result.skippedReason = "no home station set";
    return result;
  }
  const siteId = employee.primarySiteId;

  // ── Follow a corrected transporter ID ──
  // The ID is the schedule key, so changing it orphans every row the
  // person already has. They are the same employee either way, and
  // employeeId proves it, so the rows move rather than being abandoned.
  const prev = String(opts.previousTransporterId || "").trim();
  if (prev && prev !== employee.transporterId) {
    // Refuse a partial rename: the {transporterId, date} index is unique,
    // so if anything already sits under the new ID an updateMany would
    // abort midway and leave the rows split across both IDs — worse than
    // not moving them and saying so.
    const collision = await SymxEmployeeSchedule.countDocuments({
      transporterId: employee.transporterId,
    });
    if (collision > 0) {
      result.skippedReason =
        `transporter ID changed from ${prev}, but rows already exist under ` +
        `${employee.transporterId} — the old rows were left in place to avoid ` +
        `a partial rename. Merge them by hand.`;
    } else {
      // Match on employeeId where it is present, since that survives an ID
      // change; fall back to the old ID for rows predating that field.
      const moved = await SymxEmployeeSchedule.updateMany(
        employee._id
          ? { $or: [{ employeeId: employee._id }, { transporterId: prev }] }
          : { transporterId: prev },
        { $set: { transporterId: employee.transporterId } }
      );
      if (moved.modifiedCount) {
        console.log(
          `[schedules] Moved ${moved.modifiedCount} row(s) from ${prev} to ${employee.transporterId}`
        );
      }
    }
  }

  // Weeks that exist at this station. Nothing is created beyond these.
  const weeks = await SymxAvailableWeek.find({ siteId }, { week: 1 }).lean();
  if (weeks.length === 0) {
    // Not an error — a new station legitimately has no weeks yet — but
    // silence here reads exactly like a failure to the person who just
    // added an employee and is waiting for their shifts to appear.
    result.skippedReason =
      "this station has no schedule weeks yet — generate a week first, and " +
      "the employee will be included";
    return result;
  }

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

  // ── Also clean up stale FUTURE rows at the OLD station, on a transfer ──
  // These are not history — they're leftover defaults from before the
  // move that nobody has acted on. Scoped by date only, not weekKeys: the
  // old station may have already generated weeks further out than the
  // new one has, and any of those are just as stale. Without this, the
  // employee reads as scheduled at BOTH stations for the same day, and
  // (pre migration 15) a generate-week at the new station for that date
  // collided on the old global {transporterId,date} index with a raw
  // E11000 surfaced straight to whoever clicked Generate.
  if (opts.previousSiteId && String(opts.previousSiteId) !== String(siteId)) {
    const staleAtOldStation = await SymxEmployeeSchedule.find(
      { transporterId: employee.transporterId, siteId: opts.previousSiteId, date: { $gte: today } },
      { date: 1, status: 1, shiftNotification: 1, futureShift: 1, weekConfirmation: 1 }
    ).lean();

    const staleRemovable = (staleAtOldStation as any[]).filter((r: any) => {
      return (
        !r.status &&
        !(r.shiftNotification || []).length &&
        !(r.futureShift || []).length &&
        !r.weekConfirmation
      );
    });

    if (staleRemovable.length > 0) {
      await SymxEmployeeSchedule.deleteMany({
        _id: { $in: staleRemovable.map((r: any) => r._id) },
      });
      result.removed += staleRemovable.length;
    }
  }

  return result;
}

/** True when a status change should trigger a resync. */
export function statusChangeNeedsSync(before?: string, after?: string): boolean {
  if (before === after) return false;
  return isSchedulableStatus(before) !== isSchedulableStatus(after);
}
