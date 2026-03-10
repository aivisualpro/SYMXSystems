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
    TrendingUp,
    AlertCircle,
    type LucideIcon,
} from "lucide-react";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
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

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", width: "flex-1 min-w-[130px]" },
    { key: "type", label: "Type", width: "w-[95px]" },
    { key: "routeNumber", label: "Route #", width: "w-[70px]" },
    { key: "stopCount", label: "Stops", width: "w-[55px]" },
    { key: "routeDuration", label: "Duration", width: "w-[65px]" },
    { key: "waveTime", label: "Wave", width: "w-[60px]" },
    { key: "actualDepartureTime", label: "Act Dep", width: "w-[60px]" },
    { key: "departureDelay", label: "Dep Delay", width: "w-[65px]" },
    { key: "plannedOutboundStem", label: "Pln OB", width: "w-[55px]" },
    { key: "actualOutboundStem", label: "Act OB", width: "w-[55px]" },
    { key: "outboundDelay", label: "OB Delay", width: "w-[60px]" },
    { key: "plannedFirstStop", label: "Pln 1st", width: "w-[55px]" },
    { key: "actualFirstStop", label: "Act 1st", width: "w-[55px]" },
    { key: "firstStopDelay", label: "1st Delay", width: "w-[60px]" },
    { key: "plannedLastStop", label: "Pln Last", width: "w-[60px]" },
    { key: "actualLastStop", label: "Act Last", width: "w-[60px]" },
    { key: "lastStopDelay", label: "Last Delay", width: "w-[65px]" },
    { key: "plannedRTSTime", label: "Pln RTS", width: "w-[60px]" },
    { key: "estimatedRTSTime", label: "Est RTS", width: "w-[60px]" },
    { key: "plannedInboundStem", label: "Pln IB", width: "w-[55px]" },
    { key: "plannedDuration1stToLast", label: "Pln 1-L", width: "w-[55px]" },
    { key: "actualDuration1stToLast", label: "Act 1-L", width: "w-[55px]" },
    { key: "stopsPerHour", label: "Stp/Hr", width: "w-[50px]" },
    { key: "deliveryCompletionTime", label: "DCT", width: "w-[60px]" },
    { key: "dctDelay", label: "DCT Delay", width: "w-[65px]" },
    { key: "stopsRescued", label: "Rescued", width: "w-[60px]" },
    { key: "driverEfficiency", label: "Eff %", width: "w-[55px]" },
] as const;

const GRID_TEMPLATE = "1fr 95px 70px 55px 65px 60px 60px 65px 55px 55px 60px 55px 55px 60px 60px 60px 65px 60px 60px 55px 55px 55px 50px 60px 65px 60px 55px";

// ── Editable fields ──
const EDITABLE_FIELDS = new Set([
    "routeNumber", "stopCount", "routeDuration", "waveTime",
    "actualDepartureTime", "departureDelay",
    "plannedOutboundStem", "actualOutboundStem", "outboundDelay",
    "plannedFirstStop", "actualFirstStop", "firstStopDelay",
    "plannedLastStop", "actualLastStop", "lastStopDelay",
    "plannedRTSTime", "estimatedRTSTime", "plannedInboundStem",
    "plannedDuration1stToLast", "actualDuration1stToLast",
    "stopsPerHour", "deliveryCompletionTime", "dctDelay", "stopsRescued", "driverEfficiency",
]);

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
    type: string;
    routeNumber: string;
    stopCount: number;
    routeDuration: string;
    waveTime: string;
    actualDepartureTime: string;
    departureDelay: string;
    plannedOutboundStem: string;
    actualOutboundStem: string;
    outboundDelay: string;
    plannedFirstStop: string;
    actualFirstStop: string;
    firstStopDelay: string;
    plannedLastStop: string;
    actualLastStop: string;
    lastStopDelay: string;
    plannedRTSTime: string;
    estimatedRTSTime: string;
    plannedInboundStem: string;
    plannedDuration1stToLast: string;
    actualDuration1stToLast: string;
    stopsPerHour: number;
    deliveryCompletionTime: string;
    dctDelay: string;
    stopsRescued: number;
    driverEfficiency: number;
}

type SortKey = typeof COLUMNS[number]["key"];

