"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Truck, Package, Clock, Users, AlertTriangle, Wrench,
  ChevronRight, CalendarClock, Gauge, TrendingDown,
  CircleDot, Timer, MapPin, FileWarning, Shield, Loader2
} from "lucide-react";
import { useEffect, useState } from "react";
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

  const repairsData = data ? [
    { status: "All", count: data.totalRepairs || 0 },
    { status: "Completed", count: data.repairStatusMap?.["Completed"] || 0, color: "bg-emerald-500" },
    { status: "Not started", count: data.repairStatusMap?.["Not Started"] || 0, color: "bg-slate-500" },
    { status: "Repair in progress", count: data.repairStatusMap?.["In Progress"] || 0, color: "bg-blue-500" },
    { status: "Sent to repair shop", count: data.repairStatusMap?.["Sent to Repair Shop"] || 0, color: "bg-amber-500" },
    { status: "Waiting for parts", count: data.repairStatusMap?.["Waiting for Parts"] || 0, color: "bg-red-500" },
  ] : REPAIRS_DATA;

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
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Package className="h-4 w-4 text-blue-500" />
              </div>
              Loadout Summary
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-mono">{LOADOUT_DATA.date}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border/50">
            <StatRow icon={MapPin} label="Routes" value={LOADOUT_DATA.routes} />
            <StatRow icon={Users} label="Operations" value={LOADOUT_DATA.operations} />
            <StatRow icon={AlertTriangle} label="Call Out" value={LOADOUT_DATA.callOut} valueClassName={LOADOUT_DATA.callOut > 0 ? "text-amber-500" : ""} />
            <StatRow icon={TrendingDown} label="Reduction" value={LOADOUT_DATA.reduction} valueClassName={LOADOUT_DATA.reduction > 0 ? "text-red-400" : ""} />
            <StatRow icon={Timer} label="Avg Route Duration" value={`${LOADOUT_DATA.avgRouteDuration} hrs`} />
            <StatRow icon={Package} label="Avg Package Count" value={LOADOUT_DATA.avgPackageCount.toLocaleString()} />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-bold">Total Package Count</span>
            <span className="text-lg font-black font-mono tabular-nums text-primary">{LOADOUT_DATA.totalPackageCount.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 2. ROSTER SUMMARY ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
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
            <span className="text-2xl font-black font-mono text-primary">{ROSTER_DATA.assignedRoutes}</span>
          </div>

          <div className="divide-y divide-border/50">
            <div className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80 flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  Working Vans <span className="text-[10px] text-muted-foreground">({ROSTER_DATA.workingVans.date})</span>
                </span>
                <span className="text-sm font-semibold">Total: {ROSTER_DATA.workingVans.total}</span>
              </div>
              <div className="flex gap-3 mt-1 ml-6">
                <span className="text-[11px] text-muted-foreground">XL: <span className="font-bold text-foreground">{ROSTER_DATA.workingVans.xl}</span></span>
                <span className="text-[11px] text-muted-foreground">LG: <span className="font-bold text-foreground">{ROSTER_DATA.workingVans.lg}</span></span>
                <span className="text-[11px] text-muted-foreground">SM: <span className="font-bold text-foreground">{ROSTER_DATA.workingVans.sm}</span></span>
              </div>
            </div>

            <div className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/80 flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  Routes Rostered
                </span>
                <span className="text-sm font-semibold">Total: {ROSTER_DATA.routesRostered.total}</span>
              </div>
              <div className="flex gap-3 mt-1 ml-6">
                <span className="text-[11px] text-muted-foreground">XL: <span className="font-bold text-foreground">{ROSTER_DATA.routesRostered.xl}</span></span>
                <span className="text-[11px] text-muted-foreground">LG: <span className="font-bold text-foreground">{ROSTER_DATA.routesRostered.lg}</span></span>
                <span className="text-[11px] text-muted-foreground">SM: <span className="font-bold text-foreground">{ROSTER_DATA.routesRostered.sm}</span></span>
              </div>
            </div>

            <StatRow label="Extras" value={`Stand by: ${ROSTER_DATA.extras.standby}, Open: ${ROSTER_DATA.extras.open}, Close: ${ROSTER_DATA.extras.close}`} />
            <StatRow label="Other" value={`AMZ: ${ROSTER_DATA.other.amzTraining}, OTR: ${ROSTER_DATA.other.trainingOTR}, Trainer: ${ROSTER_DATA.other.trainer}`} />
          </div>
        </CardContent>
      </Card>

      {/* ═══ 3. EFFICIENCY LOG ═══ */}
      <Card className="overflow-hidden group/card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <Gauge className="h-4 w-4 text-emerald-500" />
            </div>
            Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border/50 max-h-[320px] overflow-y-auto">
            {EFFICIENCY_LOG.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between py-3 px-1 hover:bg-muted/30 rounded transition-colors",
                  entry.alert && "bg-red-500/5"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{entry.date}</p>
                  <p className={cn(
                    "text-xs mt-0.5 font-semibold",
                    entry.alert ? "text-amber-500" : entry.efficiency >= 98 ? "text-emerald-500" : entry.efficiency >= 96 ? "text-green-500" : "text-amber-500"
                  )}>
                    {entry.alert && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                    Efficiency {entry.efficiency.toFixed(2)}% CPR ${entry.cpr.toFixed(2)}
                  </p>
                </div>
                <CalendarClock className="h-4 w-4 text-muted-foreground/50" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10">
              <Wrench className="h-4 w-4 text-amber-500" />
            </div>
            Repairs
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Current Status</div>
          <div className="divide-y divide-border/50">
            {repairsData.map((item: any, i: number) => (
              <div
                key={i}
                onClick={() => router.push(`/fleet/repairs${item.status !== "All" ? `?status=${item.status}` : ""}`)}
                className="flex items-center justify-between py-2.5 px-1 hover:bg-muted/30 rounded transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  {item.color && <div className={cn("w-2 h-2 rounded-full", item.color)} />}
                  <span className={cn("text-sm", i === 0 ? "font-bold" : "text-foreground/80")}>{item.status}</span>
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
