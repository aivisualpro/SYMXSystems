/**
 * Shared types, constants, and utility functions for the dispatching routes page.
 * Extracted from page.tsx to reduce bundle size and improve code-splitting.
 */

import { CheckCircle2, XCircle, CircleDashed } from "lucide-react";

// ── Attendance Options ──
export const ATTENDANCE_OPTIONS = [
  { label: "Present", icon: CheckCircle2, bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", iconColor: "text-emerald-500" },
  { label: "Absent", icon: XCircle, bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", iconColor: "text-red-400" },
  { label: "", icon: CircleDashed, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", iconColor: "text-zinc-400", displayLabel: "Clear" },
];

export const getAttendanceStyle = (value: string) => {
  const v = (value || "").trim().toLowerCase();
  if (v === "present") return ATTENDANCE_OPTIONS[0];
  if (v === "absent") return ATTENDANCE_OPTIONS[1];
  return ATTENDANCE_OPTIONS[2];
};

// ── Time arithmetic helpers ──
export function parseTime(t: string): number | null {
  if (!t || !t.trim()) return null;
  const s = t.trim();
  // Handle negative duration: "-H:MM" or "H:MM"
  const mNeg = s.match(/^(-?)(\d{1,2}):(\d{2})$/);
  if (mNeg) {
    const val = parseInt(mNeg[2]) * 60 + parseInt(mNeg[3]);
    return mNeg[1] === "-" ? -val : val;
  }
  // Handle 12h format: "2:00 PM"
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1]);
    const min = parseInt(m12[2]);
    const pm = m12[3].toUpperCase() === "PM";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + min;
  }
  return null;
}

export function isDelayPositive(d: string): boolean {
  return !!d && !d.startsWith("-") && d !== "0:00";
}

export function fmtDur(mins: number | null): string {
  if (mins === null || isNaN(mins)) return "";
  const neg = mins < 0;
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${neg ? "-" : ""}${h}:${m.toString().padStart(2, "0")}`;
}

export function fmtTime(mins: number | null): string {
  if (mins === null || isNaN(mins)) return "";
  let m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mn = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mn.toString().padStart(2, "0")} ${ampm}`;
}

export function durToHrs(t: string): number {
  const m = parseTime(t);
  return m !== null ? m / 60 : 0;
}

/** Strip trailing seconds (":00" or ":SS") from time strings like "6:30:00" → "6:30" */
export function stripSec(v: string): string {
  if (!v) return v;
  if ((v.match(/:/g) || []).length === 2) {
    return v.replace(/:\d{2}$/, "");
  }
  return v;
}

/** Business timezone — all date comparisons use Pacific Time */
export const BUSINESS_TZ = "America/Los_Angeles";

/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time.
 *  Shifts UTC-midnight dates to noon to prevent timezone rollback. */
export function toPacificDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

