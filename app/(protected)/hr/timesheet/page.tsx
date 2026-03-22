"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useDataStore } from "@/hooks/use-data-store";
import {
  Calendar,
  FileText,
  FileDown,
  Loader2,
  Users,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ────────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function fmtDateHeader(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
}

/** Get 14 consecutive days starting from `start` */
function getDays(start: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Get ISO week number for a date */
function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the Sunday that starts a given ISO week */
function getSundayOfWeek(year: number, week: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay(); // 0=Sun
  // Monday of ISO week 1
  const mondayW1 = new Date(jan4);
  mondayW1.setDate(jan4.getDate() - ((dayOfWeek + 6) % 7));
  // Monday of target week
  const targetMonday = new Date(mondayW1);
  targetMonday.setDate(mondayW1.getDate() + (week - 1) * 7);
  // Sunday before that Monday
  const sunday = new Date(targetMonday);
  sunday.setDate(targetMonday.getDate() - 1);
  return sunday;
}

interface WeekPair {
  id: string;         // e.g. "2026-W12,2026-W13"
  label: string;      // e.g. "2026-W12 , 2026-W13"
  startDate: Date;    // Sunday of week 1
  endDate: Date;      // Saturday of week 2
  w1: number;
  w2: number;
  year: number;
}

/** Generate bi-weekly pairs for the given year + some surrounding */
function generateWeekPairs(): WeekPair[] {
  const now = new Date();
  const year = now.getFullYear();
  const pairs: WeekPair[] = [];

  // Generate for current year: W01-W02, W03-W04, ..., W51-W52
  for (let w = 1; w <= 52; w += 2) {
    const w1 = w;
    const w2 = w + 1;
    const startDate = getSundayOfWeek(year, w1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 13);

    const w1Str = String(w1).padStart(2, "0");
    const w2Str = String(w2).padStart(2, "0");

    pairs.push({
      id: `${year}-W${w1Str},${year}-W${w2Str}`,
      label: `${year}-W${w1Str} , ${year}-W${w2Str}`,
      startDate,
      endDate,
      w1, w2, year,
    });
  }

  return pairs;
}

/** Find the current week pair */
function getCurrentPairId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = getISOWeek(now);
  // Find which pair the current week belongs to (odd-even pairing)
  const w1 = week % 2 === 1 ? week : week - 1;
  const w2 = w1 + 1;
  return `${year}-W${String(w1).padStart(2, "0")},${year}-W${String(w2).padStart(2, "0")}`;
}

const LEGAL_TEXT =
  "I understand my job classification is eligible for overtime and/or compensatory time payment. These payments will be made at the rate of one and one-half time of my annualized hourly rate. I agree to work overtime or compensatory time only with advance approval of my supervisor. Failure to receive advance approval for overtime or compensatory time worked may result in a corrective or disciplinary action which may include termination of SYMX employment. I certify the time entries on this time record accurately reflect my actual hours worked and that I have not worked anytime during this pay period that is not reflected on this time record. I acknowledge I am authorized and permitted to take paid rest periods of 15 minutes net time per each four hours worked. I acknowledge I am provided a 30 minute unpaid meal period if I work a work period of more than 5 hours in a workday and a second 30 minute unpaid meal period if I work a work period of more than 10 hours in a workday. I acknowledge I am entitled to recovery periods. I have complied with company policies on rest, meal and no recovery periods for the pay period unless otherwise documented on this time record and discussed with my supervisor. No Company Supervisor or manager has done anything to impede, discourage or prevent me from taking rest, meal or recovery period(s) during this pay period. I declare under penalty of perjury under the laws of State of California and the United States of America that this certification is true and correct.";

/* ────────────────────────────────────────────────────────────────────────────
 *  PDF Generation
 * ──────────────────────────────────────────────────────────────────────────── */

/** Load logo as base64 data URL */
async function loadLogoBase64(): Promise<string> {
  try {
    const res = await fetch("/sidebar-icon.png");
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return ""; // fallback: no logo
  }
}

async function generateTimesheetPDF(
  employees: { firstName: string; lastName: string }[],
  startDate: Date,
  options: { blank?: boolean } = {}
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const days = getDays(startDate);
  const endDate = days[days.length - 1];
  const fromStr = fmtDateHeader(startDate);
  const toStr = fmtDateHeader(endDate);

  // Load logo
  const logoBase64 = await loadLogoBase64();

  const list = options.blank ? [null] : employees;

  list.forEach((emp, idx) => {
    if (idx > 0) doc.addPage();

    let y = 35;

    // ── Logo + Title ──
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 35, y - 8, 32, 32);
      } catch {}
    }
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("SYMX Logistics", 75, y + 14);

    // Punch In Correction Form
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Punch In Correction Form", pageW / 2, y + 10, { align: "center" });

    // Dates
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Date From: ${fromStr}`, pageW - 250, y + 2);
    doc.text(`Date To: ${toStr}`, pageW - 250, y + 16);

    y += 42;

    // ── Employee Name ──
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Employee Name:", pageW / 2 - 80, y, { align: "right" });
    if (emp && !options.blank) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim().toUpperCase();
      doc.text(name, pageW / 2 - 74, y);
    } else {
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(pageW / 2 - 70, y + 2, pageW - 80, y + 2);
    }

    y += 26;

    // ── Table ──
    const cols = ["Date", "Day", "In Day", "Out Lunch", "In Lunch", "Out Day", "Notes", "Employee Signature"];
    const tableW = pageW - 70;             // 35pt margin each side
    const tableX = 35;
    // Proportional column widths for landscape
    const ratios = [0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.18, 0.22];
    const colWidths = ratios.map((r) => r * tableW);

    const drawRow = (rowY: number, values: string[], isHeader = false, isWeekSep = false) => {
      const rowH = isHeader ? 22 : 26;
      let x = tableX;

      if (isHeader) {
        doc.setFillColor(230, 230, 230);
        doc.rect(x, rowY, tableW, rowH, "F");
      }
      if (isWeekSep) {
        doc.setFillColor(240, 245, 255);
        doc.rect(x, rowY, tableW, rowH, "F");
      }

      for (let c = 0; c < cols.length; c++) {
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        doc.rect(x, rowY, colWidths[c], rowH);

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(isHeader ? 9 : 10);
        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        const txt = values[c] || "";
        doc.text(txt, x + colWidths[c] / 2, rowY + rowH / 2 + 3, { align: "center" });
        x += colWidths[c];
      }
      return rowH;
    };

    // Header row
    drawRow(y, cols, true);
    y += 22;

    // Week 1 (days 0-6)
    for (let i = 0; i < 7; i++) {
      const d = days[i];
      const h = drawRow(y, [fmtDate(d), DAY_NAMES[d.getDay()], "", "", "", "", "", ""], false, false);
      y += h;
    }

    y += 6; // gap between weeks

    // Week 2 (days 7-13)
    for (let i = 7; i < 14; i++) {
      const d = days[i];
      const h = drawRow(y, [fmtDate(d), DAY_NAMES[d.getDay()], "", "", "", "", "", ""], false, i === 7);
      y += h;
    }

    y += 10;

    // ── Legal Text ──
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const legalLines = doc.splitTextToSize(LEGAL_TEXT, pageW - 70);
    doc.text(legalLines, 35, y);
    y += legalLines.length * 6 + 14;

    // ── Signature lines ──
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);

    doc.text("Supervisor's Signature:", 35, y);
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(185, y + 2, pageW / 2 - 20, y + 2);
    doc.text("Date:", pageW / 2 + 30, y);
    doc.line(pageW / 2 + 65, y + 2, pageW / 2 + 220, y + 2);

    y += 26;

    doc.text("Employee's Signature:", 35, y);
    doc.line(185, y + 2, pageW / 2 - 20, y + 2);
    doc.text("Date:", pageW / 2 + 30, y);
    doc.line(pageW / 2 + 65, y + 2, pageW / 2 + 220, y + 2);
  });

  return doc;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Component
 * ──────────────────────────────────────────────────────────────────────────── */

export default function TimesheetPage() {
  const store = useDataStore();
  const weekPairs = generateWeekPairs();
  const [selectedPairId, setSelectedPairId] = useState(getCurrentPairId());
  const [generating, setGenerating] = useState<"timesheet" | "blank" | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { setRightContent } = useHeaderActions();

  // Seed from store
  const storeEmployees = store.employees as any;
  useEffect(() => {
    if (storeEmployees?.records?.length > 0 && employees.length === 0) {
      const active = storeEmployees.records
        .filter((e: any) => e.status === "Active")
        .sort((a: any, b: any) => {
          const na = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
          const nb = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
          return na.localeCompare(nb);
        });
      setEmployees(active);
    }
  }, [storeEmployees]);

  // Also fetch fresh data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/employees?terminated=false&limit=9999");
        if (res.ok) {
          const data = await res.json();
          const list = (data.records || data || [])
            .filter((e: any) => e.status === "Active")
            .sort((a: any, b: any) => {
              const na = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
              const nb = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
              return na.localeCompare(nb);
            });
          setEmployees(list);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  // Header
  useEffect(() => {
    setRightContent(null);
    return () => setRightContent(null);
  }, [setRightContent]);

  const selectedPair = weekPairs.find((p) => p.id === selectedPairId) || weekPairs[0];
  const start = selectedPair.startDate;
  const end = selectedPair.endDate;
  const selectedIdx = weekPairs.findIndex((p) => p.id === selectedPairId);

  const goPrev = () => {
    if (selectedIdx > 0) setSelectedPairId(weekPairs[selectedIdx - 1].id);
  };
  const goNext = () => {
    if (selectedIdx < weekPairs.length - 1) setSelectedPairId(weekPairs[selectedIdx + 1].id);
  };

  const handleGenerate = useCallback(async (type: "timesheet" | "blank") => {
    if (type === "timesheet" && employees.length === 0) {
      toast.error("No active employees found");
      return;
    }

    setGenerating(type);

    // Slight delay for UI to update
    await new Promise((r) => setTimeout(r, 100));

    try {
      const doc = await generateTimesheetPDF(
        employees,
        selectedPair.startDate,
        { blank: type === "blank" }
      );

      const fromStr = fmtDateHeader(selectedPair.startDate);
      const fileName = type === "blank"
        ? `Blank_Timesheet_${selectedPair.id.replace(",", "_")}.pdf`
        : `TimeSheet_${selectedPair.id.replace(",", "_")}.pdf`;

      doc.save(fileName);
      toast.success(
        type === "blank"
          ? "Blank timesheet downloaded"
          : `Timesheet with ${employees.length} employees downloaded`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF");
    } finally {
      setGenerating(null);
    }
  }, [employees, selectedPair]);

  const days = getDays(selectedPair.startDate);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ═══ Date Selector + Actions ═══ */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          {/* Week pair selector */}
          <div className="space-y-2 flex-1 min-w-0">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Pay Period (2 Weeks)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrev}
                disabled={selectedIdx <= 0}
                className="h-10 w-10 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={selectedPairId}
                onChange={(e) => setSelectedPairId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border/50 bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
              >
                {weekPairs.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={goNext}
                disabled={selectedIdx >= weekPairs.length - 1}
                className="h-10 w-10 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Period: <span className="font-bold text-foreground">{fmtDate(start)}</span>
              {" → "}
              <span className="font-bold text-foreground">{fmtDate(end)}</span>
              <span className="ml-2 text-muted-foreground/60">(14 days)</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => handleGenerate("timesheet")}
              disabled={!!generating || employees.length === 0}
              className="h-10 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20 px-5"
            >
              {generating === "timesheet" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate Timesheet
              {employees.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-black">
                  {employees.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleGenerate("blank")}
              disabled={!!generating}
              className="h-10 gap-2 border-border px-5"
            >
              {generating === "blank" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Download Blank
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Preview Section ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Timesheet Preview Card */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <ClipboardList className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold">Employee Timesheet</p>
              <p className="text-[10px] text-muted-foreground">1 page per active employee, sorted A—Z</p>
            </div>
          </div>
          {/* Mini Preview */}
          <div className="p-5">
            <div className="border border-border/50 rounded-xl p-4 bg-background space-y-3">
              {/* Header preview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">◉</span>
                  </div>
                  <span className="text-[10px] font-black text-foreground">SYMX Logistics</span>
                </div>
                <span className="text-[8px] font-bold text-muted-foreground">Punch In Correction Form</span>
              </div>

              <p className="text-[9px] text-center text-muted-foreground">
                Employee Name: <span className="font-bold text-blue-500">JOHN DOE</span>
              </p>

              {/* Mini table */}
              <div className="border border-border/30 rounded-md overflow-hidden">
                <div className="grid grid-cols-8 bg-muted/50 text-center">
                  {["Date", "Day", "In", "Out L", "In L", "Out", "Notes", "Sign"].map((h) => (
                    <div key={h} className="px-1 py-1 text-[6px] font-black text-muted-foreground border-r border-border/20 last:border-0">
                      {h}
                    </div>
                  ))}
                </div>
                {days.slice(0, 4).map((d, i) => (
                  <div key={i} className="grid grid-cols-8 border-t border-border/20 text-center">
                    <div className="px-1 py-1 text-[6px] text-muted-foreground border-r border-border/10">{fmtDate(d)}</div>
                    <div className="px-1 py-1 text-[6px] text-muted-foreground border-r border-border/10">{DAY_NAMES[d.getDay()].slice(0, 3)}</div>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className="px-1 py-1 border-r border-border/10 last:border-0" />
                    ))}
                  </div>
                ))}
                <div className="text-center py-1 text-[6px] text-muted-foreground/40 border-t border-border/10">
                  ... {10} more rows
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                <span className="text-[7px] text-muted-foreground/40">Supervisor's Signature: ____________</span>
                <span className="text-[7px] text-muted-foreground/40">Date: ____________</span>
              </div>
            </div>

            {/* Employee count */}
            <div className="mt-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold text-foreground">
                {employees.length} active employees
              </span>
              <span className="text-[10px] text-muted-foreground">
                = {employees.length} pages
              </span>
            </div>
          </div>
        </div>

        {/* Blank Preview Card */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border/30 bg-gradient-to-r from-gray-500/5 to-gray-400/5 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <FileDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">Blank Template</p>
              <p className="text-[10px] text-muted-foreground">Single page, empty name field</p>
            </div>
          </div>
          {/* Mini Preview */}
          <div className="p-5">
            <div className="border border-border/50 rounded-xl p-4 bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">◉</span>
                  </div>
                  <span className="text-[10px] font-black text-foreground">SYMX Logistics</span>
                </div>
                <span className="text-[8px] font-bold text-muted-foreground">Punch In Correction Form</span>
              </div>

              <p className="text-[9px] text-center text-muted-foreground">
                Employee Name: <span className="inline-block w-32 border-b border-muted-foreground/30" />
              </p>

              {/* Mini table */}
              <div className="border border-border/30 rounded-md overflow-hidden">
                <div className="grid grid-cols-8 bg-muted/50 text-center">
                  {["Date", "Day", "In", "Out L", "In L", "Out", "Notes", "Sign"].map((h) => (
                    <div key={h} className="px-1 py-1 text-[6px] font-black text-muted-foreground border-r border-border/20 last:border-0">
                      {h}
                    </div>
                  ))}
                </div>
                {days.slice(0, 4).map((d, i) => (
                  <div key={i} className="grid grid-cols-8 border-t border-border/20 text-center">
                    <div className="px-1 py-1 text-[6px] text-muted-foreground border-r border-border/10">{fmtDate(d)}</div>
                    <div className="px-1 py-1 text-[6px] text-muted-foreground border-r border-border/10">{DAY_NAMES[d.getDay()].slice(0, 3)}</div>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className="px-1 py-1 border-r border-border/10 last:border-0" />
                    ))}
                  </div>
                ))}
                <div className="text-center py-1 text-[6px] text-muted-foreground/40 border-t border-border/10">
                  ... {10} more rows
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                <span className="text-[7px] text-muted-foreground/40">Supervisor's Signature: ____________</span>
                <span className="text-[7px] text-muted-foreground/40">Date: ____________</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">1 page</span>
              <span className="text-[10px] text-muted-foreground">— print and fill manually</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Employee List Preview ═══ */}
      {employees.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-bold">Employees in Timesheet</p>
            </div>
            <span className="text-xs text-muted-foreground font-bold">{employees.length} total</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
              {employees.map((emp: any, i: number) => (
                <div key={emp._id || i} className="flex items-center gap-2 px-4 py-2.5 border-b border-r border-border/20 hover:bg-muted/20 transition-colors">
                  <span className="text-[10px] font-bold text-muted-foreground/40 w-5 text-right shrink-0">{i + 1}</span>
                  {emp.profileImage ? (
                    <img src={emp.profileImage} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-border/30 shrink-0" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-[8px] font-bold text-muted-foreground">
                        {(emp.firstName?.[0] || "")}{(emp.lastName?.[0] || "")}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-foreground truncate">
                    {`${emp.firstName || ""} ${emp.lastName || ""}`.trim()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
