"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
    Users,
    Loader2,
    ChevronUp,
    ChevronDown,
    UserCheck,
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
    BookOpen,
    Ban,
    ShieldAlert,
    Clock,
    type LucideIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ── Type Options (reused from roster for colored pills) ──
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
    if (!value || value.trim() === "") {
        return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" };
    }
    const opt = TYPE_MAP.get(value.trim().toLowerCase());
    if (opt) return { bg: opt.bg, text: opt.text, border: opt.border };
    return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
};

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", width: "flex-1 min-w-[150px]" },
    { key: "attendance", label: "Attendance", width: "w-[100px]" },
    { key: "type", label: "Type", width: "w-[110px]" },
    { key: "routeNumber", label: "Route #", width: "w-[80px]" },
    { key: "van", label: "Van", width: "w-[70px]" },
    { key: "routeDuration", label: "Duration", width: "w-[80px]" },
    { key: "waveTime", label: "Wave Time", width: "w-[85px]" },
    { key: "pad", label: "PAD", width: "w-[60px]" },
    { key: "stagingLocation", label: "Staging", width: "w-[85px]" },
    { key: "attendanceTime", label: "Att. Time", width: "w-[85px]" },
    { key: "dashcam", label: "Dashcam", width: "w-[75px]" },
] as const;

const GRID_TEMPLATE = "1fr 100px 110px 80px 70px 80px 85px 60px 85px 85px 75px";

// ── Editable fields ──
const EDITABLE_FIELDS = new Set([
    "routeNumber", "van", "routeDuration",
    "waveTime", "pad", "stagingLocation", "attendanceTime", "dashcam",
]);

