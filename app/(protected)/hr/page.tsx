"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
  const [employees, setEmployees] = useState<ISymxEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/employees?terminated=true");
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
    const active = employees.filter(e => e.status === "Active" || !e.status || (!["Terminated", "Resigned", "Inactive"].includes(e.status))).length;
    const terminated = employees.filter(e => e.status === "Terminated" && !e.resignationDate).length;
    const resigned = employees.filter(e => e.status === "Resigned" || (e.resignationDate && e.status !== "Terminated")).length;
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

    // Expired DL
    const expiredDL = employees.filter(e => {
      if (!e.dlExpiration || e.status !== "Active") return false;
      return new Date(e.dlExpiration) < new Date();
    }).length;

    // Missing documents
    const missingDocs = employees.filter(e => {
      if (e.status !== "Active") return false;
      return !e.offerLetterFile || !e.driversLicenseFile || !e.i9File;
    }).length;

    // Document completeness
    const activeEmployees = employees.filter(e => e.status === "Active" || !e.status || (!["Terminated", "Resigned", "Inactive"].includes(e.status)));
    const docChecks = activeEmployees.map(e => {
      let score = 0;
      let total = 5;
      if (e.offerLetterFile) score++;
      if (e.driversLicenseFile) score++;
      if (e.i9File) score++;
      if (e.drugTestFile) score++;
      if (e.handbookFile) score++;
      return { score, total };
    });
    const totalDocScore = docChecks.reduce((s, d) => s + d.score, 0);
    const totalDocPossible = docChecks.reduce((s, d) => s + d.total, 0);
    const docCompliancePct = totalDocPossible > 0 ? Math.round((totalDocScore / totalDocPossible) * 100) : 0;

    // Individual doc counts
    const hasOfferLetter = activeEmployees.filter(e => e.offerLetterFile).length;
    const hasDL = activeEmployees.filter(e => e.driversLicenseFile).length;
    const hasI9 = activeEmployees.filter(e => e.i9File).length;
    const hasDrugTest = activeEmployees.filter(e => e.drugTestFile).length;
    const hasHandbook = activeEmployees.filter(e => e.handbookFile).length;

    // Hourly status breakdown
    const hourlyMap: Record<string, number> = {};
    activeEmployees.forEach(e => {
      const h = e.hourlyStatus || "Unspecified";
      hourlyMap[h] = (hourlyMap[h] || 0) + 1;
    });

    // Tenure analysis
    const now = new Date();
    const tenureBuckets = { '<3mo': 0, '3-6mo': 0, '6-12mo': 0, '1-2yr': 0, '2yr+': 0 };
    let totalTenureDays = 0;
    let tenureCount = 0;
    activeEmployees.forEach(e => {
      if (!e.hiredDate) return;
      const hd = new Date(e.hiredDate);
      const days = Math.floor((now.getTime() - hd.getTime()) / (1000 * 60 * 60 * 24));
      totalTenureDays += days;
      tenureCount++;
      if (days < 90) tenureBuckets['<3mo']++;
      else if (days < 180) tenureBuckets['3-6mo']++;
      else if (days < 365) tenureBuckets['6-12mo']++;
      else if (days < 730) tenureBuckets['1-2yr']++;
      else tenureBuckets['2yr+']++;
    });
    const avgTenureDays = tenureCount > 0 ? Math.round(totalTenureDays / tenureCount) : 0;
    const avgTenureMonths = Math.round(avgTenureDays / 30);

    // Availability heatmap
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const availability = days.map(day => {
      const avail = activeEmployees.filter(e => {
        const val = e[day];
        return val && val !== 'OFF';
      }).length;
      return { day: day.substring(0, 3).toUpperCase(), available: avail, total: activeEmployees.length };
    });

    // Gender distribution
    const genderMap: Record<string, number> = {};
    activeEmployees.forEach(e => {
      const g = e.gender || "Not Specified";
      genderMap[g] = (genderMap[g] || 0) + 1;
    });

    // City distribution (top 5)
    const cityMap: Record<string, number> = {};
    activeEmployees.forEach(e => {
      const c = e.city || "Unknown";
      cityMap[c] = (cityMap[c] || 0) + 1;
    });
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Offboarding pipeline
    const recentTerminations = employees.filter(e => {
      if (e.status !== "Terminated" && e.status !== "Resigned") return false;
      const td = e.terminationDate || e.resignationDate;
      if (!td) return false;
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      return new Date(td) >= sixtyDaysAgo;
    });
    const pendingPaycom = recentTerminations.filter(e => !e.paycomOffboarded).length;
    const pendingAmazon = recentTerminations.filter(e => !e.amazonOffboarded).length;
    const pendingFinalCheck = recentTerminations.filter(e => !e.finalCheckIssued).length;

    // Retention rate (how many active vs total ever)
    const retentionRate = total > 0 ? Math.round((active / total) * 100) : 0;

    // Turnover (terminated + resigned / total * 100)
    const turnoverRate = total > 0 ? Math.round(((terminated + resigned) / total) * 100) : 0;

    return {
      total, active, terminated, resigned, inactive,
      typeMap, recentHires, expiringDL, expiredDL, missingDocs,
      hourlyMap, tenureBuckets, avgTenureMonths,
      availability, genderMap, topCities,
      pendingPaycom, pendingAmazon, pendingFinalCheck,
      recentTerminations: recentTerminations.length,
      retentionRate, turnoverRate,
      docCompliancePct, hasOfferLetter, hasDL, hasI9, hasDrugTest, hasHandbook,
      activeCount: activeEmployees.length,
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
            {Object.entries(stats.typeMap)
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
            {Object.entries(stats.tenureBuckets).map(([bucket, count]) => {
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
            {stats.availability.map(a => (
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
              stats.topCities.map(([city, count], idx) => {
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
            {Object.entries(stats.genderMap)
              .sort((a, b) => b[1] - a[1])
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
            {Object.entries(stats.hourlyMap)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
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
