"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Truck, Package, Clock, Users, AlertTriangle, Wrench,
  ChevronRight, ChevronLeft, CalendarClock, Gauge, TrendingDown,
  CircleDot, Timer, MapPin, FileWarning, Shield, Loader2
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Dummy Data ────────────────────────────────────────────────────────────

const LOADOUT_DATA = {
  date: "02/07/2026",
  routes: 27,
  operations: 3,
  callOut: 1,
  reduction: 2,
  avgRouteDuration: 7.47,
  avgPackageCount: 344,
  totalPackageCount: 9276,
};

const ROSTER_DATA = {
  assignedRoutes: 25,
  workingVans: { total: 33, xl: 33, lg: 0, sm: 0, date: "02/08/26" },
  routesRostered: { total: 29, xl: 24, lg: 0, sm: 0 },
  extras: { standby: 0, open: 2, close: 2 },
  other: { amzTraining: 0, trainingOTR: 0, trainer: 0 },
};

const EFFICIENCY_LOG = [
  { date: "02/08/2026", efficiency: 0, cpr: 0, alert: true },
  { date: "02/09/2026", efficiency: 0, cpr: 0, alert: false },
  { date: "02/10/2026", efficiency: 0, cpr: 0, alert: false },
  { date: "02/11/2026", efficiency: 0, cpr: 0, alert: false },
  { date: "02/12/2026", efficiency: 98.42, cpr: 214.50, alert: false },
  { date: "02/13/2026", efficiency: 97.85, cpr: 221.30, alert: false },
  { date: "02/14/2026", efficiency: 99.10, cpr: 198.75, alert: false },
];

const FLEET_NOT_WORKING = [
  { vehicle: "4", days: 17, mileage: 58107, notes: "", alert: true },
  { vehicle: "47", days: 10, mileage: 22387, notes: "", alert: true },
  { vehicle: "12", days: 5, mileage: 41250, notes: "Transmission issue", alert: false },
];

const REPAIRS_DATA = [
  { status: "All", count: null },
  { status: "Completed", count: 1855, color: "bg-emerald-500" },
  { status: "Not started", count: 2, color: "bg-slate-500" },
  { status: "Repair in progress", count: 18, color: "bg-blue-500" },
  { status: "Sent to repair shop", count: 1, color: "bg-amber-500" },
  { status: "Waiting for parts", count: 1, color: "bg-red-500" },
];

const REGISTRATION_EXPIRY: { vehicle: string; expiry: string; daysLeft: number }[] = [];

// ── Sub-Components ────────────────────────────────────────────────────────

