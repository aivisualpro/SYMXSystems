"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { type ViolationSeverity } from "@/lib/payroll-audit";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* ────────────────────────────────────────────────────────────────────────────
 *  Pay period (bi-weekly) helpers — mirrors app/(protected)/hr/timesheet/page.tsx
 * ──────────────────────────────────────────────────────────────────────────── */

function fmtDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function toDateKey(d: Date) {
  return d.toISOString().split("T")[0];
}

interface WeekPair {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

function getSundayOfWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay();
  const mondayW1 = new Date(jan4);
  mondayW1.setDate(jan4.getDate() - ((dayOfWeek + 6) % 7));
  const targetMonday = new Date(mondayW1);
  targetMonday.setDate(mondayW1.getDate() + (week - 1) * 7);
  const sunday = new Date(targetMonday);
  sunday.setDate(targetMonday.getDate() - 1);
  return sunday;
}

function makePair(y1: number, w1: number, y2: number, w2: number): WeekPair {
  const startDate = getSundayOfWeek(y1, w1);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);
  const w1Str = String(w1).padStart(2, "0");
  const w2Str = String(w2).padStart(2, "0");
  return { id: `${y1}-W${w1Str},${y2}-W${w2Str}`, label: `${y1}-W${w1Str} , ${y2}-W${w2Str}`, startDate, endDate };
}

function generateWeekPairs(): WeekPair[] {
  const pairs: WeekPair[] = [];
  pairs.push(makePair(2025, 52, 2026, 1));
  for (let w = 2; w <= 50; w += 2) pairs.push(makePair(2026, w, 2026, w + 1));
  pairs.push(makePair(2026, 52, 2027, 1));
  return pairs;
}

function getCurrentPairId(pairs: WeekPair[]): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const match = pairs.find((p) => now >= p.startDate && now <= p.endDate);
  return match?.id || pairs[0].id;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Types
 * ──────────────────────────────────────────────────────────────────────────── */

interface Violation {
  code: string;
  severity: ViolationSeverity;
  message: string;
}

interface DayRecord {
  weekDay: string;
  date: string;
  hasRecord: boolean;
  attendance?: string;
  attendanceTime?: string;
  paycomInDay?: string;
  paycomOutLunch?: string;
  paycomInLunch?: string;
  paycomOutDay?: string;
  amazonOutLunch?: string;
  amazonInLunch?: string;
  amazonAppLogout?: string;
  inspectionTime?: string;
  violations: Violation[];
  mealPremiumHours: number;
}

interface WeekPay {
  regHours: number;
  ot15Hours: number;
  ot2Hours: number;
  mealPremiumHours: number;
  grossPay: number;
}

interface PayPeriodPay {
  rate: number;
  weeks: WeekPay[];
  totalRegHours: number;
  totalOt15Hours: number;
  totalOt2Hours: number;
  totalGrossPay: number;
}

interface EmployeeAudit {
  employeeId: string;
  employeeName: string;
  employeeStatus: string;
  eeCode: string;
  transporterId: string;
  mealWaiverFile: string;
  days: DayRecord[];
  totalMealPremiumHours: number;
  violationCount: number;
  warningCount: number;
  payPeriodPay: PayPeriodPay;
}

interface AuditResponse {
  success: boolean;
  dateKeys: string[];
  employees: EmployeeAudit[];
  summary: {
    employeeCount: number;
    totalMealPremiumHours: number;
    totalViolations: number;
    totalWarnings: number;
    employeesWithIssues: number;
    totalGrossPayroll: number;
    employeesMissingRate: number;
  };
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function worstSeverity(violations: Violation[]): ViolationSeverity | null {
  if (violations.some((v) => v.severity === "violation")) return "violation";
  if (violations.some((v) => v.severity === "warning")) return "warning";
  if (violations.some((v) => v.severity === "info")) return "info";
  return null;
}

function severityDot(severity: ViolationSeverity | null, hasRecord: boolean) {
  if (!hasRecord) return "bg-muted-foreground/15";
  if (severity === "violation") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  if (severity === "info") return "bg-blue-400";
  return "bg-emerald-500";
}

function formatAmPm(timeStr?: string): string {
  if (!timeStr || !timeStr.includes(":")) return "—";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Component
 * ──────────────────────────────────────────────────────────────────────────── */

export default function TimecardAuditPage() {
  const weekPairs = useMemo(() => generateWeekPairs(), []);
  const [selectedPairId, setSelectedPairId] = useState(() => getCurrentPairId(weekPairs));
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ emp: EmployeeAudit; day: DayRecord } | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);

