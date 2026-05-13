/**
 * Shared types, constants, and pure utility functions for the scheduling module.
 * Extracted from page.tsx to reduce bundle size and improve code-splitting.
 */

// ── Constants ────────────────────────────────────────────────────────────────
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Business timezone — all "today" checks use Pacific Time. */
export const BUSINESS_TZ = "America/Los_Angeles";

// ── Types ────────────────────────────────────────────────────────────────────
export interface DayData {
  _id: string;
  date: string;
  weekDay: string;
  typeId?: string;
  // Legacy fields — kept for read-back compatibility with old records
  type?: string;
  status?: string;
  routeStatus?: string;
  subType?: string;
  trainingDay?: string;
  note?: string;
  startTime: string;
  dayBeforeConfirmation: string;
  dayOfConfirmation: string;
  weekConfirmation: string;
  van: string;
}

export interface EmployeeSchedule {
  transporterId: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    name: string;
    type: string;
    status: string;
    ScheduleNotes?: string;
    hiredDate?: string | Date;
    profileImage?: string;
  } | null;
  weekNote: string;
  days: Record<number, DayData>;
}

export interface WeekData {
  yearWeek: string;
  dates: string[];
  employees: EmployeeSchedule[];
  totalEmployees: number;
  prevWeekTrailing?: Record<string, number>;
  auditCounts?: Record<string, number>;
  everydayRecords?: Record<string, any>;
  dailyLaborActualCost?: Record<string, number>;
  dailyLaborTheoryCost?: Record<string, number>;
  dailyLaborTheoryCostBreakdown?: Record<string, { employeeName: string; type: string; rate: number; theoryHrs: number; cost: number; }[]>;
  dailyLaborActualCostBreakdown?: Record<string, { employeeName: string; type: string; regHrs: number; otHrs: number; rate: number; cost: number; }[]>;
  dailyRevenue?: Record<string, number>;
  dailyRevenueBreakdown?: Record<string, { employeeName: string; type: string; wst: string; hrs: number; cost: number; }[]>;
  dailyDriverActualCost?: Record<string, number>;
  dailyOpsActualCost?: Record<string, number>;
  dailyDriverCostPct?: Record<string, number>;
  dailyOpsCostPct?: Record<string, number>;
  dailyLaborTheoryPct?: Record<string, number>;
  dailyLaborActualPct?: Record<string, number>;
  dailyLaborVarDol?: Record<string, number>;
  dailyLaborVarPct?: Record<string, number>;
}

// ── Planning Row Data ──
export interface PlanningRow {
  label: string;
  values: number[];
  total: number;
  color: string;
}

// ── Pure Utility Functions ───────────────────────────────────────────────────

/** Working types — anything NOT in this list is considered "not working" */
export function isWorkingDay(day: DayData | undefined | null, routeTypeIdMap?: Map<string, any>): boolean {
  if (!day) return false;
  if (day.typeId && routeTypeIdMap) {
    const rt = routeTypeIdMap.get(String(day.typeId));
    if (rt) return (rt.routeStatus || "").trim().toLowerCase() !== "off";
  }
  // Legacy fallback
  const NON_WORKING = new Set(["off", "", "call out", "request off", "suspension", "stand by"]);
  return !NON_WORKING.has((day.type || "").trim().toLowerCase());
}

