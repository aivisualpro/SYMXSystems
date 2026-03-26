"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";
import { useDataStore } from "@/hooks/use-data-store";
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
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

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
    { key: "employee", label: "Employee", width: "w-[150px] shrink-0 sticky left-0 z-20 bg-card border-r border-border/50 font-bold" },
    { key: "type", label: "Type", width: "w-[95px] shrink-0" },
    { key: "routeNumber", label: "Route #", width: "w-[80px] shrink-0" },
    { key: "stopCount", label: "Stops", width: "w-[70px] shrink-0" },
    { key: "routeDuration", label: "Duration", width: "w-[80px] shrink-0" },
    { key: "waveTime", label: "Wave", width: "w-[75px] shrink-0" },
    { key: "actualDepartureTime", label: "Act Dep", width: "w-[75px] shrink-0" },
    { key: "departureDelay", label: "Dep Delay", width: "w-[80px] shrink-0" },
    { key: "plannedOutboundStem", label: "Pln OB", width: "w-[70px] shrink-0" },
    { key: "actualOutboundStem", label: "Act OB", width: "w-[70px] shrink-0" },
    { key: "outboundDelay", label: "OB Delay", width: "w-[75px] shrink-0" },
    { key: "plannedFirstStop", label: "Pln 1st", width: "w-[70px] shrink-0" },
    { key: "actualFirstStop", label: "Act 1st", width: "w-[70px] shrink-0" },
    { key: "firstStopDelay", label: "1st Delay", width: "w-[75px] shrink-0" },
    { key: "plannedLastStop", label: "Pln Last", width: "w-[75px] shrink-0" },
    { key: "actualLastStop", label: "Act Last", width: "w-[75px] shrink-0" },
    { key: "lastStopDelay", label: "Last Delay", width: "w-[80px] shrink-0" },
    { key: "plannedRTSTime", label: "Pln RTS", width: "w-[75px] shrink-0" },
    { key: "estimatedRTSTime", label: "Est RTS", width: "w-[75px] shrink-0" },
    { key: "plannedInboundStem", label: "Pln IB", width: "w-[70px] shrink-0" },
    { key: "plannedDuration1stToLast", label: "Pln 1-L", width: "w-[70px] shrink-0" },
    { key: "actualDuration1stToLast", label: "Act 1-L", width: "w-[70px] shrink-0" },
    { key: "stopsPerHour", label: "Stp/Hr", width: "w-[65px] shrink-0" },
    { key: "deliveryCompletionTime", label: "DCT", width: "w-[75px] shrink-0" },
    { key: "dctDelay", label: "DCT Delay", width: "w-[80px] shrink-0" },
    { key: "stopsRescued", label: "Rescued", width: "w-[75px] shrink-0" },
    { key: "driverEfficiency", label: "Eff %", width: "w-[70px] shrink-0" },
    { key: "actions", label: "", width: "w-[40px] shrink-0" },
] as const;

// ── Editable fields (raw inputs only — computed fields are read-only) ──
const EDITABLE_FIELDS = new Set([
    "actualDepartureTime",
    "plannedOutboundStem", "actualOutboundStem",
    "plannedFirstStop", "actualFirstStop",
    "plannedLastStop", "actualLastStop",
    "deliveryCompletionTime", "stopsRescued",
]);

