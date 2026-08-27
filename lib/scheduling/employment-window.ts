// ── When is an employee actually schedulable? ─────────────────────────
//
// A schedule row should exist for a day only if the person was employed
// on that day. Generating rows before someone's hire date or after they
// left is not merely untidy: those rows carry theory hours, so they show
// up in labour cost, in headcount averages and in the timecard audit as
// days a person "should" have worked.
//
// One helper rather than a status check at each call site, because the
// three rules interact — a terminated employee has a last day, a rehire
// has a new first day, and "Active" alone tells you neither.

/** Statuses that mean this person is not currently working. */
const NON_WORKING_STATUSES = new Set([
  "terminated",
  "resigned",
  "inactive",
  "on leave",
  "loa",
]);

export interface EmploymentDates {
  status?: string;
  hiredDate?: Date | string | null;
  terminationDate?: Date | string | null;
  resignationDate?: Date | string | null;
  /**
   * When someone inactive was made active again. Schedules resume from
   * this day forward, NOT from their original hire date — backfilling a
   * rehire's dormant months would invent history.
   */
  reactivatedDate?: Date | string | null;
}

function asDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Midnight UTC, so comparisons are day-level and not affected by time. */
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Is this person in a status that should appear on a schedule at all? */
export function isSchedulableStatus(status?: string): boolean {
  return !NON_WORKING_STATUSES.has(String(status || "").trim().toLowerCase());
}

/**
 * The first and last day this person should have schedule rows.
 *
 * `from` is the later of their hire date and any reactivation, because a
 * rehire starts fresh. `to` is the earlier of termination and resignation
 * when either is set — whichever came first is the day they stopped.
 *
 * Nulls mean unbounded: an employee with no hire date recorded is treated
 * as always having been here, which is the pre-existing behaviour and
 * safer than refusing to schedule them.
 */
export function employmentWindow(emp: EmploymentDates): {
  from: Date | null;
  to: Date | null;
} {
  const hired = asDate(emp.hiredDate);
  const reactivated = asDate(emp.reactivatedDate);
  const terminated = asDate(emp.terminationDate);
  const resigned = asDate(emp.resignationDate);

  let from: Date | null = hired;
  if (reactivated && (!from || reactivated > from)) from = reactivated;

  let to: Date | null = null;
  for (const d of [terminated, resigned]) {
    if (d && (!to || d < to)) to = d;
  }

  return {
    from: from ? startOfDay(from) : null,
    to: to ? startOfDay(to) : null,
  };
}

/**
 * Should this employee have a schedule row on this date?
 *
 * Combines status and dates. A terminated employee whose termination date
 * is in the past is excluded outright; one terminated with a FUTURE date
 * still gets rows up to that day, because they are still working until
 * then and their shifts still need covering.
 */
export function isScheduledOn(emp: EmploymentDates, date: Date | string): boolean {
  const d = asDate(date);
  if (!d) return false;
  const day = startOfDay(d);
  const { from, to } = employmentWindow(emp);

  if (from && day < from) return false;
  if (to && day > to) return false;

  // Status is checked LAST and only when there is no end date, because a
  // terminated employee with a recorded last day is handled precisely by
  // the window above — status alone would wrongly erase the days they did
  // work before leaving.
  if (!to && !isSchedulableStatus(emp.status)) return false;

  return true;
}

/** Filter a week's dates down to the days this person was employed. */
export function schedulableDates(emp: EmploymentDates, dates: Date[]): Date[] {
  return dates.filter((d) => isScheduledOn(emp, d));
}
