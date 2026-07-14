// ── Timecard Audit rule engine ──────────────────────────────────────────────
// Pure functions that compare the punch/attendance data already captured on
// SYMXRoute against California meal-period law and internal cross-source
// consistency, for a single employee/day. No I/O here — the API route pulls
// the raw route + employee records and hands them to auditDay().
//
// CA meal period rules encoded here (Labor Code 512 / IWC Wage Orders, matches
// SYMX's own employee timesheet certification text):
//   - 1st 30-min unpaid meal period required once the workday exceeds 5 hours,
//     and must BEGIN no later than the end of the 5th hour worked.
//   - 2nd 30-min unpaid meal period required once the workday exceeds 10 hours.
//     Can be waived by mutual written consent ONLY if total hours worked that
//     day do not exceed 12 — cannot be waived at all past 12 hours.
//   - Violation of either meal rule entitles the employee to 1 additional hour
//     of pay at their regular rate, per violation type, per workday (max 2
//     meal-premium hours/day). This module can only compute the MEAL side of
//     that — rest breaks (10 min paid, ~every 4 hrs) are never independently
//     punched anywhere in Paycom/SYMX, so they cannot be audited from data;
//     see REST_BREAK_NOTE below for the static reminder to show instead.
//
// Data is stored as 24-hour "HH:MM" strings throughout SYMXRoute (see
// app/api/dispatching/time/punch-import/route.ts for the same convention).

export type ViolationSeverity = "violation" | "warning" | "info";

export interface Violation {
  code: string;
  severity: ViolationSeverity;
  message: string;
}

export interface DayInput {
  date: string; // ISO date, "day" this record is for
  attendance?: string; // "Present" | "Absent" | ""
  attendanceTime?: string;
  paycomInDay?: string;
  paycomOutLunch?: string;
  paycomInLunch?: string;
  paycomOutDay?: string;
  amazonOutLunch?: string;
  amazonInLunch?: string;
  amazonAppLogout?: string;
  inspectionTime?: string;
}

export interface DayAudit {
  violations: Violation[];
  mealPremiumHours: number; // 0, 1, or 2 — estimated meal-only premium pay owed for this day
}

export const REST_BREAK_NOTE =
  "Rest breaks (10 min paid, roughly every 4 hrs) aren't independently punched anywhere in Paycom or SYMX — CA law only requires they be authorized and permitted, not clocked. This audit can't verify them from data; confirm separately per company policy.";

