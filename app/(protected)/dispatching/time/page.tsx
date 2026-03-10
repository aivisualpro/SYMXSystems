"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
    Users,
    Loader2,
    ChevronUp,
    ChevronDown,
    Pencil,
    Check,
    X,
    Minus,
    CheckCircle2,
    XCircle,
    CircleDashed,
    Navigation,
    DoorOpen,
    DoorClosed,
    Coffee,
    PhoneOff,
    GraduationCap,
    TruckIcon,
    CalendarOff,
    UserCheck,
    BookOpen,
    Ban,
    ShieldAlert,
    Clock,
    AlertCircle,
    Flag,
    type LucideIcon,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Type Options (colored pills) ──
const TYPE_OPTIONS = [
    { label: "Route", icon: Navigation, bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700" },
    { label: "Open", icon: DoorOpen, bg: "bg-amber-400/80", text: "text-white", border: "border-amber-500/60" },
    { label: "Close", icon: DoorClosed, bg: "bg-rose-400/80", text: "text-white", border: "border-rose-500/60" },
    { label: "Off", icon: Coffee, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" },
    { label: "Call Out", icon: PhoneOff, bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600" },
    { label: "AMZ Training", icon: GraduationCap, bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700" },
    { label: "Fleet", icon: TruckIcon, bg: "bg-blue-600", text: "text-white", border: "border-blue-700" },
    { label: "Request Off", icon: CalendarOff, bg: "bg-purple-600", text: "text-white", border: "border-purple-700" },
    { label: "Trainer", icon: UserCheck, bg: "bg-teal-600", text: "text-white", border: "border-teal-700" },
    { label: "Training OTR", icon: BookOpen, bg: "bg-violet-600", text: "text-white", border: "border-violet-700" },
    { label: "Suspension", icon: Ban, bg: "bg-rose-700", text: "text-white", border: "border-rose-800" },
    { label: "Modified Duty", icon: ShieldAlert, bg: "bg-amber-600", text: "text-white", border: "border-amber-700" },
    { label: "Stand by", icon: Clock, bg: "bg-cyan-600", text: "text-white", border: "border-cyan-700" },
];
const TYPE_MAP = new Map(TYPE_OPTIONS.map(opt => [opt.label.toLowerCase(), opt]));
const getTypeStyle = (value: string) => {
    if (!value || value.trim() === "") return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" };
    const opt = TYPE_MAP.get(value.trim().toLowerCase());
    if (opt) return { bg: opt.bg, text: opt.text, border: opt.border };
    return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
};

// ── Attendance Options ──
const ATTENDANCE_OPTIONS = [
    { label: "Present", icon: CheckCircle2, bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", iconColor: "text-white" },
    { label: "Absent", icon: XCircle, bg: "bg-red-600", text: "text-white", border: "border-red-700", iconColor: "text-white" },
    { label: "", icon: CircleDashed, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", iconColor: "text-zinc-400", displayLabel: "Clear" },
];
const getAttendanceStyle = (value: string) => {
    const v = value.trim().toLowerCase();
    if (v === "present") return ATTENDANCE_OPTIONS[0];
    if (v === "absent") return ATTENDANCE_OPTIONS[1];
    return ATTENDANCE_OPTIONS[2];
};

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", width: "flex-1 min-w-[100px] max-w-[150px]" },
    { key: "attendance", label: "Attendance", width: "w-[95px]" },
    { key: "type", label: "Type", width: "w-[100px]" },
    { key: "routeNumber", label: "Route #", width: "w-[75px]" },
    { key: "paycomInDay", label: "In Day", width: "w-[70px]" },
    { key: "paycomOutLunch", label: "Out Lunch", width: "w-[75px]" },
    { key: "paycomInLunch", label: "In Lunch", width: "w-[70px]" },
    { key: "paycomOutDay", label: "Out Day", width: "w-[70px]" },
    { key: "punchStatus", label: "Punch", width: "w-[110px]" },
    { key: "attendanceTime", label: "Att. Time", width: "w-[75px]" },
    { key: "amazonOutLunch", label: "AMZ Out", width: "w-[70px]" },
    { key: "amazonInLunch", label: "AMZ In", width: "w-[65px]" },
    { key: "amazonAppLogout", label: "AMZ Logout", width: "w-[80px]" },
    { key: "inspectionTime", label: "Inspection", width: "w-[80px]" },
    { key: "totalHours", label: "Total Hrs", width: "w-[70px]" },
    { key: "actions", label: "", width: "w-[40px]" },
] as const;

const GRID_TEMPLATE = "minmax(100px, 150px) 95px 100px 75px 70px 75px 70px 70px 110px 75px 70px 65px 80px 80px 70px 40px";

// ── Editable fields ──
const EDITABLE_FIELDS = new Set([
    "routeNumber", "paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay",
    "punchStatus", "attendanceTime", "amazonOutLunch", "amazonInLunch",
    "amazonAppLogout", "inspectionTime", "totalHours",
]);

// ── Short day labels ──
const SHORT_DAYS: Record<string, string> = {
    Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

interface RouteRow {
    _id: string;
    transporterId: string;
    date: string;
    weekDay: string;
    employeeName: string;
    attendance: string;
    type: string;
    routeNumber: string;
    paycomInDay: string;
    paycomOutLunch: string;
    paycomInLunch: string;
    paycomOutDay: string;
    punchStatus: string;
    attendanceTime: string;
    amazonOutLunch: string;
    amazonInLunch: string;
    amazonAppLogout: string;
    inspectionTime: string;
    totalHours: string;
    profileImage?: string;
}

// ── Formatting Rules Helpers ──
const parseSmartTime = (val: string): string => {
    if (!val) return "";
    const d = val.replace(/\D/g, "");
    if (!d) return "";

    let hours = 0;
    let mins = 0;

    if (d.length <= 2) {
        hours = parseInt(d, 10);
    } else if (d.length === 3) {
        hours = parseInt(d.substring(0, 1), 10);
        mins = parseInt(d.substring(1, 3), 10);
    } else {
        hours = parseInt(d.substring(0, 2), 10);
        mins = parseInt(d.substring(2, 4), 10);
    }

    if (hours > 23) hours = 23;
    if (mins > 59) mins = 59;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const timeToMins = (t: string | undefined | null) => {
    if (!t) return 0;
    const parts = t.split(":");
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

const getElapsedMins = (inDayStr: string, dateStr: string) => {
    if (!inDayStr) return 0;
    const inMins = timeToMins(inDayStr);
    const today = new Date();
    // Use local time for comparison since time strings are local
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const rowDate = dateStr?.split("T")[0];

    if (rowDate === todayStr) {
        return (today.getHours() * 60 + today.getMinutes()) - inMins;
    } else if (rowDate && rowDate < todayStr) {
        return 9999;
    } else {
        return -9999;
    }
};

const getCellFormat = (row: RouteRow, field: string) => {
    if (field === "paycomInDay") {
        const inMins = timeToMins(row.paycomInDay);
        const attMins = timeToMins(row.attendanceTime);
        if (row.paycomInDay && row.attendanceTime) {
            if (inMins - attMins > 10 || attMins - inMins > 5) {
                return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white" };
            } else if (attMins - inMins <= 5 && inMins - attMins <= 10) {
                return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white" };
            }
        }
    }

    if (field === "paycomOutLunch") {
        const outLunchValid = !!row.paycomOutLunch;
        const outLunchMins = timeToMins(row.paycomOutLunch);
        const inDayValid = !!row.paycomInDay;
        const inDayMins = timeToMins(row.paycomInDay);
        const amzOutValid = !!row.amazonOutLunch;
        const type = row.type?.trim().toLowerCase() || "";

        const isTypeCR = ["route", "crash"].includes(type);
        const isTypeOCR = ["open", "close", "rescue"].includes(type);
        const isTypeOCRC = ["open", "close", "rescue", "crash"].includes(type);
        const isTypeCRC0 = ["route", "crash", "c0"].includes(type);

        const elapsed = getElapsedMins(row.paycomInDay, row.date);
        const duration = outLunchValid && inDayValid ? (outLunchMins - inDayMins) : 0;

        // D: Red with alarm icon
        const condD_noPunch = !outLunchValid && inDayValid && elapsed >= 295;
        const condD_punchLate = outLunchValid && inDayValid && duration >= 295;
        const condD = condD_noPunch || condD_punchLate;

        // C: Red
        const condC = outLunchValid && isTypeOCRC && duration > 330;

        // E: Red with different icon
        const condE = outLunchValid && isTypeCR && (!amzOutValid || row.paycomOutLunch !== row.amazonOutLunch);

        // F: Green with icon
        const condF = outLunchValid && isTypeOCR && duration <= 330;

        // G: Green with different icon
        const condG = isTypeCRC0 && outLunchValid && amzOutValid && (row.paycomOutLunch === row.amazonOutLunch);

        if (condD) return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white", icon: Flag, iconColor: "text-white fill-white" };
        if (condC) return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white", icon: Flag, iconColor: "text-white fill-white" };
        if (condE) return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white", icon: Flag, iconColor: "text-white fill-white" };
        if (condG) return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white", icon: CheckCircle2, iconColor: "text-white" };
        if (condF) return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white", icon: CheckCircle2, iconColor: "text-white" };
    }

    if (field === "paycomInLunch") {
        const inLunchValid = !!row.paycomInLunch;
        const inLunchMins = timeToMins(row.paycomInLunch);
        const outLunchValid = !!row.paycomOutLunch;
        const outLunchMins = timeToMins(row.paycomOutLunch);
        const amzInValid = !!row.amazonInLunch;

        const type = row.type?.trim().toLowerCase() || "";
        const isTypeCR = ["route", "crash"].includes(type);
        const isTypeOCR = ["open", "close", "rescue"].includes(type);
        const isTypeCRC0 = ["route", "crash", "c0"].includes(type);

        const condA1 = inLunchValid && inLunchMins > 0 && isTypeCR && (!amzInValid || row.paycomInLunch !== row.amazonInLunch);
        const condA2 = inLunchValid && inLunchMins > 0 && outLunchValid && (inLunchMins - outLunchMins < 30);

        if (condA1 || condA2) {
            return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white" };
        }

        const condB1 = isTypeOCR && outLunchValid && inLunchValid && (inLunchMins - outLunchMins >= 30) && inLunchMins > 0;
        const condB2 = isTypeCRC0 && inLunchValid && inLunchMins > 0 && amzInValid && (row.paycomInLunch === row.amazonInLunch);

        if (condB1 || condB2) {
            return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white" };
        }
    }

    if (field === "paycomOutDay") {
        const outDayValid = !!row.paycomOutDay;
        const outDayMins = timeToMins(row.paycomOutDay);
        const appLogoutValid = !!row.amazonAppLogout;
        const appLogoutMins = timeToMins(row.amazonAppLogout);

        const inLunchValid = !!row.paycomInLunch;
        const inLunchMins = timeToMins(row.paycomInLunch);
        const outLunchValid = !!row.paycomOutLunch;
        const outLunchMins = timeToMins(row.paycomOutLunch);

        const type = row.type?.trim().toLowerCase() || "";
        const isTypeRoute = type === "route";

        if (outDayValid && outDayMins > 0) {
            if (isTypeRoute) {
                if (appLogoutValid) {
                    if (outDayMins < appLogoutMins || outDayMins >= appLogoutMins + 15) {
                        return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white" };
                    }
                    if (outDayMins >= appLogoutMins && outDayMins < appLogoutMins + 15) {
                        return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white" };
                    }
                }
            } else {
                if (inLunchValid && outLunchValid) {
                    const diff = inLunchMins - outLunchMins;
                    if (diff < 30) {
                        return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white" };
                    }
                    if (diff >= 30) {
                        return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white" };
                    }
                }
            }
        }
    }

    if (field === "amazonInLunch") {
        const outLunchValid = !!row.amazonOutLunch;
        const outLunchMins = timeToMins(row.amazonOutLunch);
        const inLunchValid = !!row.amazonInLunch;
        const inLunchMins = timeToMins(row.amazonInLunch);

        if (outLunchValid && inLunchValid) {
            const diff = inLunchMins - outLunchMins;
            if (diff < 30) {
                return { bg: "bg-red-600", text: "text-white font-bold", inputBg: "bg-red-600 text-white focus:bg-red-500 focus:text-white" };
            } else {
                return { bg: "bg-emerald-600", text: "text-white font-bold", inputBg: "bg-emerald-600 text-white focus:bg-emerald-500 focus:text-white" };
            }
        }
    }

    return null;
};

type SortKey = typeof COLUMNS[number]["key"];

export default function TimePage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats, globalEditMode } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // ── Quick Edit Modal State ──
    const [quickEditRow, setQuickEditRow] = useState<RouteRow | null>(null);
    const [quickEditForm, setQuickEditForm] = useState<Partial<RouteRow>>({});
    const [punchStatusOptions, setPunchStatusOptions] = useState<any[]>([]);

    // ── Fetch Punch Status Options ──
    useEffect(() => {
        let mounted = true;
        fetch("/api/admin/settings/dropdowns?type=punch%20status")
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (mounted && Array.isArray(data)) setPunchStatusOptions(data);
            })
            .catch(() => { });
        return () => { mounted = false; };
    }, []);

    // ── Fetch routes ──
    useEffect(() => {
        if (!selectedWeek) return;
        let cancelled = false;
        setLoading(true);

        fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                if (!data.routes || data.routes.length === 0) { setAllRoutes([]); return; }

                const rows: RouteRow[] = data.routes.map((rec: any) => {
                    const emp = data.employees?.[rec.transporterId];
                    return {
                        _id: rec._id,
                        transporterId: rec.transporterId,
                        date: rec.date,
                        weekDay: rec.weekDay || "",
                        employeeName: emp?.name || rec.transporterId,
                        attendance: rec.attendance || "",
                        type: rec.type || "",
                        routeNumber: rec.routeNumber || "",
                        paycomInDay: rec.paycomInDay || "",
                        paycomOutLunch: rec.paycomOutLunch || "",
                        paycomInLunch: rec.paycomInLunch || "",
                        paycomOutDay: rec.paycomOutDay || "",
                        punchStatus: rec.punchStatus || "",
                        attendanceTime: rec.attendanceTime || "",
                        amazonOutLunch: rec.amazonOutLunch || "",
                        amazonInLunch: rec.amazonInLunch || "",
                        amazonAppLogout: rec.amazonAppLogout || "",
                        inspectionTime: rec.inspectionTime || "",
                        totalHours: rec.totalHours || "",
                        profileImage: emp?.profileImage || "",
                    };
                });
                setAllRoutes(rows);
            })
            .catch(() => setAllRoutes([]))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [selectedWeek, routesGenerated]);

    // ── Save handler ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: value } : r));
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { [field]: value } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);

    // ── Quick Edit Save Handler ──
    const handleQuickEditSave = async () => {
        if (!quickEditRow) return;
        const updates = { ...quickEditForm };
        const routeId = quickEditRow._id;

        // Optimistic update
        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, ...updates } : r));
        setQuickEditRow(null);

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Updated time entry for ${quickEditRow.employeeName}`);
        } catch {
            toast.error("Failed to update time entry");
        }
    };

    // ── Sort ──
    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    // ── Format date ──
    const formatDateColumn = (dateStr: string, weekDay: string) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const yy = String(d.getUTCFullYear()).slice(-2);
        const day = weekDay ? (SHORT_DAYS[weekDay] || weekDay.slice(0, 3)) : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
        return `${mm}/${dd}/${yy} ${day}`;
    };

    // ── Filter + sort ──
    const { rows: displayRows, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date?.split("T")[0] === selectedDate);
        const totalForDate = dateFiltered.length;

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(r =>
                r.employeeName.toLowerCase().includes(q) ||
                r.transporterId.toLowerCase().includes(q) ||
                r.routeNumber.toLowerCase().includes(q) ||
                r.attendance.toLowerCase().includes(q) ||
                r.punchStatus.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            const aVal = sortKey === "employee" ? a.employeeName : (a as any)[sortKey] || "";
            const bVal = sortKey === "employee" ? b.employeeName : (b as any)[sortKey] || "";
            return sortDir === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        return { rows: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats ──
    useEffect(() => { setStats({ employeeCount: totalFiltered }); }, [totalFiltered, setStats]);
    useEffect(() => { return () => setStats({}); }, [setStats]);

    // ── Loading / Empty ──
    if (routesLoading || loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!routesGenerated || allRoutes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-rose-500 to-pink-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-500">
                        <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Time</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {!routesGenerated
                        ? "No routes generated for this week yet. Click \"Generate Routes\" in the header to create route records from the schedule."
                        : "No route data available for this week."}
                </p>
                <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold", "bg-muted/50 border border-border text-muted-foreground")}>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Click &quot;Generate Routes&quot; to get started
                </div>
            </div>
        );
    }

    // ── Editable cell renderer ──
    const renderCell = (row: RouteRow, field: string, value: any) => {
        const isEditable = EDITABLE_FIELDS.has(field);
        const displayVal = value === 0 || value === "" ? "—" : String(value);

        const style = getCellFormat(row, field);
        const Icon = style?.icon;

        const isTimeField = field !== "routeNumber" && field !== "punchStatus";

        const handleTimeInputKeyDown = (val: string) => {
            return isTimeField ? parseSmartTime(val) : val;
        };

        if (globalEditMode && isEditable) {
            if (field === "punchStatus") {
                const opt = punchStatusOptions.find(o => o.description === value);
                const badgeColor = opt?.color || "bg-muted text-muted-foreground";
                const textColor = badgeColor.startsWith("bg-") && badgeColor !== "bg-muted" ? "text-white" : "";
                const IconComponent = opt?.icon ? (LucideIcons as any)[opt.icon] : null;

                return (
                    <div className="relative w-full h-7 mt-[-2px]">
                        <select
                            value={value || ""}
                            onChange={(e) => handleSave(row._id, field, e.target.value)}
                            className={cn(
                                "w-full h-full relative z-10 text-[11px] px-1 rounded border border-border/40 focus:border-primary focus:outline-none transition-all appearance-none shadow-sm cursor-pointer",
                                value && opt ? `${badgeColor} ${textColor} pl-6 font-semibold` : "bg-foreground/5"
                            )}
                            style={{ backgroundImage: 'none' }}
                        >
                            <option value=""></option>
                            {punchStatusOptions.map(o => <option key={o._id} value={o.description} className="bg-background text-foreground">{o.description}</option>)}
                        </select>
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-20">
                            {opt?.image ? (
                                <img src={opt.image} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0 ring-1 ring-white/20" />
                            ) : IconComponent ? (
                                <IconComponent className={cn("h-3.5 w-3.5", textColor)} />
                            ) : null}
                        </div>
                    </div>
                );
            }
            return (
                <div className="relative w-full h-7">
                    <input
                        defaultValue={value === 0 ? "" : String(value)}
                        onChange={(e) => {
                            if (isTimeField) {
                                e.target.value = e.target.value.replace(/[^\d:]/g, "");
                            }
                        }}
                        onBlur={(e) => {
                            let updatedVal = e.target.value;
                            if (isTimeField) updatedVal = handleTimeInputKeyDown(updatedVal);
                            e.target.value = updatedVal;

                            if (updatedVal !== String(value)) {
                                handleSave(row._id, field, updatedVal);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.currentTarget.blur();
                            }
                        }}
                        className={cn(
                            "w-full h-full text-xs px-1.5 rounded border border-border/40 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/30 shadow-inner",
                            style ? `${style.inputBg} ${style.text}` : "bg-foreground/5 focus:bg-background relative z-10",
                            Icon ? "pr-6" : ""
                        )}
                        placeholder="—"
                    />
                    {Icon && <Icon className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none", (style as any)?.iconColor || style?.text || "opacity-80")} />}
                </div>
            );
        }

        if (field === "punchStatus") {
            const opt = punchStatusOptions.find(o => o.description === displayVal);
            if (opt && displayVal !== "—") {
                const badgeColor = opt.color || "bg-muted";
                const textColor = badgeColor.startsWith("bg-") ? "text-white" : "text-foreground";
                const IconComponent = opt.icon ? (LucideIcons as any)[opt.icon] : null;
                return (
                    <div className={cn("inline-flex items-center gap-1.5 px-2 min-h-[22px] rounded text-[11px] font-semibold w-max", badgeColor, textColor)}>
                        {opt.image ? (
                            <img src={opt.image} alt={opt.description} className="h-4 w-4 rounded-full object-cover shrink-0 ring-1 ring-border/20" />
                        ) : IconComponent ? (
                            <IconComponent className="h-3.5 w-3.5 shrink-0" />
                        ) : null}
                        <span className="truncate leading-none">{opt.description}</span>
                    </div>
                );
            }
        }

        return (
            <div className={cn("flex items-center gap-1 w-full rounded px-1 min-h-[28px]", style && `${style.bg} ${style.text}`)}>
                {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", (style as any).iconColor || style.text || "opacity-80")} />}
                <span className={cn("text-[11px] truncate block w-full", !style && (displayVal === "—" ? "text-muted-foreground/40" : "text-foreground"))}>{displayVal}</span>
            </div>
        );
    };

    // ── Attendance dropdown (Read-Only) ──
    const renderAttendance = (row: RouteRow) => {
        const style = getAttendanceStyle(row.attendance);
        const Icon = style.icon;
        return (
            <div className={cn("relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold border select-none px-1.5", style.bg, style.text, style.border)}>
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{row.attendance || "—"}</span>
            </div>
        );
    };

    // ── Type pill (read-only) ──
    const renderType = (row: RouteRow) => {
        const typeStyle = getTypeStyle(row.type);
        const matched = TYPE_MAP.get((row.type || "").trim().toLowerCase());
        const CellIcon = matched?.icon;
        return (
            <div className={cn("relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold border select-none px-1.5", typeStyle.bg, typeStyle.text, typeStyle.border)}>
                {CellIcon && <CellIcon className="h-3 w-3 shrink-0" />}
                <span className="truncate">{row.type || <Minus className="h-3 w-3 opacity-40" />}</span>
            </div>
        );
    };

    // ── Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="grid items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-muted/30"
                        style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                        {COLUMNS.map((col) => (
                            <button key={col.key} onClick={() => handleSort(col.key)}
                                className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left">
                                {col.label}
                                {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                            </button>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-auto">
                        {displayRows.map((row) => (
                            <div key={row._id} className="grid items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors"
                                style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                                {/* Employee */}
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                    {row.profileImage ? (
                                        <img src={row.profileImage} alt={row.employeeName} className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-border" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                                            <span className="text-[9px] font-bold text-primary">{row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                                        </div>
                                    )}
                                    <span className="text-xs font-semibold truncate hover:text-primary transition-colors cursor-pointer" onClick={() => {
                                        setQuickEditRow(row);
                                        setQuickEditForm({ ...row });
                                    }}>{row.employeeName}</span>
                                </div>
                                {/* Attendance */}
                                {renderAttendance(row)}
                                {/* Type */}
                                {renderType(row)}
                                {/* Route # */}
                                {renderCell(row, "routeNumber", row.routeNumber)}
                                {/* Paycom In Day */}
                                {renderCell(row, "paycomInDay", row.paycomInDay)}
                                {/* Paycom Out Lunch */}
                                {renderCell(row, "paycomOutLunch", row.paycomOutLunch)}
                                {/* Paycom In Lunch */}
                                {renderCell(row, "paycomInLunch", row.paycomInLunch)}
                                {/* Paycom Out Day */}
                                {renderCell(row, "paycomOutDay", row.paycomOutDay)}
                                {/* Punch Status */}
                                {renderCell(row, "punchStatus", row.punchStatus)}
                                {/* Attendance Time */}
                                {renderCell(row, "attendanceTime", row.attendanceTime)}
                                {/* Amazon Out Lunch */}
                                {renderCell(row, "amazonOutLunch", row.amazonOutLunch)}
                                {/* Amazon In Lunch */}
                                {renderCell(row, "amazonInLunch", row.amazonInLunch)}
                                {/* Amazon App Logout */}
                                {renderCell(row, "amazonAppLogout", row.amazonAppLogout)}
                                {/* Inspection Time */}
                                {renderCell(row, "inspectionTime", row.inspectionTime)}
                                {/* Total Hours */}
                                {renderCell(row, "totalHours", row.totalHours)}
                                {/* Actions */}
                                <div className="flex justify-end pr-1">
                                    <button
                                        onClick={() => {
                                            setQuickEditRow(row);
                                            setQuickEditForm({ ...row });
                                        }}
                                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {displayRows.length === 0 && (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                No employees found for this date
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-2.5 border-t border-border/50 bg-muted/20">
                        <span className="text-[11px] text-muted-foreground">{totalFiltered} of {totalForDate} employees</span>
                    </div>
                </div>

                {/* ── Quick Edit Sheet ── */}
                <Sheet open={!!quickEditRow} onOpenChange={(open) => !open && setQuickEditRow(null)}>
                    <SheetContent side="right" className="w-full sm:w-[450px] border-l border-border bg-background p-0 flex flex-col shadow-2xl">
                        <SheetHeader className="px-6 py-5 border-b border-border bg-muted/20">
                            <SheetTitle className="text-lg font-bold flex items-center gap-3">
                                {quickEditRow?.profileImage ? (
                                    <img src={quickEditRow.profileImage} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                                        <span className="text-sm font-bold text-primary">{quickEditRow?.employeeName?.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                                    </div>
                                )}
                                <div>
                                    <div className="text-foreground">{quickEditRow?.employeeName}</div>
                                    <div className="text-xs text-muted-foreground font-medium mt-0.5">Quick Edit Time Entries</div>
                                </div>
                            </SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-x-5 gap-y-6">
                                <div className="col-span-2 space-y-1.5 border-b border-border/50 pb-5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Punch Status</label>
                                    <select
                                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={quickEditForm.punchStatus || ""}
                                        onChange={e => setQuickEditForm(prev => ({ ...prev, punchStatus: e.target.value }))}
                                    >
                                        <option value="">Select Status...</option>
                                        {punchStatusOptions.map(opt => (
                                            <option key={opt._id} value={opt.description}>{opt.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">Attendance Time</label>
                                    <Input
                                        value={quickEditForm.attendanceTime || ""}
                                        onChange={e => setQuickEditForm(prev => ({ ...prev, attendanceTime: e.target.value.replace(/[^\d:]/g, "") }))}
                                        onBlur={() => setQuickEditForm(prev => ({ ...prev, attendanceTime: parseSmartTime(prev.attendanceTime || "") }))}
                                        className="h-9 shadow-sm" placeholder="—"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">Inspection Time</label>
                                    <Input
                                        value={quickEditForm.inspectionTime || ""}
                                        onChange={e => setQuickEditForm(prev => ({ ...prev, inspectionTime: e.target.value.replace(/[^\d:]/g, "") }))}
                                        onBlur={() => setQuickEditForm(prev => ({ ...prev, inspectionTime: parseSmartTime(prev.inspectionTime || "") }))}
                                        className="h-9 shadow-sm" placeholder="—"
                                    />
                                </div>

                                <div className="col-span-2 mt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Paycom Data</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">In Day</label>
                                            <Input
                                                value={quickEditForm.paycomInDay || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomInDay: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, paycomInDay: parseSmartTime(prev.paycomInDay || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Out Lunch</label>
                                            <Input
                                                value={quickEditForm.paycomOutLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomOutLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, paycomOutLunch: parseSmartTime(prev.paycomOutLunch || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">In Lunch</label>
                                            <Input
                                                value={quickEditForm.paycomInLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomInLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, paycomInLunch: parseSmartTime(prev.paycomInLunch || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Out Day</label>
                                            <Input
                                                value={quickEditForm.paycomOutDay || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, paycomOutDay: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, paycomOutDay: parseSmartTime(prev.paycomOutDay || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 mt-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-3">Amazon Data</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">In Lunch</label>
                                            <Input
                                                value={quickEditForm.amazonInLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, amazonInLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, amazonInLunch: parseSmartTime(prev.amazonInLunch || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Out Lunch</label>
                                            <Input
                                                value={quickEditForm.amazonOutLunch || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, amazonOutLunch: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, amazonOutLunch: parseSmartTime(prev.amazonOutLunch || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground">App Logout</label>
                                            <Input
                                                value={quickEditForm.amazonAppLogout || ""}
                                                onChange={e => setQuickEditForm(prev => ({ ...prev, amazonAppLogout: e.target.value.replace(/[^\d:]/g, "") }))}
                                                onBlur={() => setQuickEditForm(prev => ({ ...prev, amazonAppLogout: parseSmartTime(prev.amazonAppLogout || "") }))}
                                                className="h-9 shadow-sm" placeholder="—"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => setQuickEditRow(null)}>Cancel</Button>
                            <Button size="sm" onClick={handleQuickEditSave} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
                                Save Changes
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </TooltipProvider>
    );
}
