"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDataStore } from "@/hooks/use-data-store";
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
  FileWarning,
  MapPin,
  Award,
  ArrowUpRight,
  Zap,
  BarChart3,
  Target,
  Calendar,
  Heart,
  Star,
  Shield,
  DollarSign,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";

// ── Animated Number ──
function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(undefined);
  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);
  return <>{display}</>;
}

// ── Donut Chart ──
function DonutChart({ segments, size = 120, strokeWidth = 14 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number; strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
        className="text-muted/20" />
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const o = offset;
        offset += dash;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-o}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        );
      })}
    </svg>
  );
}

// ── Mini Spark Bar ──
function SparkBar({ values, colors, height = 6 }: { values: number[]; colors: string[]; height?: number }) {
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <div className="flex w-full rounded-full overflow-hidden gap-0.5" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className={cn("transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full", colors[i])}
          style={{ width: `${total > 0 ? (v / total) * 100 : 0}%` }} />
      ))}
    </div>
  );
}

// ── Status Breakdown Row ──
function StatusRow({ label, count, total, color, onClick }: { label: string; count: number; total: number; color: string; onClick?: () => void }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div
      className={cn("space-y-1.5 p-2 -mx-2 rounded-lg transition-colors", onClick && "cursor-pointer hover:bg-muted/50 active:scale-[0.99]")}
      onClick={onClick}
    >
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
function TypeChip({ label, count, color, onClick }: { label: string; count: number; color: string; onClick?: () => void }) {
  return (
    <div
      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border bg-card transition-colors", onClick && "cursor-pointer hover:bg-muted/50 hover:border-primary/30 active:scale-[0.98]")}
      onClick={onClick}
    >
      <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="text-xs font-black text-muted-foreground ml-auto">{count}</span>
    </div>
  );
}

// ── Availability Day ──
function AvailabilityDay({ day, available, total }: { day: string; available: number; total: number }) {
  const pct = total > 0 ? (available / total) * 100 : 0;
  const intensity = pct > 75 ? "bg-emerald-500" : pct > 50 ? "bg-emerald-400/70" : pct > 25 ? "bg-amber-400/70" : "bg-red-400/60";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{day}</span>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black text-white transition-all", intensity)}>
        {available}
      </div>
      <span className="text-[9px] text-muted-foreground font-medium">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function EmployeesDashboardPage() {
  const store = useDataStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [incidentKpi, setIncidentKpi] = useState<any>(null);
  const [reimbursementKpi, setReimbursementKpi] = useState<any>(null);
  const hasSyncedFromStore = useRef(false);
  const router = useRouter();

  // ── Read from store instantly ──
  const storeStats = store.hrStats;
  const storeClaimsKpi = store.hrClaimsKpi;
  const storeReimbursementsKpi = store.hrReimbursementsKpi;

  useEffect(() => {
    if (storeStats && !hasSyncedFromStore.current) {
      setStats(storeStats);
      setIncidentKpi(storeClaimsKpi);
      setReimbursementKpi(storeReimbursementsKpi);
      hasSyncedFromStore.current = true;
      setLoading(false);
    }
  }, [storeStats, storeClaimsKpi, storeReimbursementsKpi]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, incRes, reimbRes] = await Promise.all([
        fetch("/api/admin/employees/dashboard"),
        fetch("/api/admin/claims?skip=0&limit=1"),
        fetch("/api/admin/reimbursements?skip=0&limit=1"),
      ]);
      if (dashRes.ok) {
        const data = await dashRes.json();
        setStats(data);
      }
      if (incRes.ok) {
        const data = await incRes.json();
        setIncidentKpi(data.kpi || null);
      }
      if (reimbRes.ok) {
        const data = await reimbRes.json();
        setReimbursementKpi(data.kpi || null);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!storeStats && !store.initialized) return;
    if (!storeStats) fetchData();
  }, [store.initialized]);

  const typeColors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  ];

  if (loading || !stats) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 h-[280px] rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
          <div className="lg:col-span-7 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[132px] rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* ══════════════ ROW 1 — Workforce Overview + Quick Stats ══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Combined Workforce Overview Card ── */}
        <div className="lg:col-span-5 rounded-2xl border border-border/50 bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Workforce Overview</h3>
            </div>
            <button onClick={() => router.push("/hr/employees")} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 transition-colors">
              View All <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative flex-shrink-0">
              <DonutChart
                segments={[
                  { value: stats.active, color: "#10b981", label: "Active" },
                  { value: stats.terminated, color: "#ef4444", label: "Terminated" },
                  { value: stats.resigned, color: "#f59e0b", label: "Resigned" },
                  { value: stats.inactive, color: "#71717a", label: "Inactive" },
                ]}
                size={130}
                strokeWidth={16}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-foreground"><AnimatedNumber value={stats.total} /></span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2.5">
              {[
                { label: "Active", count: stats.active, color: "bg-emerald-500", href: "/hr/employees?status=Active" },
                { label: "Terminated", count: stats.terminated, color: "bg-red-500", href: "/hr/terminations" },
                { label: "Resigned", count: stats.resigned, color: "bg-amber-500", href: "/hr/employees?status=Resigned" },
                { label: "Inactive", count: stats.inactive, color: "bg-zinc-500", href: "/hr/employees?status=Inactive" },
              ].map(s => (
                <div key={s.label} onClick={() => router.push(s.href)}
                  className="flex items-center justify-between cursor-pointer group p-1.5 -mx-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full", s.color)} />
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">{s.count}</span>
                    <span className="text-[10px] text-muted-foreground">({stats.total > 0 ? ((s.count / stats.total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Quick Metric Tiles ── */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Active Rate */}
          <div onClick={() => router.push("/hr/employees?status=Active")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-emerald-500/30 active:scale-[0.98]">
            <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Active</p>
              <div className="p-1.5 rounded-lg bg-emerald-500/10"><UserCheck className="h-3.5 w-3.5 text-emerald-500" /></div>
            </div>
            <p className="text-2xl font-black text-foreground"><AnimatedNumber value={stats.active} /></p>
            <div className="flex items-center gap-1 mt-1.5">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500">{stats.retentionRate}% retention</span>
            </div>
          </div>

          {/* Recent Hires */}
          <div onClick={() => router.push("/hr/hired")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-purple-500/30 active:scale-[0.98]">
            <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-purple-400 to-purple-600" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">New Hires</p>
              <div className="p-1.5 rounded-lg bg-purple-500/10"><UserPlus className="h-3.5 w-3.5 text-purple-500" /></div>
            </div>
            <p className="text-2xl font-black text-foreground"><AnimatedNumber value={stats.recentHires} /></p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Last 30 days</p>
          </div>

          {/* Turnover Rate */}
          <div onClick={() => router.push("/hr/terminations")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-red-500/30 active:scale-[0.98]">
            <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-red-400 to-red-600" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Turnover</p>
              <div className="p-1.5 rounded-lg bg-red-500/10"><TrendingDown className="h-3.5 w-3.5 text-red-500" /></div>
            </div>
            <p className="text-2xl font-black text-foreground"><AnimatedNumber value={stats.turnoverRate} />%</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1.5">{stats.terminated + stats.resigned} separated</p>
          </div>

          {/* Avg Tenure */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 transition-all hover:shadow-lg hover:border-cyan-500/30">
            <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-cyan-400 to-cyan-600" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Avg Tenure</p>
              <div className="p-1.5 rounded-lg bg-cyan-500/10"><Award className="h-3.5 w-3.5 text-cyan-500" /></div>
            </div>
            <p className="text-2xl font-black text-foreground"><AnimatedNumber value={stats.avgTenureMonths} /><span className="text-sm font-bold text-muted-foreground ml-1">mo</span></p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Active employees</p>
          </div>
        </div>
      </div>

      {/* ══════════════ ROW 1.5 — Reimbursements ══════════════ */}
      {reimbursementKpi && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Reimbursement Donut */}
          <div className="lg:col-span-5 rounded-2xl border border-border/50 bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <Receipt className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Reimbursements</h3>
              </div>
              <button onClick={() => router.push("/hr/reimbursement")} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 transition-colors">
                View All <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <DonutChart
                  segments={[
                    { value: reimbursementKpi.paidCount || 0, color: "#10b981", label: "Paid" },
                    { value: reimbursementKpi.unpaidCount || 0, color: "#f59e0b", label: "Unpaid" },
                  ]}
                  size={130}
                  strokeWidth={16}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-foreground"><AnimatedNumber value={reimbursementKpi.totalRecords || 0} /></span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {[
                  { label: "Paid", count: reimbursementKpi.paidCount || 0, dot: "#10b981" },
                  { label: "Unpaid", count: reimbursementKpi.unpaidCount || 0, dot: "#f59e0b" },
                ].map(s => {
                  const total = (reimbursementKpi.paidCount || 0) + (reimbursementKpi.unpaidCount || 0);
                  const pct = total > 0 ? ((s.count / total) * 100).toFixed(0) : "0";
                  return (
                    <div key={s.label} className="flex items-center justify-between p-1.5 -mx-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.dot }} />
                        <span className="text-xs font-semibold text-foreground">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">{s.count}</span>
                        <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reimbursement Quick Stats */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Requests */}
            <div onClick={() => router.push("/hr/reimbursement")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-teal-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-teal-400 to-teal-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Total</p>
                <div className="p-1.5 rounded-lg bg-teal-500/10"><Receipt className="h-3.5 w-3.5 text-teal-500" /></div>
              </div>
              <p className="text-2xl font-black text-foreground"><AnimatedNumber value={reimbursementKpi.totalRecords || 0} /></p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">All requests</p>
            </div>

            {/* Unpaid */}
            <div onClick={() => router.push("/hr/reimbursement")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-amber-400 to-amber-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Unpaid</p>
                <div className="p-1.5 rounded-lg bg-amber-500/10"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /></div>
              </div>
              <p className="text-2xl font-black text-foreground"><AnimatedNumber value={reimbursementKpi.unpaidCount || 0} /></p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Pending approval</p>
            </div>

            {/* Total Paid */}
            <div onClick={() => router.push("/hr/reimbursement")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-emerald-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Paid</p>
                <div className="p-1.5 rounded-lg bg-emerald-500/10"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /></div>
              </div>
              <p className="text-lg font-black text-emerald-500">${((reimbursementKpi.paidAmount || 0) / 1000).toFixed(1)}K</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Total paid out</p>
            </div>

            {/* Pending Amount */}
            <div onClick={() => router.push("/hr/reimbursement")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-orange-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-orange-400 to-orange-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Pending</p>
                <div className="p-1.5 rounded-lg bg-orange-500/10"><DollarSign className="h-3.5 w-3.5 text-orange-500" /></div>
              </div>
              <p className="text-lg font-black text-amber-500">${((reimbursementKpi.unpaidAmount || 0) / 1000).toFixed(1)}K</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Awaiting payment</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ROW 2 — Open Incidents Chart ══════════════ */}
      {incidentKpi && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Open Incidents Donut */}
          <div className="lg:col-span-5 rounded-2xl border border-border/50 bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20">
                  <Shield className="h-4 w-4 text-rose-400" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Open Incidents</h3>
              </div>
              <button onClick={() => router.push("/hr/incidents")} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 transition-colors">
                View All <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative flex-shrink-0">
                <DonutChart
                  segments={[
                    { value: incidentKpi.openInjuryCount || 0, color: "#f43f5e", label: "Injury" },
                    { value: incidentKpi.openAutoCount || 0, color: "#3b82f6", label: "Auto" },
                    { value: incidentKpi.openPropertyDamageCount || 0, color: "#f59e0b", label: "Property Damage" },
                  ]}
                  size={130}
                  strokeWidth={16}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-foreground"><AnimatedNumber value={incidentKpi.openCount || 0} /></span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Open</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {[
                  { label: "Injury", count: incidentKpi.openInjuryCount || 0, dot: "#f43f5e" },
                  { label: "Auto", count: incidentKpi.openAutoCount || 0, dot: "#3b82f6" },
                  { label: "Property Damage", count: incidentKpi.openPropertyDamageCount || 0, dot: "#f59e0b" },
                ].map(s => {
                  const total = (incidentKpi.openInjuryCount || 0) + (incidentKpi.openAutoCount || 0) + (incidentKpi.openPropertyDamageCount || 0);
                  const pct = total > 0 ? ((s.count / total) * 100).toFixed(0) : "0";
                  return (
                    <div key={s.label} className="flex items-center justify-between p-1.5 -mx-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.dot }} />
                        <span className="text-xs font-semibold text-foreground">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">{s.count}</span>
                        <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Incident Quick Stats */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Incidents */}
            <div onClick={() => router.push("/hr/incidents")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-rose-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-rose-400 to-rose-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Total</p>
                <div className="p-1.5 rounded-lg bg-rose-500/10"><Shield className="h-3.5 w-3.5 text-rose-500" /></div>
              </div>
              <p className="text-2xl font-black text-foreground"><AnimatedNumber value={incidentKpi.totalRecords || 0} /></p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">All incidents</p>
            </div>

            {/* Open */}
            <div onClick={() => router.push("/hr/incidents")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-amber-400 to-amber-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Open</p>
                <div className="p-1.5 rounded-lg bg-amber-500/10"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /></div>
              </div>
              <p className="text-2xl font-black text-foreground"><AnimatedNumber value={incidentKpi.openCount || 0} /></p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold text-emerald-500">{incidentKpi.closedCount || 0} closed</span>
              </div>
            </div>

            {/* Total Paid */}
            <div onClick={() => router.push("/hr/incidents")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-red-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-red-400 to-red-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Paid</p>
                <div className="p-1.5 rounded-lg bg-red-500/10"><DollarSign className="h-3.5 w-3.5 text-red-500" /></div>
              </div>
              <p className="text-lg font-black text-red-500">${((incidentKpi.totalPaid || 0) / 1000).toFixed(0)}K</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Total payouts</p>
            </div>

            {/* Reserved */}
            <div onClick={() => router.push("/hr/incidents")}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:shadow-lg hover:border-blue-500/30 active:scale-[0.98]">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full bg-gradient-to-b from-blue-400 to-blue-600" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Reserved</p>
                <div className="p-1.5 rounded-lg bg-blue-500/10"><DollarSign className="h-3.5 w-3.5 text-blue-500" /></div>
              </div>
              <p className="text-lg font-black text-amber-500">${((incidentKpi.totalReserved || 0) / 1000).toFixed(0)}K</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1.5">Pending reserves</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Employee Audit Card ══════════════ */}
      {stats.employeeAuditCount > 0 && (
        <div
          onClick={() => router.push("/hr/audit")}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 cursor-pointer transition-all hover:shadow-lg hover:border-orange-500/30 active:scale-[0.99]"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full rounded-r-full bg-gradient-to-b from-orange-400 to-red-500" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
                <FileWarning className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Employee Audit</h3>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Active employees with compliance issues
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-3xl font-black text-orange-500"><AnimatedNumber value={stats.employeeAuditCount} /></p>
                <p className="text-[10px] font-bold text-muted-foreground">need attention</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
            </div>
          </div>
          {/* Mini breakdown */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/40">
            {[
              { label: "DL Expired", count: stats.expiredDL || 0, color: "text-red-500" },
              { label: "Missing Docs", count: stats.missingDocs || 0, color: "text-amber-500" },
              { label: "DL Expiring", count: stats.expiringDL || 0, color: "text-orange-400" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={cn("text-sm font-black", item.color)}>{item.count}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ ROW 2 — Status, Types, Compliance ══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Employee Status Breakdown ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Status Breakdown</h3>
          </div>
          <SparkBar
            values={[stats.active, stats.terminated, stats.resigned, stats.inactive]}
            colors={["bg-emerald-500", "bg-red-500", "bg-amber-500", "bg-zinc-400"]}
            height={8}
          />
          <div className="space-y-2">
            <StatusRow label="Active" count={stats.active} total={stats.total} color="bg-emerald-500" onClick={() => router.push("/hr/employees?status=Active")} />
            <StatusRow label="Terminated" count={stats.terminated} total={stats.total} color="bg-red-500" onClick={() => router.push("/hr/terminations")} />
            <StatusRow label="Resigned" count={stats.resigned} total={stats.total} color="bg-amber-500" onClick={() => router.push("/hr/employees?status=Resigned")} />
            <StatusRow label="Inactive" count={stats.inactive} total={stats.total} color="bg-zinc-400" onClick={() => router.push("/hr/employees?status=Inactive")} />
          </div>
        </div>

        {/* ── Employee Types ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">By Type</h3>
          </div>
          <div className="space-y-2">
            {(Object.entries(stats.typeMap) as [string, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([type, count], idx) => (
                <TypeChip key={type} label={type} count={count} color={typeColors[idx % typeColors.length]} onClick={() => router.push(`/hr/employees?type=${encodeURIComponent(type)}`)} />
              ))}
          </div>
        </div>

        {/* ── Document Compliance Score ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Compliance Score</h3>
            </div>
            <span className={cn(
              "text-lg font-black",
              stats.docCompliancePct >= 80 ? "text-emerald-500" : stats.docCompliancePct >= 50 ? "text-amber-500" : "text-red-500"
            )}>
              {stats.docCompliancePct}%
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Offer Letter", count: stats.hasOfferLetter, icon: "📄" },
              { label: "Driver's License", count: stats.hasDL, icon: "🪪" },
              { label: "I-9 Form", count: stats.hasI9, icon: "📋" },
              { label: "Drug Test", count: stats.hasDrugTest, icon: "🧪" },
              { label: "Handbook", count: stats.hasHandbook, icon: "📖" },
            ].map(doc => {
              const pct = stats.activeCount > 0 ? (doc.count / stats.activeCount) * 100 : 0;
              return (
                <div key={doc.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                      <span className="text-xs">{doc.icon}</span> {doc.label}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">{doc.count}/{stats.activeCount}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700 ease-out",
                      pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
                    )} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════ ROW 3 — Tenure + Availability + Alerts ══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Tenure Distribution ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Tenure Distribution</h3>
          </div>
          <div className="space-y-2.5">
            {(Object.entries(stats.tenureBuckets) as [string, number][]).map(([bucket, count]) => {
              const activeTotal = stats.active;
              const pct = activeTotal > 0 ? (count / activeTotal) * 100 : 0;
              const colorMap: Record<string, string> = {
                '<3mo': 'bg-sky-400', '3-6mo': 'bg-blue-500', '6-12mo': 'bg-indigo-500',
                '1-2yr': 'bg-purple-500', '2yr+': 'bg-emerald-500',
              };
              return (
                <div key={bucket} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">{bucket}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">{count} <span className="font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700 ease-out", colorMap[bucket] || 'bg-blue-500')}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Average</span>
              <span className="text-sm font-black text-foreground">{stats.avgTenureMonths} months</span>
            </div>
          </div>
        </div>

        {/* ── Weekly Availability Heatmap ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Weekly Availability</h3>
          </div>
          <div className="flex items-end justify-between gap-2 px-1">
            {stats.availability.map((a: { day: string; available: number; total: number }) => (
              <AvailabilityDay key={a.day} day={a.day} available={a.available} total={a.total} />
            ))}
          </div>
          <div className="pt-2 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[9px] text-muted-foreground">&gt;75%</span></div>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-amber-400/70" /><span className="text-[9px] text-muted-foreground">25-75%</span></div>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-400/60" /><span className="text-[9px] text-muted-foreground">&lt;25%</span></div>
            </div>
          </div>
        </div>

        {/* ── Compliance Alerts ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Alerts</h3>
          </div>
          <div className="space-y-2.5">
            {/* Expired DL */}
            {stats.expiredDL > 0 && (
              <div onClick={() => router.push("/hr/employees?filter=dlExpired")}
                className="flex items-center gap-3 p-3 rounded-xl border bg-red-500/5 border-red-500/20 cursor-pointer transition-all hover:shadow-sm hover:bg-red-500/10 active:scale-[0.99]">
                <div className="p-2 rounded-lg bg-red-500/10"><FileWarning className="h-4 w-4 text-red-500" /></div>
                <div>
                  <p className="text-xs font-bold">{stats.expiredDL} Expired DL</p>
                  <p className="text-[10px] text-muted-foreground">Needs immediate action</p>
                </div>
              </div>
            )}

            {/* DL Expiring Soon */}
            <div onClick={() => router.push("/hr/employees?filter=dlExpiring")}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm active:scale-[0.99]",
                stats.expiringDL > 0
                  ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                  : "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
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
            <div onClick={() => router.push("/hr/employees?filter=missingDocs")}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm active:scale-[0.99]",
                stats.missingDocs > 0
                  ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                  : "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
              )}>
              <div className={cn("p-2 rounded-lg", stats.missingDocs > 0 ? "bg-red-500/10" : "bg-emerald-500/10")}>
                <FileWarning className={cn("h-4 w-4", stats.missingDocs > 0 ? "text-red-500" : "text-emerald-500")} />
              </div>
              <div>
                <p className="text-xs font-bold">{stats.missingDocs > 0 ? `${stats.missingDocs} Missing Documents` : "All Docs Complete"}</p>
                <p className="text-[10px] text-muted-foreground">Offer letter, DL, or I-9</p>
              </div>
            </div>

            {/* Active Headcount */}
            <div onClick={() => router.push("/hr/employees?status=Active")}
              className="flex items-center gap-3 p-3 rounded-xl border bg-blue-500/5 border-blue-500/20 cursor-pointer transition-all hover:shadow-sm hover:bg-blue-500/10 active:scale-[0.99]">
              <div className="p-2 rounded-lg bg-blue-500/10"><Zap className="h-4 w-4 text-blue-500" /></div>
              <div>
                <p className="text-xs font-bold">{stats.active} Active Employees</p>
                <p className="text-[10px] text-muted-foreground">Current headcount</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ ROW 4 — Location, Offboarding, Hourly ══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Top Locations ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Top Locations</h3>
          </div>
          <div className="space-y-2.5">
            {stats.topCities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No location data</p>
            ) : (
              (stats.topCities as [string, number][]).map(([city, count]: [string, number], idx: number) => {
                const pct = stats.activeCount > 0 ? (count / stats.activeCount) * 100 : 0;
                const rankColors = ["text-amber-400", "text-zinc-400", "text-orange-600", "text-muted-foreground", "text-muted-foreground"];
                return (
                  <div key={city} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className={cn("text-sm font-black w-5 text-center", rankColors[idx])}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground truncate">{city}</span>
                        <span className="text-[10px] font-bold text-muted-foreground ml-2">{count}</span>
                      </div>
                      <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Offboarding Pipeline ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Offboarding</h3>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted/40">Last 60 days</span>
          </div>
          <div className="text-center py-2">
            <span className="text-3xl font-black text-foreground"><AnimatedNumber value={stats.recentTerminations} /></span>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Separations</p>
          </div>
          <div className="space-y-2">
            {[
              { label: "Paycom Offboarding", pending: stats.pendingPaycom, total: stats.recentTerminations, color: stats.pendingPaycom > 0 ? "bg-amber-500" : "bg-emerald-500" },
              { label: "Amazon Offboarding", pending: stats.pendingAmazon, total: stats.recentTerminations, color: stats.pendingAmazon > 0 ? "bg-amber-500" : "bg-emerald-500" },
              { label: "Final Check Issued", pending: stats.pendingFinalCheck, total: stats.recentTerminations, color: stats.pendingFinalCheck > 0 ? "bg-red-500" : "bg-emerald-500" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                <span className="text-[11px] font-semibold text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", item.color)} />
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {item.pending > 0 ? `${item.pending} pending` : "Complete"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Gender & Demographics ── */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Demographics</h3>
          </div>
          <div className="space-y-3">
            {(Object.entries(stats.genderMap) as [string, number][])
              .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
              .map(([gender, count]) => {
                const pct = stats.activeCount > 0 ? (count / stats.activeCount) * 100 : 0;
                const genderColorMap: Record<string, string> = {
                  'Male': 'bg-blue-500', 'Female': 'bg-pink-500', 'Non-binary': 'bg-purple-500',
                };
                return (
                  <div key={gender} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">{gender}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700 ease-out", genderColorMap[gender] || 'bg-zinc-400')}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ══════════════ ROW 5 — Hourly Status ══════════════ */}
      {Object.keys(stats.hourlyMap).length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Hourly Status Distribution</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.entries(stats.hourlyMap) as [string, number][])
              .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
              .map(([status, count]: [string, number]) => (
                <div
                  key={status}
                  onClick={() => router.push(`/hr/employees?hourlyStatus=${encodeURIComponent(status)}`)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 border border-border/50 cursor-pointer transition-all hover:bg-muted/60 hover:border-primary/30 hover:shadow-sm active:scale-[0.98]"
                >
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
