"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
  Pen, Save, Smile, X, CalendarDays, FileUp, ShieldAlert,
  UserCheck, ShieldCheck, Play,
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
  dcrFromCollection: number | null;
  // DVIC
  dvicInspections: { vin: string; fleetType: string; inspectionType: string; inspectionStatus: string; startTime: string; endTime: string; duration: string; startDate: string }[];
  dvicTotalInspections: number;
  dvicRushedCount: number;
  // Safety Dashboard DFO2
  safetyEvents: { date: string; deliveryAssociate: string; eventId: string; dateTime: string; vin: string; programImpact: string; metricType: string; metricSubtype: string; source: string; videoLink: string; reviewDetails: string }[];
  safetyEventCount: number;
  // CDF Negative Feedback
  cdfNegativeRecords: { deliveryGroupId: string; deliveryAssociateName: string; daMishandledPackage: string; daWasUnprofessional: string; daDidNotFollowInstructions: string; deliveredToWrongAddress: string; neverReceivedDelivery: string; receivedWrongItem: string; feedbackDetails: string; trackingId: string; deliveryDate: string }[];
  cdfNegativeCount: number;
  // Quality DSB/DNR
  qualityDsbDnr: { dsbCount: number; dsbDpmo: number; attendedDeliveryCount: number; unattendedDeliveryCount: number; simultaneousDeliveries: number; deliveredOver50m: number; incorrectScanUsageAttended: number; incorrectScanUsageUnattended: number; noPodOnDelivery: number; scannedNotDeliveredNotReturned: number } | null;
  // Customer Delivery Feedback (summary)
  customerDeliveryFeedback: { cdfDpmo: number; cdfDpmoTier: string; cdfDpmoScore: number; negativeFeedbackCount: number } | null;
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
interface CdfNegativeRow {
  deliveryAssociateName: string; transporterId: string; deliveryGroupId: string;
  trackingId: string; deliveryDate: string;
  daMishandledPackage: string; daWasUnprofessional: string; daDidNotFollowInstructions: string;
  deliveredToWrongAddress: string; neverReceivedDelivery: string; receivedWrongItem: string;
  feedbackDetails: string;
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

// ── Metric Info Data ──────────────────────────────────────────────────────
type MetricInfoEntry = {
  title: string;
  description: string;
  howMeasured?: string;
};

const METRIC_INFO: Record<string, MetricInfoEntry> = {
  'fico-score': {
    title: 'FICO SCORE',
    description: 'Safe driving is based on your driving activity. Repeated fast acceleration, braking, cornering, cell phone distractions, and speeding decreases your FICO. Take more time to accelerate, brake and safely drive around corners. Reduce distractions by keeping your eyes on the road ahead.',
  },
  'on-road-safety-score': {
    title: 'ON-ROAD SAFETY SCORE',
    description: 'Your On-Road Safety Score reflects your overall driving safety performance. It is determined by your FICO score and other driving behavior metrics. A higher tier indicates safer driving habits across all categories.',
  },
  'proper-park-sequence': {
    title: 'PROPER-PARK-SEQUENCE COMPLIANCE',
    description: 'Vehicle rollaways can occur when you park a vehicle without following the Proper Park Sequence (PPS). Vehicle rollaways can be incredibly dangerous, but they are also very preventable if you follow the PPS.\n\nFirst, apply the parking brake. Next, shift the vehicle into Park (for manual transmission, into First or Reverse gear). If on a hill, turn your wheels toward the curb (Downhill) or toward the road (Uphill). Finally, turn off the engine if appropriate and remember to take your keys with you.',
    howMeasured: 'This metric only looks at whether you first applied the parking brake, and next if you shifted gear into Park. You need to complete both operations, in that order to count as compliant. We\'ll show you the total percentage of stops you were compliant, along with the number and reasons for the stops that were not.',
  },
  'paw-print-contact': {
    title: 'PAW PRINT CONTACT COMPLIANCE',
    description: 'Identifying the presence of a dog starts before you exit your vehicle. You should look in the Delivery App notes at every stop for the Paw Print icon that says, “Be aware of a dog at this stop” or other identifying notes from the customer. The Paw Print icon indicates that a dog has been previously seen at this location, so it is critical to look for the Paw Print icon prior to entering the property to be aware of a potential dog presence.\n\nIf you see a Paw Print icon, you should text the customer to alert them that you are on your way - this automated text asks the customer to secure any pets. You should always use this feature whenever you see a paw print.',
    howMeasured: 'This score measures how many stops where a "paw print" was noted and you correctly notified the customer via text. You should aim to notify customers of your arrival for ALL stops where a paw print is present.',
  },
  'distractions': {
    title: 'DISTRACTIONS',
    description: 'Please keep your attention on the road while driving. We capture 3 types of distraction based on video evidence, including when a DA is looking down, looking at their phone, or talking on their phone while driving. Each time a DA is driving while distracted, we will register one event.',
    howMeasured: 'Your score is the sum of all distraction events divided by the total number of trips. This is shown on your Scorecard as XX events per 100 trips to make it easier to interpret.',
  },
  'speeding': {
    title: 'SPEEDING',
    description: 'Please travel within posted speed limits for your safety and the safety of others. A speeding instance is speeding 10 Miles per Hour (MPH) or more for roughly one city block.',
    howMeasured: 'Your score is the sum of all speeding events divided by the total number of trips. This is shown on your Scorecard as XX events per 100 trips to make it easier to interpret',
  },
  'seatbelt-off': {
    title: 'SEATBELT OFF',
    description: 'The average number of times per route you did not wear your seatbelt. An event is recorded any time the vehicle accelerated faster than 6 mph and your seatbelt was not buckled.',
    howMeasured: 'Your score is the sum of all seatbelt off instances divided by the total number of routes completed in a vehicle with seat belt sensors. This is shown on your Scorecard as XX events per 100 trips to make it easier to interpret.',
  },
  'follow-distance': {
    title: 'FOLLOW DISTANCE',
    description: 'Following Distance events occur when you are driving too close to the vehicle in front of you. Maintaining a safe following distance gives you more time to react to sudden stops or changes in traffic.',
    howMeasured: 'Each time you don\'t leave enough following distance, we register 1 event, and your score is the sum of all following distance events divided by the number of trips. This will show on your DSP Scorecard as XX events per 100 trips to make it easier to interpret. For example, if you incurred 10 Following Distance Events during 200 trips in a week, then the Following Distance Rate is 5 events per 100 trips (10 events per 200 trips is the same as 5 events per 100 trips).',
  },
  'sign-signal-violations': {
    title: 'SIGN/SIGNAL VIOLATIONS',
    description: 'The Sign/Signal Violations Rate measures how well you adhere to posted road signs and traffic signals. We\'re currently including stop sign violations, which is any time a DA drives past/through a stop sign without coming to a full stop, illegal U-turns, which measure any time a DA makes a U-turn when a "No U-Turn sign" is present, and stop light violations, which is triggered any time a DA drives through an intersection while the light is red.',
    howMeasured: 'In the measurement of this metric, a stop light violation will count 10 times to every one stop sign violation or illegal U-turn, since stop light violations can be particularly dangerous. Your weekly score is the sum of all stop sign violation events, illegal U-turns, and stop light violation events (which again, are weighted at 10 times stop sign violations) divided by the number of trips. This will show on your DSP Scorecard as XX events per 100 trips to make it easier to interpret.',
  },
  'dvic-rushed': {
    title: 'DVIC — RUSHED INSPECTIONS',
    description: 'The Daily Vehicle Inspection Checklist (DVIC) is Amazon\'s vehicle safety inspection, designed to keep you safe. You are prompted to complete DVIC in the Amazon Delivery App when required, and you should follow the process thoroughly. The delivery app records the amount of time it takes you to perform the inspection.',
    howMeasured: 'For standard vehicles, DAs should complete the DVIC in no less than 90 seconds. For DOT vehicles like Step Vans, the process should take no less than 5 minutes.\n\nAny inspection under the recommended time is listed on your scorecard, with inspections under 10 seconds highlighted in red. Your goal is to have 0 rushed inspections.',
  },
};

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

// Textarea that manages its own local state to avoid re-rendering the entire page on every keystroke.
// Syncs value to parent onChange on blur.
function DebouncedTextarea({ value, onChange, ...props }: { value: string; onChange: (val: string) => void } & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  const [local, setLocal] = useState(value);
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  // Sync external value changes (e.g. when switching drivers)
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <Textarea
      {...props}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => latestOnChange.current(local)}
    />
  );
}

