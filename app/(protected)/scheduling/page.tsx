"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  TruckIcon,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Minus,
  ChevronDown,
  MapPin,
  DoorOpen,
  DoorClosed,
  PhoneOff,
  GraduationCap,
  Wrench,
  CalendarOff,
  Navigation,
  UserCheck,
  BookOpen,
  Ban,
  ShieldAlert,
  Coffee,
  Save,
  Pencil,
  X,
  MessageSquare,
  RefreshCw,
  Plus,
  History,
  FileText,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import MessagingPanel, { type ActiveTabInfo, SUB_TABS } from "@/components/scheduling/messaging-panel";
import { useDataStore } from "@/hooks/use-data-store";
// ── Type Options with Icons & Colors ──
interface TypeOption {
  label: string;
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  dotColor: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { label: "Route", icon: Navigation, bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", dotColor: "bg-emerald-500" },
  { label: "Open", icon: DoorOpen, bg: "bg-amber-400/80", text: "text-white", border: "border-amber-500/60", dotColor: "bg-amber-400" },
  { label: "Close", icon: DoorClosed, bg: "bg-rose-400/80", text: "text-white", border: "border-rose-500/60", dotColor: "bg-rose-400" },
  { label: "Off", icon: Coffee, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", dotColor: "bg-zinc-400" },
  { label: "Call Out", icon: PhoneOff, bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600", dotColor: "bg-yellow-500" },
  { label: "AMZ Training", icon: GraduationCap, bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700", dotColor: "bg-indigo-500" },
  { label: "Fleet", icon: TruckIcon, bg: "bg-blue-600", text: "text-white", border: "border-blue-700", dotColor: "bg-blue-500" },
  { label: "Request Off", icon: CalendarOff, bg: "bg-purple-600", text: "text-white", border: "border-purple-700", dotColor: "bg-purple-500" },
  { label: "Trainer", icon: UserCheck, bg: "bg-teal-600", text: "text-white", border: "border-teal-700", dotColor: "bg-teal-500" },
  { label: "Training OTR", icon: BookOpen, bg: "bg-violet-600", text: "text-white", border: "border-violet-700", dotColor: "bg-violet-500" },
  { label: "Suspension", icon: Ban, bg: "bg-rose-700", text: "text-white", border: "border-rose-800", dotColor: "bg-rose-600" },
  { label: "Modified Duty", icon: ShieldAlert, bg: "bg-amber-600", text: "text-white", border: "border-amber-700", dotColor: "bg-amber-500" },
  { label: "Stand by", icon: Clock, bg: "bg-cyan-600", text: "text-white", border: "border-cyan-700", dotColor: "bg-cyan-500" },
];

const TYPE_MAP = new Map(TYPE_OPTIONS.map(opt => [opt.label.toLowerCase(), opt]));

const getTypeStyle = (value: string): { bg: string; text: string; border: string } => {
  if (!value || value.trim() === "") {
    return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" };
  }
  const opt = TYPE_MAP.get(value.trim().toLowerCase());
  if (opt) return { bg: opt.bg, text: opt.text, border: opt.border };
  return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Working types — anything NOT in this list is considered "not working"
const NON_WORKING_TYPES = new Set(["off", ""]);

function isWorkingDay(type: string): boolean {
  return !NON_WORKING_TYPES.has((type || "").trim().toLowerCase());
}

// Route types for consecutive route detection
const ROUTE_TYPES = new Set(["route"]);

function isRouteDay(type: string): boolean {
  return ROUTE_TYPES.has((type || "").trim().toLowerCase());
}

interface DayData {
  _id: string;
  date: string;
  weekDay: string;
  status: string;
  type: string;
  subType: string;
  trainingDay: string;
  startTime: string;
  dayBeforeConfirmation: string;
  dayOfConfirmation: string;
  weekConfirmation: string;
  van: string;
  note: string;
}

interface EmployeeSchedule {
  transporterId: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    name: string;
    type: string;
    status: string;
  } | null;
  weekNote: string;
  days: Record<number, DayData>;
}

interface WeekData {
  yearWeek: string;
  dates: string[];
  employees: EmployeeSchedule[];
  totalEmployees: number;
  prevWeekTrailing?: Record<string, number>;
}

// ── Planning Row Data ──
interface PlanningRow {
  label: string;
  values: number[];
  total: number;
  color: string;
}

function computePlanningData(employees: EmployeeSchedule[]): PlanningRow[] {
  const daStats = Array(7).fill(0);
  const standBy = Array(7).fill(0);
  const routesAssigned = Array(7).fill(0);
  const ops = Array(7).fill(0);
  const extraDAs = Array(7).fill(0);

  employees.forEach(emp => {
    for (let d = 0; d < 7; d++) {
      const day = emp.days[d];
      if (!day) continue;
      const typeVal = (day.type || "").trim().toLowerCase();
      const empType = (emp.employee?.type || "").trim().toLowerCase();

      if (isWorkingDay(day.type)) {
        daStats[d]++;
      }
      if (typeVal === "stand by") standBy[d]++;
      if (typeVal === "route") routesAssigned[d]++;
      if (empType === "ops" || empType === "operations") ops[d]++;
      if (typeVal === "open") extraDAs[d]++;
    }
  });

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return [
    { label: "DA's", values: daStats, total: sum(daStats), color: "text-emerald-400" },
    { label: "Stand By", values: standBy, total: sum(standBy), color: "text-cyan-400" },
    { label: "Routes Assigned", values: routesAssigned, total: sum(routesAssigned), color: "text-blue-400" },
    { label: "Ops", values: ops, total: sum(ops), color: "text-orange-400" },
    { label: "Extra DA's", values: extraDAs, total: sum(extraDAs), color: "text-purple-400" },
  ];
}

// Group employees by type
function groupByType(employees: EmployeeSchedule[]): Record<string, EmployeeSchedule[]> {
  const groups: Record<string, EmployeeSchedule[]> = {};
  employees.forEach(emp => {
    const type = emp.employee?.type || "Unassigned";
    if (!groups[type]) groups[type] = [];
    groups[type].push(emp);
  });
  return groups;
}

// Count working days for an employee
function countWorkingDays(emp: EmployeeSchedule): number {
  let count = 0;
  for (let d = 0; d < 7; d++) {
    const day = emp.days[d];
    if (day && isWorkingDay(day.type)) {
      count++;
    }
  }
  return count;
}

// Detect consecutive working days and return warnings per day index
// carryOver = how many consecutive working days the employee had at the END of the previous week
// Returns a Map<dayIndex, { consecutive: number, type: 'caution' | 'danger' }>
function getConsecutiveWarnings(emp: EmployeeSchedule, carryOver: number = 0): Map<number, { consecutive: number; type: 'caution' | 'danger' }> {
  const warnings = new Map<number, { consecutive: number; type: 'caution' | 'danger' }>();

  // Start with carry-over from previous week
  let consecutive = carryOver;
  for (let d = 0; d < 7; d++) {
    const day = emp.days[d];
    if (day && (day.status || "").trim().toLowerCase() === "scheduled") {
      consecutive++;
      if (consecutive === 6) {
        warnings.set(d, { consecutive: 6, type: 'caution' });
      } else if (consecutive >= 7) {
        warnings.set(d, { consecutive, type: 'danger' });
      }
    } else {
      consecutive = 0;
    }
  }

  return warnings;
}

// ── Inline Editable Note Component ──
function EditableNote({
  value,
  employeeId,
  transporterId,
  yearWeek,
  employeeName,
  onSaved,
}: {
  value: string;
  employeeId: string | undefined;
  transporterId: string;
  yearWeek: string;
  employeeName?: string;
  onSaved: (newNote: string, employeeName?: string, oldNote?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = async () => {
    if (!employeeId) {
      toast.error("No employee ID available");
      return;
    }
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, note: draft, yearWeek, transporterId, employeeName, oldNote: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Note saved");
      onSaved(draft, employeeName, value);
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[180px]">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 text-[11px] px-1.5 py-0 border-primary/40 focus-visible:ring-primary/30"
          disabled={saving}
          placeholder="Add a note..."
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-500/10"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1 cursor-pointer group/note min-w-[100px] max-w-[250px] rounded px-1 py-0.5 hover:bg-muted/40 transition-colors"
          onClick={() => setEditing(true)}
        >
          <span className="text-[11px] text-muted-foreground truncate flex-1">
            {value || <span className="italic opacity-50">—</span>}
          </span>
          <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
        </div>
      </TooltipTrigger>
      {value && value.length > 25 && (
        <TooltipContent side="top" className="max-w-[300px] text-xs bg-popover text-popover-foreground border shadow-lg">
          <p>{value}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

/** Business timezone — all "today" checks use Pacific Time. */
const BUSINESS_TZ = "America/Los_Angeles";

/** Get today's date string (YYYY-MM-DD) in Pacific Time. */
function getTodayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/** Compute current yearWeek (Sun-based) from today's date in Pacific Time. */
function getCurrentYearWeek(): string {
  const todayStr = getTodayPacific();
  const date = new Date(todayStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat
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

export default function SchedulingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Read initial week from URL ──
  const urlWeek = searchParams.get("week") || "";

  // ── State-driven tab switching — NO route navigation, instant!
  const [activeMainTab, setActiveMainTab] = useState<"scheduling" | "messaging">(
    () => (pathname.includes("/messaging") ? "messaging" : "scheduling")
  );
  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    const match = pathname.match(/\/scheduling\/messaging\/([^\/]+)/);
    return match?.[1] || "future-shift";
  });

  // ── Sync state changes to URL ──
  const updateURL = useCallback((tab: "scheduling" | "messaging", subTab: string, week: string) => {
    const params = new URLSearchParams();
    if (week) params.set("week", week);
    const qs = params.toString();
    const basePath = tab === "messaging"
      ? `/scheduling/messaging/${subTab}`
      : "/scheduling";
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  // Keep router in a ref so it never triggers the sync effect
  const routerRef = useRef(router);
  routerRef.current = router;

  // Sync URL when tabs change — runs ONLY when tab state actually changes, not on every render
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // skip the initial mount — URL is already correct
    }
    updateURL(activeMainTab, activeSubTab, selectedWeek);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab, activeSubTab]);

  const [mounted, setMounted] = useState(false);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeekState] = useState<string>(urlWeek);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [planningCollapsed, setPlanningCollapsed] = useState(true);
  const [selectAllTrigger, setSelectAllTrigger] = useState(0);
  const [activeTabInfo, setActiveTabInfo] = useState<ActiveTabInfo | null>(null);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [routeTypeConfigs, setRouteTypeConfigs] = useState<Record<string, { color: string; startTime: string }>>({});
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditEmployee, setAuditEmployee] = useState<{ transporterId: string; name: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const { setLeftContent, setRightContent } = useHeaderActions();

  // Wrapped setter that also updates URL
  const setSelectedWeek = useCallback((week: string) => {
    setSelectedWeekState(week);
    updateURL(activeMainTab, activeSubTab, week);
  }, [activeMainTab, activeSubTab, updateURL]);

  // Helpers to compute next/prev yearWeek strings
  const getNextYearWeek = (yw: string): string => {
    const m = yw.match(/(\d{4})-W(\d{2})/);
    if (!m) return yw;
    let yr = parseInt(m[1]), wk = parseInt(m[2]) + 1;
    if (wk > 52) { yr++; wk = 1; }
    return `${yr}-W${String(wk).padStart(2, "0")}`;
  };

  const getPrevYearWeek = (yw: string): string => {
    const m = yw.match(/(\d{4})-W(\d{2})/);
    if (!m) return yw;
    let yr = parseInt(m[1]), wk = parseInt(m[2]) - 1;
    if (wk < 1) { yr--; wk = 52; }
    return `${yr}-W${String(wk).padStart(2, "0")}`;
  };

  // Generate week schedules (works for both next and prev)
  const generateWeek = useCallback(async (targetWeek: string, direction: 'next' | 'prev') => {
    if (generatingWeek) return;
    setGeneratingWeek(true);
    try {
      const res = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearWeek: targetWeek }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      if (data.created === 0) {
        toast.info(`Week ${targetWeek} — all ${data.employees} employees already have schedules`);
      } else if (data.isNewWeek) {
        toast.success(`Created week ${targetWeek} — ${data.created} records for ${data.employees} employees`);
      } else {
        toast.success(`Synced week ${targetWeek} — added ${data.created} records for ${data.missingEmployees} new employee(s)`);
      }
      // Add to weeks list in the right position and navigate
      setWeeks(prev => {
        if (prev.includes(targetWeek)) return prev;
        const updated = [...prev, targetWeek].sort((a, b) => b.localeCompare(a));
        return updated;
      });
      setSelectedWeek(targetWeek);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate week");
    } finally {
      setGeneratingWeek(false);
    }
  }, [generatingWeek]);

  const store = useDataStore();

  // Mark as mounted on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    // Hydrate route type configs from global store if available
    if (store.initialized && store.admin.routeTypes && Object.keys(store.admin.routeTypes).length > 0) {
      setRouteTypeConfigs(store.admin.routeTypes);
    } else {
      // Fallback: Fetch route type configs for auto-filling startTime
      fetch("/api/admin/settings/route-types")
        .then(res => res.json())
        .then((types: any[]) => {
          const map: Record<string, { color: string; startTime: string }> = {};
          types.forEach((t: any) => { map[t.name.toLowerCase()] = { color: t.color, startTime: t.startTime || "" }; });
          setRouteTypeConfigs(map);
        })
        .catch(() => { });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Pick best default week: URL > current > closest ≤ current > latest */
  const pickDefaultWeek = useCallback((availableWeeks: string[], urlW: string) => {
    const currentWeek = getCurrentYearWeek();
    if (urlW && availableWeeks.includes(urlW)) return urlW;
    if (availableWeeks.includes(currentWeek)) return currentWeek;
    const prior = availableWeeks.filter(w => w <= currentWeek).sort((a, b) => b.localeCompare(a));
    return prior.length > 0 ? prior[0] : availableWeeks[0];
  }, []);

  // Hydrate weeks from global store for instant load
  const hydratedWeeksRef = useRef(false);
  useEffect(() => {
    if (hydratedWeeksRef.current) return;
    if (store.initialized && store.schedulingWeeks?.length) {
      hydratedWeeksRef.current = true;
      setWeeks(store.schedulingWeeks);
      setSelectedWeek(pickDefaultWeek(store.schedulingWeeks, urlWeek));
      setLoading(false);
    }
  }, [store.initialized, store.schedulingWeeks]);

  // Fetch available weeks (fallback if store not ready)
  useEffect(() => {
    if (!mounted) return;
    if (hydratedWeeksRef.current) return; // already hydrated from store
    setLoading(true);
    const fetchWeeks = async () => {
      try {
        const res = await fetch("/api/schedules?weeksList=true");
        const data = await res.json();
        if (data.weeks?.length) {
          setWeeks(data.weeks);
          setSelectedWeek(pickDefaultWeek(data.weeks, urlWeek));
        }
      } catch (err) {
        toast.error("Failed to load available weeks");
      } finally {
        setLoading(false);
      }
    };
    fetchWeeks();
  }, [mounted]);

  // Track which weeks have been auto-synced to avoid redundant generate calls
  const syncedWeeksRef = useRef<Set<string>>(new Set());

  // Hydrate first week's data from global store if available
  const hydratedWeekDataRef = useRef(false);

  // Fetch week data + audit counts (bundled) + auto-sync missing employees (once per week)
  useEffect(() => {
    if (!selectedWeek) return;
    let cancelled = false;

    // Try hydrating from global store for the first/default week
    if (
      !hydratedWeekDataRef.current &&
      store.initialized &&
      store.schedulingWeekData &&
      store.schedulingWeeks?.[0] === selectedWeek
    ) {
      hydratedWeekDataRef.current = true;
      setWeekData(store.schedulingWeekData);
      if (store.schedulingWeekData.auditCounts) {
        setAuditCounts(store.schedulingWeekData.auditCounts);
      }
      setLoadingData(false);

      // Still run background sync
      if (!syncedWeeksRef.current.has(selectedWeek)) {
        syncedWeeksRef.current.add(selectedWeek);
        fetch("/api/schedules/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yearWeek: selectedWeek }),
        })
          .then(r => r.json())
          .then(syncData => {
            if (cancelled) return;
            if (syncData.created > 0) {
              toast.success(`Synced ${syncData.missingEmployees} new employee(s) — ${syncData.created} records added`);
              fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}`)
                .then(r => r.json())
                .then(refetchData => {
                  if (cancelled) return;
                  setWeekData(refetchData);
                  if (refetchData.auditCounts) {
                    setAuditCounts(refetchData.auditCounts);
                  }
                });
            }
          })
          .catch(() => { });
      }
      return () => { cancelled = true; };
    }

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const res = await fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}`);
        const data = await res.json();
        if (cancelled) return;
        setWeekData(data);
        // Use audit counts from the bundled response
        if (data.auditCounts) {
          setAuditCounts(data.auditCounts);
        }

        // Auto-sync only once per week per session
        if (!syncedWeeksRef.current.has(selectedWeek)) {
          syncedWeeksRef.current.add(selectedWeek);
          // Run sync in background — don't block the UI
          fetch("/api/schedules/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ yearWeek: selectedWeek }),
          })
            .then(r => r.json())
            .then(syncData => {
              if (cancelled) return;
              if (syncData.created > 0) {
                toast.success(`Synced ${syncData.missingEmployees} new employee(s) — ${syncData.created} records added`);
                // Refetch to show the new records
                fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}`)
                  .then(r => r.json())
                  .then(refetchData => {
                    if (cancelled) return;
                    setWeekData(refetchData);
                    if (refetchData.auditCounts) {
                      setAuditCounts(refetchData.auditCounts);
                    }
                  });
              }
            })
            .catch(() => { });
        }
      } catch (err) {
        if (!cancelled) toast.error("Failed to load schedule data");
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    fetchData();

    return () => { cancelled = true; };
  }, [selectedWeek]);

  const navigateWeek = useCallback((direction: number) => {
    const idx = weeks.indexOf(selectedWeek);
    const newIdx = idx - direction; // weeks are sorted descending
    if (newIdx >= 0 && newIdx < weeks.length) {
      setSelectedWeek(weeks[newIdx]);
    }
  }, [weeks, selectedWeek]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Compute warning counts for KPI card
  const warningCounts = useMemo(() => {
    if (!weekData?.employees) return { caution: 0, danger: 0, cautionNames: [] as string[], dangerNames: [] as string[] };
    let caution = 0;
    let danger = 0;
    const cautionNames: string[] = [];
    const dangerNames: string[] = [];
    weekData.employees.forEach(emp => {
      const warnings = getConsecutiveWarnings(emp, weekData.prevWeekTrailing?.[emp.transporterId] || 0);
      let hasCaution = false;
      let hasDanger = false;
      warnings.forEach(w => {
        if (w.type === 'danger') hasDanger = true;
        else if (w.type === 'caution') hasCaution = true;
      });
      const name = emp.employee?.name || emp.transporterId;
      if (hasDanger) { danger++; dangerNames.push(name); }
      else if (hasCaution) { caution++; cautionNames.push(name); }
    });
    return { caution, danger, cautionNames, dangerNames };
  }, [weekData]);

  // Push title into left, all actions into right
  useEffect(() => {
    setLeftContent(
      <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        {activeMainTab === "messaging"
          ? (SUB_TABS.find((t) => t.id === activeSubTab)?.label ?? "Messaging")
          : "Scheduling"}
      </h1>
    );
    return () => setLeftContent(null);
  }, [setLeftContent, activeMainTab, activeSubTab]);

  // Right content: search + messaging actions + week selector
  useEffect(() => {
    const idx = weeks.indexOf(selectedWeek);
    setRightContent(
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 w-[120px] sm:w-[200px] text-sm"
          />
        </div>
        {/* Messaging-only: eligible count + refresh */}
        {activeMainTab === "messaging" && activeTabInfo && (
          <>
            <Badge variant="secondary" className="text-[11px] h-6 px-2 gap-1.5 hidden sm:inline-flex">
              <Users className="h-3.5 w-3.5" />
              {activeTabInfo.loading ? "..." : activeTabInfo.eligibleCount} eligible
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={activeTabInfo.refresh}
              disabled={activeTabInfo.loading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", activeTabInfo.loading && "animate-spin")} />
            </Button>
          </>
        )}
        {/* Week selector — shown on both scheduling and messaging */}
        {weeks.length > 0 && (
          <>
            <div className="w-px h-5 bg-border/60 hidden sm:block" />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (idx >= weeks.length - 1) {
                  const prevWeek = getPrevYearWeek(weeks[weeks.length - 1]);
                  generateWeek(prevWeek, 'prev');
                } else {
                  setSelectedWeek(weeks[idx + 1]);
                }
              }}
              disabled={generatingWeek}
            >
              {generatingWeek ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : idx >= weeks.length - 1 ? (
                <Plus className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[110px] sm:w-[170px] h-8 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeks.map(w => (
                  <SelectItem key={w} value={w}>
                    {formatWeekLabel(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (idx <= 0) {
                  const nextWeek = getNextYearWeek(weeks[0]);
                  generateWeek(nextWeek, 'next');
                } else {
                  setSelectedWeek(weeks[idx - 1]);
                }
              }}
              disabled={generatingWeek}
            >
              {generatingWeek ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : idx <= 0 ? (
                <Plus className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>
    );
    return () => setRightContent(null);
  }, [setRightContent, searchQuery, activeMainTab, activeTabInfo, weeks, selectedWeek, generatingWeek, generateWeek]);

  // Handle type change via dropdown
  const handleTypeChange = useCallback(async (
    scheduleId: string | undefined,
    newType: string,
    transporterId: string,
    dayIdx: number,
    employeeName?: string
  ) => {
    // Optimistic update
    const isWorking = !NON_WORKING_TYPES.has(newType.trim().toLowerCase());
    const routeConfig = routeTypeConfigs[newType.trim().toLowerCase()];
    const defaultStartTime = routeConfig?.startTime || "";
    setWeekData(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.employees = updated.employees.map(emp => {
        if (emp.transporterId !== transporterId) return emp;
        return {
          ...emp,
          days: {
            ...emp.days,
            [dayIdx]: {
              ...(emp.days[dayIdx] || {}),
              type: newType,
              status: isWorking ? "Scheduled" : "Off",
              startTime: defaultStartTime,
            } as DayData,
          },
        };
      });
      return updated;
    });

    try {
      // Build payload — include creation fields when no scheduleId
      const payload: Record<string, string> = { type: newType, startTime: defaultStartTime };
      if (employeeName) payload.employeeName = employeeName;
      if (scheduleId) {
        payload.scheduleId = scheduleId;
      } else {
        // Need to create a new entry — compute the date from weekData.dates
        const dateStr = weekData?.dates?.[dayIdx];
        if (!dateStr || !selectedWeek) {
          toast.error("Cannot determine date for this day");
          return;
        }
        payload.transporterId = transporterId;
        payload.date = dateStr;
        payload.yearWeek = selectedWeek;
        payload.weekDay = FULL_DAY_NAMES[dayIdx];
      }

      const res = await fetch("/api/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update");
      }
      toast.success(`Type updated to ${newType}`);

      // Update audit count for this employee
      setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));

      // Refetch to get the new _id if we created a new entry
      if (!scheduleId) {
        const refetchRes = await fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}`);
        const refetchData = await refetchRes.json();
        setWeekData(refetchData);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update type");
      // Revert on error — refetch
      if (selectedWeek) {
        const res = await fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}`);
        const data = await res.json();
        setWeekData(data);
      }
    }
  }, [selectedWeek, weekData]);

  // Handle note save — optimistic update
  const handleNoteSaved = useCallback((transporterId: string, newNote: string, employeeName?: string, oldNote?: string) => {
    setWeekData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map(emp => {
          if (emp.transporterId !== transporterId) return emp;
          return {
            ...emp,
            weekNote: newNote,
          };
        }),
      };
    });
    // Update audit count optimistically
    setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
  }, []);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (!weekData?.employees) return [];
    return weekData.employees.filter(emp => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = emp.employee?.name || "";
        const tid = emp.transporterId || "";
        if (!name.toLowerCase().includes(q) && !tid.toLowerCase().includes(q)) return false;
      }
      // Type filter
      if (typeFilter !== "all") {
        const type = emp.employee?.type || "Unassigned";
        if (type !== typeFilter) return false;
      }
      // Status filter (at least one day with this status)
      if (statusFilter !== "all") {
        const hasStatus = Object.values(emp.days).some(
          (d: DayData) => d.status === statusFilter
        );
        if (!hasStatus) return false;
      }
      return true;
    });
  }, [weekData, searchQuery, typeFilter, statusFilter]);

  const isFiltered = searchQuery || typeFilter !== "all" || statusFilter !== "all";

  // Group data
  const grouped = useMemo(() => groupByType(filteredEmployees), [filteredEmployees]);

  // Planning data now uses filtered employees when any filter is active
  const planningData = useMemo(
    () => computePlanningData(isFiltered ? filteredEmployees : (weekData?.employees || [])),
    [weekData, filteredEmployees, isFiltered]
  );

  // Get unique types and statuses for filters
  const employeeTypes = useMemo(() => {
    if (!weekData?.employees) return [];
    const types = new Set(weekData.employees.map(e => e.employee?.type || "Unassigned"));
    return Array.from(types).sort();
  }, [weekData]);

  const allStatuses = useMemo(() => {
    if (!weekData?.employees) return [];
    const statuses = new Set<string>();
    weekData.employees.forEach(emp => {
      Object.values(emp.days).forEach((d: DayData) => {
        if (d.status) statuses.add(d.status);
      });
    });
    return Array.from(statuses).sort();
  }, [weekData]);

  // Date format helpers
  const formatDate = (dateStr: string) => {
    const cleaned = dateStr.split("T")[0]; // strip time if present
    const d = new Date(cleaned + "T00:00:00Z");
    if (isNaN(d.getTime())) return "";
    return `${(d.getUTCMonth() + 1).toString().padStart(2, "0")}/${d.getUTCDate().toString().padStart(2, "0")}`;
  };

  const formatWeekLabel = (week: string) => {
    const match = week.match(/(\d{4})-W(\d{2})/);
    if (!match) return week;
    return `${match[1]} – Week ${parseInt(match[2])}`;
  };

  // ── KPI Stats ──
  const totalEmployees = weekData?.totalEmployees || 0;
  const totalScheduleEntries = weekData?.employees?.reduce(
    (sum, emp) => sum + Object.keys(emp.days).length, 0
  ) || 0;
  const totalRoutes = weekData?.employees?.reduce((sum, emp) => {
    return sum + Object.values(emp.days).filter((d: DayData) => (d.type || "").trim().toLowerCase() === "route").length;
  }, 0) || 0;
  const totalOff = weekData?.employees?.reduce((sum, emp) => {
    return sum + Object.values(emp.days).filter((d: DayData) => {
      const t = (d.type || "").trim().toLowerCase();
      return t === "off" || t === "";
    }).length;
  }, 0) || 0;

  // ── Derived KPIs ──
  const totalCallOuts = useMemo(() => {
    if (!weekData?.employees) return 0;
    return weekData.employees.reduce((sum, emp) => {
      return sum + Object.values(emp.days).filter((d: DayData) =>
        (d.type || "").trim().toLowerCase() === "call out"
      ).length;
    }, 0);
  }, [weekData]);

  const totalStandBy = useMemo(() => {
    if (!weekData?.employees) return 0;
    return weekData.employees.reduce((sum, emp) => {
      return sum + Object.values(emp.days).filter((d: DayData) =>
        (d.type || "").trim().toLowerCase() === "stand by"
      ).length;
    }, 0);
  }, [weekData]);

  // Percentage of scheduled slots that are "working" (not off)
  const activityRate = useMemo(() => {
    if (!totalScheduleEntries || totalScheduleEntries === 0) return 0;
    const working = totalScheduleEntries - totalOff;
    return Math.round((working / totalScheduleEntries) * 100);
  }, [totalScheduleEntries, totalOff]);

  // How many unique employees have at least one Route day this week
  const activeRouteEmployees = useMemo(() => {
    if (!weekData?.employees) return 0;
    return weekData.employees.filter(emp =>
      Object.values(emp.days).some((d: DayData) => (d.type || "").trim().toLowerCase() === "route")
    ).length;
  }, [weekData]);

  if (!mounted) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden gap-2 sm:gap-4">

        {/* ── Main Tabs: Scheduling | Messaging ── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border shrink-0">
          <button
            onClick={() => setActiveMainTab("scheduling")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
              activeMainTab === "scheduling"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Scheduling
          </button>
          <button
            onClick={() => setActiveMainTab("messaging")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
              activeMainTab === "messaging"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Messaging
          </button>
        </div>

        {/* ── Messaging Tab Content — always mounted, hidden when inactive ── */}
        <div className={cn("flex-1 min-h-0 overflow-auto", activeMainTab !== "messaging" && "hidden")}>
          <MessagingPanel
            weeks={weeks}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            searchQuery={searchQuery}
            selectAllTrigger={selectAllTrigger}
            activeSubTab={activeSubTab}
            onSubTabChange={setActiveSubTab}
            onActiveTabInfo={setActiveTabInfo}
          />
        </div>

        {/* ── Scheduling Tab Content — always mounted, hidden when inactive ── */}
        <div className={cn("flex-1 min-h-0 flex flex-col gap-4 overflow-auto", activeMainTab !== "scheduling" && "hidden")}>

          {loading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <CalendarDays className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">Loading schedule data...</p>
              </div>
            </div>
          ) : weeks.length === 0 ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">No Schedule Data</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Import employee schedules via{" "}
                    <span className="text-primary font-medium">Admin → Settings → Imports</span>{" "}
                    to see the weekly schedule dashboard.
                  </p>
                </div>
              </div>
            </div>
          ) : (<>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">

              {/* Employees */}
              <div className="relative overflow-hidden rounded-xl border border-blue-500/20 p-3 sm:p-4 bg-gradient-to-br from-blue-500/15 to-cyan-500/15">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-blue-400/80 font-semibold">Employees</p>
                    <p className="text-2xl sm:text-3xl font-black mt-0.5 tabular-nums tracking-tight">
                      {loadingData ? <span className="text-muted-foreground/40">—</span> : totalEmployees}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {loadingData ? "—" : activeRouteEmployees} on routes
                      </span>
                      <span className="text-muted-foreground/30 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                        {loadingData ? "—" : totalStandBy} stand-by
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/15 flex-shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                  </div>
                </div>
              </div>

              {/* Routes */}
              <div className="relative overflow-hidden rounded-xl border border-violet-500/20 p-3 sm:p-4 bg-gradient-to-br from-violet-500/15 to-purple-500/15">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-violet-400/80 font-semibold">Routes</p>
                    <p className="text-2xl sm:text-3xl font-black mt-0.5 tabular-nums tracking-tight">
                      {loadingData ? <span className="text-muted-foreground/40">—</span> : totalRoutes}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground/60 font-medium">
                        <span className="text-violet-400">{loadingData ? "—" : (totalEmployees > 0 ? Math.round((activeRouteEmployees / totalEmployees) * 100) : 0)}%</span> of team on route
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-violet-500/15 flex-shrink-0">
                    <TruckIcon className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />
                  </div>
                </div>
              </div>

              {/* Activity Rate — replaces Days Off */}
              <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 p-3 sm:p-4 bg-gradient-to-br from-emerald-500/15 to-teal-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">Activity Rate</p>
                    <p className="text-2xl sm:text-3xl font-black mt-0.5 tabular-nums tracking-tight">
                      {loadingData ? <span className="text-muted-foreground/40">—</span> : <>{activityRate}<span className="text-base font-medium text-muted-foreground">%</span></>}
                    </p>
                    {/* Gradient progress bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                        style={{ width: loadingData ? "0%" : `${activityRate}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      <span className="text-yellow-400 font-medium">{loadingData ? "—" : totalCallOuts}</span> call-out{totalCallOuts !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/15 flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Warnings */}
              <div className="relative overflow-hidden rounded-xl border border-amber-500/25 p-3 sm:p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-semibold">Streak Alerts</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-start cursor-default group/tip">
                            <span className="text-2xl sm:text-3xl font-black tabular-nums text-orange-400 group-hover/tip:text-orange-300 transition-colors">
                              {loadingData ? "—" : warningCounts.caution}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-orange-400/70 font-medium -mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                              6-day streak
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px] bg-popover text-popover-foreground border shadow-lg">
                          <p className="font-semibold text-amber-500 mb-1">6 Consecutive Days</p>
                          {warningCounts.cautionNames.length > 0
                            ? warningCounts.cautionNames.map(n => <p key={n} className="text-xs">{n}</p>)
                            : <p className="text-xs text-muted-foreground">None</p>
                          }
                        </TooltipContent>
                      </Tooltip>
                      <div className="w-px h-8 bg-border/40" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-start cursor-default group/tip">
                            <span className="text-2xl sm:text-3xl font-black tabular-nums text-red-500 group-hover/tip:text-red-400 transition-colors">
                              {loadingData ? "—" : warningCounts.danger}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-red-500/70 font-medium -mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              7+ days
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px] bg-popover text-popover-foreground border shadow-lg">
                          <p className="font-semibold text-red-500 mb-1">7+ Consecutive Days</p>
                          {warningCounts.dangerNames.length > 0
                            ? warningCounts.dangerNames.map(n => <p key={n} className="text-xs">{n}</p>)
                            : <p className="text-xs text-muted-foreground">None</p>
                          }
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/15 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
                  </div>
                </div>
              </div>

            </div>



            {/* ── Main Schedule Table ── */}
            {loadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden bg-card flex-1 min-h-0 flex flex-col">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-xs sm:text-sm">
                    {/* Table Header with Dates */}
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-muted border-b border-border/50">
                        <th className="text-left font-semibold px-2 sm:px-3 py-2 sm:py-2.5 min-w-[100px] sm:min-w-[180px] sticky left-0 bg-muted z-30 backdrop-blur-sm">
                          Employee Name
                        </th>
                        {weekData?.dates?.map((date, i) => (
                          <th key={date} className="text-center font-medium px-1 sm:px-2 py-2 sm:py-2.5 min-w-[70px] sm:min-w-[110px]">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {DAY_NAMES[i]}
                              </span>
                              <span className="text-xs font-semibold">{formatDate(date)}</span>
                            </div>
                          </th>
                        ))}
                        <th className="text-center font-semibold px-1 sm:px-2 py-2 sm:py-2.5 min-w-[36px] sm:min-w-[50px]">Days</th>
                        <th className="text-left font-semibold px-2 sm:px-3 py-2 sm:py-2.5 min-w-[100px] sm:min-w-[180px] hidden md:table-cell">Note</th>
                        <th className="text-center font-semibold px-1 sm:px-2 py-2 sm:py-2.5 min-w-[40px] sm:min-w-[60px]">
                          <div className="inline-flex items-center gap-1 text-violet-400">
                            <History className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">Audit</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ── Planning Section ── */}
                      <tr
                        className="border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setPlanningCollapsed(!planningCollapsed)}
                      >
                        <td className="px-2 sm:px-3 py-1.5 sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                planningCollapsed && "-rotate-90"
                              )}
                            />
                            <span className="font-bold text-xs uppercase tracking-wider text-primary">Planning</span>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary">
                              {planningData.length}
                            </Badge>
                            {isFiltered && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/40 text-amber-500">
                                Filtered
                              </Badge>
                            )}
                          </div>
                        </td>
                        {weekData?.dates?.map((_, i) => (
                          <td key={`planning-header-${i}`} className="px-2 py-1.5" />
                        ))}
                        <td className="px-2 py-1.5" />
                        <td className="px-2 sm:px-3 py-1.5 hidden md:table-cell" />
                        <td className="px-1 sm:px-2 py-1.5" />
                      </tr>
                      {!planningCollapsed && planningData.map((row) => (
                        <tr key={row.label} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5 sticky left-0 bg-card z-10">
                            <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                          </td>
                          {row.values.map((val, i) => (
                            <td key={`${row.label}-${i}`} className="text-center px-2 py-1.5">
                              <span className={cn(
                                "inline-flex items-center justify-center h-7 min-w-[36px] rounded-md text-xs font-bold transition-all",
                                val > 0
                                  ? `${row.color} bg-current/10 border border-current/20`
                                  : "text-zinc-500"
                              )}
                                style={val > 0 ? { backgroundColor: "rgba(255,255,255,0.05)" } : {}}
                              >
                                {val}
                              </span>
                            </td>
                          ))}
                          <td className="text-center px-2 py-1.5">
                            <span className={cn("text-xs font-bold", row.color)}>{row.total}</span>
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 hidden md:table-cell" />
                          <td className="px-1 sm:px-2 py-1.5" />
                        </tr>
                      ))}

                      {/* ── Employee Groups ── */}
                      {Object.entries(grouped)
                        .sort(([a], [b]) => {
                          if (a === "Operations") return -1;
                          if (b === "Operations") return 1;
                          return a.localeCompare(b);
                        })
                        .map(([groupName, emps]) => (
                          <Fragment key={`group-${groupName}`}>
                            {/* Group Header */}
                            <tr
                              className="border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => toggleGroup(groupName)}
                            >
                              <td
                                colSpan={(weekData?.dates?.length || 7) + 4}
                                className="px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                      collapsedGroups[groupName] && "-rotate-90"
                                    )}
                                  />
                                  <span className="font-bold text-xs uppercase tracking-wider text-amber-500">
                                    {groupName}
                                  </span>
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-500">
                                    {emps.length}
                                  </Badge>
                                </div>
                              </td>
                            </tr>

                            {/* Employee Rows */}
                            {!collapsedGroups[groupName] &&
                              emps
                                .sort((a, b) => {
                                  const nameA = a.employee?.name || "";
                                  const nameB = b.employee?.name || "";
                                  return nameA.localeCompare(nameB);
                                })
                                .map((emp) => {
                                  const workDays = countWorkingDays(emp);
                                  const notes = emp.weekNote || "";
                                  const consecutiveWarnings = getConsecutiveWarnings(emp, weekData?.prevWeekTrailing?.[emp.transporterId] || 0);

                                  return (
                                    <tr
                                      key={`${groupName}-${emp.transporterId}`}
                                      className="border-b border-border/10 hover:bg-muted/20 transition-colors group"
                                    >
                                      <td className="px-2 sm:px-3 py-1 sm:py-1.5 sticky left-0 bg-card z-10 group-hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-1 sm:gap-2">
                                          <span className="text-[10px] sm:text-xs font-semibold truncate max-w-[80px] sm:max-w-[160px]">
                                            {emp.employee?.name || emp.transporterId}
                                          </span>
                                        </div>
                                      </td>
                                      {Array.from({ length: 7 }, (_, dayIdx) => {
                                        const day = emp.days[dayIdx];
                                        const status = day?.status || "";
                                        const van = day?.van || "";
                                        const startTime = day?.startTime || "";
                                        const type = day?.type || "";
                                        const displayValue = type || status || "";
                                        const style = getTypeStyle(displayValue);
                                        const matchedOpt = TYPE_MAP.get(displayValue.toLowerCase());
                                        const CellIcon = matchedOpt?.icon;
                                        const warning = consecutiveWarnings.get(dayIdx);

                                        return (
                                          <td key={dayIdx} className="text-center px-0.5 sm:px-1 py-0.5 sm:py-1">
                                            <DropdownMenu>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <DropdownMenuTrigger asChild>
                                                    <div
                                                      className={cn(
                                                        "relative flex items-center justify-center gap-0.5 sm:gap-1 h-6 sm:h-7 rounded-md text-[9px] sm:text-[11px] font-semibold transition-all border cursor-pointer select-none px-1 sm:px-1.5",
                                                        style.bg,
                                                        style.text,
                                                        style.border,
                                                        "hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                                      )}
                                                    >
                                                      {CellIcon && <CellIcon className="h-3 w-3 shrink-0" />}
                                                      <span className="truncate">{displayValue || <Minus className="h-3 w-3 opacity-40" />}</span>
                                                      {warning && (
                                                        <span className={cn(
                                                          "flex items-center justify-center h-4 min-w-[16px] rounded-full text-[9px] font-bold text-white leading-none px-1 ml-0.5 shrink-0",
                                                          warning.type === 'danger'
                                                            ? "bg-red-500 animate-pulse"
                                                            : "bg-orange-400"
                                                        )}>
                                                          {warning.consecutive}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </DropdownMenuTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                  side="top"
                                                  className="max-w-[300px] text-xs space-y-1 bg-popover text-popover-foreground border shadow-xl"
                                                >
                                                  <p className="font-semibold">{emp.employee?.name || emp.transporterId}</p>
                                                  <p className="text-muted-foreground">
                                                    {day?.weekDay || FULL_DAY_NAMES[dayIdx]} — {day?.date ? formatDate(day.date) : ""}
                                                  </p>
                                                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t border-border/50">
                                                    <span className="text-muted-foreground">Status:</span>
                                                    <span className="font-medium">{status}</span>
                                                    {type && (
                                                      <>
                                                        <span className="text-muted-foreground">Type:</span>
                                                        <span>{type}</span>
                                                      </>
                                                    )}
                                                    {day?.subType && (
                                                      <>
                                                        <span className="text-muted-foreground">Sub Type:</span>
                                                        <span>{day.subType}</span>
                                                      </>
                                                    )}
                                                    {startTime && (
                                                      <>
                                                        <span className="text-muted-foreground">Start:</span>
                                                        <span>{startTime}</span>
                                                      </>
                                                    )}
                                                    {van && (
                                                      <>
                                                        <span className="text-muted-foreground">Van:</span>
                                                        <span>{van}</span>
                                                      </>
                                                    )}
                                                    {day?.note && (
                                                      <>
                                                        <span className="text-muted-foreground">Note:</span>
                                                        <span>{day.note}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                  {warning && (
                                                    <div className={cn(
                                                      "mt-1 pt-1 border-t flex items-center gap-1.5 font-semibold text-[11px]",
                                                      warning.type === 'danger' ? "text-red-400 border-red-500/30" : "text-amber-400 border-amber-500/30"
                                                    )}>
                                                      <AlertTriangle className="h-3.5 w-3.5" />
                                                      {warning.type === 'danger'
                                                        ? `${warning.consecutive} consecutive work days!`
                                                        : `${warning.consecutive} consecutive work days`
                                                      }
                                                    </div>
                                                  )}
                                                </TooltipContent>
                                              </Tooltip>
                                              <DropdownMenuContent
                                                align="start"
                                                side="bottom"
                                                className="w-48 max-h-[320px] overflow-y-auto"
                                              >
                                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                  Change Type
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {TYPE_OPTIONS.map(opt => {
                                                  const Icon = opt.icon;
                                                  const isActive = displayValue.toLowerCase() === opt.label.toLowerCase();
                                                  return (
                                                    <DropdownMenuItem
                                                      key={opt.label}
                                                      className={cn(
                                                        "flex items-center gap-2 cursor-pointer text-xs",
                                                        isActive && "bg-accent"
                                                      )}
                                                      onClick={() => handleTypeChange(day?._id, opt.label, emp.transporterId, dayIdx, emp.employee?.name)}
                                                    >
                                                      <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", opt.bg)}>
                                                        <Icon className={cn("h-3 w-3", opt.text)} />
                                                      </div>
                                                      <span className="font-medium">{opt.label}</span>
                                                      {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                                                    </DropdownMenuItem>
                                                  );
                                                })}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </td>
                                        );
                                      })}
                                      <td className="text-center px-2 py-1.5">
                                        <span className={cn(
                                          "text-xs font-bold",
                                          workDays >= 6
                                            ? "text-red-400"
                                            : workDays >= 5
                                              ? "text-amber-400"
                                              : workDays >= 3
                                                ? "text-emerald-400"
                                                : "text-muted-foreground"
                                        )}>
                                          {workDays}
                                        </span>
                                      </td>
                                      <td className="px-2 sm:px-3 py-1.5 hidden md:table-cell">
                                        <EditableNote
                                          value={notes}
                                          employeeId={emp.employee?._id}
                                          transporterId={emp.transporterId}
                                          yearWeek={selectedWeek}
                                          employeeName={emp.employee?.name}
                                          onSaved={(newNote, eName, oldNote) => handleNoteSaved(emp.transporterId, newNote, eName, oldNote)}
                                        />
                                      </td>
                                      <td className="text-center px-0.5 sm:px-1 py-1 sm:py-1.5">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={async () => {
                                                setAuditEmployee({ transporterId: emp.transporterId, name: emp.employee?.name || emp.transporterId });
                                                setShowAuditPanel(true);
                                                setAuditLoading(true);
                                                try {
                                                  const res = await fetch(`/api/schedules/audit?yearWeek=${encodeURIComponent(selectedWeek)}&transporterId=${encodeURIComponent(emp.transporterId)}&limit=50`);
                                                  const data = await res.json();
                                                  setAuditLogs(data.logs || []);
                                                } catch { }
                                                setAuditLoading(false);
                                              }}
                                              className={cn(
                                                "inline-flex items-center justify-center h-6 min-w-[24px] rounded-md transition-all",
                                                (auditCounts[emp.transporterId] || 0) > 0
                                                  ? "bg-violet-500/15 hover:bg-violet-500/25 ring-1 ring-violet-500/30 text-violet-400 hover:text-violet-300"
                                                  : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/30"
                                              )}
                                            >
                                              {(auditCounts[emp.transporterId] || 0) > 0 ? (
                                                <span className="text-[10px] font-bold">{auditCounts[emp.transporterId]}</span>
                                              ) : (
                                                <History className="h-3 w-3" />
                                              )}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="left" className="text-xs">
                                            {(auditCounts[emp.transporterId] || 0) > 0
                                              ? `${auditCounts[emp.transporterId]} change${auditCounts[emp.transporterId] !== 1 ? "s" : ""} this week`
                                              : "No changes recorded"}
                                          </TooltipContent>
                                        </Tooltip>
                                      </td>
                                    </tr>
                                  );
                                })}
                          </Fragment>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Type Legend ── */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-2">Legend:</span>
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <div key={opt.label} className="flex items-center gap-1.5">
                    <div className={cn("h-4 w-4 rounded-sm flex items-center justify-center", opt.bg)}>
                      <Icon className={cn("h-2.5 w-2.5", opt.text)} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                  </div>
                );
              })}
            </div>
          </>)}
        </div>
      </div>

      {/* ── Audit Log Slide-out Panel ── */}
      {showAuditPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowAuditPanel(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-[100vw] sm:max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            {/* Panel Header */}
            <div className="shrink-0 px-5 py-4 border-b border-border bg-gradient-to-r from-violet-500/10 to-purple-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center ring-1 ring-violet-500/30">
                    <History className="h-4.5 w-4.5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">Audit Log</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {auditEmployee?.name || ""} · {selectedWeek} · {auditLogs.length} change{auditLogs.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAuditPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {auditLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <FileText className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No changes recorded</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Changes will appear here when schedule modifications are made.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-1">
                    {auditLogs.map((log, i) => {
                      const actionConfig: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
                        type_changed: { icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/15 ring-blue-500/30", label: "Type Changed" },
                        note_updated: { icon: Pencil, color: "text-amber-400", bg: "bg-amber-500/15 ring-amber-500/30", label: "Note Updated" },
                        start_time_changed: { icon: Clock, color: "text-emerald-400", bg: "bg-emerald-500/15 ring-emerald-500/30", label: "Start Time Changed" },
                        schedule_created: { icon: Plus, color: "text-violet-400", bg: "bg-violet-500/15 ring-violet-500/30", label: "Schedule Created" },
                      };
                      const config = actionConfig[log.action] || actionConfig.type_changed;
                      const ActionIcon = config.icon;
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(log.createdAt).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return "just now";
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        const days = Math.floor(hrs / 24);
                        return `${days}d ago`;
                      })();

                      return (
                        <div key={log._id || i} className="relative pl-10 py-2 group">
                          {/* Timeline dot */}
                          <div className={`absolute left-1.5 top-3.5 w-5 h-5 rounded-full ring-1 flex items-center justify-center ${config.bg}`}>
                            <ActionIcon className={`h-2.5 w-2.5 ${config.color}`} />
                          </div>

                          {/* Content */}
                          <div className="bg-muted/30 hover:bg-muted/50 rounded-xl px-3.5 py-2.5 transition-all border border-transparent hover:border-border/50">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                                {config.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                            </div>

                            <p className="text-xs font-semibold mt-1">
                              {log.employeeName || log.transporterId}
                            </p>

                            {log.dayOfWeek && (
                              <p className="text-[11px] text-muted-foreground">
                                {log.dayOfWeek}
                                {log.date && ` · ${new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`}
                              </p>
                            )}

                            {/* Value change */}
                            {(log.oldValue || log.newValue) && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {log.oldValue && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/20 line-through">
                                    {log.oldValue || "(empty)"}
                                  </span>
                                )}
                                {log.oldValue && log.newValue && (
                                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                )}
                                {log.newValue && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                                    {log.newValue || "(empty)"}
                                  </span>
                                )}
                              </div>
                            )}

                            <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                              by {log.performedByName || log.performedBy}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