export function computePlanningData(employees: EmployeeSchedule[], everydayRecords: Record<string, any> = {}, dates: string[] = [], routeTypeIdMap: Map<string, any> = new Map()): PlanningRow[] {
  const daStats = Array(7).fill(0);
  const standBy = Array(7).fill(0);
  const routesAssigned = Array(7).fill(0);
  const ops = Array(7).fill(0);
  const extraDAs = Array(7).fill(0);

  // Initialize Routes Assigned from manual entries only
  for (let d = 0; d < 7; d++) {
    const date = dates[d];
    if (date && everydayRecords[date]?.routesAssigned !== undefined) {
      routesAssigned[d] = everydayRecords[date].routesAssigned;
    }
  }

  employees.forEach(emp => {
    for (let d = 0; d < 7; d++) {
      const day = emp.days[d];
      if (!day) continue;

      const rt = day.typeId ? routeTypeIdMap.get(String(day.typeId)) : null;
      const typeVal = (day.type || "").trim().toLowerCase();

      const isDA = rt ? rt.isDA : (typeVal === "route" || typeVal === "pending ecp");
      const isStandby = rt ? rt.isStandby : (typeVal === "stand by");
      const isOps = rt ? rt.isOps : (["open", "close", "fleet"].includes(typeVal));

      if (isDA) daStats[d]++;
      if (isStandby) standBy[d]++;
      if (isOps) ops[d]++;
    }
  });

  for (let d = 0; d < 7; d++) {
    extraDAs[d] = daStats[d] - routesAssigned[d];
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return [
    { label: "DA's", values: daStats, total: sum(daStats), color: "text-emerald-400" },
    { label: "Stand By", values: standBy, total: sum(standBy), color: "text-cyan-400" },
    { label: "Routes Assigned", values: routesAssigned, total: sum(routesAssigned), color: "text-blue-400" },
    { label: "Ops", values: ops, total: sum(ops), color: "text-orange-400" },
    { label: "Extra DA's", values: extraDAs, total: sum(extraDAs), color: "text-purple-400" },
  ];
}

// Group employees by type, and sort alphabetically with new hires at the bottom
export function groupByType(employees: EmployeeSchedule[]): Record<string, EmployeeSchedule[]> {
  const groups: Record<string, EmployeeSchedule[]> = {};
  employees.forEach(emp => {
    const type = emp.employee?.type || "Unassigned";
    if (!groups[type]) groups[type] = [];
    groups[type].push(emp);
  });

  Object.values(groups).forEach(groupList => {
    groupList.sort((a, b) => {
      const aIsNewHire = a.employee?.hiredDate ? (Date.now() - new Date(a.employee.hiredDate).getTime()) / 86400000 <= 30 : false;
      const bIsNewHire = b.employee?.hiredDate ? (Date.now() - new Date(b.employee.hiredDate).getTime()) / 86400000 <= 30 : false;

      if (aIsNewHire && !bIsNewHire) return 1;
      if (!aIsNewHire && bIsNewHire) return -1;
      
      const nameA = (a.employee?.name || a.transporterId || "").toLowerCase();
      const nameB = (b.employee?.name || b.transporterId || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  });

  return groups;
}

// Count working days for an employee using typeId resolution
export function countWorkingDays(emp: EmployeeSchedule, routeTypeIdMap?: Map<string, any>): number {
  let count = 0;
  for (let d = 0; d < 7; d++) {
    const day = emp.days[d];
    if (isWorkingDay(day, routeTypeIdMap)) count++;
  }
  return count;
}

// Detect consecutive working days and return warnings per day index
export function getConsecutiveWarnings(emp: EmployeeSchedule, carryOver: number = 0, routeTypeIdMap?: Map<string, any>): Map<number, { consecutive: number; type: 'caution' | 'danger' }> {
  const warnings = new Map<number, { consecutive: number; type: 'caution' | 'danger' }>();

  let consecutive = carryOver;
  for (let d = 0; d < 7; d++) {
    const day = emp.days[d];
    if (isWorkingDay(day, routeTypeIdMap)) {
      consecutive++;
      if (consecutive === 6) {
        warnings.set(d, { consecutive: 6, type: 'caution' });
      } else if (consecutive >= 7) {
        warnings.set(d, { consecutive, type: 'danger' });
      }
    } else {
      consecutive = 0;
    }
  }

  return warnings;
}

/** Get today's date string (YYYY-MM-DD) in Pacific Time. */
export function getTodayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/** Compute current yearWeek (Sun-based) from today's date in Pacific Time. */
export function getCurrentYearWeek(): string {
  const todayStr = getTodayPacific();
  const date = new Date(todayStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat
  const sundayOfThisWeek = new Date(date);
  sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
  const year = sundayOfThisWeek.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

/** Helper to compute next yearWeek string */
export function getNextYearWeek(yw: string): string {
  const m = yw.match(/(\d{4})-W(\d{2})/);
  if (!m) return yw;
  let yr = parseInt(m[1]), wk = parseInt(m[2]) + 1;
  if (wk > 52) { yr++; wk = 1; }
  return `${yr}-W${String(wk).padStart(2, "0")}`;
}

/** Helper to compute previous yearWeek string */
export function getPrevYearWeek(yw: string): string {
  const m = yw.match(/(\d{4})-W(\d{2})/);
  if (!m) return yw;
  let yr = parseInt(m[1]), wk = parseInt(m[2]) - 1;
  if (wk < 1) { yr--; wk = 52; }
  return `${yr}-W${String(wk).padStart(2, "0")}`;
}