// ── Tab Routing Map ───────────────────────────────────────────────────────
const TAB_MAP = [
  { slug: 'Drivers', icon: Truck, label: 'Drivers' },
  { slug: 'SYMX', icon: Target, label: 'SYMX' },
  { slug: 'Safety', icon: Shield, label: 'Safety' },
  { slug: 'POD', icon: Camera, label: 'POD Analysis' },
  { slug: 'Delivery-Excellence', icon: Activity, label: 'Delivery Quality' },
  { slug: 'CDF', icon: Smile, label: 'Customer Feedback' },
  { slug: 'CDF-Negative', icon: MessageSquareWarning, label: 'CDF Negative' },
  { slug: 'DVIC', icon: ClipboardCheck, label: 'Inspection Time' },
  { slug: 'DSB', icon: ShieldAlert, label: 'DSB' },
  { slug: 'DCR', icon: Package, label: 'DCR' },
] as const;

// ── Main Component ────────────────────────────────────────────────────────
export default function EmployeePerformanceDashboard() {
  const params = useParams<{ tab: string }>();
  const router = useRouter();
  const activeTab = params.tab || 'Drivers';
  const { setRightContent, setLeftContent } = useHeaderActions();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [podRows, setPodRows] = useState<PodRow[]>([]);
  const [cdfRows, setCdfRows] = useState<CdfRow[]>([]);
  const [cdfNegativeRows, setCdfNegativeRows] = useState<CdfNegativeRow[]>([]);
  const [deliveryExcellenceRows, setDeliveryExcellenceRows] = useState<any[]>([]);
  const [dcrRows, setDcrRows] = useState<any[]>([]);
  const [dsbRows, setDsbRows] = useState<any[]>([]);
  const [safetyRows, setSafetyRows] = useState<any[]>([]);
  const [dvicRawRows, setDvicRawRows] = useState<any[]>([]);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [avgOverallScore, setAvgOverallScore] = useState(0);
  const [dspMetrics, setDspMetrics] = useState<DspMetrics | null>(null);
  const [signatureMap, setSignatureMap] = useState<Record<string, { driverSigned: boolean; managerSigned: boolean }>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pageTitle, setPageTitle] = useState("Scorecard");
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [videoDialogUrl, setVideoDialogUrl] = useState<string | null>(null);
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
  const [loggedInUserName, setLoggedInUserName] = useState("");
  const [infoModal, setInfoModal] = useState<{ key: string; score?: string } | null>(null);

  // Fetch logged-in user name
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const { user } = await res.json();
          if (user?.name) setLoggedInUserName(user.name);
        }
      } catch { /* ignore */ }
    };
    fetchUser();
  }, []);


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
      // Refresh signature map for the table
      if (selectedWeek) {
        try {
          const sigRes = await fetch(`/api/reports/scorecard-remarks?week=${encodeURIComponent(selectedWeek)}`);
          const sigData = await sigRes.json();
          setSignatureMap(sigData.signatureMap || {});
        } catch { /* silently fail */ }
      }
    } catch {
      toast.error('Failed to save remarks');
    } finally {
      setSavingRemarks(false);
    }
  };

  // ── Import State ──────────────────────────────────────────────────────────
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [importWeek, setImportWeek] = useState<string>("");
  const [importWeekPopoverOpen, setImportWeekPopoverOpen] = useState(false);
  const [importWeekSearchInput, setImportWeekSearchInput] = useState("");
  const importWeekInputRef = useRef<HTMLInputElement>(null);

  // Batch file state — one file per import type, with per-file detected week
  const [importFiles, setImportFiles] = useState<Record<string, { file: File; detectedWeek: string | null } | null>>({
    "delivery-excellence": null,
    "import-pod": null,
    "customer-delivery-feedback": null,
    "dvic-vehicle-inspection": null,
    "safety-dashboard-dfo2": null,
    "quality-dsb-dnr": null,
    "quality-dcr": null,
    "cdf-negative": null,
  });
  const deFileRef = useRef<HTMLInputElement>(null);
  const podFileRef = useRef<HTMLInputElement>(null);
  const cdfFileRef = useRef<HTMLInputElement>(null);
  const dvicFileRef = useRef<HTMLInputElement>(null);
  const safetyDfo2FileRef = useRef<HTMLInputElement>(null);
  const dsbDnrFileRef = useRef<HTMLInputElement>(null);
  const dcrFileRef = useRef<HTMLInputElement>(null);
  const cdfNegFileRef = useRef<HTMLInputElement>(null);

  const fileRefMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
    "delivery-excellence": deFileRef,
    "import-pod": podFileRef,
    "customer-delivery-feedback": cdfFileRef,
    "dvic-vehicle-inspection": dvicFileRef,
    "safety-dashboard-dfo2": safetyDfo2FileRef,
    "quality-dsb-dnr": dsbDnrFileRef,
    "quality-dcr": dcrFileRef,
    "cdf-negative": cdfNegFileRef,
  };

  // Detect week from CSV content (first row's Week column or Date column)
  const detectWeekFromCSV = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        preview: 5, // Only parse first 5 rows
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[];
          if (rows.length === 0) { resolve(null); return; }
          // Try Week column first
          for (const row of rows) {
            const weekVal = (row["Week"] || row["week"] || "").toString().trim();
            if (weekVal) {
              const normalized = normalizeWeekInput(weekVal);
              if (normalized) { resolve(normalized); return; }
            }
          }
          // Try Date column — convert date to ISO week
          for (const row of rows) {
            const dateVal = (row["Date"] || row["date"] || row["Delivery Date"] || "").toString().trim();
            if (dateVal && dateVal.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)) {
              try {
                const parsed = new Date(dateVal);
                if (!isNaN(parsed.getTime())) {
                  // Get ISO week
                  const jan4 = new Date(parsed.getFullYear(), 0, 4);
                  const dayDiff = Math.floor((parsed.getTime() - jan4.getTime()) / 86400000);
                  const weekNum = Math.ceil((dayDiff + jan4.getDay() + 1) / 7);
                  if (weekNum >= 1 && weekNum <= 53) {
                    resolve(`${parsed.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`);
                    return;
                  }
                }
              } catch { /* ignore */ }
            }
          }
          resolve(null);
        },
        error: () => resolve(null),
      });
    });
  };

  const handleImportFileAttach = (type: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isValidExt = file.name.endsWith(".csv") || file.name.endsWith(".xlsx");
    if (!isValidExt) { toast.error("Please select a valid CSV or XLSX file"); return; }

    // Try to detect week from filename first, then from CSV content
    let detectedWeek = extractWeekFromFilename(file.name);
    if (!detectedWeek) {
      detectedWeek = await detectWeekFromCSV(file);
    }

    setImportFiles(prev => ({ ...prev, [type]: { file, detectedWeek } }));

    if (detectedWeek && !weeks.includes(detectedWeek)) {
      setWeeks(prev => [detectedWeek!, ...prev].sort().reverse());
    }
  };

  const removeImportFile = (type: string) => {
    setImportFiles(prev => ({ ...prev, [type]: null }));
    const ref = fileRefMap[type];
    if (ref?.current) ref.current.value = "";
  };

  const attachedFileCount = Object.values(importFiles).filter(Boolean).length;

  // Process a single file type through the import API
  const processImportFile = async (type: string, file: File, week: string): Promise<{ inserted: number; updated: number; total: number }> => {
    return new Promise((resolve, reject) => {
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
              const payload: any = { type, data: batch, week };

              const response = await fetch("/api/admin/imports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Batch failed for ${type}`);
              }

              const result = await response.json();
              insertedCount += result.inserted || 0;
              updatedCount += result.updated || 0;
              processedCount += batch.length;
            }

            resolve({ inserted: insertedCount, updated: updatedCount, total: totalRows });
          } catch (error: any) {
            reject(error);
          }
        },
        error: () => reject(new Error(`Failed to parse ${file.name}`)),
      });
    });
  };

  const handleBatchImport = async () => {
    const filesToProcess = Object.entries(importFiles).filter(([, entry]) => entry !== null) as [string, { file: File; detectedWeek: string | null }][];
    if (filesToProcess.length === 0) { toast.error("No files attached. Please select at least one CSV."); return; }

    // Validate: any file without a detected week needs the global fallback week
    const filesWithoutWeek = filesToProcess.filter(([, { detectedWeek }]) => !detectedWeek);
    if (filesWithoutWeek.length > 0 && !importWeek) {
      toast.error(`Please select a fallback week — ${filesWithoutWeek.length} file(s) couldn't auto-detect their week.`);
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setShowImportDialog(false);

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalRecords = 0;
    const typeLabels: Record<string, string> = {
      "delivery-excellence": "Delivery Excellence",
      "import-pod": "Photo On Delivery",
      "customer-delivery-feedback": "Delivery Feedback",
      "dvic-vehicle-inspection": "DVIC Inspection",
      "safety-dashboard-dfo2": "Safety Dashboard DFO2",
      "quality-dsb-dnr": "Quality DSB DNR",
      "quality-dcr": "Quality DCR",
      "cdf-negative": "CDF Negative Feedback",
    };

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const [type, { file, detectedWeek }] = filesToProcess[i];
        const weekForFile = detectedWeek || importWeek;
        const label = typeLabels[type] || type;
        const pct = Math.round(((i) / filesToProcess.length) * 100);
        setImportProgress(pct);
        setImportStatusMessage(`Importing ${label} (${weekForFile})... (${i + 1}/${filesToProcess.length})`);

        const result = await processImportFile(type, file, weekForFile);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalRecords += result.total;
      }

      setImportProgress(100);
      setImportStatusMessage("All imports complete!");
      toast.success(`Processed ${totalRecords} total records. Added: ${totalInserted}, Updated: ${totalUpdated}`);

      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatusMessage("");
        // Reset all files
        setImportFiles({ "delivery-excellence": null, "import-pod": null, "customer-delivery-feedback": null, "dvic-vehicle-inspection": null, "safety-dashboard-dfo2": null, "quality-dsb-dnr": null, "quality-dcr": null, "cdf-negative": null });
        Object.values(fileRefMap).forEach(ref => { if (ref?.current) ref.current.value = ""; });
        // Refresh scorecard data
        if (selectedWeek) fetchData(selectedWeek);
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to import data");
      setIsImporting(false);
    }
  };


  // ── Week Selector State (header combo-box) ──────────────────────────────
  const [weekPopoverOpen, setWeekPopoverOpen] = useState(false);
  const [weekSearchInput, setWeekSearchInput] = useState("");
  const weekInputRef = useRef<HTMLInputElement>(null);

  // Normalize flexible input → standard YYYY-Wxx format
  const normalizeWeekInput = (raw: string): string | null => {
    const s = raw.trim().toUpperCase();
    // Match patterns: 2026-W05, 2026-W5, 2026W05, 2026W5
    let m = s.match(/^(\d{4})-?W(\d{1,2})$/);
    // Also match: 2026_week-5, 2026_week-05, 2026-week-5
    if (!m) m = s.match(/^(\d{4})[_-]WEEK[_-]?(\d{1,2})$/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const wk = parseInt(m[2], 10);
    if (wk < 1 || wk > 53 || year < 2020 || year > 2099) return null;
    return `${m[1]}-W${wk.toString().padStart(2, '0')}`;
  };

  // Extract week from filename — supports various naming patterns
  const extractWeekFromFilename = (filename: string): string | null => {
    const s = filename.toUpperCase();
    // Pattern 1: 2026-W05 or 2026-W5
    let m = s.match(/(\d{4})-W(\d{1,2})/);
    if (m) {
      const wk = parseInt(m[2], 10);
      if (wk >= 1 && wk <= 53) return `${m[1]}-W${wk.toString().padStart(2, '0')}`;
    }
    // Pattern 2: 2026_week-5, 2026_week-05, 2026_WEEK_5
    m = s.match(/(\d{4})[_-]WEEK[_-]?(\d{1,2})/);
    if (m) {
      const wk = parseInt(m[2], 10);
      if (wk >= 1 && wk <= 53) return `${m[1]}-W${wk.toString().padStart(2, '0')}`;
    }
    return null;
  };

  const normalizedWeekInput = normalizeWeekInput(weekSearchInput);

  // Combined list: fetched weeks + user-added weeks
  const headerFilteredWeeks = useMemo(() => {
    if (!weekSearchInput) return weeks;
    const lower = weekSearchInput.toLowerCase();
    return weeks.filter(w => w.toLowerCase().includes(lower));
  }, [weeks, weekSearchInput]);

  const isCustomWeek = !!normalizedWeekInput && !weeks.includes(normalizedWeekInput);

  const handleSelectHeaderWeek = (week: string) => {
    setSelectedWeek(week);
    setWeekSearchInput("");
    setWeekPopoverOpen(false);
  };

  const handleAddCustomWeek = () => {
    if (!normalizedWeekInput) {
      toast.error("Invalid week format. Use YYYY-Wxx (e.g. 2026-W05)");
      return;
    }
    if (!weeks.includes(normalizedWeekInput)) {
      setWeeks(prev => [normalizedWeekInput, ...prev].sort().reverse());
    }
    setSelectedWeek(normalizedWeekInput);
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
      setDrivers(data.drivers || []); setPodRows(data.podRows || []); setCdfRows(data.cdfRows || []); setCdfNegativeRows(data.cdfNegativeRows || []);
      setDeliveryExcellenceRows(data.deliveryExcellenceRows || []); setDcrRows(data.dcrRows || []);
      setDsbRows(data.dsbRows || []); setSafetyRows(data.safetyRows || []); setDvicRawRows(data.dvicRows || []);
      setTotalDrivers(data.totalDrivers || 0); setTotalDelivered(data.totalDelivered || 0);
      setAvgOverallScore(data.avgOverallScore || 0); setDspMetrics(data.dspMetrics || null);
      // Fetch signature statuses for this week
      try {
        const sigRes = await fetch(`/api/reports/scorecard-remarks?week=${encodeURIComponent(week)}`);
        const sigData = await sigRes.json();
        setSignatureMap(sigData.signatureMap || {});
      } catch { /* silently fail */ }
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
        <Button size="sm" variant="outline" onClick={() => { console.log("IMPORT BUTTON CLICKED", showImportDialog); setShowImportDialog(true); }} className="gap-2">
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
            <div className="absolute right-0 top-full mt-1 z-50 w-[260px] rounded-md border bg-popover text-popover-foreground shadow-md">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    ref={weekInputRef}
                    type="text"
                    placeholder="Type week e.g. 2026-W06"
                    className="h-8 pl-7 text-sm"
                    value={weekSearchInput}
                    onChange={(e) => setWeekSearchInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (isCustomWeek) handleAddCustomWeek();
                        else if (normalizedWeekInput && weeks.includes(normalizedWeekInput)) handleSelectHeaderWeek(normalizedWeekInput);
                      }
                    }}
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 px-0.5">Format: YYYY-Wxx (e.g. 2026-W06)</p>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {isCustomWeek && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-primary/10 border-b bg-primary/5 transition-colors"
                    onClick={handleAddCustomWeek}
                  >
                    <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">
                      <Hash className="h-3 w-3" /> Add
                    </span>
                    <span className="font-semibold text-primary">{normalizedWeekInput}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">↵ Enter</span>
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
                  <div className="py-4 px-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      {weekSearchInput
                        ? normalizedWeekInput
                          ? `"${normalizedWeekInput}" not found — click + Add above`
                          : "Invalid format — use YYYY-Wxx"
                        : "No weeks available. Type a week to add it."}
                    </p>
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
  }, [selectedWeek, weeks, loadingWeeks, generatingPdf, drivers.length, setRightContent, showImportDialog, weekPopoverOpen, weekSearchInput, headerFilteredWeeks, isCustomWeek, normalizedWeekInput, driverSearch]);

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

  // ── Dialogs & hidden inputs must render even when there's no data ──
  const importDialogElements = (
    <>
      {/* Hidden file inputs for each import type */}
      <input type="file" ref={deFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("delivery-excellence")} suppressHydrationWarning />
      <input type="file" ref={podFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("import-pod")} suppressHydrationWarning />
      <input type="file" ref={cdfFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("customer-delivery-feedback")} suppressHydrationWarning />
      <input type="file" ref={dvicFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("dvic-vehicle-inspection")} suppressHydrationWarning />
      <input type="file" ref={safetyDfo2FileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("safety-dashboard-dfo2")} suppressHydrationWarning />
      <input type="file" ref={dsbDnrFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("quality-dsb-dnr")} suppressHydrationWarning />
      <input type="file" ref={dcrFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("quality-dcr")} suppressHydrationWarning />
      <input type="file" ref={cdfNegFileRef} className="hidden" accept=".csv,.xlsx" onChange={handleImportFileAttach("cdf-negative")} suppressHydrationWarning />

      {/* Import Dialog — Multi-file batch import */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!open) {
          // Reset files when closing
          setImportFiles({ "delivery-excellence": null, "import-pod": null, "customer-delivery-feedback": null, "dvic-vehicle-inspection": null, "safety-dashboard-dfo2": null, "quality-dsb-dnr": null, "quality-dcr": null, "cdf-negative": null });
          Object.values(fileRefMap).forEach(ref => { if (ref?.current) ref.current.value = ""; });
        }
        setShowImportDialog(open);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import Performance Data
            </DialogTitle>
            <DialogDescription>
              Attach CSV or XLSX files for each data type. Week will be auto-detected from filenames or content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {([
              { key: "delivery-excellence", label: "Delivery Excellence", icon: "📦" },
              { key: "import-pod", label: "Photo On Delivery (POD)", icon: "📸" },
              { key: "customer-delivery-feedback", label: "Customer Delivery Feedback", icon: "💬" },
              { key: "dvic-vehicle-inspection", label: "DVIC Vehicle Inspection", icon: "🚛" },
              { key: "safety-dashboard-dfo2", label: "Safety Dashboard DFO2", icon: "🛡️" },
              { key: "quality-dsb-dnr", label: "Quality DSB / DNR", icon: "📋" },
              { key: "quality-dcr", label: "Quality DCR", icon: "✅" },
              { key: "cdf-negative", label: "CDF Negative Feedback", icon: "⚠️" },
            ] as const).map(({ key, label, icon }) => {
              const entry = importFiles[key];
              return (
                <div key={key} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all",
                  entry ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/30 border-border hover:bg-muted/50"
                )}>
                  <span className="text-lg shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    {entry ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{entry.file.name}</span>
                        {entry.detectedWeek && (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {entry.detectedWeek}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No file attached</p>
                    )}
                  </div>
                  {entry ? (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeImportFile(key)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileRefMap[key]?.current?.click()}>
                      <Upload className="h-3 w-3" /> Attach
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{attachedFileCount}</span> file{attachedFileCount !== 1 ? "s" : ""} attached
              {selectedWeek && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Week: {selectedWeek}</span>}
            </div>
            <Button
              size="sm"
              disabled={attachedFileCount === 0}
              onClick={handleBatchImport}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Import All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Importing Data</DialogTitle>
            <DialogDescription>Please wait while we process your files. Do not close this window.</DialogDescription>
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
    </>
  );





  const sm = dspMetrics;

  return (
    <>
      {importDialogElements}

    <div className="space-y-4 print:space-y-2">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit print:hidden">
        {TAB_MAP.map(({ slug, icon: Icon, label }) => (
          <button
            key={slug}
            onClick={() => router.push(`/scorecard/${slug}`)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
              activeTab === slug
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (<>

        {activeTab === 'Drivers' && (
        <div className="space-y-4 mt-4">
          {drivers.length > 0 ? (
            <Card className="overflow-hidden py-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead className="min-w-[180px]">Driver</TableHead>
                        <TableHead className="text-center w-[70px]">Signed</TableHead>
                        <TableHead className="text-center">Deliveries</TableHead>
                        <TableHead className="text-center">Safety</TableHead>
                        <TableHead className="text-center">DVIC</TableHead>
                        <TableHead className="text-center">DSB DPMO</TableHead>
                        <TableHead className="text-center">DCR</TableHead>
                        <TableHead className="text-center">Overall Score</TableHead>
                        <TableHead className="text-center">NFC</TableHead>
                        <TableHead className="text-center w-10">Video</TableHead>
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
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2.5">
                                <div title={signatureMap[d.transporterId]?.driverSigned ? 'Driver signed' : 'Driver not signed'}>
                                  {signatureMap[d.transporterId]?.driverSigned
                                    ? <UserCheck className="h-[22px] w-[22px] text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                    : <Users className="h-[22px] w-[22px] text-muted-foreground/20" />
                                  }
                                </div>
                                <div className="w-px h-5 bg-border/30" />
                                <div title={signatureMap[d.transporterId]?.managerSigned ? 'Manager signed' : 'Manager not signed'}>
                                  {signatureMap[d.transporterId]?.managerSigned
                                    ? <ShieldCheck className="h-[22px] w-[22px] text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                    : <Shield className="h-[22px] w-[22px] text-muted-foreground/20" />
                                  }
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-bold tabular-nums">{d.packagesDelivered.toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              {d.safetyEvents.length > 0 ? (
                                <a
                                  href={d.safetyEvents[0].videoLink || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                  title={`${d.safetyEvents.length} safety event(s)`}
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="text-xs font-semibold">{d.safetyEvents.length}</span>
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {d.dvicTotalInspections > 0 ? (
                                <span className="text-sm font-bold tabular-nums">
                                  <span className={d.dvicRushedCount > 0 ? "text-amber-500" : "text-emerald-500"}>{d.dvicRushedCount}</span>
                                  <span className="text-muted-foreground font-normal">/</span>
                                  <span>{d.dvicTotalInspections}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-bold tabular-nums">{d.qualityDsbDnr?.dsbDpmo ?? '—'}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-bold tabular-nums">{d.dcrFromCollection != null ? `${d.dcrFromCollection}%` : '—'}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-bold tabular-nums">{d.overallScore ?? '—'}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={cn("text-sm font-bold tabular-nums", d.negativeFeedbackCount > 0 ? "text-red-500" : "")}>{d.negativeFeedbackCount}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              {d.safetyEvents.length > 0 && d.safetyEvents[0].videoLink ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setVideoDialogUrl(d.safetyEvents[0].videoLink); }}
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                                  title="Play safety video"
                                >
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                </button>
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
        </div>)}

        {activeTab === 'SYMX' && (
        <div className="space-y-4 mt-4">
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
          {!sm && (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <Target className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No SYMX scorecard data for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {activeTab === 'POD' && (
        <div className="mt-4">
          {podRows.length > 0 ? (
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
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <Camera className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No POD data for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {activeTab === 'CDF' && (
        <div className="mt-4">
          {cdfRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[160px]">Driver</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-center">CDF DPMO</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Negative Feedback</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cdfRows.map((r, i) => (
                    <TableRow key={r.transporterId} className={r.negativeFeedbackCount > 0 ? "bg-red-500/5" : ""}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.cdfDpmo}</TableCell>
                      <TableCell className="text-center"><TierBadge tier={r.cdfDpmoTier} className="text-[9px]" /></TableCell>
                      <TableCell className="text-center tabular-nums">{r.cdfDpmoScore}</TableCell>
                      <TableCell className="text-center">
                        <span className={r.negativeFeedbackCount > 0 ? "text-red-500 font-bold" : "text-muted-foreground"}>{r.negativeFeedbackCount}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <Smile className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No CDF data available for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {activeTab === 'CDF-Negative' && (
        <div className="mt-4">
          {cdfNegativeRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[160px]">Driver</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead className="text-center">Delivery Date</TableHead>
                  <TableHead className="text-center">Mishandled</TableHead>
                  <TableHead className="text-center">Unprofessional</TableHead>
                  <TableHead className="text-center">Didn&apos;t Follow Instructions</TableHead>
                  <TableHead className="text-center">Wrong Address</TableHead>
                  <TableHead className="text-center">Never Received</TableHead>
                  <TableHead className="text-center">Wrong Item</TableHead>
                  <TableHead className="min-w-[200px]">Feedback Details</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cdfNegativeRows.map((r, i) => {
                    const flagClass = (val: string) => val && val.toLowerCase() === 'yes'
                      ? 'text-red-500 font-bold'
                      : 'text-muted-foreground/40';
                    const flagLabel = (val: string) => val && val.toLowerCase() === 'yes' ? 'Yes' : '—';
                    return (
                      <TableRow key={`${r.trackingId}-${i}`} className="bg-red-500/5">
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.deliveryAssociateName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{r.trackingId || '—'}</TableCell>
                        <TableCell className="text-center text-xs">{r.deliveryDate || '—'}</TableCell>
                        <TableCell className={cn("text-center text-xs", flagClass(r.daMishandledPackage))}>{flagLabel(r.daMishandledPackage)}</TableCell>
                        <TableCell className={cn("text-center text-xs", flagClass(r.daWasUnprofessional))}>{flagLabel(r.daWasUnprofessional)}</TableCell>
                        <TableCell className={cn("text-center text-xs", flagClass(r.daDidNotFollowInstructions))}>{flagLabel(r.daDidNotFollowInstructions)}</TableCell>
                        <TableCell className={cn("text-center text-xs", flagClass(r.deliveredToWrongAddress))}>{flagLabel(r.deliveredToWrongAddress)}</TableCell>
                        <TableCell className={cn("text-center text-xs", flagClass(r.neverReceivedDelivery))}>{flagLabel(r.neverReceivedDelivery)}</TableCell>
                        <TableCell className={cn("text-center text-xs", flagClass(r.receivedWrongItem))}>{flagLabel(r.receivedWrongItem)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={r.feedbackDetails}>{r.feedbackDetails || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <MessageSquareWarning className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No CDF Negative records for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {/* ═══ TAB: DELIVERY EXCELLENCE ═══ */}
        {activeTab === 'Delivery-Excellence' && (
        <div className="mt-4">
          {deliveryExcellenceRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[160px]">Driver</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-center">Standing</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">FICO</TableHead>
                  <TableHead className="text-right">Speeding</TableHead>
                  <TableHead className="text-right">Seatbelt</TableHead>
                  <TableHead className="text-right">Distractions</TableHead>
                  <TableHead className="text-right">Sign/Signal</TableHead>
                  <TableHead className="text-right">Follow Dist</TableHead>
                  <TableHead className="text-right">CDF DPMO</TableHead>
                  <TableHead className="text-right">CED</TableHead>
                  <TableHead className="text-right">DCR</TableHead>
                  <TableHead className="text-right">DSB</TableHead>
                  <TableHead className="text-right">POD</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {deliveryExcellenceRows.map((r: any, i: number) => (
                    <TableRow key={r.transporterId + i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-center"><TierBadge tier={r.overallStanding} className="text-[9px]" /></TableCell>
                      <TableCell className="text-right font-bold">{r.overallScore}</TableCell>
                      <TableCell className="text-right">{r.ficoMetric ?? '—'}</TableCell>
                      <TableCell className="text-right">{r.speedingEventRate}</TableCell>
                      <TableCell className="text-right">{r.seatbeltOffRate}</TableCell>
                      <TableCell className="text-right">{r.distractionsRate}</TableCell>
                      <TableCell className="text-right">{r.signSignalViolationsRate}</TableCell>
                      <TableCell className="text-right">{r.followingDistanceRate}</TableCell>
                      <TableCell className="text-right">{r.cdfDpmo}</TableCell>
                      <TableCell className="text-right">{r.ced}</TableCell>
                      <TableCell className="text-right">{r.dcr}</TableCell>
                      <TableCell className="text-right">{r.dsb}</TableCell>
                      <TableCell className="text-right">{r.pod}</TableCell>
                      <TableCell className="text-right">{r.packagesDelivered}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No Delivery Excellence data for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {/* ═══ TAB: DCR ═══ */}
        {activeTab === 'DCR' && (
        <div className="mt-4">
          {dcrRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[160px]">Driver</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">DCR %</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Dispatched</TableHead>
                  <TableHead className="text-right">RTS</TableHead>
                  <TableHead className="text-right">DA Ctrl</TableHead>
                  <TableHead className="text-right">Biz Closed</TableHead>
                  <TableHead className="text-right">Cust Unavail</TableHead>
                  <TableHead className="text-right">No Secure</TableHead>
                  <TableHead className="text-right">Unable Access</TableHead>
                  <TableHead className="text-right">Unable Locate</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {dcrRows.map((r: any, i: number) => (
                    <TableRow key={r.transporterId + i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-right font-bold">{r.dcr}%</TableCell>
                      <TableCell className="text-right">{r.packagesDelivered}</TableCell>
                      <TableCell className="text-right">{r.packagesDispatched}</TableCell>
                      <TableCell className="text-right"><span className={r.packagesReturnedToStation > 0 ? "text-red-500 font-bold" : ""}>{r.packagesReturnedToStation}</span></TableCell>
                      <TableCell className="text-right">{r.packagesReturnedDAControllable}</TableCell>
                      <TableCell className="text-right">{r.rtsBusinessClosed}</TableCell>
                      <TableCell className="text-right">{r.rtsCustomerUnavailable}</TableCell>
                      <TableCell className="text-right">{r.rtsNoSecureLocation}</TableCell>
                      <TableCell className="text-right">{r.rtsUnableToAccess}</TableCell>
                      <TableCell className="text-right">{r.rtsUnableToLocate}</TableCell>
                      <TableCell className="text-right">{r.rtsOther}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No DCR data for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {/* ═══ TAB: DSB ═══ */}
        {activeTab === 'DSB' && (
        <div className="mt-4">
          {dsbRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[160px]">Driver</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">DSB Count</TableHead>
                  <TableHead className="text-right">DSB DPMO</TableHead>
                  <TableHead className="text-right">Attended</TableHead>
                  <TableHead className="text-right">Unattended</TableHead>
                  <TableHead className="text-right">Simultaneous</TableHead>
                  <TableHead className="text-right">Over 50m</TableHead>
                  <TableHead className="text-right">Scan Att.</TableHead>
                  <TableHead className="text-right">Scan Unatt.</TableHead>
                  <TableHead className="text-right">No POD</TableHead>
                  <TableHead className="text-right">SNDNR</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {dsbRows.map((r: any, i: number) => (
                    <TableRow key={r.transporterId + i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-right"><span className={r.dsbCount > 0 ? "text-red-500 font-bold" : ""}>{r.dsbCount}</span></TableCell>
                      <TableCell className="text-right">{r.dsbDpmo}</TableCell>
                      <TableCell className="text-right">{r.attendedDeliveryCount}</TableCell>
                      <TableCell className="text-right">{r.unattendedDeliveryCount}</TableCell>
                      <TableCell className="text-right">{r.simultaneousDeliveries}</TableCell>
                      <TableCell className="text-right">{r.deliveredOver50m}</TableCell>
                      <TableCell className="text-right">{r.incorrectScanUsageAttended}</TableCell>
                      <TableCell className="text-right">{r.incorrectScanUsageUnattended}</TableCell>
                      <TableCell className="text-right">{r.noPodOnDelivery}</TableCell>
                      <TableCell className="text-right">{r.scannedNotDeliveredNotReturned}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No DSB data for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {/* ═══ TAB: SAFETY ═══ */}
        {activeTab === 'Safety' && (
        <div className="mt-4">
          {safetyRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[140px]">Driver</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subtype</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead className="min-w-[200px]">Review Details</TableHead>
                  <TableHead>Video</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {safetyRows.map((r: any, i: number) => (
                    <TableRow key={r.eventId + i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-xs">{r.date}</TableCell>
                      <TableCell className="text-xs">{r.metricType}</TableCell>
                      <TableCell className="text-xs">{r.metricSubtype}</TableCell>
                      <TableCell className="text-xs"><span className={r.programImpact?.toLowerCase().includes('tier') ? "text-red-500 font-semibold" : ""}>{r.programImpact}</span></TableCell>
                      <TableCell className="text-xs">{r.source}</TableCell>
                      <TableCell className="text-xs font-mono">{r.vin}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={r.reviewDetails}>{r.reviewDetails || '—'}</TableCell>
                      <TableCell className="text-xs">{r.videoLink ? <a href={r.videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View</a> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <Shield className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No Safety events for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        {/* ═══ TAB: DVIC ═══ */}
        {activeTab === 'DVIC' && (
        <div className="mt-4">
          {dvicRawRows.length > 0 ? (
            <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="min-w-[140px]">Driver</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Fleet Type</TableHead>
                  <TableHead>Inspection Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {dvicRawRows.map((r: any, i: number) => (
                    <TableRow key={r.transporterId + r.vin + i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.transporterName || r.deliveryAssociate || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                      <TableCell className="text-xs">{r.startDate}</TableCell>
                      <TableCell className="text-xs font-mono">{r.vin}</TableCell>
                      <TableCell className="text-xs">{r.fleetType}</TableCell>
                      <TableCell className="text-xs">{r.inspectionType}</TableCell>
                      <TableCell className="text-xs"><span className={r.inspectionStatus?.toLowerCase() === 'rushed' ? "text-amber-500 font-semibold" : "text-emerald-500"}>{r.inspectionStatus}</span></TableCell>
                      <TableCell className="text-xs">{r.startTime}</TableCell>
                      <TableCell className="text-xs">{r.endTime}</TableCell>
                      <TableCell className="text-xs">{r.duration}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></CardContent></Card>
          ) : (
            <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No DVIC inspection data for this week</p>
            </CardContent></Card>
          )}
        </div>)}

        </>)}



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
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] p-0 gap-0 overflow-hidden border border-white/10 shadow-2xl rounded-2xl backdrop-blur-xl bg-background/85">
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
          if (d.negativeFeedbackCount > 0) focusAreas.push({ title: 'Customer Delivery Feedback', tip: 'Always read the customer notes before executing a delivery! These notes will aid you in the delivery and help to ensure your success. When in doubt, call customer support or call/text the customer for guidance on how they want their package delivered. Lastly, if you ever interact with a customer directly, smiling and being courteous will generally help your CDF score.' });
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
                    <div className="h-[60px] w-[60px] rounded-full bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-[2px] shrink-0 shadow-md">
                      <Image src={d.profileImage} alt={d.name} width={56} height={56} className="h-full w-full rounded-full object-cover" />
                    </div>
                  ) : (
                    <div className={cn(
                      "h-[60px] w-[60px] rounded-full flex items-center justify-center text-lg font-black text-white shrink-0 shadow-md",
                      "bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a]"
                    )}>
                      {d.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight truncate">{d.name}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{d.transporterId}</p>
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
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  {/* On-Road Safety Score */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'on-road-safety-score', score: d.ficoTier || 'N/A' })}>
                    <span className="text-sm font-bold">On-Road Safety Score</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black">{d.ficoTier || 'N/A'}</span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>
                  {/* FICO Score */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'fico-score', score: `${d.ficoMetric ?? '—'}/850` })} style={{ background: `linear-gradient(270deg, ${(d.ficoMetric ?? 0) >= 800 ? 'rgba(16,185,129,0.15)' : (d.ficoMetric ?? 0) >= 700 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'} 0%, transparent 60%)` }}>
                    <span className="text-sm font-bold">FICO Score</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black tabular-nums">
                        <span className={(d.ficoMetric ?? 0) >= 800 ? 'text-emerald-600' : (d.ficoMetric ?? 0) >= 700 ? 'text-amber-500' : 'text-red-500'}>{d.ficoMetric ?? '—'}</span>
                        <span className="text-muted-foreground font-normal">/850</span>
                      </span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>
                  {/* Proper-Park-Sequence Compliance */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'proper-park-sequence', score: 'Coming Soon' })} style={{ background: 'linear-gradient(270deg, rgba(245,158,11,0.12) 0%, transparent 60%)' }}>
                    <span className="text-sm font-bold">Proper-Park-Sequence Compliance</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>
                  {/* Sub-rows */}
                  <div className="flex justify-between items-center px-4 py-2 pl-7 border-b border-border/10">
                    <span className="text-sm text-muted-foreground">Did Not Apply Parking Brake</span>
                    <span className="text-sm font-black tabular-nums text-muted-foreground/50">—</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2 pl-7 border-b border-border/10">
                    <span className="text-sm text-muted-foreground">Did Not Shift Gear to Park</span>
                    <span className="text-sm font-black tabular-nums text-muted-foreground/50">—</span>
                  </div>
                  {/* Paw Print Contact Compliance */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'paw-print-contact', score: 'Coming Soon' })} style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 50%, transparent 100%)' }}>
                    <span className="text-sm font-bold">Paw Print Contact Compliance</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>

                  {/* Events header */}
                  <div className="px-4 pt-3.5 pb-2 border-b border-border/15">
                    <span className="text-sm font-black">Events</span>
                    <span className="text-xs text-muted-foreground ml-1">(Per 100 Deliveries)</span>
                  </div>

                  {/* Event rates with gradient bars */}
                  {(() => {
                    const events = [
                      { label: 'Distractions', value: d.distractionsRate, infoKey: 'distractions' },
                      { label: 'Speeding', value: d.speedingEventRate, infoKey: 'speeding' },
                      { label: 'Seatbelt Off', value: d.seatbeltOffRate, infoKey: 'seatbelt-off' },
                      { label: 'Follow Distance', value: d.followingDistanceRate, infoKey: 'follow-distance' },
                      { label: 'Sign/Signal Violations', value: d.signSignalViolationsRate, infoKey: 'sign-signal-violations' },
                    ];
                    const getEventColor = (v: number) => {
                      if (v === 0) return { text: 'text-emerald-500', bg: 'transparent' };
                      if (v <= 0.3) return { text: 'text-emerald-500', bg: 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, transparent 60%)' };
                      if (v <= 0.8) return { text: 'text-amber-500', bg: 'linear-gradient(270deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' };
                      if (v <= 1.5) return { text: 'text-orange-500', bg: 'linear-gradient(270deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.05) 50%, transparent 100%)' };
                      return { text: 'text-red-500', bg: 'linear-gradient(270deg, rgba(239,68,68,0.20) 0%, rgba(239,68,68,0.06) 50%, transparent 100%)' };
                    };
                    return events.map((m, idx) => {
                      const colors = getEventColor(m.value);
                      return (
                        <div key={m.label} className={cn("flex justify-between items-center px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors", idx < events.length - 1 && "border-b border-border/10")} style={{ background: colors.bg }} onClick={() => setInfoModal({ key: m.infoKey, score: String(m.value) })}>
                          <span className="text-sm font-bold">{m.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-sm font-black tabular-nums", colors.text)}>{m.value}</span>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* ── DELIVERY QUALITY ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a8a5a] to-[#1a6a4a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Delivery Quality</h3>
                  <CheckCircle2 className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  {/* Overall Quality Score */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 60%, transparent 100%)' }}>
                    <span className="text-sm font-bold">Overall Quality Score</span>
                    <span className="text-sm font-black text-emerald-600">{d.dcrTier || 'N/A'}</span>
                  </div>
                  {/* Completion Rate */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15">
                    <span className="text-sm font-bold">Completion Rate</span>
                    <span className="text-sm font-black tabular-nums">{d.dcr}</span>
                  </div>
                  {/* Delivered, Not Received */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: d.ced > 0 ? 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' : undefined }}>
                    <span className="text-sm font-bold">Delivered, Not Received</span>
                    <span className={cn("text-sm font-black tabular-nums", d.ced > 0 && "text-amber-500")}>
                      {d.ced}<span className="text-muted-foreground font-normal">/{d.packagesDelivered}</span>
                    </span>
                  </div>
                  {/* Photo-On-Delivery Acceptance */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.10) 0%, transparent 60%)' }}>
                    <span className="text-sm font-bold">Photo-On-Delivery Acceptance</span>
                    <span className="text-sm font-black tabular-nums">{podRate}%</span>
                  </div>
                  {/* Photo-On-Delivery Rejects */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15">
                    <span className="text-sm font-bold">Photo-On-Delivery Rejects</span>
                    <span className={cn("text-sm font-black tabular-nums", d.podRejects > 0 && "text-amber-500")}>
                      {d.podRejects}<span className="text-muted-foreground font-normal">/{d.podOpportunities || '—'}</span>
                    </span>
                  </div>
                  {/* POD Reject Breakdown */}
                  {d.podRejects > 0 && Object.entries(d.podRejectBreakdown).length > 0 && (
                    <>
                      {Object.entries(d.podRejectBreakdown).sort(([,a],[,b]) => (b as number) - (a as number)).map(([reason, count]) => (
                        <div key={reason} className="flex justify-between items-center px-4 py-2 pl-7 border-b border-border/10">
                          <span className="text-sm text-muted-foreground">{reason}</span>
                          <span className="text-sm font-black tabular-nums">{count as number}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {/* Delivery Success Behaviors */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: d.dsb > 0 ? 'linear-gradient(270deg, rgba(245,158,11,0.18) 0%, rgba(239,68,68,0.08) 50%, transparent 100%)' : 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, transparent 60%)' }}>
                    <span className="text-sm font-bold">Delivery Success Behaviors</span>
                    <span className={cn("text-sm font-black tabular-nums", d.dsb > 0 ? "text-amber-500" : "text-emerald-500")}>{d.dsb}</span>
                  </div>
                  {/* Pickup Success Behaviors */}
                  <div className="flex justify-between items-center px-4 py-2.5" style={{ background: 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' }}>
                    <span className="text-sm font-bold">Pickup Success Behaviors</span>
                    <span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span>
                  </div>
                </div>
              </div>

              {/* ── CUSTOMER FEEDBACK ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#d4950a] to-[#c2860a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Customer Feedback</h3>
                  <Smile className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  {/* Overall Feedback Score */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: 'linear-gradient(90deg, rgba(212,149,10,0.12) 0%, rgba(212,149,10,0.05) 100%)' }}>
                    <span className="text-sm font-bold">Overall Feedback Score</span>
                    <span className="text-sm font-black text-[#c2860a]">{d.cdfDpmoTier || 'N/A'}</span>
                  </div>
                  {/* Negative Feedback Rate */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: 'linear-gradient(90deg, rgba(212,149,10,0.08) 0%, rgba(212,149,10,0.03) 100%)' }}>
                    <span className="text-sm font-bold">Negative Feedback Rate <span className="font-normal text-muted-foreground">(CDF DPMO)</span></span>
                    <span className="text-sm font-black tabular-nums text-[#c2860a]">{typeof d.cdfDpmo === 'number' ? d.cdfDpmo.toLocaleString() : d.cdfDpmo}</span>
                  </div>
                  {/* Deliveries w/ Negative Feedback */}
                  <div className="flex justify-between items-center px-4 py-2.5 pl-7 border-b border-border/15" style={{ background: 'linear-gradient(90deg, rgba(212,149,10,0.05) 0%, transparent 100%)' }}>
                    <span className="text-sm text-muted-foreground">Deliveries w/ Negative Feedback</span>
                    <span className="text-sm font-black tabular-nums">
                      {d.negativeFeedbackCount}<span className="text-muted-foreground font-normal">/{d.packagesDelivered}</span>
                    </span>
                  </div>
                  {/* Escalation Defects */}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 60%, transparent 100%)' }}>
                    <span className="text-sm font-bold">Escalation Defects</span>
                    <span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span>
                  </div>

                  {/* Negative Feedback Breakdown */}
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-sm font-black mb-1">Negative Feedback</p>
                    <p className="text-[10px] text-muted-foreground italic mb-2">Coming Soon</p>
                  </div>
                  {['Not Great', 'Did Not Follow Instructions', 'Wrong Address', 'Never Received'].map((label) => (
                    <div key={label} className="flex justify-between items-center px-4 py-2 pl-7 border-t border-border/10">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-black tabular-nums text-muted-foreground/50">—</span>
                    </div>
                  ))}
                  <div className="h-1" />
                </div>
              </div>

              {/* ── DVIC ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Vehicle Inspection Times (DVIC)</h3>
                  <ClipboardCheck className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-3 mb-4">
                  {d.dvicTotalInspections > 0 ? (() => {
                    // Helper: parse duration to seconds
                    const parseDurSec = (dur: string | number | undefined): number => {
                      if (dur == null || dur === "") return 0;
                      if (!isNaN(Number(dur))) return Number(dur);
                      const s = String(dur);
                      const minM = s.match(/(\d+(?:\.\d+)?)\s*min/i);
                      if (minM) return parseFloat(minM[1]) * 60;
                      const parts = s.split(":");
                      if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                      if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
                      return 0;
                    };
                    // Helper: format seconds to MM:SS
                    const fmtMMSS = (sec: number): string => {
                      const m = Math.floor(sec / 60);
                      const s = Math.round(sec % 60);
                      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    };
                    // Helper: format date to "Day MM/DD"
                    const fmtDay = (dateStr: string): string => {
                      if (!dateStr) return '—';
                      try {
                        const d = new Date(dateStr + 'T00:00:00');
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        return `${days[d.getDay()]} ${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
                      } catch { return dateStr; }
                    };

                    const inspections = d.dvicInspections.map((insp, idx) => {
                      const sec = parseDurSec(insp.duration);
                      const isRushed = sec > 0 && sec < 90;
                      return { ...insp, sec, isRushed, idx };
                    });

                    // Sort by date
                    inspections.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

                    return (
                      <>
                        {/* Rushed Inspections header */}
                        <div className="flex items-center justify-between py-2 mb-2 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg px-1 -mx-1" onClick={() => setInfoModal({ key: 'dvic-rushed', score: `${d.dvicRushedCount}/${d.dvicTotalInspections}` })}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black">Rushed Inspections</span>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                          <span className={cn("text-sm font-black tabular-nums", d.dvicRushedCount > 0 ? "text-amber-500" : "text-emerald-500")}>
                            {d.dvicRushedCount}/{d.dvicTotalInspections}
                          </span>
                        </div>
                        {/* All inspections list */}
                        <div className="space-y-1.5">
                          {inspections.map((insp) => {
                            const sec = insp.sec;
                            const isRushed = insp.isRushed;
                            // Color tier: < 80 = red, 80-89 = orange, >= 90 = normal
                            const isRed = sec > 0 && sec < 80;
                            const isOrange = sec >= 80 && sec < 90;
                            const statusLower = (insp.inspectionStatus || '').toLowerCase();
                            const statusColor = statusLower === 'complete' || statusLower === 'passed'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : statusLower === 'incomplete' || statusLower === 'failed'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-muted text-muted-foreground border-border/30';
                            const statusDot = statusLower === 'complete' || statusLower === 'passed'
                              ? 'bg-emerald-500'
                              : statusLower === 'incomplete' || statusLower === 'failed'
                              ? 'bg-red-500' : 'bg-muted-foreground';

                            // Gradient from right side; red or orange based on severity
                            const gradientBg = isRed
                              ? 'linear-gradient(270deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.12) 40%, transparent 100%)'
                              : isOrange
                              ? 'linear-gradient(270deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.10) 40%, transparent 100%)'
                              : '';

                            const durationColor = isRed ? 'text-red-500' : isOrange ? 'text-amber-500' : 'text-foreground';

                            return (
                              <div
                                key={insp.idx}
                                className={cn(
                                  "relative rounded-lg overflow-hidden transition-colors",
                                  isRushed ? "" : "hover:bg-muted/20"
                                )}
                              >
                                {/* Gradient bar for rushed — shades from right */}
                                {isRushed && (
                                  <div
                                    className="absolute inset-0 rounded-lg"
                                    style={{ background: gradientBg }}
                                  />
                                )}
                                {/* Single inline row: Day | VIN | Fleet | Status | Duration */}
                                <div className="relative flex items-center px-3 py-2 gap-0">
                                  {isRushed && <AlertTriangle className={cn("h-3 w-3 flex-shrink-0 mr-1.5", isRed ? "text-red-500" : "text-amber-500")} />}
                                  <span className={cn("text-xs font-semibold whitespace-nowrap", isRushed ? "text-foreground" : "text-foreground/80")}>
                                    {fmtDay(insp.startDate)}
                                  </span>
                                  <span className="mx-2 text-border/60 select-none">|</span>
                                  <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap" title={insp.vin}>
                                    {insp.vin ? `VIN …${insp.vin.slice(-6)}` : '—'}
                                  </span>
                                  {insp.fleetType && (
                                    <>
                                      <span className="mx-2 text-border/60 select-none">|</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20 font-medium whitespace-nowrap">
                                        {insp.fleetType}
                                      </span>
                                    </>
                                  )}
                                  {insp.inspectionStatus && (
                                    <>
                                      <span className="mx-2 text-border/60 select-none">|</span>
                                      <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap", statusColor)}>
                                        <span className={cn("w-1 h-1 rounded-full", statusDot)} />
                                        {insp.inspectionStatus}
                                      </span>
                                    </>
                                  )}
                                  <span className="mx-2 text-border/60 select-none">|</span>
                                  <span className={cn(
                                    "text-sm font-black font-mono tabular-nums whitespace-nowrap ml-auto",
                                    durationColor
                                  )}>
                                    {sec > 0 ? fmtMMSS(sec) : (insp.duration || '—')}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })() : (
                    <div className="py-6 text-center">
                      <ClipboardCheck className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No inspections recorded this week</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SAFETY DASHBOARD DFO2 ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-600 to-amber-600 mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-white/70" />
                    Safety Dashboard DFO2
                  </h3>
                  <span className={cn("text-sm font-black tabular-nums text-white")}>
                    {d.safetyEventCount} Event{d.safetyEventCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4">
                  {d.safetyEvents.length > 0 ? (
                    <div className="space-y-1.5">
                      {d.safetyEvents.map((evt, idx) => {
                        const impactLower = (evt.programImpact || '').toLowerCase();
                        const impactColor = impactLower.includes('tier 1') || impactLower.includes('high')
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : impactLower.includes('tier 2') || impactLower.includes('medium')
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';

                        return (
                          <div key={idx} className="rounded-lg border border-border/30 overflow-hidden hover:border-border/50 transition-colors">
                            {/* Top row: Metric Type + Date */}
                            <div className="flex items-center justify-between px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{evt.metricType || '—'}</span>
                                {evt.metricSubtype && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                    {evt.metricSubtype}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums">{evt.date || evt.dateTime || '—'}</span>
                            </div>
                            {/* Bottom row: Impact, Source, Video */}
                            <div className="flex items-center gap-2 px-3 pb-2 pt-0.5">
                              {evt.programImpact && (
                                <span className={cn("inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-semibold", impactColor)}>
                                  {evt.programImpact}
                                </span>
                              )}
                              {evt.source && (
                                <span className="text-[10px] text-muted-foreground">{evt.source}</span>
                              )}
                              {evt.videoLink && (
                                <a href={evt.videoLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-500 hover:underline ml-auto">
                                  View Video
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <ShieldAlert className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No safety events recorded this week</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── CDF NEGATIVE FEEDBACK ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <MessageSquareWarning className="h-5 w-5 text-white/70" />
                    CDF Negative Feedback
                  </h3>
                  <span className={cn("text-sm font-black tabular-nums text-white")}>
                    {d.cdfNegativeCount} Record{d.cdfNegativeCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4">
                  {d.cdfNegativeRecords && d.cdfNegativeRecords.length > 0 ? (
                    <div className="space-y-2">
                      {d.cdfNegativeRecords.map((rec, idx) => {
                        // Determine which categories were flagged
                        const flags: string[] = [];
                        if (rec.daMishandledPackage && rec.daMishandledPackage.toLowerCase() === 'true') flags.push('Mishandled Package');
                        if (rec.daWasUnprofessional && rec.daWasUnprofessional.toLowerCase() === 'true') flags.push('Unprofessional');
                        if (rec.daDidNotFollowInstructions && rec.daDidNotFollowInstructions.toLowerCase() === 'true') flags.push('Did Not Follow Instructions');
                        if (rec.deliveredToWrongAddress && rec.deliveredToWrongAddress.toLowerCase() === 'true') flags.push('Wrong Address');
                        if (rec.neverReceivedDelivery && rec.neverReceivedDelivery.toLowerCase() === 'true') flags.push('Never Received');
                        if (rec.receivedWrongItem && rec.receivedWrongItem.toLowerCase() === 'true') flags.push('Wrong Item');

                        return (
                          <div key={idx} className="rounded-lg border border-border/30 overflow-hidden hover:border-border/50 transition-colors">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
                              <div className="flex items-center gap-2 flex-wrap">
                                {flags.length > 0 ? flags.map((f, fi) => (
                                  <span key={fi} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-semibold">{f}</span>
                                )) : (
                                  <span className="text-[10px] text-muted-foreground italic">No categories flagged</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">{rec.deliveryDate || '—'}</span>
                            </div>
                            {rec.feedbackDetails && (
                              <div className="px-3 py-2">
                                <p className="text-xs text-muted-foreground leading-relaxed">{rec.feedbackDetails}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 px-3 pb-2">
                              {rec.trackingId && <span className="text-[10px] font-mono text-muted-foreground">TID: {rec.trackingId}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <MessageSquareWarning className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No negative feedback records this week</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── CUSTOMER DELIVERY FEEDBACK ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#d4950a] to-[#c2860a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <Smile className="h-5 w-5 text-white/70" />
                    Customer Delivery Feedback
                  </h3>
                  {d.customerDeliveryFeedback && (
                    <span className="text-sm font-black text-white">{d.customerDeliveryFeedback.cdfDpmoTier}</span>
                  )}
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  {d.customerDeliveryFeedback ? (() => {
                    const cdfData = d.customerDeliveryFeedback;
                    const dpmoColor = cdfData.cdfDpmo <= 200 ? 'text-emerald-500' : cdfData.cdfDpmo <= 500 ? 'text-green-500' : cdfData.cdfDpmo <= 1000 ? 'text-amber-500' : 'text-red-500';
                    const dpmoGradient = cdfData.cdfDpmo <= 200
                      ? 'linear-gradient(270deg, rgba(16,185,129,0.15) 0%, transparent 60%)'
                      : cdfData.cdfDpmo <= 500
                      ? 'linear-gradient(270deg, rgba(34,197,94,0.15) 0%, transparent 60%)'
                      : cdfData.cdfDpmo <= 1000
                      ? 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, transparent 60%)'
                      : 'linear-gradient(270deg, rgba(239,68,68,0.15) 0%, transparent 60%)';
                    return (
                      <>
                        <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: dpmoGradient }}>
                          <span className="text-sm font-bold">CDF DPMO</span>
                          <span className={cn("text-sm font-black tabular-nums", dpmoColor)}>{cdfData.cdfDpmo.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15">
                          <span className="text-sm font-bold">CDF DPMO Tier</span>
                          <span className="text-sm font-black">{cdfData.cdfDpmoTier}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15">
                          <span className="text-sm font-bold">CDF DPMO Score</span>
                          <span className="text-sm font-black tabular-nums">{cdfData.cdfDpmoScore}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5" style={{ background: cdfData.negativeFeedbackCount > 0 ? 'linear-gradient(270deg, rgba(239,68,68,0.15) 0%, transparent 60%)' : undefined }}>
                          <span className="text-sm font-bold">Negative Feedback Count</span>
                          <span className={cn("text-sm font-black tabular-nums", cdfData.negativeFeedbackCount > 0 && "text-red-500")}>{cdfData.negativeFeedbackCount}</span>
                        </div>
                      </>
                    );
                  })() : (
                    <div className="py-6 text-center">
                      <Smile className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No CDF data this week</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── QUALITY DSB / DNR ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-white/70" />
                    Quality DSB / DNR
                  </h3>
                  {d.qualityDsbDnr && (
                    <span className={cn("text-sm font-black tabular-nums text-white")}>
                      {d.qualityDsbDnr.dsbCount} DSB
                    </span>
                  )}
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  {d.qualityDsbDnr ? (() => {
                    const q = d.qualityDsbDnr;
                    const dsbColor = q.dsbCount === 0 ? 'text-emerald-500' : q.dsbCount <= 3 ? 'text-amber-500' : 'text-red-500';
                    const getRowGradient = (val: number) => val > 0
                      ? 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)'
                      : undefined;
                    return (
                      <>
                        <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: q.dsbCount > 0 ? 'linear-gradient(270deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 50%, transparent 100%)' : 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, transparent 60%)' }}>
                          <span className="text-sm font-bold">DSB Count</span>
                          <span className={cn("text-sm font-black tabular-nums", dsbColor)}>{q.dsbCount}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15">
                          <span className="text-sm font-bold">DSB DPMO</span>
                          <span className="text-sm font-black tabular-nums">{q.dsbDpmo.toLocaleString()}</span>
                        </div>
                        <div className="px-4 pt-3 pb-1.5 border-b border-border/15">
                          <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Breakdown</span>
                        </div>
                        {([
                          { label: 'Attended Deliveries', value: q.attendedDeliveryCount },
                          { label: 'Unattended Deliveries', value: q.unattendedDeliveryCount },
                          { label: 'Simultaneous Deliveries', value: q.simultaneousDeliveries },
                          { label: 'Delivered > 50m', value: q.deliveredOver50m },
                          { label: 'Incorrect Scan (Attended)', value: q.incorrectScanUsageAttended },
                          { label: 'Incorrect Scan (Unattended)', value: q.incorrectScanUsageUnattended },
                          { label: 'No POD on Delivery', value: q.noPodOnDelivery },
                          { label: 'Scanned Not Delivered/Returned', value: q.scannedNotDeliveredNotReturned },
                        ] as const).map((row, idx, arr) => (
                          <div key={row.label} className={cn("flex justify-between items-center px-4 py-2 pl-7", idx < arr.length - 1 && "border-b border-border/10")} style={{ background: getRowGradient(row.value) }}>
                            <span className="text-sm text-muted-foreground">{row.label}</span>
                            <span className={cn("text-sm font-black tabular-nums", row.value > 0 ? "text-amber-500" : "text-muted-foreground/50")}>{row.value || '—'}</span>
                          </div>
                        ))}
                      </>
                    );
                  })() : (
                    <div className="py-6 text-center">
                      <ClipboardCheck className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No DSB/DNR data this week</p>
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
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4 space-y-3">
                  {focusAreas.map((fa, idx) => (
                    <div key={idx} className={cn(idx > 0 && "pt-3 border-t border-border/30")}>
                      <p className="text-sm leading-relaxed">
                        <span className="font-black">{fa.title}:</span>{' '}
                        <span className="text-muted-foreground">{fa.tip}</span>
                      </p>
                    </div>
                  ))}
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
                        <p className="text-xs font-bold text-foreground mb-1">{d.name}</p>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label>
                        <DebouncedTextarea
                          placeholder="Enter driver remarks..."
                          className="min-h-[100px] text-xs resize-none border-2 border-border/40 focus:border-[#1a7a8a]/50 transition-colors bg-transparent"
                          value={driverRemarks}
                          onChange={setDriverRemarks}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground mb-1">{d.name}</p>
                        <SignaturePad
                          value={driverSignature}
                          onChange={setDriverSignature}
                          height={100}
                          label="Signature"
                          timestamp={driverSigTimestamp ? format(new Date(driverSigTimestamp), 'MMM d, yyyy h:mm a') : null}
                        />
                      </div>
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
                        <p className="text-xs font-bold text-foreground mb-1">{loggedInUserName || 'Manager'}</p>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label>
                        <DebouncedTextarea
                          placeholder="Enter manager remarks..."
                          className="min-h-[100px] text-xs resize-none bg-transparent border-2 border-border/40 focus:border-[#1a7a8a]/50 transition-colors"
                          value={managerRemarks}
                          onChange={setManagerRemarks}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground mb-1">{loggedInUserName || 'Manager'}</p>
                        <SignaturePad
                          value={managerSignature}
                          onChange={setManagerSignature}
                          height={100}
                          label="Signature"
                          timestamp={managerSigTimestamp ? format(new Date(managerSigTimestamp), 'MMM d, yyyy h:mm a') : null}
                        />
                      </div>
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

    {/* ── METRIC INFO MODAL ── */}
    <Dialog open={!!infoModal} onOpenChange={() => setInfoModal(null)}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border border-border/60 shadow-2xl rounded-2xl">
        <DialogHeader className="sr-only"><DialogTitle>Metric Information</DialogTitle><DialogDescription>Details about this metric</DialogDescription></DialogHeader>
        {infoModal && METRIC_INFO[infoModal.key] && (() => {
          const info = METRIC_INFO[infoModal.key];
          return (
            <div className="p-6 space-y-4">
              {/* Title */}
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-black tracking-tight leading-tight">{info.title}</h3>
                <button onClick={() => setInfoModal(null)} className="shrink-0 p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Description */}
              <div className="space-y-3">
                {info.description.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground leading-relaxed">{paragraph}</p>
                ))}
              </div>

              {/* How it's measured */}
              {info.howMeasured && (
                <div className="space-y-2 pt-1">
                  <h4 className="text-sm font-black uppercase tracking-wide">How It&apos;s Measured</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{info.howMeasured}</p>
                </div>
              )}

              {/* Your Score */}
              {infoModal.score && (
                <div className="pt-2 border-t border-border/30 space-y-1.5">
                  <h4 className="text-sm font-black uppercase tracking-wide">Your Score</h4>
                  <p className="text-2xl font-black tabular-nums tracking-tight">{infoModal.score}</p>
                </div>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* ═══ VIDEO PLAYBACK DIALOG ═══ */}
    <Dialog open={!!videoDialogUrl} onOpenChange={() => setVideoDialogUrl(null)}>
      <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4 text-blue-500" />
            Safety Event Video
          </DialogTitle>
          <DialogDescription>Video from ScoreCard Safety Dashboard</DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-4">
          {videoDialogUrl && (
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={videoDialogUrl}
                controls
                autoPlay
                className="w-full h-full"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    </>
  );
}
