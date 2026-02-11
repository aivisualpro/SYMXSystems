"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import SignaturePad from "@/components/ui/signature-pad";
import {
  Download, FileText, Users, Package, TrendingUp, AlertTriangle,
  Loader2, Shield, Truck, Camera, MessageSquareWarning, Target,
  Lightbulb, ChevronRight, Info, CheckCircle2, XCircle, Eye,
  Upload, Activity, MessageSquare, Search, Check, ClipboardCheck, Hash,
  Pen, Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────
interface DriverData {
  name: string; transporterId: string; profileImage: string | null; overallStanding: string; overallScore: number | null;
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
  // DVIC
  dvicInspections: { vin: string; fleetType: string; inspectionType: string; inspectionStatus: string; startTime: string; endTime: string; duration: string; startDate: string }[];
  dvicTotalInspections: number;
  dvicRushedCount: number;
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
  const [activeTab, setActiveTab] = useState("drivers-tab");
  const [pageTitle, setPageTitle] = useState("Scorecard");
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [driverSearch, setDriverSearch] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Remarks & Signatures State ──────────────────────────────────────────
  const [driverRemarks, setDriverRemarks] = useState("");
  const [managerRemarks, setManagerRemarks] = useState("");
  const [driverSignature, setDriverSignature] = useState("");
  const [managerSignature, setManagerSignature] = useState("");
  const [driverSigTimestamp, setDriverSigTimestamp] = useState<string | null>(null);
  const [managerSigTimestamp, setManagerSigTimestamp] = useState<string | null>(null);
  const [savingRemarks, setSavingRemarks] = useState(false);


  // Fetch remarks when driver is selected
  useEffect(() => {
    if (!selectedDriver || !selectedWeek) {
      setDriverRemarks(''); setManagerRemarks('');
      setDriverSignature(''); setManagerSignature('');
      setDriverSigTimestamp(null); setManagerSigTimestamp(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/reports/scorecard-remarks?transporterId=${encodeURIComponent(selectedDriver.transporterId)}&week=${encodeURIComponent(selectedWeek)}`);
        const data = await res.json();
        if (data.remarks) {
          setDriverRemarks(data.remarks.driverRemarks || '');
          setManagerRemarks(data.remarks.managerRemarks || '');
          setDriverSignature(data.remarks.driverSignature || '');
          setManagerSignature(data.remarks.managerSignature || '');
          setDriverSigTimestamp(data.remarks.driverSignatureTimestamp || null);
          setManagerSigTimestamp(data.remarks.managerSignatureTimestamp || null);
        } else {
          setDriverRemarks(''); setManagerRemarks('');
          setDriverSignature(''); setManagerSignature('');
          setDriverSigTimestamp(null); setManagerSigTimestamp(null);
        }
      } catch { /* silently fail */ }
    })();
  }, [selectedDriver, selectedWeek]);

  const saveRemarks = async () => {
    if (!selectedDriver || !selectedWeek) return;
    setSavingRemarks(true);
    try {
      const res = await fetch('/api/reports/scorecard-remarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transporterId: selectedDriver.transporterId,
          week: selectedWeek,
          driverRemarks,
          driverSignature,
          managerRemarks,
          managerSignature,
        }),
      });
      const data = await res.json();
      if (data.remarks) {
        setDriverSigTimestamp(data.remarks.driverSignatureTimestamp || null);
        setManagerSigTimestamp(data.remarks.managerSignatureTimestamp || null);
      }
      toast.success('Remarks saved successfully');
    } catch {
      toast.error('Failed to save remarks');
    } finally {
      setSavingRemarks(false);
    }
  };

  // ── Import State ──────────────────────────────────────────────────────────
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importType, setImportType] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [showImportWeekSelector, setShowImportWeekSelector] = useState(false);
  const [importWeek, setImportWeek] = useState<string>("");
  const [importWeekSearch, setImportWeekSearch] = useState("");
  const [importFilteredWeeks, setImportFilteredWeeks] = useState<string[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Generate weeks for import dialog (2025-2027)
  const importAllWeeks = useMemo(() => {
    const years = [2025, 2026, 2027];
    const allWeeks: string[] = [];
    for (const year of years) {
      for (let i = 1; i <= 53; i++) {
        allWeeks.push(`${year}-W${i.toString().padStart(2, '0')}`);
      }
    }
    return allWeeks;
  }, []);

  useEffect(() => {
    if (importWeekSearch) {
      const lower = importWeekSearch.toLowerCase();
      setImportFilteredWeeks(importAllWeeks.filter(w => w.toLowerCase().includes(lower)).slice(0, 10));
    } else {
      setImportFilteredWeeks(importAllWeeks.filter(w => w.startsWith('2026')).slice(0, 10));
    }
  }, [importWeekSearch, importAllWeeks]);

  const handleImportTypeClick = (type: string) => {
    setImportType(type);
    if (type === "import-pod" || type === "customer-delivery-feedback") {
      // Use the week already selected in the header — no extra dialog needed
      setImportWeek(selectedWeek);
      setShowImportDialog(false);
      setTimeout(() => importFileRef.current?.click(), 100);
    } else {
      setShowImportDialog(false);
      setTimeout(() => importFileRef.current?.click(), 100);
    }
  };

  const confirmImportWeek = () => {
    const finalWeek = importWeekSearch.trim();
    if (!/^\d{4}-W\d{2}$/.test(finalWeek)) {
      toast.error("Invalid week format. Use YYYY-Www (e.g. 2026-W05)");
      return;
    }
    setImportWeek(finalWeek);
    setShowImportWeekSelector(false);
    importFileRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Please select a valid CSV file"); return; }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatusMessage(`Reading file...`);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        const totalRows = data.length;
        const batchSize = 50;
        let processedCount = 0;
        let insertedCount = 0;
        let updatedCount = 0;

        try {
          for (let i = 0; i < totalRows; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const remaining = totalRows - processedCount;
            setImportProgress(Math.min(Math.round((processedCount / totalRows) * 100), 99));
            setImportStatusMessage(`Processing... ${remaining} records remaining`);

            const payload: any = { type: importType, data: batch };
            if (importType === 'import-pod' || importType === 'customer-delivery-feedback') {
              payload.week = importWeek;
            }

            const response = await fetch("/api/admin/imports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Batch failed`);
            }

            const result = await response.json();
            insertedCount += result.inserted || 0;
            updatedCount += result.updated || 0;
            processedCount += batch.length;
          }

          setImportProgress(100);
          setImportStatusMessage("Import complete!");
          toast.success(`Processed ${totalRows} records. Added: ${insertedCount}, Updated: ${updatedCount}`);

          setTimeout(() => {
            setIsImporting(false);
            setImportProgress(0);
            setImportStatusMessage("");
            if (importFileRef.current) importFileRef.current.value = "";
            // Refresh scorecard data
            if (selectedWeek) fetchData(selectedWeek);
          }, 1500);
        } catch (error: any) {
          toast.error(error.message || "Failed to import data");
          setIsImporting(false);
          if (importFileRef.current) importFileRef.current.value = "";
        }
      },
      error: () => {
        toast.error("Failed to parse CSV file");
        setIsImporting(false);
      },
    });
  };


  // ── Week Selector State (header combo-box) ──────────────────────────────
  const [weekPopoverOpen, setWeekPopoverOpen] = useState(false);
  const [weekSearchInput, setWeekSearchInput] = useState("");

  // Combined list: fetched weeks + user-added weeks
  const headerFilteredWeeks = useMemo(() => {
    if (!weekSearchInput) return weeks;
    const lower = weekSearchInput.toLowerCase();
    return weeks.filter(w => w.toLowerCase().includes(lower));
  }, [weeks, weekSearchInput]);

  const isCustomWeek = weekSearchInput && /^\d{4}-W\d{2}$/.test(weekSearchInput) && !weeks.includes(weekSearchInput);

  const handleSelectHeaderWeek = (week: string) => {
    setSelectedWeek(week);
    setWeekSearchInput("");
    setWeekPopoverOpen(false);
  };

  const handleAddCustomWeek = () => {
    const w = weekSearchInput.trim();
    if (!/^\d{4}-W\d{2}$/.test(w)) {
      toast.error("Invalid week format. Use YYYY-Www (e.g. 2026-W05)");
      return;
    }
    if (!weeks.includes(w)) {
      setWeeks(prev => [w, ...prev]);
    }
    setSelectedWeek(w);
    setWeekSearchInput("");
    setWeekPopoverOpen(false);
  };

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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search drivers..."
            className="h-8 w-[180px] pl-8 text-sm"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Import
        </Button>
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="w-[180px] h-8 justify-between font-normal"
            onClick={() => setWeekPopoverOpen(!weekPopoverOpen)}
            disabled={loadingWeeks}
          >
            <span>{selectedWeek || "Select Week"}</span>
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground" />
          </Button>
          {weekPopoverOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search or add week..."
                    className="h-8 pl-7 text-sm"
                    value={weekSearchInput}
                    onChange={(e) => setWeekSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isCustomWeek) handleAddCustomWeek();
                    }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {isCustomWeek && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground border-b"
                    onClick={handleAddCustomWeek}
                  >
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">+ Add</span>
                    <span className="font-medium">{weekSearchInput}</span>
                  </div>
                )}
                {headerFilteredWeeks.length > 0 ? headerFilteredWeeks.map(w => (
                  <div
                    key={w}
                    className={cn("flex items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground", selectedWeek === w && "bg-accent/50 font-medium")}
                    onClick={() => handleSelectHeaderWeek(w)}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", selectedWeek === w ? "opacity-100" : "opacity-0")} />
                    {w}
                  </div>
                )) : (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    {weekSearchInput ? "No matching weeks" : "No weeks available"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <Button size="sm" onClick={generatePDF} disabled={generatingPdf || drivers.length === 0} className="gap-2">
          {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
        </Button>
      </div>
    );
    return () => setRightContent(null);
  }, [selectedWeek, weeks, loadingWeeks, generatingPdf, drivers.length, setRightContent, showImportDialog, weekPopoverOpen, weekSearchInput, headerFilteredWeeks, isCustomWeek, driverSearch]);

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
    <>
      {/* Hidden file input for import */}
      <input type="file" ref={importFileRef} className="hidden" accept=".csv" onChange={handleImportFile} />

      {/* Import Type Selector Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>Select the type of data you want to import.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button
              variant="outline"
              className="flex h-20 items-center justify-start gap-4 px-4 border-dashed border-2 hover:bg-accent hover:text-accent-foreground transition-all"
              onClick={() => handleImportTypeClick("delivery-excellence")}
            >
              <div className="p-2.5 rounded-full bg-emerald-500/10"><Activity className="h-6 w-6 text-emerald-500" /></div>
              <div className="text-left"><span className="font-semibold">Delivery Excellence</span><p className="text-xs text-muted-foreground mt-0.5">Import DSP metrics matched by Transporter ID</p></div>
            </Button>
            <Button
              variant="outline"
              className="flex h-20 items-center justify-start gap-4 px-4 border-dashed border-2 hover:bg-accent hover:text-accent-foreground transition-all"
              onClick={() => handleImportTypeClick("import-pod")}
            >
              <div className="p-2.5 rounded-full bg-blue-500/10"><Camera className="h-6 w-6 text-blue-500" /></div>
              <div className="text-left"><span className="font-semibold">Photo On Delivery</span><p className="text-xs text-muted-foreground mt-0.5">Import POD metrics (select week first)</p></div>
            </Button>
            <Button
              variant="outline"
              className="flex h-20 items-center justify-start gap-4 px-4 border-dashed border-2 hover:bg-accent hover:text-accent-foreground transition-all"
              onClick={() => handleImportTypeClick("customer-delivery-feedback")}
            >
              <div className="p-2.5 rounded-full bg-violet-500/10"><MessageSquare className="h-6 w-6 text-violet-500" /></div>
              <div className="text-left"><span className="font-semibold">Delivery Feedback</span><p className="text-xs text-muted-foreground mt-0.5">Import CDF metrics (select week first)</p></div>
            </Button>
            <Button
              variant="outline"
              className="flex h-20 items-center justify-start gap-4 px-4 border-dashed border-2 hover:bg-accent hover:text-accent-foreground transition-all"
              onClick={() => handleImportTypeClick("dvic-vehicle-inspection")}
            >
              <div className="p-2.5 rounded-full bg-sky-500/10"><ClipboardCheck className="h-6 w-6 text-sky-500" /></div>
              <div className="text-left"><span className="font-semibold">DVIC Vehicle Inspection</span><p className="text-xs text-muted-foreground mt-0.5">Import inspection times — week auto-detected from dates</p></div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Week Selector Dialog for POD/CDF */}
      <Dialog open={showImportWeekSelector} onOpenChange={setShowImportWeekSelector}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Week</DialogTitle>
            <DialogDescription>Choose the week for the data you are importing.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="text" placeholder="Search or enter week..." className="pl-9" value={importWeekSearch} onChange={(e) => setImportWeekSearch(e.target.value)} />
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-sm">
              {importWeekSearch && !importAllWeeks.includes(importWeekSearch) && /^\d{4}-W\d{2}$/.test(importWeekSearch) && (
                <div className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => setImportWeekSearch(importWeekSearch)}>
                  <Check className={cn("mr-2 h-4 w-4", importWeekSearch === importWeek ? "opacity-100" : "opacity-0")} /> Create &quot;{importWeekSearch}&quot;
                </div>
              )}
              {importFilteredWeeks.length > 0 ? importFilteredWeeks.map((week) => (
                <div key={week} className={cn("flex cursor-pointer select-none items-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground", importWeekSearch === week && "bg-accent/50")} onClick={() => { setImportWeekSearch(week); setImportWeek(week); }}>
                  <Check className={cn("mr-2 h-4 w-4", importWeekSearch === week ? "opacity-100" : "opacity-0")} /> {week}
                </div>
              )) : (
                <div className="py-6 text-center text-sm text-muted-foreground">{/^\d{4}-W\d{2}$/.test(importWeekSearch) ? "Click Create above" : "No weeks found"}</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportWeekSelector(false)}>Cancel</Button>
            <Button onClick={confirmImportWeek}>Continue to Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Importing Data</DialogTitle>
            <DialogDescription>Please wait while we process your file. Do not close this window.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-medium"><span className="text-muted-foreground">Progress</span><span>{importProgress}%</span></div>
              <Progress value={importProgress} className="h-2 w-full transition-all duration-500" />
            </div>
            <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium animate-pulse">{importStatusMessage}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <div className="space-y-4 print:space-y-2">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
        <TabsList>
          <TabsTrigger value="drivers-tab" className="gap-1.5"><Truck className="h-3.5 w-3.5" />Drivers</TabsTrigger>
          <TabsTrigger value="scorecard" className="gap-1.5"><Target className="h-3.5 w-3.5" />DSP Scorecard</TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5"><Users className="h-3.5 w-3.5" />Driver Details</TabsTrigger>
          <TabsTrigger value="pod" className="gap-1.5"><Camera className="h-3.5 w-3.5" />POD Analysis</TabsTrigger>
          <TabsTrigger value="cdf" className="gap-1.5"><MessageSquareWarning className="h-3.5 w-3.5" />CDF Report</TabsTrigger>
        </TabsList>

        {/* ═══ TAB: DRIVERS ═══ */}
        <TabsContent value="drivers-tab" className="space-y-4 mt-4">
          {drivers.length > 0 ? (
            <Card className="overflow-hidden py-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead className="min-w-[180px]">Driver</TableHead>
                        <TableHead className="text-center">Tier</TableHead>
                        <TableHead className="text-center">Rank</TableHead>
                        <TableHead className="text-center">Driving Safety</TableHead>
                        <TableHead className="text-center">Delivery Quality</TableHead>
                        <TableHead className="text-center">Customer Feedback</TableHead>
                        <TableHead className="text-center">DVIC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...drivers]
                        .filter(d => !driverSearch || d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                        .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
                        .map((d, i) => (
                          <TableRow
                            key={d.transporterId}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setSelectedDriver(d)}
                          >
                            <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                {d.profileImage ? (
                                  <Image src={d.profileImage} alt={d.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                    {d.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium leading-none">{d.name}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center"><TierBadge tier={d.overallStanding} /></TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-bold">{i + 1}<span className="text-[10px] text-muted-foreground">/{drivers.length}</span></span>
                            </TableCell>
                            <TableCell className="text-center"><TierBadge tier={d.ficoTier || 'N/A'} /></TableCell>
                            <TableCell className="text-center"><TierBadge tier={d.dcrTier} /></TableCell>
                            <TableCell className="text-center"><TierBadge tier={d.cdfDpmoTier} /></TableCell>
                            <TableCell className="text-center">
                              {d.dvicTotalInspections > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-sm font-bold">{d.dvicTotalInspections}</span>
                                  {d.dvicRushedCount > 0 && (
                                    <span className="text-[10px] text-amber-500 font-medium">{d.dvicRushedCount} rushed</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden py-0">
              <CardContent className="py-16 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No driver data</p>
                <p className="text-sm text-muted-foreground mt-1">Import data or select a week with available records.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 2: DSP SCORECARD ═══ */}
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
    {/* ═══ DRIVER DETAIL DIALOG ═══ */}
    <Dialog open={!!selectedDriver} onOpenChange={() => setSelectedDriver(null)}>
      <DialogContent className="sm:max-w-[520px] max-h-[92vh] p-0 gap-0 overflow-hidden border border-white/10 shadow-2xl rounded-2xl backdrop-blur-xl bg-background/85">
        <DialogHeader className="sr-only"><DialogTitle>Driver Scorecard</DialogTitle><DialogDescription>Detailed performance breakdown</DialogDescription></DialogHeader>
        {selectedDriver && (() => {
          const d = selectedDriver;
          const rank = [...drivers].sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0)).findIndex(x => x.transporterId === d.transporterId) + 1;
          const tierCfg = getTier(d.overallStanding);
          const podRate = d.podOpportunities > 0 ? Math.round((d.podSuccess / d.podOpportunities) * 10000) / 100 : 0;

          // Gradient bar percentage helper (for FICO-like gradient bars)
          const ficoBarPct = d.ficoMetric ? Math.min(100, Math.max(0, (d.ficoMetric / 850) * 100)) : 0;
          // Rate bar — lower is better, maxes out at 3.0
          const rateBarPct = (v: number) => Math.min(100, Math.max(5, (v / 3) * 100));
          const rateBarColor = (v: number) => v === 0 ? 'bg-emerald-500' : v <= 0.5 ? 'bg-green-500' : v <= 1.5 ? 'bg-amber-500' : 'bg-red-500';

          // Focus area — pick the weakest metric area
          const focusAreas: { title: string; tip: string }[] = [];
          if (d.negativeFeedbackCount > 0) focusAreas.push({ title: 'Customer Delivery Feedback', tip: 'Always read the customer notes before executing a delivery! These notes will aid you in the delivery and help to ensure your success. When in doubt, call customer support or call/text the customer for guidance on how they want their package delivered.' });
          if (d.dsb > 0) focusAreas.push({ title: 'Delivery Success Behaviors', tip: 'Focus on following the correct sequence at every stop — scan, photo, confirm. Skipping steps or rushing through can trigger DSB flags.' });
          if (d.podRejects > 0) focusAreas.push({ title: 'Photo-On-Delivery Quality', tip: 'Make sure your photos clearly show the package at the delivery location. Avoid blurry images, photos that are too close, or images that include people.' });
          if (d.speedingEventRate > 0.5) focusAreas.push({ title: 'Speeding Events', tip: 'Keep an eye on your speed, especially in residential areas and school zones. Reducing your speed will directly improve your FICO score.' });
          if (d.distractionsRate > 0.5) focusAreas.push({ title: 'Distraction Events', tip: 'Avoid using your phone while driving. Place it in a mount and use voice commands when needed. Every distraction event impacts your safety score.' });
          if (focusAreas.length === 0) focusAreas.push({ title: 'Great Work!', tip: 'You\'re performing well across all categories. Keep it up and maintain your focus on safety and delivery quality.' });

          return (
            <div className="overflow-y-auto max-h-[88vh] scorecard-scroll">
              {/* ── HEADER ── */}
              <div className="px-6 pt-7 pb-5">
                {/* Driver identity row */}
                <div className="flex items-center gap-4 mb-5">
                  {d.profileImage ? (
                    <div className="h-[60px] w-[60px] rounded-xl bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-[3px] shrink-0 shadow-md">
                      <Image src={d.profileImage} alt={d.name} width={56} height={56} className="h-full w-full rounded-[9px] object-cover" />
                    </div>
                  ) : (
                    <div className={cn(
                      "h-[60px] w-[60px] rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0 shadow-md",
                      "bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a]"
                    )}>
                      {d.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight truncate">{d.name}</h2>
                  </div>
                </div>

                {/* Week */}
                <div className="text-center mb-4">
                  <h3 className="text-2xl font-black tracking-tight text-[#1a6a7a]">{selectedWeek}</h3>
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mt-3" />
                  <div className="flex justify-center -mt-2">
                    <div className="w-3 h-3 rotate-45 bg-[hsl(var(--background))] border-b border-r border-border" />
                  </div>
                </div>

                {/* Deliveries */}
                <p className="text-center text-muted-foreground text-sm">Deliveries: <span className="font-black text-lg text-foreground tabular-nums">{d.packagesDelivered.toLocaleString()}</span></p>

                {/* Tier & Rank cards */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-xl bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-5 text-center text-white shadow-md">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-80" />
                    <p className="text-xl font-black">{d.overallStanding}</p>
                    <p className="text-[11px] text-white/60 mt-1">Overall Tier</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-5 text-center text-white shadow-md">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-80" />
                    <p className="text-xl font-black">{rank}<span className="text-sm font-medium text-white/50"> / {drivers.length}</span></p>
                    <p className="text-[11px] text-white/60 mt-1">Rank</p>
                  </div>
                </div>
              </div>

              {/* ── DRIVING SAFETY ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Driving Safety</h3>
                  <Shield className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-3 mb-4">
                  {/* On-Road Safety Score */}
                  <div className="flex justify-between items-center py-2 border-b border-border/20">
                    <span className="text-sm font-bold">On-Road Safety Score</span>
                    <span className={cn("text-sm font-black", tierCfg.color)}>{d.ficoTier || 'N/A'}</span>
                  </div>
                  {/* FICO Score with gradient bar */}
                  <div className="py-2 border-b border-border/20">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-semibold">FICO Score</span>
                      <span className="text-sm font-black tabular-nums">{d.ficoMetric ?? '—'}<span className="text-muted-foreground font-normal text-xs">/850</span></span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-yellow-400 to-emerald-500 relative overflow-hidden opacity-80">
                      <div className="absolute top-0 right-0 h-full bg-muted/80 rounded-r-full transition-all duration-700" style={{ width: `${100 - ficoBarPct}%` }} />
                    </div>
                  </div>

                  {/* Events header */}
                  <p className="text-xs text-muted-foreground pt-3 pb-1 font-medium">Events <span className="text-[10px]">(Per 100 Deliveries)</span></p>
                  
                  {/* Event rates with gradient bars */}
                  {[
                    { label: 'Distractions', value: d.distractionsRate },
                    { label: 'Speeding', value: d.speedingEventRate },
                    { label: 'Seatbelt Off', value: d.seatbeltOffRate },
                    { label: 'Follow Distance', value: d.followingDistanceRate },
                    { label: 'Sign/Signal Violations', value: d.signSignalViolationsRate },
                  ].map((m) => (
                    <div key={m.label} className="flex justify-between items-center py-2">
                      <span className="text-sm font-semibold">{m.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", rateBarColor(m.value))} style={{ width: `${m.value === 0 ? 0 : rateBarPct(m.value)}%` }} />
                        </div>
                        <span className={cn("text-sm font-black tabular-nums w-8 text-right", m.value === 0 ? 'text-emerald-500' : m.value <= 0.5 ? 'text-green-500' : m.value <= 1.5 ? 'text-amber-500' : 'text-red-500')}>{m.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── DELIVERY QUALITY ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Delivery Quality</h3>
                  <CheckCircle2 className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-3 mb-4">
                  {[
                    { label: 'Overall Quality Score', value: d.dcrTier, isTier: true },
                    { label: 'Completion Rate', value: `${d.dcr}%` },
                    { label: 'Delivered, Not Received', value: `${d.ced}/${d.packagesDelivered}`, warn: d.ced > 0 },
                    { label: 'Photo-On-Delivery Acceptance', value: `${podRate}%` },
                    { label: 'Photo-On-Delivery Rejects', value: `${d.podRejects}/${d.podOpportunities || '—'}`, warn: d.podRejects > 0 },
                  ].map((m) => (
                    <div key={m.label} className="flex justify-between items-center py-2 border-b border-border/10 last:border-0">
                      <span className={cn("text-sm", m.isTier ? 'font-bold' : 'font-semibold')}>{m.label}</span>
                      <span className={cn("text-sm font-black tabular-nums", m.isTier ? tierCfg.color : m.warn ? 'text-red-500' : '')}>{m.value}</span>
                    </div>
                  ))}
                  {/* POD Reject Breakdown */}
                  {d.podRejects > 0 && Object.entries(d.podRejectBreakdown).length > 0 && (
                    <div className="pl-5 space-y-0.5 pb-2">
                      {Object.entries(d.podRejectBreakdown).sort(([,a],[,b]) => b - a).map(([reason, count]) => (
                        <div key={reason} className="flex justify-between text-xs py-0.5 text-muted-foreground">
                          <span>{reason}</span>
                          <span className="font-mono font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={cn("flex justify-between items-center py-2 border-t border-border/20")}>
                    <span className="text-sm font-semibold">Delivery Success Behaviors</span>
                    <span className={cn("text-sm font-black tabular-nums", d.dsb > 0 ? "text-red-500" : "text-emerald-500")}>{d.dsb}</span>
                  </div>
                </div>
              </div>

              {/* ── CUSTOMER FEEDBACK ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Customer Feedback</h3>
                  <MessageSquareWarning className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-3 mb-4">
                  <div className="flex justify-between items-center py-2 border-b border-border/10">
                    <span className="text-sm font-semibold">CDF DPMO</span>
                    <span className="text-sm font-black tabular-nums">{d.cdfDpmo}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-semibold">Negative Feedback Count</span>
                    <span className={cn("text-sm font-black tabular-nums", d.negativeFeedbackCount > 0 && "text-red-500")}>{d.negativeFeedbackCount}</span>
                  </div>
                </div>
              </div>

              {/* ── DVIC ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Vehicle Inspection (DVIC)</h3>
                  <ClipboardCheck className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-3 mb-4">
                  {d.dvicTotalInspections > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-lg bg-[#1a7a8a]/5 border border-[#1a7a8a]/15 p-2.5 text-center">
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Total</p>
                          <p className="text-lg font-black text-[#1a7a8a] tabular-nums">{d.dvicTotalInspections}</p>
                        </div>
                        <div className={cn("rounded-lg border p-2.5 text-center", d.dvicRushedCount > 0 ? "bg-amber-500/5 border-amber-500/15" : "bg-emerald-500/5 border-emerald-500/15")}>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Rushed</p>
                          <p className={cn("text-lg font-black tabular-nums", d.dvicRushedCount > 0 ? "text-amber-500" : "text-emerald-500")}>{d.dvicRushedCount}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/30 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/20">
                              <th className="text-left py-2 px-2 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                              <th className="text-left py-2 px-2 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">VIN</th>
                              <th className="text-left py-2 px-2 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                              <th className="text-right py-2 px-2 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Duration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/15">
                            {d.dvicInspections.map((insp, idx) => (
                              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                <td className="py-2 px-2 text-[11px] font-medium">{insp.startDate || '—'}</td>
                                <td className="py-2 px-2 font-mono text-[11px] text-muted-foreground">{insp.vin ? `…${insp.vin.slice(-6)}` : '—'}</td>
                                <td className="py-2 px-2">
                                  <span className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold",
                                    insp.inspectionStatus?.toLowerCase() === 'complete' ? 'bg-emerald-500/10 text-emerald-500' :
                                    insp.inspectionStatus?.toLowerCase() === 'incomplete' ? 'bg-red-500/10 text-red-500' :
                                    'bg-muted text-muted-foreground'
                                  )}>
                                    <span className={cn("w-1 h-1 rounded-full",
                                      insp.inspectionStatus?.toLowerCase() === 'complete' ? 'bg-emerald-500' :
                                      insp.inspectionStatus?.toLowerCase() === 'incomplete' ? 'bg-red-500' : 'bg-muted-foreground'
                                    )} />
                                    {insp.inspectionStatus || '—'}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-[11px] font-bold">{insp.duration || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center">
                      <ClipboardCheck className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No inspections recorded this week</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── FOCUS AREA & GUIDANCE ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Focus Area & Guidance</h3>
                  <Activity className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4">
                  <p className="text-sm leading-relaxed">
                    <span className="font-black">{focusAreas[0].title}:</span>{' '}
                    <span className="text-muted-foreground">{focusAreas[0].tip}</span>
                  </p>
                </div>
              </div>

              {/* ── REMARKS & SIGNATURES ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Remarks & Signatures</h3>
                  <Pen className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-4 mb-4 space-y-3">

                  {/* ── Driver Box ── */}
                  <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/40">
                      <p className="text-[10px] uppercase tracking-widest font-black text-foreground/70 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#1a7a8a]"></span>
                        Driver
                      </p>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label>
                        <Textarea
                          placeholder="Enter driver remarks..."
                          className="min-h-[100px] text-xs resize-none border-2 border-border/40 focus:border-[#1a7a8a]/50 transition-colors"
                          value={driverRemarks}
                          onChange={(e) => setDriverRemarks(e.target.value)}
                        />
                      </div>
                      <SignaturePad
                        value={driverSignature}
                        onChange={setDriverSignature}
                        height={100}
                        label="Signature"
                        timestamp={driverSigTimestamp ? format(new Date(driverSigTimestamp), 'MMM d, yyyy h:mm a') : null}
                      />
                    </div>
                  </div>

                  {/* ── Manager Box ── */}
                  <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/40">
                      <p className="text-[10px] uppercase tracking-widest font-black text-foreground/70 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#1a5f6a]"></span>
                        Manager
                      </p>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label>
                        <Textarea
                          placeholder="Enter manager remarks..."
                          className="min-h-[100px] text-xs resize-none border-2 border-border/40 focus:border-[#1a7a8a]/50 transition-colors"
                          value={managerRemarks}
                          onChange={(e) => setManagerRemarks(e.target.value)}
                        />
                      </div>
                      <SignaturePad
                        value={managerSignature}
                        onChange={setManagerSignature}
                        height={100}
                        label="Signature"
                        timestamp={managerSigTimestamp ? format(new Date(managerSigTimestamp), 'MMM d, yyyy h:mm a') : null}
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] hover:from-[#1a6a7a] hover:to-[#1a4f5a] text-white"
                    onClick={saveRemarks}
                    disabled={savingRemarks}
                  >
                    {savingRemarks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingRemarks ? 'Saving...' : 'Save Remarks & Signatures'}
                  </Button>
                </div>
              </div>

              {/* ── FOOTER TIP ── */}
              <div className="mx-4 mb-4 rounded-xl border border-[#1a7a8a]/20 bg-[#1a7a8a]/5 px-4 py-3">
                <div className="flex gap-3 items-center">
                  <Lightbulb className="h-5 w-5 text-[#1a7a8a] shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tap on any metric to see more information about what it measures and how it&apos;s calculated.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    </>
  );
}