function toMinutes(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function fmtDuration(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function auditDay(
  day: DayInput,
  employee: { mealWaiverFile?: string },
  opts: { isToday: boolean; isFuture: boolean }
): DayAudit {
  const violations: Violation[] = [];
  let mealPremiumHours = 0;

  const inDay = toMinutes(day.paycomInDay);
  const outLunch = toMinutes(day.paycomOutLunch);
  const inLunch = toMinutes(day.paycomInLunch);
  const outDay = toMinutes(day.paycomOutDay);
  const attMin = toMinutes(day.attendanceTime);
  const amzOutLunch = toMinutes(day.amazonOutLunch);
  const amzInLunch = toMinutes(day.amazonInLunch);
  const amzLogout = toMinutes(day.amazonAppLogout);
  const inspection = toMinutes(day.inspectionTime);

  const worked = day.attendance === "Present" || inDay !== null;
  if (!worked || opts.isFuture) {
    return { violations, mealPremiumHours: 0 };
  }

  // ── Missing punches (only meaningful once the day is actually over) ──
  if (!opts.isToday) {
    const missing: string[] = [];
    if (inDay === null) missing.push("In Day");
    if (outLunch === null) missing.push("Out Lunch");
    if (inLunch === null) missing.push("In Lunch");
    if (outDay === null) missing.push("Out Day");
    if (missing.length > 0) {
      violations.push({
        code: "missing_punch",
        severity: "warning",
        message: `Missing punch${missing.length > 1 ? "es" : ""}: ${missing.join(", ")}`,
      });
    }
  }

  // ── 1st meal period: must begin by end of 5th hour worked ──
  if (inDay !== null && outLunch !== null) {
    const toLunch = outLunch - inDay;
    if (toLunch > 300) {
      violations.push({
        code: "meal1_late",
        severity: "violation",
        message: `1st meal period started ${fmtDuration(toLunch)} after clock-in — must begin by end of 5th hour (300 min)`,
      });
      mealPremiumHours = Math.min(2, mealPremiumHours + 1);
    }
  }

  // ── 1st meal period: must be at least 30 min ──
  if (outLunch !== null && inLunch !== null) {
    const mealLen = inLunch - outLunch;
    if (mealLen >= 0 && mealLen < 30) {
      violations.push({
        code: "meal1_short",
        severity: "violation",
        message: `Meal period only ${fmtDuration(mealLen)} — must be at least 30 min`,
      });
      mealPremiumHours = Math.min(2, mealPremiumHours + 1);
    } else if (mealLen < 0) {
      violations.push({
        code: "meal1_order",
        severity: "warning",
        message: "In Lunch punch is earlier than Out Lunch punch — check for a data entry error",
      });
    }
  }

  // ── 2nd meal period (shift > 10 hrs) ──
  if (inDay !== null && outDay !== null) {
    const shiftLen = outDay - inDay;
    if (shiftLen > 720) {
      violations.push({
        code: "meal2_over12",
        severity: "violation",
        message: `Shift was ${fmtDuration(shiftLen)} — over 12 hrs, the 2nd meal period cannot legally be waived regardless of any waiver on file. Verify a 2nd meal was actually taken.`,
      });
      mealPremiumHours = Math.min(2, mealPremiumHours + 1);
    } else if (shiftLen > 600) {
      if (employee.mealWaiverFile) {
        violations.push({
          code: "meal2_waived",
          severity: "info",
          message: `Shift was ${fmtDuration(shiftLen)} — over 10 hrs. Signed 2nd meal period waiver is on file for this employee; confirm it still applies.`,
        });
      } else {
        violations.push({
          code: "meal2_missing",
          severity: "violation",
          message: `Shift was ${fmtDuration(shiftLen)} — over 10 hrs and no signed 2nd meal period waiver on file. 2nd 30-min meal period required.`,
        });
        mealPremiumHours = Math.min(2, mealPremiumHours + 1);
      }
    }
  }

  // ── Attendance (dispatcher-observed) vs Paycom In Day ──
  // Same tolerance as the Dispatching > Time page's own flagging logic.
  if (attMin !== null && inDay !== null) {
    const diff = inDay - attMin;
    if (diff > 10 || diff < -5) {
      violations.push({
        code: "attendance_mismatch",
        severity: "warning",
        message: `Paycom clock-in is ${fmtDuration(Math.abs(diff))} ${diff > 0 ? "after" : "before"} the dispatcher-observed attendance time`,
      });
    }
  }

  // ── Paycom lunch vs Amazon Flex app lunch (only when Flex data exists) ──
  if (amzOutLunch !== null && outLunch !== null && Math.abs(amzOutLunch - outLunch) > 5) {
    violations.push({
      code: "amz_out_lunch_mismatch",
      severity: "warning",
      message: `Paycom Out Lunch (${day.paycomOutLunch}) doesn't match Amazon Flex app Out Lunch (${day.amazonOutLunch})`,
    });
  }
  if (amzInLunch !== null && inLunch !== null && Math.abs(amzInLunch - inLunch) > 5) {
    violations.push({
      code: "amz_in_lunch_mismatch",
      severity: "warning",
      message: `Paycom In Lunch (${day.paycomInLunch}) doesn't match Amazon Flex app In Lunch (${day.amazonInLunch})`,
    });
  }

  // ── Amazon Flex logout vs Paycom Out Day — should be at/before, or within 30 min after ──
  if (amzLogout !== null && outDay !== null) {
    const diff = amzLogout - outDay;
    if (diff > 30) {
      violations.push({
        code: "amz_logout_late",
        severity: "warning",
        message: `Flex app logout is ${fmtDuration(diff)} after Paycom clock-out — expected at/before, or within 30 min after (in case dispatcher clocked them out)`,
      });
    }
  }

  // ── Vehicle inspection time vs return time (informational — loose tolerance) ──
  if (inspection !== null && outDay !== null && Math.abs(inspection - outDay) > 60) {
    violations.push({
      code: "inspection_gap",
      severity: "info",
      message: `Inspection time (${day.inspectionTime}) is ${fmtDuration(Math.abs(inspection - outDay))} from Paycom clock-out — worth a glance`,
    });
  }

  return { violations, mealPremiumHours };
}

// ── Gross pay calculation (CA daily + weekly overtime) ──────────────────────
// CA non-exempt overtime rules (Labor Code 510 / DLSE), applied per workweek —
// SYMX's workweek is Sunday–Saturday, same as the pay-period pairing:
//   - Hours 0–8 in a workday: regular rate (1x).
//   - Hours 8–12 in a workday: time-and-a-half (1.5x).
//   - Hours over 12 in a workday: double time (2x).
//   - 7th consecutive day worked in a single workweek: first 8 hrs at 1.5x,
//     everything past 8 hrs that day at 2x (overrides the normal daily split).
//   - Hours over 40 in the workweek (counting only what was "regular" under the
//     daily split above) are upgraded to 1.5x — the daily and weekly rules
//     don't stack on the same hour, each hour gets exactly one rate, whichever
//     rule pushes it higher.
// Meal-premium hours (from auditDay) are paid at the regular (1x) rate, per
// CA law, and are added on top — they're not "hours worked" so they never
// factor into the daily/weekly OT thresholds above.
//
// "Hours worked" per day is derived directly from Paycom punches: Out Day
// minus In Day, minus the one meal break we can see (Out Lunch → In Lunch).
// If In Day or Out Day is missing, that day is excluded from pay entirely
// (nothing to compute from) rather than guessed at.

const DAILY_OT_MIN = 8 * 60;
const DAILY_DT_MIN = 12 * 60;
const WEEKLY_OT_MIN = 40 * 60;

export interface WeekPay {
  regHours: number;
  ot15Hours: number;
  ot2Hours: number;
  mealPremiumHours: number;
  grossPay: number;
}

function computeWorkedMinutes(day: DayInput): number | null {
  const inDay = toMinutes(day.paycomInDay);
  const outDay = toMinutes(day.paycomOutDay);
  if (inDay === null || outDay === null) return null;
  let span = outDay - inDay;
  if (span <= 0) return null;

  const outLunch = toMinutes(day.paycomOutLunch);
  const inLunch = toMinutes(day.paycomInLunch);
  if (outLunch !== null && inLunch !== null && inLunch > outLunch) {
    span -= inLunch - outLunch;
  }
  return span > 0 ? span : null;
}

/**
 * weekDays must be exactly 7 DayInput entries, Sunday first through Saturday
 * last (matches the pay-period date ordering used throughout this module).
 */
export function computeWeekPay(
  weekDays: { day: DayInput; mealPremiumHours: number }[],
  rate: number
): WeekPay {
  const workedMinutesByDay = weekDays.map((w) => computeWorkedMinutes(w.day));
  const workedAllSeven = weekDays.length === 7 && workedMinutesByDay.every((m) => m !== null && m > 0);

  let regMin = 0;
  let ot15Min = 0;
  let ot2Min = 0;
  let mealPremiumHours = 0;

  workedMinutesByDay.forEach((worked, i) => {
    mealPremiumHours += weekDays[i].mealPremiumHours;
    if (worked === null || worked <= 0) return;

    const isSeventhConsecutiveDay = workedAllSeven && i === 6; // Saturday, last day of the Sun-Sat week
    if (isSeventhConsecutiveDay) {
      ot15Min += Math.min(worked, DAILY_OT_MIN);
      ot2Min += Math.max(0, worked - DAILY_OT_MIN);
    } else {
      regMin += Math.min(worked, DAILY_OT_MIN);
      ot15Min += Math.max(0, Math.min(worked, DAILY_DT_MIN) - DAILY_OT_MIN);
      ot2Min += Math.max(0, worked - DAILY_DT_MIN);
    }
  });

  // Weekly 40-hr rule — only ever touches hours still sitting at "regular."
  if (regMin > WEEKLY_OT_MIN) {
    const excess = regMin - WEEKLY_OT_MIN;
    regMin -= excess;
    ot15Min += excess;
  }

  const regHours = regMin / 60;
  const ot15Hours = ot15Min / 60;
  const ot2Hours = ot2Min / 60;
  const grossPay = regHours * rate + ot15Hours * rate * 1.5 + ot2Hours * rate * 2 + mealPremiumHours * rate;

  return {
    regHours: round2(regHours),
    ot15Hours: round2(ot15Hours),
    ot2Hours: round2(ot2Hours),
    mealPremiumHours: round2(mealPremiumHours),
    grossPay: round2(grossPay),
  };
}
