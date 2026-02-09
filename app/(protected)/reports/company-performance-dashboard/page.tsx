"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download, FileText, Users, Package, TrendingUp, AlertTriangle,
  Loader2, Shield, Truck, Camera, MessageSquareWarning, Target,
  Lightbulb, ChevronRight, Info, CheckCircle2, XCircle, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────
interface DriverData {
  name: string; transporterId: string; overallStanding: string; overallScore: number | null;
  ficoMetric: number | null; ficoTier: string;
  speedingEventRate: number; speedingEventRateTier: string;
  seatbeltOffRate: number; seatbeltOffRateTier: string;
  distractionsRate: number; distractionsRateTier: string;
  signSignalViolationsRate: number; signSignalViolationsRateTier: string;
  followingDistanceRate: number; followingDistanceRateTier: string;
  dcr: string; dcrTier: string; dsb: number; dsbTier: string;
  pod: string; podTier: string; psb: number; psbTier: string;
  packagesDelivered: number; ced: number; cedTier: string;
  cdfDpmo: number; cdfDpmoTier: string; negativeFeedbackCount: number;
  podOpportunities: number; podSuccess: number; podBypass: number;
  podRejects: number; podRejectBreakdown: Record<string, number>;
  dsbCount: number; issueCount: number;
}
interface PodRow {
  name: string; transporterId: string; opportunities: number; success: number;
  bypass: number; rejects: number; blurryPhoto: number; humanInThePicture: number;
  noPackageDetected: number; packageInCar: number; packageInHand: number;
  packageNotClearlyVisible: number; packageTooClose: number; photoTooDark: number; other: number;
}
interface CdfRow {
  name: string; transporterId: string; cdfDpmo: number; cdfDpmoTier: string;
  cdfDpmoScore: number; negativeFeedbackCount: number;
}
interface DspMetrics {
  overallScore: number; overallTier: string;
  tierDistribution: Record<string, number>;
  safety: {
    tier: string; avgFico: number; ficoTier: string;
    seatbeltOffRate: number; seatbeltOffRateTier: string;
    speedingEventRate: number; speedingEventRateTier: string;
    signSignalViolationsRate: number; signSignalViolationsRateTier: string;
    distractionsRate: number; distractionsRateTier: string;
    followingDistanceRate: number; followingDistanceRateTier: string;
  };
  deliveryQuality: {
    tier: string; dcr: number; dcrTier: string; totalDsb: number; dsbTier: string;
    pod: number; podTier: string; podAcceptanceRate: number;
    totalPodOpps: number; totalPodSuccess: number; totalPodRejects: number; totalPodBypass: number;
    totalCed: number; avgCed: number; cedTier: string;
    totalNegativeFeedback: number; avgCdfDpmo: number; cdfDpmoTier: string;
  };
  focusAreas: { area: string; reason: string; score: number }[];
}