// ── Column Definitions ──
export type ColumnDef = { key: string; label: string; minW: number; sticky: boolean; align?: "left" | "center" | "right" };
export const COLUMNS: ColumnDef[] = [
  { key: "employee", label: "Employee", minW: 260, sticky: true },
  { key: "routeNumber", label: "Route #", minW: 60, sticky: false },
  { key: "van", label: "Van", minW: 58, sticky: false, align: "left" },
  { key: "bags", label: "Bags", minW: 40, sticky: false },
  { key: "ov", label: "OV", minW: 36, sticky: false },
  { key: "stopCount", label: "Stops", minW: 46, sticky: false },
  { key: "packageCount", label: "Pkgs", minW: 44, sticky: false },
  { key: "routeDuration", label: "Duration", minW: 56, sticky: false },
  { key: "waveTime", label: "Wave", minW: 56, sticky: false },
  { key: "pad", label: "PAD", minW: 42, sticky: false },
  { key: "wst", label: "WST", minW: 50, sticky: false },
  { key: "serviceType", label: "Service", minW: 64, sticky: false },
  { key: "routesCompleted", label: "Routes", minW: 50, sticky: false },
  { key: "wstDuration", label: "WST Dur", minW: 52, sticky: false },
  { key: "stagingLocation", label: "Staging", minW: 60, sticky: false },
  { key: "departureDelay", label: "Dep Delay", minW: 60, sticky: false },
  { key: "outboundDelay", label: "OB Delay", minW: 56, sticky: false },
  { key: "firstStopDelay", label: "1st Delay", minW: 56, sticky: false },
  { key: "lastStopDelay", label: "Last Delay", minW: 58, sticky: false },
  { key: "dctDelay", label: "DCT Delay", minW: 58, sticky: false },
  { key: "plannedRTSTime", label: "Plan RTS", minW: 56, sticky: false },
  { key: "plannedInboundStem", label: "Plan IB", minW: 52, sticky: false },
  { key: "estimatedRTSTime", label: "Est RTS", minW: 54, sticky: false },
  { key: "plannedDuration1stToLast", label: "Plan 1→L", minW: 56, sticky: false },
  { key: "actualDuration1stToLast", label: "Act 1→L", minW: 56, sticky: false },
  { key: "stopsPerHour", label: "Stops/Hr", minW: 52, sticky: false },
  { key: "totalHours", label: "Total Hrs", minW: 56, sticky: false },
  { key: "regHrs", label: "Reg Hrs", minW: 50, sticky: false },
  { key: "otHrs", label: "OT Hrs", minW: 48, sticky: false },
  { key: "regPay", label: "Reg Pay", minW: 56, sticky: false },
  { key: "otPay", label: "OT Pay", minW: 52, sticky: false },
  { key: "totalCost", label: "Total Cost", minW: 60, sticky: false },
  { key: "hoursWorkedLast7Days", label: "7d Hrs", minW: 48, sticky: false },
  { key: "driverEfficiency", label: "Eff %", minW: 48, sticky: false },
] as const;

export interface RouteRow {
  _id: string;
  transporterId: string;
  date: string;
  weekDay: string;
  type: string;
  typeId?: string;
  subType: string;
  van: string;
  serviceType: string;
  dashcam: string;
  routeSize: string;
  driverEfficiency: number;
  employeeName: string;
  hiredDate?: string | null;
  confirmationStatus?: { status: string; changeRemarks?: string; updatedAt?: string; history?: Array<{ status: string; changeRemarks?: string; updatedAt?: string; createdBy?: string; messageType?: string }> } | null;
  phone: string;
  rate: number;
  routesCompleted: number;
  routeNumber: string;
  stopCount: number;
  packageCount: number;
  routeDuration: string;
  waveTime: string;
  pad: string;
  wst: string;
  wstRevenue: number;
  wstDuration: number;
  bags: string;
  ov: string;
  stagingLocation: string;
  attendance: string;
  profileImage: string;
  // Raw fields from DB
  actualDepartureTime: string;
  plannedOutboundStem: string;
  actualOutboundStem: string;
  plannedFirstStop: string;
  actualFirstStop: string;
  plannedLastStop: string;
  actualLastStop: string;
  deliveryCompletionTime: string;
  totalHours: string;
  paycomInDay?: string;
  paycomOutLunch?: string;
  paycomInLunch?: string;
  paycomOutDay?: string;
  stopsRescued: number;
  // Computed fields
  departureDelay: string;
  outboundDelay: string;
  firstStopDelay: string;
  lastStopDelay: string;
  plannedRTSTime: string;
  plannedInboundStem: string;
  estimatedRTSTime: string;
  plannedDuration1stToLast: string;
  actualDuration1stToLast: string;
  stopsPerHour: number;
  dctDelay: string;
  regHrs: number;
  otHrs: number;
  totalCost: number;
  regPay: number;
  otPay: number;
  hoursWorkedLast7Days: number;
  routesCompletedPrev: number;
}

export type SortKey = typeof COLUMNS[number]["key"];

// ── Short day label ──
export const SHORT_DAYS: Record<string, string> = {
  Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};