  const selectedIdx = weekPairs.findIndex((p) => p.id === selectedPairId);
  const selectedPair = weekPairs[selectedIdx] || weekPairs[0];

  const fetchAudit = useCallback(async (pair: WeekPair) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/timecard-audit?start=${toDateKey(pair.startDate)}&end=${toDateKey(pair.endDate)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load audit");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load audit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit(selectedPair);
  }, [selectedPair, fetchAudit]);

  const goPrev = () => selectedIdx > 0 && setSelectedPairId(weekPairs[selectedIdx - 1].id);
  const goNext = () => selectedIdx < weekPairs.length - 1 && setSelectedPairId(weekPairs[selectedIdx + 1].id);

  const visibleEmployees = useMemo(() => {
    if (!data) return [];
    const list = onlyIssues ? data.employees.filter((e) => e.violationCount + e.warningCount > 0) : data.employees;
    return [...list].sort((a, b) => (b.violationCount * 100 + b.warningCount) - (a.violationCount * 100 + a.warningCount));
  }, [data, onlyIssues]);

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      {/* ── Pay Period Selector ── */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold">Pay Period (2 Weeks)</p>
              <p className="text-[10px] text-muted-foreground">Auditing Paycom punches against attendance, Amazon Flex, and CA meal-period law</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={selectedIdx <= 0} className="h-9 w-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted/50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select value={selectedPairId} onChange={(e) => setSelectedPairId(e.target.value)} className="h-9 px-3 rounded-xl border border-border/50 bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              {weekPairs.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button onClick={goNext} disabled={selectedIdx >= weekPairs.length - 1} className="h-9 w-9 rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted/50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground px-2">{fmtDate(selectedPair.startDate)} → {fmtDate(selectedPair.endDate)}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Employees w/ Issues</p>
              <p className="text-2xl font-black mt-1">{data.summary.employeesWithIssues}<span className="text-sm text-muted-foreground font-normal"> / {data.summary.employeeCount}</span></p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-[10px] uppercase tracking-wide text-red-400 font-semibold">Violations</p>
              <p className="text-2xl font-black mt-1 text-red-400">{data.summary.totalViolations}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[10px] uppercase tracking-wide text-amber-400 font-semibold">Warnings</p>
              <p className="text-2xl font-black mt-1 text-amber-400">{data.summary.totalWarnings}</p>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="text-[10px] uppercase tracking-wide text-violet-400 font-semibold">Est. Meal Premium Hrs</p>
              <p className="text-2xl font-black mt-1 text-violet-400">{data.summary.totalMealPremiumHours}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-wide text-emerald-400 font-semibold">Est. Gross Payroll</p>
              <p className="text-2xl font-black mt-1 text-emerald-400">{fmtMoney(data.summary.totalGrossPayroll)}</p>
              {data.summary.employeesMissingRate > 0 && (
                <p className="text-[10px] text-amber-500 font-medium mt-0.5">{data.summary.employeesMissingRate} missing a pay rate</p>
              )}
            </div>
          </div>

          {/* ── Filter + Legend ── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <input type="checkbox" className="h-3.5 w-3.5 accent-primary rounded cursor-pointer" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
              Only show employees with issues
            </label>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Violation</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Warning</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Info</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Clean</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/15" /> No record</span>
            </div>
          </div>

          {/* ── Grid ── */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: 1400 }}>
                <thead className="sticky top-0 z-10 bg-muted/50">
                  <tr className="border-b border-border/30">
                    <th className="sticky left-0 z-20 bg-muted/50 text-left px-3 py-2 font-semibold text-muted-foreground min-w-[180px]">Employee</th>
                    {data.dateKeys.map((dk) => {
                      const d = new Date(`${dk}T00:00:00`);
                      return (
                        <th key={dk} className="text-center px-1 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                          <div>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}</div>
                          <div className="text-[9px] font-normal opacity-70">{d.getMonth() + 1}/{d.getDate()}</div>
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Meal Prem.</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap">Reg</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap">OT 1.5x</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap">OT 2x</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Est. Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap border-r border-border/30">
                        {emp.employeeName}
                        <span className="block text-[9px] text-muted-foreground font-normal">{emp.eeCode}</span>
                        {emp.employeeStatus && emp.employeeStatus !== "Active" && (
                          <span className="block text-[9px] font-semibold text-red-500 leading-tight">{emp.employeeStatus}</span>
                        )}
                      </td>
                      {emp.days.map((day) => {
                        const worst = worstSeverity(day.violations);
                        return (
                          <td key={day.date} className="text-center px-1 py-2">
                            <button
                              onClick={() => day.hasRecord && setDetail({ emp, day })}
                              className={cn(
                                "h-4 w-4 rounded-full mx-auto block transition-transform",
                                severityDot(worst, day.hasRecord),
                                day.hasRecord && "hover:scale-125 cursor-pointer"
                              )}
                              title={day.violations.map((v) => v.message).join("\n") || (day.hasRecord ? "No issues" : "No record")}
                            />
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-2 font-bold">
                        {emp.totalMealPremiumHours > 0 ? (
                          <span className="text-violet-400">{emp.totalMealPremiumHours}h</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="text-center px-2 py-2">{emp.payPeriodPay.totalRegHours || <span className="text-muted-foreground/30">—</span>}</td>
                      <td className="text-center px-2 py-2">
                        {emp.payPeriodPay.totalOt15Hours > 0 ? <span className="text-amber-500 font-semibold">{emp.payPeriodPay.totalOt15Hours}</span> : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="text-center px-2 py-2">
                        {emp.payPeriodPay.totalOt2Hours > 0 ? <span className="text-red-500 font-semibold">{emp.payPeriodPay.totalOt2Hours}</span> : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="text-center px-3 py-2 font-bold">
                        {emp.payPeriodPay.rate ? <span className="text-emerald-500">{fmtMoney(emp.payPeriodPay.totalGrossPay)}</span> : <span className="text-amber-500 text-[10px] font-medium">No rate on file</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleEmployees.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">No employees to show.</div>
            )}
          </div>
        </>
      )}

      {/* ── Day Detail Sheet ── */}
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:w-[420px] border-l border-border bg-background p-0 flex flex-col shadow-2xl">
          {detail && (
            <>
              <SheetHeader className="px-6 py-5 border-b border-border bg-muted/20">
                <SheetTitle className="flex flex-col gap-0.5">
                  <span>{detail.emp.employeeName}</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {new Date(`${detail.day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Paycom Punches</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/30"><span className="text-muted-foreground">In Day:</span> <span className="font-semibold">{formatAmPm(detail.day.paycomInDay)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30"><span className="text-muted-foreground">Out Lunch:</span> <span className="font-semibold">{formatAmPm(detail.day.paycomOutLunch)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30"><span className="text-muted-foreground">In Lunch:</span> <span className="font-semibold">{formatAmPm(detail.day.paycomInLunch)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30"><span className="text-muted-foreground">Out Day:</span> <span className="font-semibold">{formatAmPm(detail.day.paycomOutDay)}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Cross-Reference Sources</p>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/30 flex justify-between"><span className="text-muted-foreground">Dispatcher Attendance:</span> <span className="font-semibold">{formatAmPm(detail.day.attendanceTime)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30 flex justify-between"><span className="text-muted-foreground">Amazon Flex Out Lunch:</span> <span className="font-semibold">{formatAmPm(detail.day.amazonOutLunch)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30 flex justify-between"><span className="text-muted-foreground">Amazon Flex In Lunch:</span> <span className="font-semibold">{formatAmPm(detail.day.amazonInLunch)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30 flex justify-between"><span className="text-muted-foreground">Amazon Flex Logout:</span> <span className="font-semibold">{formatAmPm(detail.day.amazonAppLogout)}</span></div>
                    <div className="p-2 rounded-lg bg-muted/30 flex justify-between"><span className="text-muted-foreground">Vehicle Inspection:</span> <span className="font-semibold">{formatAmPm(detail.day.inspectionTime)}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Findings {detail.day.mealPremiumHours > 0 && <span className="text-violet-400">· ~{detail.day.mealPremiumHours}h meal premium</span>}
                  </p>
                  {detail.day.violations.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400 font-medium">No issues found for this day</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.day.violations.map((v, i) => {
                        const Icon = v.severity === "violation" ? AlertTriangle : v.severity === "warning" ? AlertCircle : Info;
                        const cls = v.severity === "violation" ? "bg-red-500/5 border-red-500/20 text-red-400" : v.severity === "warning" ? "bg-amber-500/5 border-amber-500/20 text-amber-500" : "bg-blue-500/5 border-blue-500/20 text-blue-400";
                        return (
                          <div key={i} className={cn("flex items-start gap-2 p-3 rounded-lg border text-xs", cls)}>
                            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span>{v.message}</span>
                              {v.code === "meal2_waived" && detail.emp.mealWaiverFile && (
                                <a href={detail.emp.mealWaiverFile} target="_blank" rel="noopener noreferrer" className="block mt-1 font-semibold underline underline-offset-2">
                                  View signed waiver →
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
