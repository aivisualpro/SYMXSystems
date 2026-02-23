"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import MessagingPanel from "@/components/scheduling/messaging-panel";

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
  { label: "Route",         icon: Navigation,    bg: "bg-emerald-600",    text: "text-white",  border: "border-emerald-700",   dotColor: "bg-emerald-500" },
  { label: "Open",          icon: DoorOpen,      bg: "bg-amber-400/80",   text: "text-white",  border: "border-amber-500/60",  dotColor: "bg-amber-400" },
  { label: "Close",         icon: DoorClosed,    bg: "bg-rose-400/80",    text: "text-white",  border: "border-rose-500/60",   dotColor: "bg-rose-400" },
  { label: "Off",           icon: Coffee,        bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", dotColor: "bg-zinc-400" },
  { label: "Call Out",      icon: PhoneOff,      bg: "bg-yellow-500",     text: "text-white",  border: "border-yellow-600",    dotColor: "bg-yellow-500" },
  { label: "AMZ Training",  icon: GraduationCap, bg: "bg-indigo-600",     text: "text-white",  border: "border-indigo-700",    dotColor: "bg-indigo-500" },
  { label: "Fleet",         icon: TruckIcon,     bg: "bg-blue-600",       text: "text-white",  border: "border-blue-700",      dotColor: "bg-blue-500" },
  { label: "Request Off",   icon: CalendarOff,   bg: "bg-purple-600",     text: "text-white",  border: "border-purple-700",    dotColor: "bg-purple-500" },
  { label: "Trainer",       icon: UserCheck,     bg: "bg-teal-600",       text: "text-white",  border: "border-teal-700",      dotColor: "bg-teal-500" },
  { label: "Training OTR",  icon: BookOpen,      bg: "bg-violet-600",     text: "text-white",  border: "border-violet-700",    dotColor: "bg-violet-500" },
  { label: "Suspension",    icon: Ban,           bg: "bg-rose-700",       text: "text-white",  border: "border-rose-800",      dotColor: "bg-rose-600" },
  { label: "Modified Duty", icon: ShieldAlert,   bg: "bg-amber-600",      text: "text-white",  border: "border-amber-700",     dotColor: "bg-amber-500" },
  { label: "Stand by",      icon: Clock,         bg: "bg-cyan-600",       text: "text-white",  border: "border-cyan-700",      dotColor: "bg-cyan-500" },
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
const NON_WORKING_TYPES = new Set(["off", "close", "request off", ""]);

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
    scheduleNotes: string;
  } | null;
  days: Record<number, DayData>;
}

