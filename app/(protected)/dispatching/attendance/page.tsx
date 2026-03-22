"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDispatching } from "../layout";
import { useDataStore } from "@/hooks/use-data-store";
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

/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

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

const GRID_TEMPLATE = "minmax(150px, 250px) 100px 110px 80px 70px 80px 85px 60px 85px 85px 75px";

// ── Editable fields ──
const EDITABLE_FIELDS = new Set([
    "attendanceTime"
]);

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
    profileImage?: string;
}

type SortKey = typeof COLUMNS[number]["key"];

export default function AttendancePage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // ── Inline editing state (for Done table) ──
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");

    // ── Hydrate from layout's shared rawRouteData (no independent fetch) ──
    const { rawRouteData, rawRouteDataLoading } = useDispatching();

    useEffect(() => {
        if (rawRouteDataLoading) { setLoading(true); return; }
        if (!rawRouteData || !rawRouteData.routes || rawRouteData.routes.length === 0) {
            setAllRoutes([]);
            setLoading(false);
            return;
        }
        const rows: RouteRow[] = rawRouteData.routes.map((rec: any) => {
            const emp = rawRouteData.employees?.[rec.transporterId];
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
                profileImage: emp?.profileImage || "",
            };
        });
        setAllRoutes(rows);
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading]);

    // ── Handle inline edit save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
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
            if (!res.ok) throw new Error("Failed to update");
            toast.success(`Updated ${field}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);

    // ── Quick Mark Present/Absent (from Pending Card) ──
    const handleMarkPresent = async (row: RouteRow) => {
        const timeStr = new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', hour12: false });

        // Optimistic
        setAllRoutes(prev => prev.map(r =>
            r._id === row._id
                ? { ...r, attendance: "Present", attendanceTime: timeStr }
                : r
        ));

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId: row._id,
                    updates: { attendance: "Present", attendanceTime: timeStr },
                }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Marked ${row.employeeName} present`);
        } catch {
            toast.error(`Failed to mark present`);
        }
    };

    const handleMarkAbsent = async (row: RouteRow, e: React.MouseEvent) => {
        e.stopPropagation();
        const timeStr = new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', hour12: false });

        // Optimistic
        setAllRoutes(prev => prev.map(r =>
            r._id === row._id
                ? { ...r, attendance: "Absent", attendanceTime: timeStr }
                : r
        ));

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId: row._id,
                    updates: { attendance: "Absent", attendanceTime: timeStr },
                }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Marked ${row.employeeName} absent`);
        } catch {
            toast.error(`Failed to mark absent`);
        }
    };

    // ── Sort handler ──
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    // ── Filter + sort ──
    const { pendingRows, doneRows, totalFiltered } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) {
            dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        }

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

        const sorted = [...filtered].sort((a, b) => {
            let aVal = (a as any)[sortKey] || "";
            let bVal = (b as any)[sortKey] || "";
            if (sortKey === "employee") { aVal = a.employeeName; bVal = b.employeeName; }

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDir === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDir === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        // Split into pending and done
        const pending = sorted.filter(r => !r.attendance || r.attendance.trim() === "");
        const done = sorted.filter(r => r.attendance && r.attendance.trim() !== "");

        return { pendingRows: pending, doneRows: done, totalFiltered: sorted.length };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered });
        return () => setStats({});
    }, [totalFiltered, setStats]);

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
            </div>
        );
    }

    // ── Helper: render editable cell (for Done table) ──
    const renderCell = (row: RouteRow, field: string, value: any) => {
        const isEditing = editingCell?.rowId === row._id && editingCell?.field === field;
        const isEditable = EDITABLE_FIELDS.has(field);
        const raw = value === 0 || value === "" ? "—" : String(value);
        const displayVal = raw === "—" ? raw : raw.replace(/:\d{2}$/, "");

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
                    <button onClick={() => handleSave(row._id, field, editValue)} className="text-emerald-500 hover:text-emerald-400 shrink-0">
                        <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingCell(null)} className="text-muted-foreground hover:text-foreground shrink-0">
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
                    className="group/cell flex items-center gap-1 text-left w-full focus:outline-none"
                >
                    <span className={cn(
                        "text-[11px] truncate font-semibold",
                        displayVal === "—" ? "text-muted-foreground/30" : "text-foreground"
                    )}>
                        {displayVal}
                    </span>
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
                </button>
            );
        }

        return (
            <span className={cn(
                "text-[11px] truncate font-semibold",
                displayVal === "—" ? "text-muted-foreground/30" : "text-foreground"
            )}>
                {displayVal}
            </span>
        );
    };

    // ── Attendance dropdown (for Done table) ──
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
                <DropdownMenuContent align="start" side="bottom" className="w-44 z-[60]">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Set Attendance
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ATTENDANCE_OPTIONS.map(opt => {
                        const OptIcon = opt.icon;
                        const isActive = (row.attendance || "").toLowerCase() === opt.label.toLowerCase();
                        return (
                            <DropdownMenuItem
                                key={opt.label || "clear"}
                                className={cn("flex items-center gap-2 cursor-pointer text-xs", isActive && "bg-accent")}
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

    // ── Render ──
    return (
        <TooltipProvider delayDuration={200}>
            {/* Split View Container: Stack on mobile, side-by-side on lg screens */}
            <div className="flex flex-col lg:flex-row h-full gap-4">

                {/* ── LEFT: Attendance Pending ── */}
                <div className="flex-none lg:w-[320px] xl:w-[380px] h-[45vh] lg:h-full flex flex-col rounded-xl border border-border/50 bg-card overflow-hidden shadow-lg shrink-0">
                    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <h2 className="text-sm font-bold tracking-tight">Attendance Pending</h2>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full ring-1 ring-amber-500/30">
                            {pendingRows.length}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {pendingRows.map(row => {
                            const initials = row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2);
                            return (
                                <div
                                    key={row._id}
                                    onClick={() => handleMarkPresent(row)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleMarkPresent(row); }}
                                    className="w-full text-left p-3 rounded-xl border border-border/40 bg-zinc-500/5 hover:bg-zinc-500/10 hover:border-primary/40 transition-all flex items-center gap-3 group relative overflow-hidden cursor-pointer"
                                >
                                    {/* Hover sweep effect */}
                                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />

                                    {/* Avatar */}
                                    {row.profileImage ? (
                                        <img
                                            src={row.profileImage}
                                            alt={row.employeeName}
                                            className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-border group-hover:ring-primary/40 transition-all"
                                        />
                                    ) : (
                                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                                            <span className="text-[11px] font-bold text-primary">{initials}</span>
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 pr-6">
                                        <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors flex items-center gap-1.5"
                                            style={row.type.toLowerCase() === "training otr" || row.type.toLowerCase() === "trainer" ? { color: "#FE9EC7" } : undefined}
                                        >
                                            {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "#FE9EC7" }} />}
                                            {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "#FE9EC7" }} />}
                                            {row.employeeName}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-[10px] font-medium text-muted-foreground/80">
                                            {row.type && <span className="truncate">{row.type}</span>}
                                            {row.routeNumber && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span className="text-foreground/70">{row.routeNumber}</span>
                                                </>
                                            )}
                                            {row.van && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span>Van <span className="text-foreground/70">{row.van}</span></span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleMarkAbsent(row, e)}
                                            className="px-2.5 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 font-bold text-[10px] uppercase tracking-wider transition-colors z-10"
                                        >
                                            Absent
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {pendingRows.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground opacity-70">
                                <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500/50" />
                                <p className="text-sm font-medium">All employees checked in!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Attendance Done ── */}
                <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-border/50 bg-card overflow-hidden shadow-lg h-[45vh] lg:h-full">
                    <div className="shrink-0 flex items-center justify-between px-3 py-3 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <h2 className="text-sm font-bold tracking-tight">Attendance Done</h2>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-500 px-2.5 py-1 rounded-full ring-1 ring-emerald-500/30">
                            {doneRows.length}
                        </span>
                    </div>

                    {/* Table Header + Rows */}
                    <div className="flex-1 overflow-auto">
                        <div style={{ minWidth: 800 }}>
                        <div className="grid items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted sticky top-0 z-20"
                            style={{ gridTemplateColumns: GRID_TEMPLATE }}
                        >
                            {COLUMNS.map((col, i) => (
                                <button
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className={cn(
                                        "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left",
                                        i === 0 && "sticky left-0 z-20 bg-muted"
                                    )}
                                >
                                    {col.label}
                                    {sortKey === col.key && (
                                        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                    )}
                                </button>
                            ))}
                        </div>

                    {/* Table Rows */}
                    <div>
                            {doneRows.map((row) => (
                                <div
                                    key={row._id}
                                    className="grid items-center gap-2 px-3 py-1.5 border-b border-border/20 hover:bg-muted/30 transition-colors group/row"
                                    style={{ gridTemplateColumns: GRID_TEMPLATE }}
                                >
                                    {/* Employee (sticky) */}
                                    <div className="flex items-center gap-2 min-w-0 sticky left-0 z-10 bg-card group-hover/row:bg-muted/30 transition-colors">
                                        {row.profileImage ? (
                                            <img src={row.profileImage} alt={row.employeeName} className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-border" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                                                <span className="text-[7px] font-bold text-primary">
                                                    {row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                                </span>
                                            </div>
                                        )}
                                        {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3 w-3 shrink-0" style={{ color: "#FE9EC7" }} />}
                                        {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3 w-3 shrink-0" style={{ color: "#FE9EC7" }} />}
                                        <span
                                            className="text-[11px] font-bold truncate"
                                            style={row.type.toLowerCase() === "training otr" || row.type.toLowerCase() === "trainer" ? { color: "#FE9EC7" } : undefined}
                                        >
                                            {row.employeeName}
                                        </span>
                                    </div>

                                    {/* Attendance */}
                                    {renderAttendance(row)}

                                    {/* Type */}
                                    <div className={cn(
                                        "relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold border select-none px-1.5",
                                        getTypeStyle(row.type).bg, getTypeStyle(row.type).text, getTypeStyle(row.type).border
                                    )}>
                                        {TYPE_MAP.get((row.type || "").trim().toLowerCase())?.icon &&
                                            (() => { const Icon = TYPE_MAP.get((row.type || "").trim().toLowerCase())!.icon; return <Icon className="h-3 w-3 shrink-0" />; })()
                                        }
                                        <span className="truncate">{row.type || <Minus className="h-3 w-3 opacity-40" />}</span>
                                    </div>

                                    {/* Editables */}
                                    {renderCell(row, "routeNumber", row.routeNumber)}
                                    {renderCell(row, "van", row.van)}
                                    {renderCell(row, "routeDuration", row.routeDuration)}
                                    {renderCell(row, "waveTime", row.waveTime)}
                                    {renderCell(row, "pad", row.pad)}
                                    {renderCell(row, "stagingLocation", row.stagingLocation)}
                                    {renderCell(row, "attendanceTime", row.attendanceTime)}

                                    {/* Dashcam */}
                                    <span className="text-[11px] font-semibold text-foreground truncate">{row.dashcam || "—"}</span>
                                </div>
                            ))}

                            {doneRows.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground opacity-60">
                                    <Coffee className="h-8 w-8 mb-2 opacity-50" />
                                    No completed attendance yet
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                </div>

            </div>
        </TooltipProvider>
    );
}
