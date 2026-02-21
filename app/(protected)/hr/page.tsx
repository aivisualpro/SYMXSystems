"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Clock,
  CalendarDays,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Briefcase,
  Loader2,
} from "lucide-react";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";

// ── KPI Card ──
function KPICard({
  label, value, subtitle, icon: Icon, trend, trendLabel, accentFrom, accentTo,
}: {
  label: string; value: string | number; subtitle?: string;
  icon: any; trend?: "up" | "down" | "neutral"; trendLabel?: string;
  accentFrom: string; accentTo: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all hover:shadow-lg hover:border-border">
      <div className={cn("absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b", accentFrom, accentTo)} />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
          <p className="text-3xl font-black tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-muted/40 group-hover:bg-muted transition-colors">
          <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>
      {trend && trendLabel && (
        <div className="flex items-center gap-1 mt-3">
          {trend === "up" ? (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          ) : trend === "down" ? (
            <TrendingDown className="h-3 w-3 text-red-500" />
          ) : null}
          <span className={cn("text-[10px] font-bold", 
            trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          )}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Status Breakdown Row ──
function StatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-xs font-bold text-muted-foreground">{count} <span className="text-[10px] font-normal">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Type Breakdown Chip ──
function TypeChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border bg-card")}>
      <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="text-xs font-black text-muted-foreground ml-auto">{count}</span>
    </div>
  );
}

export default function EmployeesDashboardPage() {
  const [employees, setEmployees] = useState<ISymxEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/employees");
        if (res.ok) {
          const data = await res.json();
          setEmployees(data);
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Computed Stats ──
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === "Active").length;
    const terminated = employees.filter(e => e.status === "Terminated").length;
    const resigned = employees.filter(e => e.status === "Resigned" || e.resignationDate).length;
    const inactive = employees.filter(e => e.status === "Inactive").length;

    // Type breakdown
    const typeMap: Record<string, number> = {};
    employees.forEach(e => {
      const t = e.type || "Unassigned";
      typeMap[t] = (typeMap[t] || 0) + 1;
    });

    // Recent hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentHires = employees.filter(e => {
      if (!e.hiredDate) return false;
      return new Date(e.hiredDate) >= thirtyDaysAgo;
    }).length;

    // Expiring documents (DL within 30 days)
    const expiringDL = employees.filter(e => {
      if (!e.dlExpiration || e.status !== "Active") return false;
      const exp = new Date(e.dlExpiration);
      const now = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      return exp >= now && exp <= thirtyDays;
    }).length;

    // Missing documents
    const missingDocs = employees.filter(e => {
      if (e.status !== "Active") return false;
      return !e.offerLetterFile || !e.driversLicenseFile || !e.i9File;
    }).length;

    // Hourly status breakdown
    const hourlyMap: Record<string, number> = {};
    employees.filter(e => e.status === "Active").forEach(e => {
      const h = e.hourlyStatus || "Unspecified";
      hourlyMap[h] = (hourlyMap[h] || 0) + 1;
    });

    return {
      total, active, terminated, resigned, inactive,
      typeMap, recentHires, expiringDL, missingDocs, hourlyMap,
    };
  }, [employees]);

  const typeColors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Employees"
          value={stats.total}
          subtitle={`${stats.active} active`}
          icon={Users}
          accentFrom="from-blue-400"
          accentTo="to-blue-600"
        />
        <KPICard
          label="Active"
          value={stats.active}
          subtitle={`${((stats.active / Math.max(stats.total, 1)) * 100).toFixed(0)}% of total`}
          icon={UserCheck}
          trend="up"
          trendLabel="Headcount"
          accentFrom="from-emerald-400"
          accentTo="to-emerald-600"
        />
        <KPICard
          label="Recent Hires"
          value={stats.recentHires}
          subtitle="Last 30 days"
          icon={UserPlus}
          trend={stats.recentHires > 0 ? "up" : "neutral"}
          trendLabel={stats.recentHires > 0 ? "New additions" : "No new hires"}
          accentFrom="from-purple-400"
          accentTo="to-purple-600"
        />
        <KPICard
          label="Terminated"
          value={stats.terminated}
          subtitle={`${stats.resigned} resigned`}
          icon={UserX}
          trend={stats.terminated > 0 ? "down" : "neutral"}
          trendLabel={stats.terminated > 0 ? `${stats.terminated} total` : "None"}
          accentFrom="from-red-400"
          accentTo="to-red-600"
        />
      </div>

      {/* ── Second Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Employee Status Breakdown */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Status Breakdown</h3>
          </div>
          <div className="space-y-3">
            <StatusRow label="Active" count={stats.active} total={stats.total} color="bg-emerald-500" />
            <StatusRow label="Terminated" count={stats.terminated} total={stats.total} color="bg-red-500" />
            <StatusRow label="Resigned" count={stats.resigned} total={stats.total} color="bg-amber-500" />
            <StatusRow label="Inactive" count={stats.inactive} total={stats.total} color="bg-zinc-400" />
          </div>
        </div>

        {/* Employee Types */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">By Type</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.typeMap)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count], idx) => (
                <TypeChip key={type} label={type} count={count} color={typeColors[idx % typeColors.length]} />
              ))}
          </div>
        </div>

        {/* Alerts & Compliance */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Compliance Alerts</h3>
          </div>
          <div className="space-y-3">
            {/* DL Expiring Soon */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              stats.expiringDL > 0
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
            )}>
              <div className={cn("p-2 rounded-lg", stats.expiringDL > 0 ? "bg-amber-500/10" : "bg-emerald-500/10")}>
                <AlertTriangle className={cn("h-4 w-4", stats.expiringDL > 0 ? "text-amber-500" : "text-emerald-500")} />
              </div>
              <div>
                <p className="text-xs font-bold">{stats.expiringDL > 0 ? `${stats.expiringDL} DL Expiring Soon` : "All DLs Valid"}</p>
                <p className="text-[10px] text-muted-foreground">Within next 30 days</p>
              </div>
            </div>

            {/* Missing Documents */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              stats.missingDocs > 0
                ? "bg-red-500/5 border-red-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
            )}>
              <div className={cn("p-2 rounded-lg", stats.missingDocs > 0 ? "bg-red-500/10" : "bg-emerald-500/10")}>
                <AlertTriangle className={cn("h-4 w-4", stats.missingDocs > 0 ? "text-red-500" : "text-emerald-500")} />
              </div>
              <div>
                <p className="text-xs font-bold">{stats.missingDocs > 0 ? `${stats.missingDocs} Missing Documents` : "All Docs Complete"}</p>
                <p className="text-[10px] text-muted-foreground">Offer letter, DL, or I-9</p>
              </div>
            </div>

            {/* Active Headcount */}
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-blue-500/5 border-blue-500/20">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold">{stats.active} Active Employees</p>
                <p className="text-[10px] text-muted-foreground">Current headcount</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hourly Status Breakdown ── */}
      {Object.keys(stats.hourlyMap).length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Hourly Status Distribution</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(stats.hourlyMap)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 border border-border/50">
                  <span className="text-xs font-semibold text-foreground truncate">{status}</span>
                  <span className="text-sm font-black text-foreground ml-2">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
