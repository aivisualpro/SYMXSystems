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
  UserPlus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmployeeNotesPanel } from "@/components/scheduling/employee-notes-panel";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  colorHex?: string;
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
const NON_WORKING_TYPES = new Set(["off", "", "call out", "request off", "suspension", "stand by"]);

function isWorkingDay(day: DayData | undefined | null): boolean {
  if (!day) return false;
  if (day.status) return day.status !== "Off";
  return !NON_WORKING_TYPES.has((day.type || "").trim().toLowerCase());
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
    ScheduleNotes?: string;
    hiredDate?: string | Date;
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

function computePlanningData(employees: EmployeeSchedule[], everydayRecords: Record<string, any> = {}, dates: string[] = []): PlanningRow[] {
  const daStats = Array(7).fill(0);
  const standBy = Array(7).fill(0);
  const routesAssigned = Array(7).fill(0);
  const ops = Array(7).fill(0);
  const extraDAs = Array(7).fill(0);

  // Initialize Routes Assigned from manual entries only
  for (let d = 0; d < 7; d++) {
    const date = dates[d];
    if (date && everydayRecords[date]?.routesAssigned !== undefined) {
      routesAssigned[d] = everydayRecords[date].routesAssigned;
    }
  }

  employees.forEach(emp => {
    for (let d = 0; d < 7; d++) {
      const day = emp.days[d];
      if (!day) continue;
      const typeVal = (day.type || "").trim().toLowerCase();

      if (typeVal === "route") {
        daStats[d]++;
      }
      if (typeVal === "stand by") {
        standBy[d]++;
      }
      if (["open", "close", "fleet"].includes(typeVal)) {
        ops[d]++;
      }
    }
  });

  // Extra DA's = DA's - Routes Assigned
  for (let d = 0; d < 7; d++) {
    extraDAs[d] = daStats[d] - routesAssigned[d];
  }

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
    if (isWorkingDay(day)) {
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

function RouteAssignedPopover({ date, value, onSave }: { date: string, value: number, onSave: (d: string, v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value.toString());

  useEffect(() => {
    if (open) setVal(value.toString());
  }, [open, value]);

  const handleSave = () => {
    onSave(date, parseInt(val) || 0);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-0.5 cursor-pointer hover:bg-white/20 px-0.5 py-0.5 rounded transition-colors group" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <TruckIcon className="h-2.5 w-2.5 text-white" />
          <span className="text-[11px] font-bold text-white leading-none whitespace-nowrap">{value}</span>
          <Pencil className="h-1.5 w-1.5 text-white/50 group-hover:text-white transition-colors" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" side="bottom">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-primary">
          <TruckIcon className="h-4 w-4" /> Routes Assigned
        </h4>
        <div className="flex gap-2">
          <Input 
            type="number" 
            value={val}
            onChange={e => setVal(e.target.value)}
            className="h-8 flex-1" 
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <Button size="sm" onClick={handleSave} className="h-8 px-3">
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
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
    return match?.[1] || "shift";
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

  const [selectAllTrigger, setSelectAllTrigger] = useState(0);
  const [activeTabInfo, setActiveTabInfo] = useState<ActiveTabInfo | null>(null);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [deletingWeek, setDeletingWeek] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then(res => res.json())
      .then(data => {
        if (data && data.email) setCurrentUserEmail(data.email.toLowerCase());
      })
      .catch(() => {});
  }, []);

  const handleDeleteWeek = async () => {
    if (!selectedWeek) return;
    if (!confirm(`Are you sure you want to delete ALL data (Schedules, Routes, Info, Audits) for ${selectedWeek}? This cannot be undone.`)) return;
    
    setDeletingWeek(true);
    try {
      const res = await fetch(`/api/schedules/reset-week?yearWeek=${encodeURIComponent(selectedWeek)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete schedule data");
      
      toast.success(`Schedule deleted successfully. Removed ${data.deleted?.schedules || 0} schedules.`);
      
      // Update UI state
      setWeeks(prev => prev.filter(w => w !== selectedWeek));
      
      // Refresh current week data since it is now empty
      const idx = weeks.indexOf(selectedWeek);
      if (weeks.length > 1) {
        setSelectedWeek(weeks[idx > 0 ? idx - 1 : 1]);
      } else {
        setWeekData(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete week");
    } finally {
      setDeletingWeek(false);
    }
  };
  const [routeTypeConfigs, setRouteTypeConfigs] = useState<Record<string, { color: string; startTime: string; routeStatus: string }>>({});
  const [routeTypesList, setRouteTypesList] = useState<any[]>([]);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditEmployee, setAuditEmployee] = useState<{ transporterId: string; name: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Notes state
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [notesEmployee, setNotesEmployee] = useState<{ employeeId: string; transporterId: string; name: string } | null>(null);

  // Routes Assigned Everyday state
  const [everydayRecords, setEverydayRecords] = useState<Record<string, any>>({});

  // The everyday records are now fetched alongside weekData to prevent UI bouncing.

  const handleRoutesAssignedUpdate = async (date: string, value: number) => {
    try {
      const res = await fetch("/api/everyday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, routesAssigned: value })
      });
      if (res.ok) {
        setEverydayRecords(prev => ({
          ...prev,
          [date]: { ...(prev[date] || {}), routesAssigned: value }
        }));
        toast.success("Routes Assigned updated");
      } else {
        toast.error("Failed to update");
      }
    } catch (err) {
      toast.error("Failed to update");
    }
  };

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
      setRouteTypesList(store.admin.routeTypesList || []);
    } else {
      // Fallback: Fetch route type configs for auto-filling startTime
      fetch("/api/admin/settings/route-types")
        .then(res => res.json())
        .then((types: any[]) => {
          const map: Record<string, { color: string; startTime: string; routeStatus: string }> = {};
          types.forEach((t: any) => { map[t.name.toLowerCase()] = { color: t.color, startTime: t.startTime || "", routeStatus: t.routeStatus || "Scheduled" }; });
          setRouteTypeConfigs(map);
          setRouteTypesList(types);
        })
        .catch(() => { });
    }

    // Fetch initial notes counts globally for all employees
    fetch("/api/schedules/notes?getCounts=true")
      .then(res => res.json())
      .then(data => {
        if (data.counts) {
          setNoteCounts(data.counts);
        }
      })
      .catch(() => {});
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

  const dynamicTypeOptions = useMemo(() => {
    if (!routeTypesList || routeTypesList.length === 0) return TYPE_OPTIONS;
    return routeTypesList
      .filter((rt: any) => rt.isActive !== false) // Only show active types in dropdowns
      .map((rt: any) => {
      const fallback = TYPE_MAP.get(rt.name.toLowerCase()) || {
        label: rt.name,
        icon: Navigation,
        bg: "bg-emerald-600",
        text: "text-white",
        border: "border-emerald-700",
        dotColor: "bg-emerald-500"
      };
      const DBIcon = rt.icon ? (LucideIcons as any)[rt.icon] : null;

      return {
        ...fallback,
        label: rt.name, // Ensure exact casing from DB used for dropdown label
        colorHex: rt.color,
        icon: DBIcon || fallback.icon,
      };
    });
  }, [routeTypesList]);

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
        // Use audit counts and everyday records from the bundled response
        if (data.auditCounts) {
          setAuditCounts(data.auditCounts);
        }
        if (data.everydayRecords) {
          setEverydayRecords(data.everydayRecords);
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

  // Average Days Per Employee (for "Employee" type only, excluding specific inactive types)
  const averageDays = useMemo(() => {
    if (!weekData?.employees || weekData.employees.length === 0) return "0.0";
    const EXCLUDED = new Set(["off", "request off", "assign schedule", "call out", "reduction", "stand by", ""]);
    
    // Only include employees with type "Employee" (case insensitive)
    const validEmps = weekData.employees.filter(emp => (emp.employee?.type || "").trim().toLowerCase() === "employee");
    if (validEmps.length === 0) return "0.0";

    let totalDays = 0;
    validEmps.forEach(emp => {
      for (let d = 0; d < 7; d++) {
        const day = emp.days[d];
        if (day) {
          const typeVal = (day.type || "").trim().toLowerCase();
          if (!EXCLUDED.has(typeVal)) {
            totalDays++;
          }
        }
      }
    });

    return (totalDays / validEmps.length).toFixed(1);
  }, [weekData]);

  // Push title into left
  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {activeMainTab === "messaging"
            ? (SUB_TABS.find((t) => t.id === activeSubTab)?.label ?? "Messaging")
            : "Scheduling"}
        </h1>
      </div>
    );
    return () => setLeftContent(null);
  }, [setLeftContent, activeMainTab, activeSubTab]);

  // Right content: search + messaging actions + week selector + scheduling chips
  useEffect(() => {
    const idx = weeks.indexOf(selectedWeek);
    const totalEmps = weekData?.totalEmployees ?? 0;
    
    setRightContent(
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
        {/* Scheduling Chips */}
        {activeMainTab === "scheduling" && (
          <div className="flex items-center gap-1.5 mr-2">
            <div className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-zinc-100 dark:bg-zinc-950 border border-primary/20 text-[11px] font-semibold text-primary select-none">
              <Users className="h-3.5 w-3.5" />
              {totalEmps}
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-zinc-100 dark:bg-zinc-950 border border-emerald-500/30 text-[11px] font-semibold text-emerald-500 select-none cursor-default">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {averageDays} avg
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs bg-popover text-popover-foreground border shadow-lg">
                  <p className="font-semibold text-emerald-500 mb-1">Average Working Days</p>
                  <p className="text-muted-foreground">For all regular Employees.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {warningCounts.caution > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-zinc-100 dark:bg-zinc-950 border border-amber-500/30 text-[11px] font-semibold text-amber-500 select-none cursor-default">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {warningCounts.caution} × 6-day
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs bg-popover text-popover-foreground border shadow-lg">
                    <p className="font-semibold text-amber-500 mb-1">6 consecutive days:</p>
                    {warningCounts.cautionNames.length > 0 ? (
                      warningCounts.cautionNames.map((n, i) => <p key={i} className="text-muted-foreground">{n}</p>)
                    ) : (
                      <p className="text-muted-foreground">None</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {warningCounts.danger > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-1.5 h-7 px-3 rounded-full bg-zinc-100 dark:bg-zinc-950 border text-[11px] font-semibold select-none cursor-default",
                      warningCounts.danger > 0 
                        ? "border-red-500/30 text-red-500 animate-pulse"
                        : "border-red-500/20 text-red-500/70"
                    )}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {warningCounts.danger} × 7+ day
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs bg-popover text-popover-foreground border shadow-lg">
                    <p className="font-semibold text-red-500 mb-1">7+ consecutive days (violation):</p>
                    {warningCounts.dangerNames.length > 0 ? (
                      warningCounts.dangerNames.map((n, i) => <p key={i} className="text-muted-foreground">{n}</p>)
                    ) : (
                      <p className="text-muted-foreground">None</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}

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
            {currentUserEmail === "adeel@symxlogistics.com" && activeMainTab === "scheduling" && (
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8 mr-1 opacity-80 hover:opacity-100"
                onClick={handleDeleteWeek}
                disabled={deletingWeek || generatingWeek}
                title={`Delete ${selectedWeek}`}
              >
                {deletingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
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
  }, [setRightContent, searchQuery, activeMainTab, activeTabInfo, weeks, selectedWeek, generatingWeek, generateWeek, weekData?.totalEmployees, warningCounts, averageDays, currentUserEmail, deletingWeek]);

  // Handle type change via dropdown
  const handleTypeChange = useCallback(async (
    scheduleId: string | undefined,
    newType: string,
    transporterId: string,
    dayIdx: number,
    employeeName?: string
  ) => {
    // Optimistic update
    const isWorking = !NON_WORKING_TYPES.has(newType.trim().toLowerCase()); // kept for legacy fallbacks if needed
    const routeConfig = routeTypeConfigs[newType.trim().toLowerCase()];
    const defaultStartTime = routeConfig?.startTime || "";
    const newRouteStatus = routeConfig?.routeStatus || (isWorking ? "Scheduled" : "Off");
    
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
               status: newRouteStatus,
               startTime: defaultStartTime,
            } as DayData,
          },
        };
      });
      return updated;
    });

    try {
      // Build payload — include creation fields when no scheduleId
      const payload: Record<string, string> = { type: newType, startTime: defaultStartTime, status: newRouteStatus };
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

      // Invalidate dispatching routes globally so it's fresh when navigating away
      store.refresh("dispatching.routes");

      // Update audit count for this employee
      setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));

      // Refetch to get the new _id if we created a new entry
      if (!scheduleId) {
        const refetchRes = await fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}&t=${Date.now()}`);
        const refetchData = await refetchRes.json();
        setWeekData(refetchData);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update type");
      // Revert on error — refetch with cache buster
      if (selectedWeek) {
        const res = await fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}&t=${Date.now()}`);
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
            employee: emp.employee ? {
              ...emp.employee,
              ScheduleNotes: newNote,
            } : null,
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
    () => computePlanningData(isFiltered ? filteredEmployees : (weekData?.employees || []), everydayRecords, weekData?.dates || []),
    [weekData, filteredEmployees, isFiltered, everydayRecords]
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
    <TooltipProvider delayDuration={0} disableHoverableContent>
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
                        <th className="text-left font-semibold px-2 sm:px-3 py-2 sm:py-2.5 min-w-[100px] sm:min-w-[140px] sticky left-0 bg-muted z-30 backdrop-blur-sm">
                          Employee Name
                        </th>
                        {weekData?.dates?.map((date, i) => {
                          const isToday = date === getTodayPacific(); // strictly lock to Pacific Time
                          const d = new Date(date.split("T")[0] + "T00:00:00Z");
                          const dateNum = isNaN(d.getTime()) ? "" : d.getUTCDate();
                          const monthStr = isNaN(d.getTime()) ? "" : d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
                          
                          return (
                          <th key={date} className="text-center font-medium px-0 sm:px-0.5 py-2 sm:py-2.5 min-w-[100px] sm:min-w-[125px]">
                            <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                              
                              {/* 1. Ultra-sleek Date row */}
                              <div className={cn(
                                "flex items-center justify-between gap-1 w-full max-w-[128px] px-1.5 py-0.5 rounded-full border transition-colors",
                                isToday ? "bg-emerald-500 text-white border-emerald-400 shadow-sm" : "bg-blue-500 text-white border-blue-400 shadow-sm"
                              )}>
                                <div className="flex items-baseline gap-1">
                                  <span className={cn(
                                    "text-[10px] uppercase font-bold tracking-widest",
                                    isToday ? "text-emerald-100" : "text-blue-100"
                                  )}>
                                    {DAY_NAMES[i]}
                                  </span>
                                  <span className={cn(
                                    "text-[12px] font-black tracking-tight text-white"
                                  )}>
                                    {formatDate(date)}
                                  </span>
                                </div>
                                {planningData.length > 0 && (
                                  <RouteAssignedPopover 
                                    date={date} 
                                    value={planningData[2].values[i]} 
                                    onSave={handleRoutesAssignedUpdate} 
                                  />
                                )}
                              </div>

                              {/* 2. Ultra-compressed Stats Row */}
                              {planningData.length > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger className="flex items-center justify-evenly w-full max-w-[128px] px-1 py-1 bg-zinc-100 dark:bg-zinc-950/50 rounded-lg border border-black/5 dark:border-white/5 shadow-inner backdrop-blur-sm mt-0.5 cursor-default hover:opacity-90 transition-opacity gap-0.5">
                                      <div className="flex items-center gap-0.5">
                                        <Users className="h-2.5 w-2.5 text-emerald-500" />
                                        <span className="text-[11px] font-bold text-foreground leading-none">{planningData[0].values[i]}</span>
                                      </div>
                                      <div className="flex items-center gap-0.5">
                                        <Clock className="h-2.5 w-2.5 text-cyan-500" />
                                        <span className="text-[11px] font-bold text-foreground leading-none">{planningData[1].values[i]}</span>
                                      </div>
                                      <div className="flex items-center gap-0.5">
                                        <Wrench className="h-2.5 w-2.5 text-orange-500" />
                                        <span className="text-[11px] font-bold text-foreground leading-none">{planningData[3].values[i]}</span>
                                      </div>
                                      <div className={cn("flex items-center gap-0.5", planningData[4].values[i] < 0 && "text-red-500")}>
                                        <UserPlus className={cn("h-2.5 w-2.5 text-purple-500", planningData[4].values[i] < 0 && "text-red-500 animate-heartbeat inline-block")} />
                                        <span className={cn("text-[11px] font-bold text-foreground leading-none", planningData[4].values[i] < 0 && "text-red-500 animate-heartbeat drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] inline-block")}>{planningData[4].values[i]}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="w-[200px] p-0 bg-popover text-popover-foreground border shadow-xl rounded-xl [&>svg]:hidden">
                                      <div className="font-semibold px-3 py-2 border-b border-border/40 bg-muted/40 text-xs">
                                        Daily Planning Metrics
                                      </div>
                                      <div className="flex flex-col py-1">
                                        <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="text-xs font-medium">DA's</span>
                                          </div>
                                          <span className="text-sm font-bold font-mono">{planningData[0].values[i]}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5 text-cyan-500" />
                                            <span className="text-xs font-medium">Stand By</span>
                                          </div>
                                          <span className="text-sm font-bold font-mono">{planningData[1].values[i]}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <TruckIcon className="h-3.5 w-3.5 text-blue-500" />
                                            <span className="text-xs font-medium">Routes Assigned</span>
                                          </div>
                                          <span className="text-sm font-bold font-mono">{planningData[2].values[i]}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <Wrench className="h-3.5 w-3.5 text-orange-500" />
                                            <span className="text-xs font-medium">OPS</span>
                                          </div>
                                          <span className="text-sm font-bold font-mono">{planningData[3].values[i]}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <UserPlus className={cn("h-3.5 w-3.5 text-purple-500", planningData[4].values[i] < 0 && "text-red-500 animate-heartbeat inline-block")} />
                                            <span className={cn("text-xs font-medium", planningData[4].values[i] < 0 && "text-red-500 font-bold")}>Extra DA's</span>
                                          </div>
                                          <span className={cn("text-sm font-bold font-mono", planningData[4].values[i] < 0 && "text-red-500 animate-heartbeat drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10 inline-block")}>{planningData[4].values[i]}</span>
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                              )}
                            </div>
                          </th>
                          );
                        })}
                        <th className="text-center font-semibold px-1 sm:px-2 py-2 sm:py-2.5 min-w-[36px] sm:min-w-[40px]">Days</th>
                        <th className="w-[30px] hidden md:table-cell py-2 px-0"></th>
                        <th className="text-left font-semibold px-2 sm:px-3 py-2 sm:py-2.5 min-w-[100px] sm:min-w-[140px] hidden md:table-cell">Employee Notes</th>
                        <th className="text-center font-semibold px-0.5 sm:px-1 py-2 sm:py-2.5 min-w-[40px] sm:min-w-[50px]">
                          <div className="inline-flex items-center gap-1 text-violet-400">
                            <History className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">Audit</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>

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
                                  const dateA = a.employee?.hiredDate ? new Date(a.employee.hiredDate).getTime() : Infinity;
                                  const dateB = b.employee?.hiredDate ? new Date(b.employee.hiredDate).getTime() : Infinity;
                                  if (dateA !== dateB) {
                                    return dateA - dateB;
                                  }
                                  const nameA = a.employee?.name || "";
                                  const nameB = b.employee?.name || "";
                                  return nameA.localeCompare(nameB);
                                })
                                .map((emp) => {
                                  const workDays = countWorkingDays(emp);
                                  const notes = emp.employee?.ScheduleNotes || "";
                                  const consecutiveWarnings = getConsecutiveWarnings(emp, weekData?.prevWeekTrailing?.[emp.transporterId] || 0);

                                  return (
                                    <tr
                                      key={`${groupName}-${emp.transporterId}`}
                                      className="border-b border-border/10 hover:bg-muted/20 transition-colors group"
                                    >
                                      <td className="px-1.5 sm:px-3 py-1 sm:py-1.5 sticky left-0 bg-card z-10 group-hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-1 sm:gap-1.5">
                                          <span className="text-[10px] sm:text-xs font-normal truncate max-w-[80px] sm:max-w-[125px]">
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
                                        const matchedOpt = dynamicTypeOptions.find(opt => opt.label.toLowerCase() === displayValue.toLowerCase());
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
                                                        !matchedOpt?.colorHex && style.bg,
                                                        !matchedOpt?.colorHex && style.text,
                                                        !matchedOpt?.colorHex && style.border,
                                                        "hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                                      )}
                                                      style={matchedOpt?.colorHex ? { backgroundColor: matchedOpt.colorHex, color: "#fff", borderColor: matchedOpt.colorHex } : undefined}
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
                                                  className="max-w-[300px] text-xs space-y-1 bg-popover text-popover-foreground border shadow-xl pointer-events-none [&>svg]:hidden"
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
                                                    {day?.dayBeforeConfirmation === "true" && (
                                                      <div className="col-span-2 flex items-center justify-end gap-1.5 mt-0.5 pt-0.5 border-t border-border/10">
                                                        <span className="text-emerald-500 font-bold">Confirmed</span>
                                                        <LucideIcons.ThumbsUp className="h-3 w-3 text-emerald-500" />
                                                      </div>
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
                                                avoidCollisions
                                                className="w-48 p-0 overflow-hidden group"
                                              >
                                                <div className="max-h-[320px] overflow-y-auto flex flex-col py-1">
                                                  {dynamicTypeOptions.map(opt => {
                                                    const Icon = opt.icon;
                                                    const isActive = displayValue.toLowerCase() === opt.label.toLowerCase();
                                                    return (
                                                      <DropdownMenuItem
                                                        key={opt.label}
                                                        className={cn(
                                                          "flex items-center gap-2 cursor-pointer text-xs mx-1 rounded",
                                                          isActive && "bg-accent"
                                                        )}
                                                        onClick={() => handleTypeChange(day?._id, opt.label, emp.transporterId, dayIdx, emp.employee?.name)}
                                                      >
                                                        <div 
                                                          className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", !opt.colorHex && opt.bg)}
                                                          style={opt.colorHex ? { backgroundColor: opt.colorHex } : undefined}
                                                        >
                                                          <Icon 
                                                            className={cn("h-3 w-3", !opt.colorHex && opt.text)} 
                                                            style={opt.colorHex ? { color: "#fff" } : undefined}
                                                          />
                                                        </div>
                                                        <span className="font-medium">{opt.label}</span>
                                                        {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                                                      </DropdownMenuItem>
                                                    );
                                                  })}
                                                </div>
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
                                      <td className="w-[34px] px-1 text-center hidden md:table-cell align-middle">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={async () => {
                                                setNotesEmployee({ employeeId: emp.employee?._id || "", transporterId: emp.transporterId, name: emp.employee?.name || emp.transporterId });
                                                setShowNotesPanel(true);
                                              }}
                                              className="inline-flex items-center justify-center p-1.5 rounded-md transition-all relative mt-1 text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/40"
                                            >
                                              <FileText className="h-[14px] w-[14px]" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            Employee Notes
                                          </TooltipContent>
                                        </Tooltip>
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
      {/* ── Employee Notes Slide-out Panel ── */}
      <EmployeeNotesPanel
        open={showNotesPanel}
        onClose={() => setShowNotesPanel(false)}
        employee={notesEmployee}
        onNoteAdded={(tid) => setNoteCounts(prev => ({ ...prev, [tid]: (prev[tid] || 0) + 1 }))}
      />
    </TooltipProvider>
  );
}


