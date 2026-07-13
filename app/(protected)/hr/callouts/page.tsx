"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notify";
import { Loader2, Download, PhoneOff, Search, Users, TrendingUp, CalendarDays, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import Papa from "papaparse";

interface CalloutRow {
  date: string;
  weekDay: string;
  transporterId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  phoneNumber: string;
  hiredDate: string;
  employeeStatus: string;
  originalShiftType: string;
  notes: string;
}

interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  transporterId: string;
  phoneNumber: string;
  hiredDate: string;
  employeeStatus: string;
  count: number;
  dates: string[];
  lastDate: string;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: string;
  direction: SortDirection;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function calloutBadgeVariant(count: number): "secondary" | "outline" | "destructive" {
  if (count >= 3) return "destructive";
  if (count === 2) return "outline";
  return "secondary";
}

function sortByKey<T extends Record<string, any>>(items: T[], sort: SortConfig): T[] {
  const sorted = [...items].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av ?? "").localeCompare(String(bv ?? ""));
  });
  return sort.direction === "asc" ? sorted : sorted.reverse();
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  sort: SortConfig;
  onSort: (key: string) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// Presets keep the range picker fast for the most common HR lookups
const PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function CalloutsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [to, setTo] = useState(toISODate(new Date()));
  const [rows, setRows] = useState<CalloutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"events" | "employees">("employees");
  // Default: only show currently-active employees. Terminated/resigned staff
  // are still in the data (their historical callouts still happened) but are
  // noise for an HR admin reviewing current attendance behavior.
  const [activeOnly, setActiveOnly] = useState(true);

  // Default sort: most recent first, on both views
  const [eventSort, setEventSort] = useState<SortConfig>({ key: "date", direction: "desc" });
  const [employeeSort, setEmployeeSort] = useState<SortConfig>({ key: "lastDate", direction: "desc" });

  const toggleSort = (setter: (fn: (prev: SortConfig) => SortConfig) => void, key: string) => {
    setter((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" }));
  };

  const fetchCallouts = async (nextFrom = from, nextTo = to) => {
    if (!nextFrom || !nextTo) {
      notify.error("Select both a start and end date");
      return;
    }
    if (nextFrom > nextTo) {
      notify.error("Start date must be before end date");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/callouts?from=${nextFrom}&to=${nextTo}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load callouts");
      setRows(json.rows || []);
    } catch (err: any) {
      notify.error(err.message || "Failed to load callouts");
    } finally {
      setLoading(false);
    }
  };

  // Load once on mount with the default range
  useEffect(() => {
    fetchCallouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const newFrom = toISODate(d);
    const newTo = toISODate(new Date());
    setFrom(newFrom);
    setTo(newTo);
    fetchCallouts(newFrom, newTo);
  };

  // ── Active-only filter applied first — everything downstream builds off this ──
  const visibleRows = useMemo(() => {
    if (!activeOnly) return rows;
    return rows.filter((r) => r.employeeStatus.toLowerCase() === "active");
  }, [rows, activeOnly]);

  // ── Per-employee callout counts within the current range (repeat-offender signal) ──
  const countsByTransporter = useMemo(() => {
    const map: Record<string, number> = {};
    visibleRows.forEach((r) => {
      map[r.transporterId] = (map[r.transporterId] || 0) + 1;
    });
    return map;
  }, [visibleRows]);

  // ── Employee-level aggregation ──
  const byEmployee = useMemo<EmployeeSummary[]>(() => {
    const map: Record<string, EmployeeSummary> = {};
    visibleRows.forEach((r) => {
      if (!map[r.transporterId]) {
        map[r.transporterId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          transporterId: r.transporterId,
          phoneNumber: r.phoneNumber,
          hiredDate: r.hiredDate,
          employeeStatus: r.employeeStatus,
          count: 0,
          dates: [],
          lastDate: r.date,
        };
      }
      map[r.transporterId].count += 1;
      map[r.transporterId].dates.push(r.date);
      if (r.date > map[r.transporterId].lastDate) map[r.transporterId].lastDate = r.date;
    });
    return Object.values(map);
  }, [visibleRows]);

  // ── Summary KPIs ──
  const summary = useMemo(() => {
    const weekdayBreakdown: Record<string, number> = {};
    WEEKDAYS.forEach((d) => (weekdayBreakdown[d] = 0));
    visibleRows.forEach((r) => {
      if (r.weekDay && weekdayBreakdown[r.weekDay] !== undefined) weekdayBreakdown[r.weekDay] += 1;
    });
    const busiest = Object.entries(weekdayBreakdown).sort((a, b) => b[1] - a[1])[0];
    const uniqueEmployees = byEmployee.length;
    const repeatOffenders = byEmployee.filter((e) => e.count >= 2).length;
    const avgPerEmployee = uniqueEmployees > 0 ? (visibleRows.length / uniqueEmployees) : 0;
    return {
      total: visibleRows.length,
      uniqueEmployees,
      repeatOffenders,
      avgPerEmployee,
      busiestDay: busiest && busiest[1] > 0 ? busiest[0] : "—",
      chartData: WEEKDAYS.map((d) => ({ day: d.slice(0, 3), count: weekdayBreakdown[d] })),
    };
  }, [visibleRows, byEmployee]);

  const eventRows = useMemo(() => {
    let filtered = visibleRows;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) => r.employeeName.toLowerCase().includes(q) || r.originalShiftType.toLowerCase().includes(q)
      );
    }
    return sortByKey(filtered, eventSort);
  }, [visibleRows, searchQuery, eventSort]);

  const employeeRows = useMemo(() => {
    let filtered = byEmployee;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((e) => e.employeeName.toLowerCase().includes(q));
    }
    return sortByKey(filtered, employeeSort);
  }, [byEmployee, searchQuery, employeeSort]);

  const exportCsv = () => {
    if (view === "employees") {
      if (employeeRows.length === 0) {
        notify.error("Nothing to export");
        return;
      }
      const csvRows = employeeRows.map((e) => ({
        "Employee Name": e.employeeName,
        Phone: e.phoneNumber,
        "Employee Status": e.employeeStatus,
        "Hired Date": e.hiredDate,
        "Callouts In Range": e.count,
        "Last Callout": e.lastDate,
        "All Dates": e.dates.join("; "),
      }));
      downloadCsv(csvRows, `callouts_by_employee_${from}_to_${to}.csv`);
    } else {
      if (eventRows.length === 0) {
        notify.error("Nothing to export");
        return;
      }
      const csvRows = eventRows.map((r) => ({
        Date: r.date,
        Day: r.weekDay,
        "Employee Name": r.employeeName,
        Phone: r.phoneNumber,
        "Employee Status": r.employeeStatus,
        "Hired Date": r.hiredDate,
        "Scheduled As (before Call Out)": r.originalShiftType,
        "Callouts In Range (this employee)": countsByTransporter[r.transporterId] || 1,
        Notes: r.notes,
      }));
      downloadCsv(csvRows, `callouts_${from}_to_${to}.csv`);
    }
  };

  const downloadCsv = (csvRows: any[], filename: string) => {
    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <PhoneOff className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Employee Callouts</h1>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from-date">From</Label>
          <Input id="from-date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to-date">To</Label>
          <Input id="to-date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={() => fetchCallouts()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Filter
        </Button>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="ghost" size="sm" onClick={() => applyPreset(p.days)}>
              {p.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={visibleRows.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label htmlFor="active-only" className="cursor-pointer">Active employees only</Label>
        </div>
        <div className="ml-auto flex flex-col gap-1.5">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Employee name or shift type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <PhoneOff className="h-8 w-8 text-red-500/70" />
            <div>
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total callouts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Users className="h-8 w-8 text-blue-500/70" />
            <div>
              <div className="text-2xl font-bold">{summary.uniqueEmployees}</div>
              <div className="text-xs text-muted-foreground">Employees involved</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <TrendingUp className="h-8 w-8 text-amber-500/70" />
            <div>
              <div className="text-2xl font-bold">{summary.repeatOffenders}</div>
              <div className="text-xs text-muted-foreground">Repeat (2+) in range</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CalendarDays className="h-8 w-8 text-violet-500/70" />
            <div>
              <div className="text-2xl font-bold">{summary.busiestDay}</div>
              <div className="text-xs text-muted-foreground">Busiest weekday</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Weekday breakdown chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Callouts by day of week</CardTitle>
        </CardHeader>
        <CardContent className="h-48 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip />
              <Bar dataKey="count" fill="#E52020" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── View toggle ── */}
      <div className="flex items-center justify-between">
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "events" | "employees")} variant="outline">
          <ToggleGroupItem value="employees">By Employee</ToggleGroupItem>
          <ToggleGroupItem value="events">By Event</ToggleGroupItem>
        </ToggleGroup>
        <div className="text-sm text-muted-foreground">
          {loading
            ? "Loading..."
            : view === "employees"
              ? `${employeeRows.length} employee${employeeRows.length === 1 ? "" : "s"}`
              : `${eventRows.length} event${eventRows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* ── By Employee view: surfaces repeat offenders for attendance-policy review ── */}
      {view === "employees" && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <SortableHeader label="Employee" sortKey="employeeName" sort={employeeSort} onSort={(k) => toggleSort(setEmployeeSort, k)} />
                <SortableHeader label="Status" sortKey="employeeStatus" sort={employeeSort} onSort={(k) => toggleSort(setEmployeeSort, k)} />
                <SortableHeader label="Phone" sortKey="phoneNumber" sort={employeeSort} onSort={(k) => toggleSort(setEmployeeSort, k)} />
                <SortableHeader label="Hired" sortKey="hiredDate" sort={employeeSort} onSort={(k) => toggleSort(setEmployeeSort, k)} />
                <SortableHeader label="Callouts" sortKey="count" sort={employeeSort} onSort={(k) => toggleSort(setEmployeeSort, k)} />
                <SortableHeader label="Last Callout" sortKey="lastDate" sort={employeeSort} onSort={(k) => toggleSort(setEmployeeSort, k)} />
              </tr>
            </thead>
            <tbody>
              {employeeRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No callouts found for this date range.
                  </td>
                </tr>
              )}
              {employeeRows.map((e) => (
                <tr key={e.transporterId} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {e.employeeId ? (
                      <Link href={`/hr/${e.employeeId}`} className="text-primary hover:underline">
                        {e.employeeName}
                      </Link>
                    ) : (
                      e.employeeName
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={e.employeeStatus.toLowerCase() === "active" ? "secondary" : "outline"}>
                      {e.employeeStatus || "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{e.phoneNumber}</td>
                  <td className="px-3 py-2">{e.hiredDate}</td>
                  <td className="px-3 py-2">
                    <Badge variant={calloutBadgeVariant(e.count)}>{e.count}</Badge>
                  </td>
                  <td className="px-3 py-2">{e.lastDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── By Event view: raw log of every call-out, including original scheduled shift ── */}
      {view === "events" && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <SortableHeader label="Date" sortKey="date" sort={eventSort} onSort={(k) => toggleSort(setEventSort, k)} />
                <SortableHeader label="Day" sortKey="weekDay" sort={eventSort} onSort={(k) => toggleSort(setEventSort, k)} />
                <SortableHeader label="Employee" sortKey="employeeName" sort={eventSort} onSort={(k) => toggleSort(setEventSort, k)} />
                <SortableHeader label="Scheduled As" sortKey="originalShiftType" sort={eventSort} onSort={(k) => toggleSort(setEventSort, k)} />
                <th className="px-3 py-2 text-left font-medium">In-Range Count</th>
                <th className="px-3 py-2 text-left font-medium">Tenure at Callout</th>
                <SortableHeader label="Notes" sortKey="notes" sort={eventSort} onSort={(k) => toggleSort(setEventSort, k)} />
              </tr>
            </thead>
            <tbody>
              {eventRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No callouts found for this date range.
                  </td>
                </tr>
              )}
              {eventRows.map((r, i) => {
                const tenureDays = daysBetween(r.hiredDate, r.date);
                const inRangeCount = countsByTransporter[r.transporterId] || 1;
                return (
                  <tr key={`${r.transporterId}-${r.date}-${i}`} className="border-t">
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.weekDay}</td>
                    <td className="px-3 py-2">
                      {r.employeeId ? (
                        <Link href={`/hr/${r.employeeId}`} className="text-primary hover:underline">
                          {r.employeeName}
                        </Link>
                      ) : (
                        r.employeeName
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{r.originalShiftType}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={calloutBadgeVariant(inRangeCount)}>{inRangeCount}</Badge>
                    </td>
                    <td className="px-3 py-2">{tenureDays !== null ? `${tenureDays}d` : "—"}</td>
                    <td className="px-3 py-2">{r.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