// ── Tier Styling ──────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; bar: string; pct: number }> = {
  "fantastic plus": { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "bg-gradient-to-r from-emerald-500 to-emerald-400", pct: 100 },
  "fantastic": { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", bar: "bg-gradient-to-r from-green-600 to-green-400", pct: 85 },
  "great": { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", bar: "bg-gradient-to-r from-blue-600 to-blue-400", pct: 65 },
  "fair": { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", bar: "bg-gradient-to-r from-amber-600 to-amber-400", pct: 40 },
  "poor": { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", bar: "bg-gradient-to-r from-red-600 to-red-400", pct: 20 },
};

function getTier(tier: string) {
  const t = (tier || "").toLowerCase();
  for (const key of Object.keys(TIER_CONFIG)) {
    if (t.includes(key)) return TIER_CONFIG[key];
  }
  return { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", bar: "bg-muted", pct: 0 };
}

// ── Reusable Sub-Components ───────────────────────────────────────────────
function TierBadge({ tier, className }: { tier: string; className?: string }) {
  const cfg = getTier(tier);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide", cfg.bg, cfg.color, cfg.border, className)}>
      {tier}
    </span>
  );
}

function ScoreBar({ score, maxScore = 100, tier, label }: { score: number; maxScore?: number; tier: string; label?: string }) {
  const cfg = getTier(tier);
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between items-baseline"><span className="text-xs text-muted-foreground">{label}</span><span className={cn("text-xs font-bold", cfg.color)}>{score} | {tier}</span></div>}
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", cfg.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OverallStandingBar({ score, tier }: { score: number; tier: string }) {
  const tiers = ["Poor", "Fair", "Great", "Fantastic", "Fantastic Plus"];
  const pct = Math.min(100, Math.max(0, score));
  const cfg = getTier(tier);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Overall Standing:</span>
        <span className={cn("text-xl font-black", cfg.color)}>{score}</span>
        <span className="text-sm text-muted-foreground">|</span>
        <TierBadge tier={tier} />
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-500/20 via-amber-500/20 via-blue-500/20 via-green-500/20 to-emerald-500/20">
        <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", cfg.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
        {tiers.map(t => <span key={t} className={cn(t.toLowerCase() === tier.toLowerCase() ? getTier(t).color + " font-bold" : "")}>{t}</span>)}
      </div>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, tier, suffix }: { icon?: any; label: string; value: string | number; tier: string; suffix?: string }) {
  const cfg = getTier(tier);
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />}
        <span className="text-sm text-foreground/80">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-semibold">{value}{suffix}</span>
        <TierBadge tier={tier} className="text-[9px] px-1.5 py-0" />
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, tier, children }: { icon: any; title: string; tier: string; children?: React.ReactNode }) {
  const cfg = getTier(tier);
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-t-xl border-b", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", cfg.bg)}><Icon className={cn("h-5 w-5", cfg.color)} /></div>
        <h3 className="text-base font-bold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <TierBadge tier={tier} />
        {children}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function EmployeePerformanceDashboard() {
  const { setRightContent, setLeftContent } = useHeaderActions();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [podRows, setPodRows] = useState<PodRow[]>([]);
  const [cdfRows, setCdfRows] = useState<CdfRow[]>([]);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [avgOverallScore, setAvgOverallScore] = useState(0);
  const [dspMetrics, setDspMetrics] = useState<DspMetrics | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState("scorecard");
  const [pageTitle, setPageTitle] = useState("Company Performance Dashboard");
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch dynamic page title from card-config (source of truth for display names)
  useEffect(() => {
    fetch("/api/card-config?page=reports")
      .then(r => r.json())
      .then(data => {
        if (data.cards?.length > 0) {
          // Index 0 is the first card on the reports page (this dashboard)
          const card = data.cards.find((c: any) => c.index === 0);
          if (card?.name) {
            setPageTitle(card.name);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingWeeks(true);
    fetch("/api/reports/employee-performance")
      .then(r => r.json())
      .then(data => { setWeeks(data.weeks || []); if (data.weeks?.length > 0) setSelectedWeek(data.weeks[0]); })
      .catch(() => toast.error("Failed to load weeks"))
      .finally(() => setLoadingWeeks(false));
  }, []);

  const fetchData = useCallback(async (week: string) => {
    if (!week) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/employee-performance?week=${encodeURIComponent(week)}`);
      const data = await res.json();
      setDrivers(data.drivers || []); setPodRows(data.podRows || []); setCdfRows(data.cdfRows || []);
      setTotalDrivers(data.totalDrivers || 0); setTotalDelivered(data.totalDelivered || 0);
      setAvgOverallScore(data.avgOverallScore || 0); setDspMetrics(data.dspMetrics || null);
    } catch { toast.error("Failed to fetch performance data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedWeek) fetchData(selectedWeek); }, [selectedWeek, fetchData]);

  const generatePDF = () => { setGeneratingPdf(true); setTimeout(() => { window.print(); setGeneratingPdf(false); }, 300); };

  const driversWithIssues = drivers.filter(d => d.dsbCount > 0 || d.negativeFeedbackCount > 0 || d.podRejects > 0).length;

  // Set dynamic header title
  useEffect(() => {
    setLeftContent(
      <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        {pageTitle}
      </h1>
    );
    return () => setLeftContent(null);
  }, [pageTitle, setLeftContent]);

  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-3">
        <Select value={selectedWeek} onValueChange={setSelectedWeek} disabled={loadingWeeks}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Select Week" /></SelectTrigger>
          <SelectContent>{weeks.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={generatePDF} disabled={generatingPdf || drivers.length === 0} className="gap-2">
          {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [selectedWeek, weeks, loadingWeeks, generatingPdf, drivers.length, setRightContent]);

  // Tips based on focus areas
  const currentTips = useMemo(() => {
    const tips: string[] = [];
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Photo"))) tips.push("Train DAs on POD photo quality — ensure packages are clearly visible, well-lit, and at proper distance.");
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Customer"))) tips.push("Provide visibility of the CDF report to DAs to show them where they stand and what areas to improve.");
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Safety"))) tips.push("Review safety infractions weekly and identify drivers needing deeper retraining for repeat violations.");
    if (dspMetrics?.focusAreas?.some(f => f.area.includes("Delivery Success"))) tips.push("Check your weekly infraction report and scorecard weekly to look for DSB patterns.");
    tips.push("Have drivers check address and delivery notes in the Rabbit device.");
    return tips.slice(0, 3);
  }, [dspMetrics]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!loading && drivers.length === 0 && selectedWeek) return (
    <Card className="print:hidden"><CardContent className="py-16 text-center">
      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-lg font-medium">No data for {selectedWeek}</p>
      <p className="text-sm text-muted-foreground mt-1">Upload performance data or select a different week.</p>
    </CardContent></Card>
  );

  const sm = dspMetrics;

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
        <TabsList>
          <TabsTrigger value="scorecard" className="gap-1.5"><Target className="h-3.5 w-3.5" />DSP Scorecard</TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5"><Users className="h-3.5 w-3.5" />Driver Details</TabsTrigger>
          <TabsTrigger value="pod" className="gap-1.5"><Camera className="h-3.5 w-3.5" />POD Analysis</TabsTrigger>
          <TabsTrigger value="cdf" className="gap-1.5"><MessageSquareWarning className="h-3.5 w-3.5" />CDF Report</TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: DSP SCORECARD ═══ */}
        <TabsContent value="scorecard" className="space-y-4 mt-4">
          {sm && <>
            {/* Header Card */}
            <Card className="overflow-hidden border-0 shadow-lg py-0">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">DSP Scorecard</h2>
                    <p className="text-slate-400 text-sm mt-0.5">SYMX at DFO2 — {selectedWeek}</p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div><p className="text-3xl font-black">{totalDrivers}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Drivers</p></div>
                    <div><p className="text-3xl font-black">{totalDelivered.toLocaleString()}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Delivered</p></div>
                    <div><p className="text-3xl font-black text-amber-400">{driversWithIssues}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">W/ Issues</p></div>
                  </div>
                </div>
                <Separator className="my-4 bg-white/10" />
                <OverallStandingBar score={sm.overallScore} tier={sm.overallTier} />
              </div>
            </Card>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Safety & Compliance */}
              <Card className="overflow-hidden py-0">
                <SectionHeader icon={Shield} title="Safety and Compliance" tier={sm.safety.tier} />
                <CardContent className="p-0 divide-y divide-border/50">
                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />On-Road Safety Score</span>
                      {sm.safety.avgFico > 0 ? <TierBadge tier={sm.safety.ficoTier} /> : <span className="text-xs text-muted-foreground italic">Coming Soon</span>}
                    </div>
                    <MetricRow label="Seatbelt-Off Rate" value={sm.safety.seatbeltOffRate} tier={sm.safety.seatbeltOffRateTier} suffix=" events per 100 trips" />
                    <MetricRow label="Speeding Event Rate" value={sm.safety.speedingEventRate} tier={sm.safety.speedingEventRateTier} suffix=" events per 100 trips" />
                    <MetricRow label="Sign/Signal Violations" value={sm.safety.signSignalViolationsRate} tier={sm.safety.signSignalViolationsRateTier} suffix=" events per 100 trips" />
                    <MetricRow label="Distractions Rate" value={sm.safety.distractionsRate} tier={sm.safety.distractionsRateTier} suffix=" events per 100 trips" />
                    <MetricRow label="Following Distance" value={sm.safety.followingDistanceRate} tier={sm.safety.followingDistanceRateTier} suffix=" events per 100 trips" />
                  </div>
                  {sm.safety.avgFico > 0 && (
                    <div className="p-4">
                      <ScoreBar score={sm.safety.avgFico} maxScore={850} tier={sm.safety.ficoTier} label="Avg FICO Score" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Delivery Quality */}
              <Card className="overflow-hidden py-0">
                <SectionHeader icon={Truck} title="Delivery Quality" tier={sm.deliveryQuality.tier} />
                <CardContent className="p-0 divide-y divide-border/50">
                  <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-1">
                    <div className="col-span-2 mb-1"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Delivery Experience</span></div>
                    <MetricRow label="CED DPMO" value={sm.deliveryQuality.totalCed} tier={sm.deliveryQuality.cedTier} />
                    <MetricRow label="CDF DPMO" value={sm.deliveryQuality.avgCdfDpmo} tier={sm.deliveryQuality.cdfDpmoTier} />
                  </div>
                  <div className="p-4 space-y-1">
                    <MetricRow label="Delivery Completion Rate" value={`${sm.deliveryQuality.dcr}%`} tier={sm.deliveryQuality.dcrTier} />
                    <MetricRow label="Delivery Success Behaviors" value={sm.deliveryQuality.totalDsb} tier={sm.deliveryQuality.dsbTier} />
                    <MetricRow label="Photo-On-Delivery Rate" value={`${sm.deliveryQuality.podAcceptanceRate}%`} tier={sm.deliveryQuality.podTier} />
                  </div>
                  <div className="p-4">
                    <ScoreBar score={sm.deliveryQuality.dcr} maxScore={100} tier={sm.deliveryQuality.dcrTier} label="Completion Rate" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tier Distribution */}
            <Card className="overflow-hidden py-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4" />Driver Tier Distribution</h3>
                  <span className="text-xs text-muted-foreground">{totalDrivers} total</span>
                </div>
                <div className="flex gap-2">
                  {["Fantastic Plus", "Fantastic", "Great", "Fair", "Poor"].map(t => {
                    const count = sm.tierDistribution[t] || 0;
                    const cfg = getTier(t);
                    const pct = totalDrivers > 0 ? Math.round((count / totalDrivers) * 100) : 0;
                    return (
                      <div key={t} className={cn("flex-1 rounded-lg p-3 text-center border transition-all", cfg.bg, cfg.border, count > 0 ? "" : "opacity-40")}>
                        <p className={cn("text-2xl font-black", cfg.color)}>{count}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{t}</p>
                        <p className={cn("text-[10px] font-bold mt-0.5", cfg.color)}>{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Focus Areas + Tips */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sm.focusAreas.length > 0 && (
                <Card className="overflow-hidden border-amber-500/20 py-0">
                  <div className="bg-amber-500/5 border-b border-amber-500/20 p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
                    <h3 className="text-base font-bold">Recommended Focus Areas</h3>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    {sm.focusAreas.map((fa, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                        <div><p className="text-sm font-semibold">{fa.area}</p><p className="text-xs text-muted-foreground mt-0.5">{fa.reason}</p></div>
                      </div>
                    ))}
                    <p className="text-[11px] text-muted-foreground italic mt-2">Improving these areas would improve your Overall Standing.</p>
                  </CardContent>
                </Card>
              )}
              <Card className="overflow-hidden border-blue-500/20 py-0">
                <div className="bg-blue-500/5 border-b border-blue-500/20 p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10"><Lightbulb className="h-5 w-5 text-blue-500" /></div>
                  <h3 className="text-base font-bold">Current Week Tips</h3>
                </div>
                <CardContent className="p-4 space-y-3">
                  {currentTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground/80">{tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>}
        </TabsContent>

        {/* ═══ TAB 2: DRIVER DETAILS ═══ */}
        <TabsContent value="drivers" className="mt-4">
          {drivers.length > 0 && (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead><TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead>ID</TableHead><TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">FICO</TableHead><TableHead className="text-right">Speeding</TableHead>
                  <TableHead className="text-right">Seatbelt</TableHead><TableHead className="text-right">Distractions</TableHead>
                  <TableHead className="text-right">Sign/Signal</TableHead><TableHead className="text-right">Follow Dist</TableHead>
                  <TableHead className="text-right">CDF DPMO</TableHead><TableHead className="text-right">CED</TableHead>
                  <TableHead className="text-right">DCR</TableHead><TableHead className="text-right">DSB</TableHead>
                  <TableHead className="text-right">POD</TableHead><TableHead className="text-right">Standing</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {drivers.map((d, i) => (
                    <TableRow key={d.transporterId} className={d.issueCount > 0 ? "bg-red-500/5" : ""}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{d.transporterId}</TableCell>
                      <TableCell className="text-right">{d.packagesDelivered}</TableCell>
                      <TableCell className="text-right">{d.ficoMetric ?? "—"}</TableCell>
                      <TableCell className="text-right">{d.speedingEventRate}</TableCell>
                      <TableCell className="text-right">{d.seatbeltOffRate}</TableCell>
                      <TableCell className="text-right">{d.distractionsRate}</TableCell>
                      <TableCell className="text-right">{d.signSignalViolationsRate}</TableCell>
                      <TableCell className="text-right">{d.followingDistanceRate}</TableCell>
                      <TableCell className="text-right">{d.cdfDpmo}</TableCell>
                      <TableCell className="text-right">{d.ced}</TableCell>
                      <TableCell className="text-right">{d.dcr}</TableCell>
                      <TableCell className="text-right"><span className={d.dsb > 0 ? "text-red-500 font-bold" : ""}>{d.dsb}</span></TableCell>
                      <TableCell className="text-right">{d.pod}</TableCell>
                      <TableCell className="text-right"><TierBadge tier={d.overallStanding} className="text-[9px]" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          )}
        </TabsContent>

        {/* ═══ TAB 3: POD ═══ */}
        <TabsContent value="pod" className="mt-4">
          {podRows.length > 0 && (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead><TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead>ID</TableHead><TableHead className="text-right">Opps</TableHead>
                  <TableHead className="text-right">Success</TableHead><TableHead className="text-right">Bypass</TableHead>
                  <TableHead className="text-right">Rejects</TableHead><TableHead className="text-right">Blurry</TableHead>
                  <TableHead className="text-right">Human</TableHead><TableHead className="text-right">No Pkg</TableHead>
                  <TableHead className="text-right">In Car</TableHead><TableHead className="text-right">In Hand</TableHead>
                  <TableHead className="text-right">Not Visible</TableHead><TableHead className="text-right">Too Close</TableHead>
                  <TableHead className="text-right">Too Dark</TableHead><TableHead className="text-right">Other</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {podRows.map((r, i) => (
                    <TableRow key={r.transporterId} className={r.rejects > 0 ? "bg-red-500/5" : ""}>
                      <TableCell>{i + 1}</TableCell><TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-right">{r.opportunities}</TableCell>
                      <TableCell className="text-right">{r.success}</TableCell>
                      <TableCell className="text-right">{r.bypass}</TableCell>
                      <TableCell className="text-right"><span className={r.rejects > 0 ? "text-red-500 font-bold" : ""}>{r.rejects}</span></TableCell>
                      <TableCell className="text-right">{r.blurryPhoto || "—"}</TableCell>
                      <TableCell className="text-right">{r.humanInThePicture || "—"}</TableCell>
                      <TableCell className="text-right">{r.noPackageDetected || "—"}</TableCell>
                      <TableCell className="text-right">{r.packageInCar || "—"}</TableCell>
                      <TableCell className="text-right">{r.packageInHand || "—"}</TableCell>
                      <TableCell className="text-right">{r.packageNotClearlyVisible || "—"}</TableCell>
                      <TableCell className="text-right">{r.packageTooClose || "—"}</TableCell>
                      <TableCell className="text-right">{r.photoTooDark || "—"}</TableCell>
                      <TableCell className="text-right">{r.other || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          )}
        </TabsContent>

        {/* ═══ TAB 4: CDF ═══ */}
        <TabsContent value="cdf" className="mt-4">
          {cdfRows.length > 0 && (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead><TableHead className="min-w-[180px]">Name</TableHead>
                  <TableHead>ID</TableHead><TableHead className="text-right">CDF DPMO</TableHead>
                  <TableHead className="text-right">Tier</TableHead><TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Negative Feedback</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cdfRows.map((r, i) => (
                    <TableRow key={r.transporterId} className={r.negativeFeedbackCount > 0 ? "bg-red-500/5" : ""}>
                      <TableCell>{i + 1}</TableCell><TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-right">{r.cdfDpmo}</TableCell>
                      <TableCell className="text-right"><TierBadge tier={r.cdfDpmoTier} className="text-[9px]" /></TableCell>
                      <TableCell className="text-right">{r.cdfDpmoScore}</TableCell>
                      <TableCell className="text-right"><span className={r.negativeFeedbackCount > 0 ? "text-red-500 font-bold" : ""}>{r.negativeFeedbackCount}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Accordion Data Tables (All Records) ──────────────────────────── */}
      {!loading && (drivers.length > 0 || podRows.length > 0 || cdfRows.length > 0) && (
        <div className="print:hidden space-y-2 mt-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
            <FileText className="h-4.5 w-4.5" /> All Records
          </h2>
          <Accordion
            type="multiple"
            defaultValue={[]}
            className="space-y-3"
          >
            {/* ── 1. DSP Delivery Excellence ──────────────────────────────── */}
            {drivers.length > 0 && (
              <AccordionItem value="excellence" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold">Delivery Excellence Performance ({drivers.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead className="min-w-[180px]">Name</TableHead>
                          <TableHead>Transporter ID</TableHead>
                          <TableHead className="text-right">Delivered</TableHead>
                          <TableHead className="text-right">FICO</TableHead>
                          <TableHead className="text-right">Speeding</TableHead>
                          <TableHead className="text-right">Seatbelt Off</TableHead>
                          <TableHead className="text-right">Distractions</TableHead>
                          <TableHead className="text-right">Sign/Signal</TableHead>
                          <TableHead className="text-right">Following Dist</TableHead>
                          <TableHead className="text-right">CDF DPMO</TableHead>
                          <TableHead className="text-right">CED</TableHead>
                          <TableHead className="text-right">DCR</TableHead>
                          <TableHead className="text-right">DSB</TableHead>
                          <TableHead className="text-right">POD</TableHead>
                          <TableHead className="text-right">PSB</TableHead>
                          <TableHead className="text-right">Standing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drivers.map((driver, idx) => (
                          <TableRow
                            key={driver.transporterId}
                            className={driver.issueCount > 0 ? "bg-red-500/5" : ""}
                          >
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{driver.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {driver.transporterId}
                            </TableCell>
                            <TableCell className="text-right">{driver.packagesDelivered}</TableCell>
                            <TableCell className="text-right">
                              {driver.ficoMetric != null ? driver.ficoMetric : "No Data"}
                            </TableCell>
                            <TableCell className="text-right">{driver.speedingEventRate}</TableCell>
                            <TableCell className="text-right">{driver.seatbeltOffRate}</TableCell>
                            <TableCell className="text-right">{driver.distractionsRate}</TableCell>
                            <TableCell className="text-right">{driver.signSignalViolationsRate}</TableCell>
                            <TableCell className="text-right">{driver.followingDistanceRate}</TableCell>
                            <TableCell className="text-right">{driver.cdfDpmo}</TableCell>
                            <TableCell className="text-right">{driver.ced}</TableCell>
                            <TableCell className="text-right">{driver.dcr}</TableCell>
                            <TableCell className="text-right">
                              <span className={driver.dsb > 0 ? "text-red-500 font-bold" : ""}>{driver.dsb}</span>
                            </TableCell>
                            <TableCell className="text-right">{driver.pod}</TableCell>
                            <TableCell className="text-right">{driver.psb}</TableCell>
                            <TableCell className="text-right">
                              <TierBadge tier={driver.overallStanding} className="text-[9px]" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* ── 2. Photo On Delivery (POD) ──────────────────────────────── */}
            {podRows.length > 0 && (
              <AccordionItem value="pod-all" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold">Photo On Delivery — POD ({podRows.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead className="min-w-[180px]">Name</TableHead>
                          <TableHead>Transporter ID</TableHead>
                          <TableHead className="text-right">Opportunities</TableHead>
                          <TableHead className="text-right">Success</TableHead>
                          <TableHead className="text-right">Bypass</TableHead>
                          <TableHead className="text-right">Rejects</TableHead>
                          <TableHead className="text-right">Blurry Photo</TableHead>
                          <TableHead className="text-right">Human in Pic</TableHead>
                          <TableHead className="text-right">No Package</TableHead>
                          <TableHead className="text-right">Pkg in Car</TableHead>
                          <TableHead className="text-right">Pkg in Hand</TableHead>
                          <TableHead className="text-right">Pkg Not Visible</TableHead>
                          <TableHead className="text-right">Pkg Too Close</TableHead>
                          <TableHead className="text-right">Too Dark</TableHead>
                          <TableHead className="text-right">Other</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {podRows.map((row, idx) => (
                          <TableRow
                            key={row.transporterId}
                            className={row.rejects > 0 ? "bg-red-500/5" : ""}
                          >
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {row.transporterId}
                            </TableCell>
                            <TableCell className="text-right">{row.opportunities}</TableCell>
                            <TableCell className="text-right">{row.success}</TableCell>
                            <TableCell className="text-right">{row.bypass}</TableCell>
                            <TableCell className="text-right">
                              <span className={row.rejects > 0 ? "text-red-500 font-bold" : ""}>{row.rejects}</span>
                            </TableCell>
                            <TableCell className="text-right">{row.blurryPhoto || "—"}</TableCell>
                            <TableCell className="text-right">{row.humanInThePicture || "—"}</TableCell>
                            <TableCell className="text-right">{row.noPackageDetected || "—"}</TableCell>
                            <TableCell className="text-right">{row.packageInCar || "—"}</TableCell>
                            <TableCell className="text-right">{row.packageInHand || "—"}</TableCell>
                            <TableCell className="text-right">{row.packageNotClearlyVisible || "—"}</TableCell>
                            <TableCell className="text-right">{row.packageTooClose || "—"}</TableCell>
                            <TableCell className="text-right">{row.photoTooDark || "—"}</TableCell>
                            <TableCell className="text-right">{row.other || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* ── 3. Customer Delivery Feedback (CDF) ────────────────────── */}
            {cdfRows.length > 0 && (
              <AccordionItem value="cdf-all" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <MessageSquareWarning className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold">Customer Delivery Feedback — CDF ({cdfRows.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead className="min-w-[180px]">Name</TableHead>
                          <TableHead>Transporter ID</TableHead>
                          <TableHead className="text-right">CDF DPMO</TableHead>
                          <TableHead className="text-right">Tier</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">Negative Feedback</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cdfRows.map((row, idx) => (
                          <TableRow
                            key={row.transporterId}
                            className={row.negativeFeedbackCount > 0 ? "bg-red-500/5" : ""}
                          >
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {row.transporterId}
                            </TableCell>
                            <TableCell className="text-right">{row.cdfDpmo}</TableCell>
                            <TableCell className="text-right">
                              <TierBadge tier={row.cdfDpmoTier} className="text-[9px]" />
                            </TableCell>
                            <TableCell className="text-right">{row.cdfDpmoScore}</TableCell>
                            <TableCell className="text-right">
                              <span className={row.negativeFeedbackCount > 0 ? "text-red-500 font-bold" : ""}>
                                {row.negativeFeedbackCount}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      )}

      {/* ══ PRINT-ONLY: Weekly Driver Coaching Report ══ */}
      <div ref={reportRef} className="hidden print:block">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-2xl font-bold mb-2">Weekly Driver Coaching Report</h1>
          <p className="text-lg text-gray-600">DFO2 / SYMX — {selectedWeek}</p>
          <Separator className="my-6" />
        </div>
        {drivers.map((driver) => (
          <div key={driver.transporterId} className="mb-6 border border-gray-300 rounded-lg p-4 break-inside-avoid">
            <div className="flex justify-between items-start mb-3">
              <div><span className="font-bold text-base">{driver.name}</span><span className="text-sm text-gray-500 ml-2">({driver.transporterId})</span></div>
              <div className="text-sm text-gray-500 text-right">Coached: ☐ Yes ☐ No &nbsp;&nbsp; DA Initials: ____ &nbsp;&nbsp; Mgr: __ &nbsp;&nbsp; Date: ___/___</div>
            </div>
            <div className="font-bold text-sm mb-1">DSB: {driver.dsb} &nbsp;|&nbsp; CDF Notes: {driver.negativeFeedbackCount} (Incidents: {driver.cdfDpmo}) &nbsp;|&nbsp; POD Rejects: {driver.podRejects}</div>
            <div className="text-xs text-gray-600 mb-3">Overall: {driver.overallScore ?? "N/A"} ({driver.overallStanding}), FICO: {driver.ficoMetric ?? "No Data"} ({driver.ficoTier}), DCR: {driver.dcr} ({driver.dcrTier}), CDF DPMO: {driver.cdfDpmo} ({driver.cdfDpmoTier}), POD: {driver.pod} ({driver.podTier})</div>
            <div className="text-sm mb-2">
              <span className="font-semibold">Issues to Address:</span>
              {driver.podRejects === 0 && driver.negativeFeedbackCount === 0 && driver.dsb === 0
                ? <span className="text-gray-500 ml-2">No issues flagged this week.</span>
                : <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                    {driver.podRejects > 0 && <li>POD Rejects ({driver.podRejects}): {Object.entries(driver.podRejectBreakdown).sort(([,a],[,b]) => b - a).map(([r,c]) => `${r}: ${c}`).join(", ")}</li>}
                    {driver.negativeFeedbackCount > 0 && <li>Negative CDF: {driver.negativeFeedbackCount} feedback record(s)</li>}
                    {driver.dsb > 0 && <li>DSB: {driver.dsb} delivery success behavior event(s)</li>}
                  </ul>
              }
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          @page { margin: 0.75in; size: letter; }
        }
      `}</style>
    </div>
  );
}