// ── Attendance Options ──
const ATTENDANCE_OPTIONS = [
    { label: "Present", icon: CheckCircle2, bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", iconColor: "text-emerald-500" },
    { label: "Absent", icon: XCircle, bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", iconColor: "text-red-400" },
    { label: "", icon: CircleDashed, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", iconColor: "text-zinc-400", displayLabel: "Clear" },
];

const getAttendanceStyle = (value: string) => {
    const v = value.trim().toLowerCase();
    if (v === "present") return ATTENDANCE_OPTIONS[0];
    if (v === "absent") return ATTENDANCE_OPTIONS[1];
    return ATTENDANCE_OPTIONS[2];
};

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
    van: string;
    routeDuration: string;
    waveTime: string;
    pad: string;
    stagingLocation: string;
    attendanceTime: string;
    dashcam: string;
}

type SortKey = typeof COLUMNS[number]["key"];

export default function AttendancePage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // ── Inline editing state ──
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");

    // ── Fetch routes for the week ──
    useEffect(() => {
        if (!selectedWeek) return;
        let cancelled = false;
        setLoading(true);

        fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                if (!data.routes || data.routes.length === 0) {
                    setAllRoutes([]);
                    return;
                }

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
                        van: rec.van || "",
                        routeDuration: rec.routeDuration || "",
                        waveTime: rec.waveTime || "",
                        pad: rec.pad || "",
                        stagingLocation: rec.stagingLocation || "",
                        attendanceTime: rec.attendanceTime || "",
                        dashcam: rec.dashcam || "",
                    };
                });

                setAllRoutes(rows);
            })
            .catch(() => setAllRoutes([]))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [selectedWeek, routesGenerated]);

    // ── Handle inline edit save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        // Optimistic update
        setAllRoutes(prev => prev.map(r =>
            r._id === routeId ? { ...r, [field]: value } : r
        ));
        setEditingCell(null);

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId,
                    updates: { [field]: value },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);

    // ── Sort handler ──
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    // ── Format date column ──
    const formatDateColumn = (dateStr: string, weekDay: string) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const yy = String(d.getUTCFullYear()).slice(-2);
        const day = weekDay
            ? (SHORT_DAYS[weekDay] || weekDay.slice(0, 3))
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
        return `${mm}/${dd}/${yy} ${day}`;
    };

    // ── Filter + sort ──
    const { rows: displayRows, totalFiltered, totalForDate } = useMemo(() => {
        // 1. Filter by selected date
        let dateFiltered = allRoutes;
        if (selectedDate) {
            dateFiltered = allRoutes.filter(r => r.date?.split("T")[0] === selectedDate);
        }
        const totalForDate = dateFiltered.length;

        // 2. Search filter
        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(
                (r) =>
                    r.employeeName.toLowerCase().includes(q) ||
                    r.transporterId.toLowerCase().includes(q) ||
                    r.routeNumber.toLowerCase().includes(q) ||
                    r.attendance.toLowerCase().includes(q) ||
                    r.van.toLowerCase().includes(q)
            );
        }

        // 3. Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "employee":
                    aVal = a.employeeName; bVal = b.employeeName; break;
                default:
                    aVal = (a as any)[sortKey] || ""; bVal = (b as any)[sortKey] || ""; break;
            }
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDir === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDir === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        return { rows: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered });
    }, [totalFiltered, setStats]);

    // ── Clear stats on unmount ──
    useEffect(() => {
        return () => setStats({});
    }, [setStats]);

    // ── Loading / Empty states ──
    if (routesLoading || loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!routesGenerated || allRoutes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-violet-500 to-purple-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-500">
                        <UserCheck className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Attendance</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {!routesGenerated
                        ? "No routes generated for this week yet. Click \"Generate Routes\" in the header to create route records from the schedule."
                        : "No route data available for this week."}
                </p>
                <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold",
                    "bg-muted/50 border border-border text-muted-foreground"
                )}>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Click &quot;Generate Routes&quot; to get started
                </div>
            </div>
        );
    }

    // ── Helper: render editable cell ──
    const renderCell = (row: RouteRow, field: string, value: any) => {
        const isEditing = editingCell?.rowId === row._id && editingCell?.field === field;
        const isEditable = EDITABLE_FIELDS.has(field);
        const displayVal = value === 0 || value === "" ? "—" : String(value);

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave(row._id, field, editValue);
                            if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-6 text-xs px-1.5 w-full"
                    />
                    <button
                        onClick={() => handleSave(row._id, field, editValue)}
                        className="text-emerald-500 hover:text-emerald-400 shrink-0"
                    >
                        <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setEditingCell(null)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            );
        }

        if (isEditable) {
            return (
                <button
                    onClick={() => {
                        setEditingCell({ rowId: row._id, field });
                        setEditValue(value === 0 ? "" : String(value));
                    }}
                    className="group/cell flex items-center gap-1 text-left w-full"
                >
                    <span className={cn(
                        "text-[11px] truncate",
                        displayVal === "—" ? "text-muted-foreground/40" : "text-foreground"
                    )}>
                        {displayVal}
                    </span>
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
                </button>
            );
        }

        return (
            <span className={cn(
                "text-[11px] truncate",
                displayVal === "—" ? "text-muted-foreground/40" : "text-foreground"
            )}>
                {displayVal}
            </span>
        );
    };

    // ── Attendance dropdown ──
    const renderAttendance = (row: RouteRow) => {
        const style = getAttendanceStyle(row.attendance);
        const Icon = style.icon;

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className={cn(
                            "relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold transition-all border cursor-pointer select-none px-1.5",
                            style.bg, style.text, style.border,
                            "hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{row.attendance || "—"}</span>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-44">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Set Attendance
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ATTENDANCE_OPTIONS.map(opt => {
                        const OptIcon = opt.icon;
                        const isActive = row.attendance.toLowerCase() === opt.label.toLowerCase();
                        return (
                            <DropdownMenuItem
                                key={opt.label || "clear"}
                                className={cn(
                                    "flex items-center gap-2 cursor-pointer text-xs",
                                    isActive && "bg-accent"
                                )}
                                onClick={() => handleSave(row._id, "attendance", opt.label)}
                            >
                                <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", opt.bg)}>
                                    <OptIcon className={cn("h-3 w-3", opt.iconColor)} />
                                </div>
                                <span className="font-medium">{opt.displayLabel || opt.label}</span>
                                {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    // ── Type pill (read-only, same style as roster) ──
    const renderType = (row: RouteRow) => {
        const typeStyle = getTypeStyle(row.type);
        const matched = TYPE_MAP.get((row.type || "").trim().toLowerCase());
        const CellIcon = matched?.icon;

        return (
            <div className={cn(
                "relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold border select-none px-1.5",
                typeStyle.bg, typeStyle.text, typeStyle.border
            )}>
                {CellIcon && <CellIcon className="h-3 w-3 shrink-0" />}
                <span className="truncate">{row.type || <Minus className="h-3 w-3 opacity-40" />}</span>
            </div>
        );
    };

    // ── Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full">
                {/* Table */}
                <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="grid items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-muted/30"
                        style={{ gridTemplateColumns: GRID_TEMPLATE }}
                    >
                        {COLUMNS.map((col) => (
                            <button
                                key={col.key}
                                onClick={() => handleSort(col.key)}
                                className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left"
                            >
                                {col.label}
                                {sortKey === col.key && (
                                    sortDir === "asc"
                                        ? <ChevronUp className="h-3 w-3" />
                                        : <ChevronDown className="h-3 w-3" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-auto">
                        {displayRows.map((row) => (
                            <div
                                key={row._id}
                                className="grid items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors"
                                style={{ gridTemplateColumns: GRID_TEMPLATE }}
                            >
                                {/* Employee */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-semibold truncate">
                                        {row.employeeName}
                                    </span>
                                </div>

                                {/* Attendance */}
                                {renderAttendance(row)}

                                {/* Type */}
                                {renderType(row)}

                                {/* Route # */}
                                {renderCell(row, "routeNumber", row.routeNumber)}

                                {/* Van */}
                                {renderCell(row, "van", row.van)}

                                {/* Duration */}
                                {renderCell(row, "routeDuration", row.routeDuration)}

                                {/* Wave Time */}
                                {renderCell(row, "waveTime", row.waveTime)}

                                {/* PAD */}
                                {renderCell(row, "pad", row.pad)}

                                {/* Staging Location */}
                                {renderCell(row, "stagingLocation", row.stagingLocation)}

                                {/* Attendance Time */}
                                {renderCell(row, "attendanceTime", row.attendanceTime)}

                                {/* Dashcam */}
                                {renderCell(row, "dashcam", row.dashcam)}
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
                        <span className="text-[11px] text-muted-foreground">
                            {totalFiltered} of {totalForDate} employees
                        </span>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