function StatRow({ icon: Icon, label, value, className, valueClassName }: {
  icon?: any; label: string; value: string | number; className?: string; valueClassName?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2.5 group", className)}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />}
        <span className="text-sm text-foreground/80">{label}</span>
      </div>
      <span className={cn("text-sm font-semibold font-mono tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

// ── Week helpers (Sun-based, Pacific Time) ──
function getCurrentYearWeek(): string {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const date = new Date(todayStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay();
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

function shiftWeek(yearWeek: string, delta: number): string {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) return yearWeek;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const target = new Date(firstSunday);
  target.setUTCDate(firstSunday.getUTCDate() + (week - 1 + delta) * 7);
  const tYear = target.getUTCFullYear();
  const tJan1 = new Date(Date.UTC(tYear, 0, 1));
  const tJan1Day = tJan1.getUTCDay();
  const tFirstSunday = new Date(tJan1);
  tFirstSunday.setUTCDate(tJan1.getUTCDate() - tJan1Day);
  const tDiffMs = target.getTime() - tFirstSunday.getTime();
  const tDiffDays = Math.round(tDiffMs / 86400000);
  const tWeekNum = Math.floor(tDiffDays / 7) + 1;
  return `${tYear}-W${tWeekNum.toString().padStart(2, "0")}`;
}

function formatWeekShort(yearWeek: string): string {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) return yearWeek;
  return `Week ${parseInt(match[2])}, ${match[1]}`;
}

const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function EfficiencyCard() {
  const router = useRouter();
  const [yearWeek, setYearWeek] = useState(getCurrentYearWeek);
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEfficiency = useCallback(async (w: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fleet?section=efficiency&yearWeek=${encodeURIComponent(w)}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDays(json.days || []);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEfficiency(yearWeek); }, [yearWeek, fetchEfficiency]);

  const currentWeek = getCurrentYearWeek();
  const avgEfficiency = days.filter(d => d.efficiency > 0);
  const weekAvg = avgEfficiency.length > 0
    ? Math.round(avgEfficiency.reduce((s, d) => s + d.efficiency, 0) / avgEfficiency.length * 100) / 100
    : 0;

  return (
    <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <Gauge className="h-4 w-4 text-emerald-500" />
            </div>
            Efficiency
          </CardTitle>
          {weekAvg > 0 && (
            <Badge variant="secondary" className={cn(
              "text-[10px] h-5 font-mono font-bold",
              weekAvg >= 98 ? "text-emerald-500" : weekAvg >= 96 ? "text-green-500" : "text-amber-500"
            )}>
              Avg {weekAvg}%
            </Badge>
          )}
        </div>
        {/* Week Navigator */}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setYearWeek(w => shiftWeek(w, -1))}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className={cn(
            "text-[11px] font-semibold",
            yearWeek === currentWeek ? "text-primary" : "text-muted-foreground"
          )}>
            {formatWeekShort(yearWeek)}
            {yearWeek === currentWeek && <span className="ml-1.5 text-[9px] opacity-60">(current)</span>}
          </span>
          <button
            onClick={() => setYearWeek(w => shiftWeek(w, 1))}
            disabled={yearWeek >= currentWeek}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {days.map((entry, i) => {
              const d = new Date(entry.date + "T00:00:00Z");
              const dayLabel = SHORT_DAY_NAMES[d.getUTCDay()];
              const dateDisplay = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
              const hasData = entry.efficiency > 0;
              const isAlert = hasData && entry.efficiency < 95;
              return (
                <div
                  key={i}
                  onClick={() => router.push(`/dispatching/efficiency?week=${yearWeek}&date=${entry.date}`)}
                  className={cn(
                    "flex items-center justify-between py-3 px-1 hover:bg-muted/30 rounded transition-colors cursor-pointer",
                    isAlert && "bg-red-500/5"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground text-[11px] mr-1.5">{dayLabel}</span>
                      {dateDisplay}
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5 font-semibold",
                      !hasData ? "text-muted-foreground/40"
                        : isAlert ? "text-amber-500"
                          : entry.efficiency >= 98 ? "text-emerald-500"
                            : "text-green-500"
                    )}>
                      {isAlert && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      Efficiency {hasData ? `${entry.efficiency.toFixed(2)}%` : "—"}
                      {" "}CPR {hasData ? `$${entry.cpr.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <CalendarClock className="h-4 w-4 text-muted-foreground/30" />
                </div>
              );
            })}
            {days.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground/50">
                No efficiency data for this week
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────

export function DashboardWidgets() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/fleet?section=dashboard")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error("Dashboard fetch error:", e);
        setLoading(false);
      });
  }, []);

  const STATUS_COLORS: Record<string, string> = {
    "Not Started": "bg-slate-500",
    "Not started": "bg-slate-500",
    "In Progress": "bg-blue-500",
    "Repair in progress": "bg-blue-500",
    "Sent to Repair Shop": "bg-amber-500",
    "Sent to repair shop": "bg-amber-500",
    "Waiting for Parts": "bg-red-500",
    "Waiting for parts": "bg-red-500",
    "Completed": "bg-emerald-500",
  };

  const repairsData = data?.repairStatusMap ? Object.entries(data.repairStatusMap as Record<string, number>)
    .filter(([status, count]) => status !== "Completed" && count > 0)
    .map(([status, count]) => ({
      status,
      count,
      color: STATUS_COLORS[status] || "bg-primary",
    })) : REPAIRS_DATA.filter(r => r.status !== "All" && r.status !== "Completed" && (r.count ?? 1) > 0);

  const fleetNotWorking = data?.fleetNotWorking ? data.fleetNotWorking.map((v: any) => {
    const days = Math.floor((new Date().getTime() - new Date(v.updatedAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
    const latestComm = v.fleetCommunications?.length ? v.fleetCommunications[v.fleetCommunications.length - 1].comments : "";
    return {
      id: v._id,
      vehicle: v.vehicleName || v.unitNumber || "Unknown",
      days,
      mileage: v.mileage || 0,
      notes: latestComm || v.notes || "",
      alert: days >= 14,
    };
  }) : FLEET_NOT_WORKING;

  const registrationExpiry = data?.registrationExpiring ? data.registrationExpiring.map((v: any) => {
    const exp = new Date(v.registrationExpiration);
    const daysLeft = Math.ceil((exp.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: v._id,
      vehicle: v.vehicleName || v.unitNumber || "Unknown",
      expiry: exp.toLocaleDateString(),
      daysLeft,
    };
  }) : REGISTRATION_EXPIRY;

  // Dispatching data (Loadout + Roster)
  const dispatching = data?.dispatching;
  const loadout = dispatching?.loadout ? {
    ...dispatching.loadout,
    date: dispatching.date || "",
  } : { ...LOADOUT_DATA };
  const roster = dispatching?.roster || ROSTER_DATA;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      {/* ═══ 1. LOADOUT SUMMARY ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/dispatching")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Package className="h-4 w-4 text-blue-500" />
              </div>
              Loadout Summary
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-mono">{loadout.date}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border/50">
            <StatRow icon={MapPin} label="Routes" value={loadout.routes} />
            <StatRow icon={Users} label="Operations" value={loadout.operations} />
            <StatRow icon={AlertTriangle} label="Call Out" value={loadout.callOut} valueClassName={loadout.callOut > 0 ? "text-amber-500" : ""} />
            <StatRow icon={TrendingDown} label="Reduction" value={loadout.reduction} valueClassName={loadout.reduction > 0 ? "text-red-400" : ""} />
            <StatRow icon={Timer} label="Avg Route Duration" value={loadout.avgRouteDuration > 0 ? `${loadout.avgRouteDuration} hrs` : "—"} />
            <StatRow icon={Package} label="Avg Package Count" value={loadout.avgPackageCount > 0 ? loadout.avgPackageCount.toLocaleString() : "—"} />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-bold">Total Package Count</span>
            <span className="text-lg font-black font-mono tabular-nums text-primary">{loadout.totalPackageCount.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 2. ROSTER SUMMARY ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/dispatching/roster")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-green-500/10">
              <Users className="h-4 w-4 text-green-500" />
            </div>
            Roster Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Assigned Routes - hero number */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
            <span className="text-sm font-medium">Assigned Routes</span>
            <span className="text-2xl font-black font-mono text-primary">{roster.assignedRoutes}</span>
          </div>

          <div className="divide-y divide-border/50">
            <div className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80 flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  Working Vans
                </span>
                <span className="text-sm font-semibold">Total: {roster.workingVans.total}</span>
              </div>
              <div className="flex gap-3 mt-1 ml-6">
                <span className="text-[11px] text-muted-foreground">XL: <span className="font-bold text-foreground">{roster.workingVans.xl}</span></span>
                <span className="text-[11px] text-muted-foreground">LG: <span className="font-bold text-foreground">{roster.workingVans.lg}</span></span>
                <span className="text-[11px] text-muted-foreground">SM: <span className="font-bold text-foreground">{roster.workingVans.sm}</span></span>
              </div>
            </div>

            <div className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80 flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  Routes Rostered
                </span>
                <span className="text-sm font-semibold">Total: {roster.routesRostered.total}</span>
              </div>
              <div className="flex gap-3 mt-1 ml-6">
                <span className="text-[11px] text-muted-foreground">XL: <span className="font-bold text-foreground">{roster.routesRostered.xl}</span></span>
                <span className="text-[11px] text-muted-foreground">LG: <span className="font-bold text-foreground">{roster.routesRostered.lg}</span></span>
                <span className="text-[11px] text-muted-foreground">SM: <span className="font-bold text-foreground">{roster.routesRostered.sm}</span></span>
              </div>
            </div>

            <StatRow label="Extras" value={`Stand by: ${roster.extras.standby}, Open: ${roster.extras.open}, Close: ${roster.extras.close}`} />
            <StatRow label="Other" value={`AMZ: ${roster.other.amzTraining}, OTR: ${roster.other.trainingOTR}, Trainer: ${roster.other.trainer}`} />
          </div>
        </CardContent>
      </Card>

      {/* ═══ 3. EFFICIENCY LOG ═══ */}
      <EfficiencyCard />

      {/* ═══ 4. FLEET NOT WORKING ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <Truck className="h-4 w-4 text-red-500" />
              </div>
              Fleet Not Working
            </CardTitle>
            <Badge variant="destructive" className="text-[10px] h-5">{fleetNotWorking.length} vehicles</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-[100px_80px_80px_1fr] gap-2 py-2 px-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
            <div>Vehicle</div>
            <div className="text-center">Days Out</div>
            <div className="text-right">Mileage</div>
            <div>Notes</div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border/30">
            {fleetNotWorking.map((v: any, i: number) => (
              <div
                key={i}
                onClick={v.id ? () => router.push(`/fleet/vehicles/${v.id}`) : undefined}
                className={cn(
                  "grid grid-cols-[100px_80px_80px_1fr] gap-2 py-2.5 px-1 hover:bg-muted/30 rounded transition-colors items-center cursor-pointer",
                  v.alert && "bg-amber-500/5"
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {v.alert && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                  <span className="text-sm font-semibold font-mono truncate">{v.vehicle}</span>
                </div>
                <div className="text-center">
                  <span className={cn(
                    "text-sm font-mono font-semibold",
                    v.days >= 14 ? "text-red-500" : v.days >= 7 ? "text-amber-500" : ""
                  )}>
                    {v.days}
                  </span>
                </div>
                <div className="text-right text-sm font-mono truncate">{v.mileage.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground truncate" title={v.notes || "—"}>{v.notes || "—"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ 5. REPAIRS ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <Wrench className="h-4 w-4 text-amber-500" />
              </div>
              Open Repairs
            </CardTitle>
            {repairsData.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 font-mono">
                {repairsData.reduce((sum: number, r: any) => sum + (r.count || 0), 0)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {repairsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 rounded-full bg-muted/50 mb-3">
                <Wrench className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">All clear!</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">No open repairs 🎉</p>
            </div>
          ) : (
          <div className="divide-y divide-border/50">
            {repairsData.map((item: any, i: number) => (
              <div
                key={i}
                onClick={() => router.push(`/fleet/repairs?status=${item.status}`)}
                className="flex items-center justify-between py-2.5 px-1 hover:bg-muted/30 rounded transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  {item.color && <div className={cn("w-2 h-2 rounded-full", item.color)} />}
                  <span className="text-sm text-foreground/80">{item.status}</span>
                  {item.count != null && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                      {item.count.toLocaleString()}
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 6. REGISTRATION EXPIRY ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-500/10">
              <Shield className="h-4 w-4 text-purple-500" />
            </div>
            Registration Expiry
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {registrationExpiry.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 rounded-full bg-muted/50 mb-3">
                <FileWarning className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No items</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">All registrations are current</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {registrationExpiry.map((item: any, i: number) => (
                <div 
                  key={i} 
                  onClick={item.id ? () => router.push(`/fleet/vehicles/${item.id}`) : undefined}
                  className="flex items-center justify-between py-2.5 px-1 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">Vehicle {item.vehicle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{item.expiry}</span>
                    <Badge
                      variant={item.daysLeft <= 7 ? "destructive" : item.daysLeft <= 30 ? "secondary" : "outline"}
                      className="text-[10px] h-4"
                    >
                      {item.daysLeft}d
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