interface WeekData {
  yearWeek: string;
  dates: string[];
  employees: EmployeeSchedule[];
  totalEmployees: number;
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
// Returns a Map<dayIndex, { consecutive: number, type: 'caution' | 'danger' }>
function getConsecutiveWarnings(emp: EmployeeSchedule): Map<number, { consecutive: number; type: 'caution' | 'danger' }> {
  const warnings = new Map<number, { consecutive: number; type: 'caution' | 'danger' }>();
  
  // Check consecutive working (not just route — any working day counts)
  let consecutive = 0;
  for (let d = 0; d < 7; d++) {
    const day = emp.days[d];
    if (day && isWorkingDay(day.type)) {
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
  onSaved,
}: {
  value: string;
  employeeId: string | undefined;
  onSaved: (newNote: string) => void;
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
        body: JSON.stringify({ employeeId, note: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Note saved");
      onSaved(draft);
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

export default function SchedulingPage() {
  const pathname = usePathname();
  const router = useRouter();
  const activeMainTab = pathname.includes("/messaging") ? "messaging" : "scheduling";
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [planningCollapsed, setPlanningCollapsed] = useState(true);
  const [selectAllTrigger, setSelectAllTrigger] = useState(0);
  const { setLeftContent, setRightContent } = useHeaderActions();

  // Fetch available weeks
  useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const res = await fetch("/api/schedules?weeksList=true");
        const data = await res.json();
        if (data.weeks?.length) {
          setWeeks(data.weeks);
          setSelectedWeek(data.weeks[0]);
        }
      } catch (err) {
        toast.error("Failed to load available weeks");
      } finally {
        setLoading(false);
      }
    };
    fetchWeeks();
  }, []);

  // Fetch week data
  useEffect(() => {
    if (!selectedWeek) return;
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const res = await fetch(`/api/schedules?yearWeek=${encodeURIComponent(selectedWeek)}`);
        const data = await res.json();
        setWeekData(data);
      } catch (err) {
        toast.error("Failed to load schedule data");
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
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
      const warnings = getConsecutiveWarnings(emp);
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

  // Push title + search into the main header
  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Scheduling
        </h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 w-[220px] text-sm"
          />
        </div>
        {activeMainTab === "messaging" && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectAllTrigger((p) => p + 1)}
          >
            Select All
          </Button>
        )}
      </div>
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [setLeftContent, setRightContent, searchQuery, activeMainTab]);

  // Update right content whenever week state changes
  useEffect(() => {
    if (weeks.length === 0) {
      setRightContent(null);
      return;
    }

    const idx = weeks.indexOf(selectedWeek);

    setRightContent(
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            const newIdx = idx + 1;
            if (newIdx < weeks.length) setSelectedWeek(weeks[newIdx]);
          }}
          disabled={idx >= weeks.length - 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
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
            const newIdx = idx - 1;
            if (newIdx >= 0) setSelectedWeek(weeks[newIdx]);
          }}
          disabled={idx <= 0}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }, [weeks, selectedWeek, setRightContent]);

  // Handle type change via dropdown
  const handleTypeChange = useCallback(async (
    scheduleId: string | undefined,
    newType: string,
    transporterId: string,
    dayIdx: number
  ) => {
    // Optimistic update
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
            } as DayData,
          },
        };
      });
      return updated;
    });

    try {
      // Build payload — include creation fields when no scheduleId
      const payload: Record<string, string> = { type: newType };
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
  const handleNoteSaved = useCallback((transporterId: string, newNote: string) => {
    setWeekData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        employees: prev.employees.map(emp => {
          if (emp.transporterId !== transporterId) return emp;
          return {
            ...emp,
            employee: emp.employee ? { ...emp.employee, scheduleNotes: newNote } : emp.employee,
          };
        }),
      };
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <CalendarDays className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading schedule data...</p>
        </div>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
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
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden gap-3">

        {/* ── Main Tabs: Scheduling | Messaging ── */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => router.push("/scheduling")}
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
            onClick={() => router.push("/scheduling/messaging")}
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

        {/* ── Messaging Tab Content ── */}
        {activeMainTab === "messaging" && (
          <div className="flex-1 min-h-0 overflow-auto">
            <MessagingPanel
              weeks={weeks}
              selectedWeek={selectedWeek}
              setSelectedWeek={setSelectedWeek}
              searchQuery={searchQuery}
              selectAllTrigger={selectAllTrigger}
            />
          </div>
        )}

        {/* ── Scheduling Tab Content ── */}
        {activeMainTab === "scheduling" && (<>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Employees",
              value: totalEmployees,
              icon: Users,
              gradient: "from-blue-500/15 to-cyan-500/15",
              iconColor: "text-blue-500",
              borderColor: "border-blue-500/20",
            },

            {
              label: "Routes",
              value: totalRoutes,
              icon: TruckIcon,
              gradient: "from-violet-500/15 to-purple-500/15",
              iconColor: "text-violet-500",
              borderColor: "border-violet-500/20",
            },
            {
              label: "Days Off",
              value: totalOff,
              icon: XCircle,
              gradient: "from-zinc-500/15 to-gray-500/15",
              iconColor: "text-zinc-400",
              borderColor: "border-zinc-500/20",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`relative overflow-hidden rounded-xl border ${kpi.borderColor} p-4 bg-gradient-to-br ${kpi.gradient}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{loadingData ? "—" : kpi.value}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.iconColor} opacity-50`} />
              </div>
            </div>
          ))}
          {/* Warnings Card */}
          <div className="relative overflow-hidden rounded-xl border border-amber-500/30 p-4 bg-gradient-to-br from-zinc-500/10 to-zinc-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Warnings</p>
                <div className="flex items-center gap-3 mt-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 cursor-default">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-400 animate-pulse" />
                        <span className="text-lg font-bold text-orange-400">{loadingData ? "—" : warningCounts.caution}</span>
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
                  <span className="text-muted-foreground/30">|</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 cursor-default">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-lg font-bold text-red-500">{loadingData ? "—" : warningCounts.danger}</span>
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
              <AlertTriangle className="h-8 w-8 text-amber-500 opacity-50" />
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
              <table className="w-full text-sm">
                {/* Table Header with Dates */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-muted border-b border-border/50">
                    <th className="text-left font-semibold px-3 py-2.5 min-w-[180px] sticky left-0 bg-muted z-30 backdrop-blur-sm">
                      Employee Name
                    </th>
                    {weekData?.dates?.map((date, i) => (
                      <th key={date} className="text-center font-medium px-2 py-2.5 min-w-[110px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {DAY_NAMES[i]}
                          </span>
                          <span className="text-xs font-semibold">{formatDate(date)}</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-center font-semibold px-2 py-2.5 min-w-[50px]">Days</th>
                    <th className="text-left font-semibold px-3 py-2.5 min-w-[180px]">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── Planning Section ── */}
                  <tr
                    className="border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setPlanningCollapsed(!planningCollapsed)}
                  >
                    <td className="px-3 py-1.5 sticky left-0 bg-card z-10">
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
                    <td className="px-3 py-1.5" />
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
                      <td className="px-3 py-1.5" />
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
                            colSpan={(weekData?.dates?.length || 7) + 3}
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
                              const notes = emp.employee?.scheduleNotes || "";
                              const consecutiveWarnings = getConsecutiveWarnings(emp);

                              return (
                                <tr
                                  key={`${groupName}-${emp.transporterId}`}
                                  className="border-b border-border/10 hover:bg-muted/20 transition-colors group"
                                >
                                  <td className="px-3 py-1.5 sticky left-0 bg-card z-10 group-hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold truncate max-w-[160px]">
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
                                      <td key={dayIdx} className="text-center px-1 py-1">
                                        <DropdownMenu>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <DropdownMenuTrigger asChild>
                                                <div
                                                  className={cn(
                                                    "relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold transition-all border cursor-pointer select-none",
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
                                                      "absolute -top-1.5 -right-1.5 flex items-center justify-center h-3.5 min-w-[14px] rounded-full text-[8px] font-bold text-white leading-none px-0.5 shadow-sm",
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
                                                  onClick={() => handleTypeChange(day?._id, opt.label, emp.transporterId, dayIdx)}
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
                                  <td className="px-3 py-1.5">
                                    <EditableNote
                                      value={notes}
                                      employeeId={emp.employee?._id}
                                      onSaved={(newNote) => handleNoteSaved(emp.transporterId, newNote)}
                                    />
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
        <div className="flex flex-wrap items-center gap-2 px-1">
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
    </TooltipProvider>
  );
}