// Auto-computed fields (never editable)
const COMPUTED_FIELDS = new Set([
    "departureDelay", "outboundDelay", "firstStopDelay", "lastStopDelay",
    "plannedRTSTime", "plannedInboundStem", "estimatedRTSTime",
    "plannedDuration1stToLast", "actualDuration1stToLast",
    "stopsPerHour", "dctDelay", "driverEfficiency",
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
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats, globalEditMode, setGlobalEditMode } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // ── Quick Edit Modal State ──
    const [quickEditRow, setQuickEditRow] = useState<RouteRow | null>(null);
    const [quickEditForm, setQuickEditForm] = useState<Partial<RouteRow>>({});

    // ── Parse Smart Time ──
    const parseSmartTime = (val: string) => {
        if (!val) return "";
        let clean = val.replace(/[^\d]/g, "");
        if (clean.length === 3) clean = `0${clean}`;
        if (clean.length === 4) {
            let h = parseInt(clean.slice(0, 2));
            let m = parseInt(clean.slice(2, 4));
            if (h > 23) h = 23;
            if (m > 59) m = 59;
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
        return val;
    };

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
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading]);

    // ── Save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        const numericFields = new Set(["stopCount", "stopsPerHour", "stopsRescued", "driverEfficiency"]);
        const parsedValue = numericFields.has(field) ? (parseFloat(value) || 0) : value;

        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: parsedValue } : r));
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

    // ── Quick Edit Save Handler ──
    const handleQuickEditSave = async () => {
        if (!quickEditRow) return;
        const updates = { ...quickEditForm };
        const routeId = quickEditRow._id;

        // Ensure numerics are parsed
        ["stopCount", "stopsPerHour", "stopsRescued", "driverEfficiency"].forEach(f => {
            if (updates[f as keyof RouteRow] !== undefined) {
                (updates as any)[f] = parseFloat(updates[f as keyof RouteRow] as any) || 0;
            }
        });

        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, ...updates } : r));
        setQuickEditRow(null);

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Updated efficiency entry for ${quickEditRow.employeeName}`);
        } catch {
            toast.error("Failed to update efficiency entry");
        }
    };

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
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
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
    const renderCell = (row: RouteRow, field: keyof RouteRow, value: any) => {
        const isEditable = EDITABLE_FIELDS.has(field);
        const raw = value === 0 || value === "" ? "—" : String(value);
        const displayVal = raw === "—" ? raw : raw.replace(/:\d{2}$/, "");

        const isTimeField = field.toLowerCase().includes("time") || field.toLowerCase().includes("delay") || field.toLowerCase().includes("duration") || field.toLowerCase().includes("stem") || field.toLowerCase().includes("stop");
        const isNumeric = ["stopCount", "stopsPerHour", "stopsRescued", "driverEfficiency"].includes(field);

        const handleInputKey = (val: string) => isTimeField ? parseSmartTime(val) : val;

        let customBg = "text-foreground";
        let Icon = null;
        if (displayVal === "—") {
            customBg = "text-muted-foreground/40";
        } else {
            if (field === "lastStopDelay") {
                const parts = String(value).split(":");
                if (parts.length >= 2) {
                    const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    if (mins >= 105) { customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm"; Icon = AlertCircle; }
                }
            } else if (field === "actualDepartureTime") {
                const actDepParts = String(value).split(":");
                const waveParts = String(row.waveTime || "").split(":");
                if (actDepParts.length >= 2 && waveParts.length >= 2) {
                    const actMins = parseInt(actDepParts[0], 10) * 60 + parseInt(actDepParts[1], 10);
                    const waveMins = parseInt(waveParts[0], 10) * 60 + parseInt(waveParts[1], 10);
                    if (actMins >= waveMins + 80) { customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm"; Icon = AlertCircle; }
                }
            } else if (field === "dctDelay") {
                const parts = String(value).split(":");
                if (parts.length >= 2) {
                    const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    if (mins >= 5) { customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm"; Icon = AlertCircle; }
                }
            }
        }

        // Global edit mode: show inline inputs
        if (globalEditMode && isEditable) {
            return (
                <div className="relative w-full h-7">
                    <input
                        defaultValue={value === 0 && !isNumeric ? "" : String(value)}
                        className="w-full h-full text-[11px] px-1.5 rounded-md border border-border/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-medium text-foreground bg-background shadow-xs hover:border-border"
                        onChange={(e) => {
                            if (isTimeField) e.target.value = e.target.value.replace(/[^\d:]/g, "");
                        }}
                        onBlur={(e) => {
                            let updatedVal = e.target.value;
                            if (isTimeField) updatedVal = handleInputKey(updatedVal);
                            e.target.value = updatedVal;
                            if (updatedVal !== String(value)) handleSave(row._id, field, updatedVal);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    />
                </div>
            );
        }

        // Read-only display (no per-cell pencil icons)
        const CellContent = Icon ? (
            <div className={cn("flex items-center gap-1 w-max", customBg)}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] truncate">{displayVal}</span>
            </div>
        ) : (
            <span className={cn("text-[11px] truncate font-semibold", customBg)}>{displayVal}</span>
        );

        return (
            <div className="w-full h-7 flex items-center justify-start px-1.5 text-[11px]">
                {CellContent}
            </div>
        );
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
        return renderCell(row, "driverEfficiency", row.driverEfficiency);
    };

    // ── Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full rounded-xl border border-border/50 bg-card overflow-hidden">
                {/* Scrollable Container */}
                <div className="flex-1 overflow-auto w-full relative">
                    <div className="w-max min-w-full flex flex-col min-h-full">
                        {/* Header */}
                        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border/50 bg-card sticky top-0 z-30 shadow-sm">
                            {COLUMNS.map((col) => {
                                const isSticky = col.key === "employee";
                                return (
                                    <button key={col.key} onClick={() => handleSort(col.key)}
                                        className={cn(
                                            "flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left",
                                            col.width,
                                            isSticky ? "bg-card hover:bg-muted/40 z-30" : ""
                                        )}>
                                        {col.label}
                                        {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Rows */}
                        <div className="flex-1">
                            {displayRows.map((row) => (
                                <div key={row._id} className="flex items-center gap-1 px-3 py-1.5 border-b border-border/20 hover:bg-muted/20 transition-colors group/row">
                                    <div className="w-[150px] shrink-0 sticky left-0 z-20 bg-card border-r border-border/50 font-bold group-hover/row:bg-muted/20 transition-colors flex items-center gap-1.5 min-w-0 pr-2">
                                        {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3 w-3 shrink-0" style={{ color: "#FE9EC7" }} />}
                                        {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3 w-3 shrink-0" style={{ color: "#FE9EC7" }} />}
                                        <span
                                            className="text-[11px] font-semibold truncate"
                                            style={row.type.toLowerCase() === "training otr" || row.type.toLowerCase() === "trainer" ? { color: "#FE9EC7" } : undefined}
                                        >
                                            {row.employeeName}
                                        </span>
                                    </div>
                                    <div className="w-[95px] shrink-0 pr-2">
                                        {renderType(row)}
                                    </div>
                                    <div className="w-[80px] shrink-0">{renderCell(row, "routeNumber", row.routeNumber)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "stopCount", row.stopCount)}</div>
                                    <div className="w-[80px] shrink-0">{renderCell(row, "routeDuration", row.routeDuration)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "waveTime", row.waveTime)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "actualDepartureTime", row.actualDepartureTime)}</div>
                                    <div className="w-[80px] shrink-0">{renderCell(row, "departureDelay", row.departureDelay)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "plannedOutboundStem", row.plannedOutboundStem)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "actualOutboundStem", row.actualOutboundStem)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "outboundDelay", row.outboundDelay)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "plannedFirstStop", row.plannedFirstStop)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "actualFirstStop", row.actualFirstStop)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "firstStopDelay", row.firstStopDelay)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "plannedLastStop", row.plannedLastStop)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "actualLastStop", row.actualLastStop)}</div>
                                    <div className="w-[80px] shrink-0">{renderCell(row, "lastStopDelay", row.lastStopDelay)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "plannedRTSTime", row.plannedRTSTime)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "estimatedRTSTime", row.estimatedRTSTime)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "plannedInboundStem", row.plannedInboundStem)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "plannedDuration1stToLast", row.plannedDuration1stToLast)}</div>
                                    <div className="w-[70px] shrink-0">{renderCell(row, "actualDuration1stToLast", row.actualDuration1stToLast)}</div>
                                    <div className="w-[65px] shrink-0">{renderCell(row, "stopsPerHour", row.stopsPerHour)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "deliveryCompletionTime", row.deliveryCompletionTime)}</div>
                                    <div className="w-[80px] shrink-0">{renderCell(row, "dctDelay", row.dctDelay)}</div>
                                    <div className="w-[75px] shrink-0">{renderCell(row, "stopsRescued", row.stopsRescued)}</div>
                                    <div className="w-[70px] shrink-0">{renderEfficiency(row)}</div>
                                    <div className="w-[40px] shrink-0 pr-1 text-right">
                                        <button
                                            onClick={() => {
                                                setQuickEditRow(row);
                                                setQuickEditForm(row);
                                            }}
                                            className="p-1.5 rounded bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm ml-auto"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {displayRows.length === 0 && (
                                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground w-full absolute left-0">
                                    No employees found for this date
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-2.5 border-t border-border/50 bg-muted/20 z-10 sticky bottom-0">
                        <span className="text-[11px] text-muted-foreground">{totalFiltered} of {totalForDate} employees</span>
                    </div>
                </div>

                {/* ── Quick Edit Modal ── */}
                <Sheet open={!!quickEditRow} onOpenChange={(open) => !open && setQuickEditRow(null)}>
                    <SheetContent className="w-[450px] sm:w-[500px] border-l border-border p-0 flex flex-col bg-card/95 backdrop-blur-xl">
                        <div className="p-5 border-b border-border bg-gradient-to-br from-muted/50 to-muted/10 shrink-0">
                            <SheetHeader>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                        <Pencil className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <SheetTitle className="text-xl font-bold font-sans tracking-tight text-foreground flex items-center gap-2">
                                            Quick Edit
                                            <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full ring-1 ring-primary/20">
                                                {formatDateColumn(quickEditRow?.date || "", quickEditRow?.weekDay || "")}
                                            </span>
                                        </SheetTitle>
                                        <SheetDescription className="text-sm">
                                            <span className="font-semibold text-foreground/80">{quickEditRow?.employeeName}</span> — Adjust efficiency data.
                                        </SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-6">
                            <div className="gap-5 flex flex-col">
                                {[{
                                    title: "Departure", color: "text-blue-500", fields: [
                                        { key: "actualDepartureTime", label: "Act Dep" },
                                    ]
                                },
                                {
                                    title: "Stem Timing", color: "text-orange-500", fields: [
                                        { key: "plannedOutboundStem", label: "Pln OB Stem" },
                                        { key: "actualOutboundStem", label: "Act OB Stem" },
                                    ]
                                },
                                {
                                    title: "Stop Timings", color: "text-rose-500", fields: [
                                        { key: "plannedFirstStop", label: "Pln 1st Stop" },
                                        { key: "actualFirstStop", label: "Act 1st Stop" },
                                        { key: "plannedLastStop", label: "Pln Last Stop" },
                                        { key: "actualLastStop", label: "Act Last Stop" },
                                    ]
                                },
                                {
                                    title: "Delivery & Rescue", color: "text-emerald-500", fields: [
                                        { key: "deliveryCompletionTime", label: "DCT" },
                                        { key: "stopsRescued", label: "Stops Rescued" },
                                    ]
                                }].map((group, i) => (
                                    <div key={i} className="col-span-2">
                                        <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${group.color}`}>{group.title}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {group.fields.map(f => {
                                                const isTimeField = f.key.toLowerCase().includes("time") || f.key.toLowerCase().includes("delay") || f.key.toLowerCase().includes("duration") || f.key.toLowerCase().includes("stem") || f.key.toLowerCase().includes("stop");
                                                return (
                                                    <div key={f.key} className="space-y-1.5">
                                                        <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
                                                        <Input
                                                            value={(quickEditForm as any)[f.key] || ""}
                                                            onChange={e => {
                                                                let v = e.target.value;
                                                                if (isTimeField) v = v.replace(/[^\d:]/g, "");
                                                                setQuickEditForm(prev => ({ ...prev, [f.key]: v }))
                                                            }}
                                                            onBlur={() => {
                                                                if (isTimeField) {
                                                                    setQuickEditForm(prev => ({ ...prev, [f.key]: parseSmartTime((prev as any)[f.key] || "") }))
                                                                }
                                                            }}
                                                            className="h-9 shadow-sm" placeholder="—"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
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