export default function EfficiencyPage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");

    // ── Fetch routes ──
    useEffect(() => {
        if (!selectedWeek) return;
        let cancelled = false;
        setLoading(true);

        fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}`)
            .then(r => r.json())
            .then(data => {
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
                        type: rec.type || "",
                        routeNumber: rec.routeNumber || "",
                        stopCount: rec.stopCount || 0,
                        routeDuration: rec.routeDuration || "",
                        waveTime: rec.waveTime || "",
                        actualDepartureTime: rec.actualDepartureTime || "",
                        departureDelay: rec.departureDelay || "",
                        plannedOutboundStem: rec.plannedOutboundStem || "",
                        actualOutboundStem: rec.actualOutboundStem || "",
                        outboundDelay: rec.outboundDelay || "",
                        plannedFirstStop: rec.plannedFirstStop || "",
                        actualFirstStop: rec.actualFirstStop || "",
                        firstStopDelay: rec.firstStopDelay || "",
                        plannedLastStop: rec.plannedLastStop || "",
                        actualLastStop: rec.actualLastStop || "",
                        lastStopDelay: rec.lastStopDelay || "",
                        plannedRTSTime: rec.plannedRTSTime || "",
                        estimatedRTSTime: rec.estimatedRTSTime || "",
                        plannedInboundStem: rec.plannedInboundStem || "",
                        plannedDuration1stToLast: rec.plannedDuration1stToLast || "",
                        actualDuration1stToLast: rec.actualDuration1stToLast || "",
                        stopsPerHour: rec.stopsPerHour || 0,
                        deliveryCompletionTime: rec.deliveryCompletionTime || "",
                        dctDelay: rec.dctDelay || "",
                        stopsRescued: rec.stopsRescued || 0,
                        driverEfficiency: rec.driverEfficiency || 0,
                    };
                });
                setAllRoutes(rows);
            })
            .catch(() => setAllRoutes([]))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [selectedWeek, routesGenerated]);

    // ── Save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        const numericFields = new Set(["stopCount", "stopsPerHour", "stopsRescued", "driverEfficiency"]);
        const parsedValue = numericFields.has(field) ? (parseFloat(value) || 0) : value;

        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: parsedValue } : r));
        setEditingCell(null);
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { [field]: parsedValue } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

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
                r.routeNumber.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "employee": aVal = a.employeeName; bVal = b.employeeName; break;
                case "stopCount": aVal = a.stopCount; bVal = b.stopCount; break;
                case "stopsPerHour": aVal = a.stopsPerHour; bVal = b.stopsPerHour; break;
                case "stopsRescued": aVal = a.stopsRescued; bVal = b.stopsRescued; break;
                case "driverEfficiency": aVal = a.driverEfficiency; bVal = b.driverEfficiency; break;
                default: aVal = (a as any)[sortKey] || ""; bVal = (b as any)[sortKey] || ""; break;
            }
            if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
            return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        });

        return { rows: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Stats ──
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
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-teal-500 to-emerald-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-500">
                        <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Efficiency</h2>
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

    // ── Cell renderer ──
    const renderCell = (row: RouteRow, field: string, value: any) => {
        const isEditing = editingCell?.rowId === row._id && editingCell?.field === field;
        const isEditable = EDITABLE_FIELDS.has(field);
        const displayVal = value === 0 || value === "" ? "—" : String(value);

        let customBg = "text-foreground";
        let Icon = null;
        if (displayVal === "—") {
            customBg = "text-muted-foreground/40";
        } else {
            if (field === "lastStopDelay") {
                const parts = String(value).split(":");
                if (parts.length >= 2) {
                    const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    if (mins >= 105) { // 105 mins = "001:45"
                        customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm";
                        Icon = AlertCircle;
                    }
                }
            } else if (field === "actualDepartureTime") {
                const actDepParts = String(value).split(":");
                const waveParts = String(row.waveTime || "").split(":");
                if (actDepParts.length >= 2 && waveParts.length >= 2) {
                    const actMins = parseInt(actDepParts[0], 10) * 60 + parseInt(actDepParts[1], 10);
                    const waveMins = parseInt(waveParts[0], 10) * 60 + parseInt(waveParts[1], 10);
                    if (actMins >= waveMins + 80) { // 80 mins = "001:20"
                        customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm";
                        Icon = AlertCircle;
                    }
                }
            } else if (field === "dctDelay") {
                const parts = String(value).split(":");
                if (parts.length >= 2) {
                    const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    if (mins >= 5) { // 5 mins = "000:05"
                        customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm";
                        Icon = AlertCircle;
                    }
                }
            }
        }

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(row._id, field, editValue); if (e.key === "Escape") setEditingCell(null); }}
                        className="h-6 text-xs px-1.5 w-full" />
                    <button onClick={() => handleSave(row._id, field, editValue)} className="text-emerald-500 hover:text-emerald-400 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingCell(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                </div>
            );
        }

        const CellContent = Icon ? (
            <div className={cn("flex items-center gap-1 w-max", customBg)}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] truncate">{displayVal}</span>
            </div>
        ) : (
            <span className={cn("text-[11px] truncate", customBg)}>{displayVal}</span>
        );

        if (isEditable) {
            return (
                <button onClick={() => { setEditingCell({ rowId: row._id, field }); setEditValue(value === 0 ? "" : String(value)); }}
                    className="group/cell flex items-center gap-1 text-left w-full">
                    {CellContent}
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
                </button>
            );
        }

        return CellContent;
    };

    // ── Type pill ──
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

    // ── Efficiency cell with color ──
    const renderEfficiency = (row: RouteRow) => {
        const val = row.driverEfficiency;
        const isEditing = editingCell?.rowId === row._id && editingCell?.field === "driverEfficiency";

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(row._id, "driverEfficiency", editValue); if (e.key === "Escape") setEditingCell(null); }}
                        className="h-6 text-xs px-1.5 w-full" />
                    <button onClick={() => handleSave(row._id, "driverEfficiency", editValue)} className="text-emerald-500 hover:text-emerald-400 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingCell(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                </div>
            );
        }

        if (val === 0) {
            return (
                <button onClick={() => { setEditingCell({ rowId: row._id, field: "driverEfficiency" }); setEditValue(""); }}
                    className="group/cell flex items-center gap-1 text-left w-full">
                    <span className="text-[11px] text-muted-foreground/40">—</span>
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
                </button>
            );
        }

        return (
            <button onClick={() => { setEditingCell({ rowId: row._id, field: "driverEfficiency" }); setEditValue(String(val)); }}
                className="group/cell flex items-center gap-1 text-left w-full">
                <span className={cn(
                    "text-xs font-bold",
                    val >= 90 ? "text-emerald-500" : val >= 70 ? "text-amber-500" : "text-red-500"
                )}>
                    {val}%
                </span>
                <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
            </button>
        );
    };

    // ── Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="grid items-center gap-1 px-3 py-2.5 border-b border-border/50 bg-muted/30"
                        style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                        {COLUMNS.map((col) => (
                            <button key={col.key} onClick={() => handleSort(col.key)}
                                className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left">
                                {col.label}
                                {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
                            </button>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-auto">
                        {displayRows.map((row) => (
                            <div key={row._id} className="grid items-center gap-1 px-3 py-1.5 border-b border-border/20 hover:bg-muted/20 transition-colors"
                                style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                                <div className="flex items-center min-w-0"><span className="text-[11px] font-semibold truncate">{row.employeeName}</span></div>
                                {renderType(row)}
                                {renderCell(row, "routeNumber", row.routeNumber)}
                                {renderCell(row, "stopCount", row.stopCount)}
                                {renderCell(row, "routeDuration", row.routeDuration)}
                                {renderCell(row, "waveTime", row.waveTime)}
                                {renderCell(row, "actualDepartureTime", row.actualDepartureTime)}
                                {renderCell(row, "departureDelay", row.departureDelay)}
                                {renderCell(row, "plannedOutboundStem", row.plannedOutboundStem)}
                                {renderCell(row, "actualOutboundStem", row.actualOutboundStem)}
                                {renderCell(row, "outboundDelay", row.outboundDelay)}
                                {renderCell(row, "plannedFirstStop", row.plannedFirstStop)}
                                {renderCell(row, "actualFirstStop", row.actualFirstStop)}
                                {renderCell(row, "firstStopDelay", row.firstStopDelay)}
                                {renderCell(row, "plannedLastStop", row.plannedLastStop)}
                                {renderCell(row, "actualLastStop", row.actualLastStop)}
                                {renderCell(row, "lastStopDelay", row.lastStopDelay)}
                                {renderCell(row, "plannedRTSTime", row.plannedRTSTime)}
                                {renderCell(row, "estimatedRTSTime", row.estimatedRTSTime)}
                                {renderCell(row, "plannedInboundStem", row.plannedInboundStem)}
                                {renderCell(row, "plannedDuration1stToLast", row.plannedDuration1stToLast)}
                                {renderCell(row, "actualDuration1stToLast", row.actualDuration1stToLast)}
                                {renderCell(row, "stopsPerHour", row.stopsPerHour)}
                                {renderCell(row, "deliveryCompletionTime", row.deliveryCompletionTime)}
                                {renderCell(row, "dctDelay", row.dctDelay)}
                                {renderCell(row, "stopsRescued", row.stopsRescued)}
                                {renderEfficiency(row)}
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
            </div>
        </TooltipProvider>
    );
}
