"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
    Users,
    Phone,
    Loader2,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Minus,
    Plus,
    History,
    FileText,
    CheckCircle2,
    Pencil,
    RefreshCw,
    Clock,
    X,
    Check,
    ArrowRight,
    TrendingUp,
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
    MapPin,
    CircleDashed,
    XCircle,
    Video,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import RouteDetailModal from "../_components/RouteDetailModal";

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

function getTypeStyle(value: string): { bg: string; text: string; border: string } {
    if (!value || value.trim() === "")
        return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" };
    const opt = TYPE_MAP.get(value.trim().toLowerCase());
    if (opt) return { bg: opt.bg, text: opt.text, border: opt.border };
    return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
}

// ── Attendance Options ──
const ATTENDANCE_OPTIONS = [
    { label: "Present", icon: CheckCircle2, bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30", iconColor: "text-emerald-500" },
    { label: "Absent", icon: XCircle, bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", iconColor: "text-red-400" },
    { label: "", icon: CircleDashed, bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600", iconColor: "text-zinc-400", displayLabel: "Clear" },
];
const getAttendanceStyle = (value: string) => {
    const v = (value || "").trim().toLowerCase();
    if (v === "present") return ATTENDANCE_OPTIONS[0];
    if (v === "absent") return ATTENDANCE_OPTIONS[1];
    return ATTENDANCE_OPTIONS[2];
};

// ── Column Definitions (merged from Roster + Opening + old Routes) ──
const COLUMNS = [
    { key: "employee", label: "Employee", minW: 140, sticky: true },
    { key: "driverEfficiency", label: "Eff", minW: 44, sticky: false },
    { key: "wst", label: "WST", minW: 50, sticky: false },
    { key: "routeNumber", label: "Route #", minW: 60, sticky: false },
    { key: "van", label: "Van", minW: 58, sticky: false },
    { key: "bags", label: "Bags", minW: 40, sticky: false },
    { key: "ov", label: "OV", minW: 36, sticky: false },
    { key: "serviceType", label: "Service", minW: 64, sticky: false },
    { key: "dashcam", label: "Dashcam", minW: 64, sticky: false },
    { key: "routesCompleted", label: "Routes", minW: 50, sticky: false },
    { key: "routeSize", label: "Rt Size", minW: 56, sticky: false },
    { key: "stopCount", label: "Stops", minW: 46, sticky: false },
    { key: "packageCount", label: "Pkgs", minW: 44, sticky: false },
    { key: "routeDuration", label: "Dur", minW: 48, sticky: false },
    { key: "waveTime", label: "Wave", minW: 56, sticky: false },
    { key: "pad", label: "PAD", minW: 42, sticky: false },
    { key: "wstDuration", label: "WST Dur", minW: 52, sticky: false },
    { key: "stagingLocation", label: "Staging", minW: 60, sticky: false },
] as const;



interface RouteRow {
    _id: string;
    transporterId: string;
    date: string;
    weekDay: string;
    type: string;
    subType: string;
    van: string;
    serviceType: string;
    dashcam: string;
    routeSize: string;
    driverEfficiency: number;
    employeeName: string;
    phone: string;
    routesCompleted: number;
    routeNumber: string;
    stopCount: number;
    packageCount: number;
    routeDuration: string;
    waveTime: string;
    pad: string;
    wst: string;
    wstDuration: number;
    bags: string;
    ov: string;
    stagingLocation: string;
    attendance: string;
    profileImage: string;
}

type SortKey = typeof COLUMNS[number]["key"];

// ── Short day label ──
const SHORT_DAYS: Record<string, string> = {
    Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

export default function RoutesPage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, refreshRoutes, refreshKey, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});


    // Audit panel state
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [auditEmployee, setAuditEmployee] = useState<{ transporterId: string; name: string } | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    // Route detail modal state
    const [detailModal, setDetailModal] = useState<{ open: boolean; routeId: string; employeeName: string; profileImage: string }>(
        { open: false, routeId: "", employeeName: "", profileImage: "" }
    );

    // ── Fetch ALL routes for the week ──
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
                    setAuditCounts({});
                    return;
                }

                setAuditCounts(data.auditCounts || {});

                const rows: RouteRow[] = data.routes.map((rec: any) => {
                    const emp = data.employees?.[rec.transporterId];
                    return {
                        _id: rec._id,
                        transporterId: rec.transporterId,
                        date: rec.date,
                        weekDay: rec.weekDay || "",
                        type: rec.type || "",
                        subType: rec.subType || "",
                        van: rec.van || "",
                        serviceType: rec.serviceType || "",
                        dashcam: rec.dashcam || "",
                        routeSize: rec.routeSize || "",
                        driverEfficiency: rec.driverEfficiency || 0,
                        employeeName: emp?.name || rec.transporterId,
                        phone: emp?.phoneNumber || "",
                        routesCompleted: data.routeCounts?.[rec.transporterId] || 0,
                        routeNumber: rec.routeNumber || "",
                        stopCount: rec.stopCount || 0,
                        packageCount: rec.packageCount || 0,
                        routeDuration: rec.routeDuration || "",
                        waveTime: rec.waveTime || "",
                        pad: rec.pad || "",
                        wst: rec.wst || "",
                        wstDuration: rec.wstDuration || 0,
                        bags: rec.bags || "",
                        ov: rec.ov || "",
                        stagingLocation: rec.stagingLocation || "",
                        attendance: rec.attendance || "",
                        profileImage: emp?.profileImage || "",
                    };
                });

                setAllRoutes(rows);
            })
            .catch(() => {
                setAllRoutes([]);
                setAuditCounts({});
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [selectedWeek, refreshKey]);

    // ── Handle type change ──
    const handleTypeChange = useCallback(async (routeId: string, newType: string, transporterId: string) => {
        setAllRoutes(prev => prev.map(r =>
            r._id === routeId ? { ...r, type: newType } : r
        ));
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { type: newType } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Type updated to ${newType}`);
            setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
        } catch (err: any) {
            toast.error(err.message || "Failed to update type");
            refreshRoutes();
        }
    }, [refreshRoutes]);


    // ── Open audit panel ──
    const openAuditPanel = useCallback(async (transporterId: string, employeeName: string) => {
        setAuditEmployee({ transporterId, name: employeeName });
        setShowAuditPanel(true);
        setAuditLoading(true);
        try {
            const res = await fetch(`/api/schedules/audit?yearWeek=${encodeURIComponent(selectedWeek)}&transporterId=${encodeURIComponent(transporterId)}&limit=50`);
            const data = await res.json();
            setAuditLogs(data.logs || []);
        } catch { }
        setAuditLoading(false);
    }, [selectedWeek]);

    // ── Sort handler ──
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    // ── Toggle group ──
    const toggleGroup = (group: string) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // ── Filter by date, search, sort, and group ──
    const { groups, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) {
            dateFiltered = allRoutes.filter(r => r.date?.split("T")[0] === selectedDate);
        }
        const totalForDate = dateFiltered.length;

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(
                (r) =>
                    r.employeeName.toLowerCase().includes(q) ||
                    r.transporterId.toLowerCase().includes(q) ||
                    r.phone.includes(q) ||
                    r.type.toLowerCase().includes(q) ||
                    r.van.toLowerCase().includes(q) ||
                    r.routeNumber.toLowerCase().includes(q) ||
                    r.stagingLocation.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "employee": aVal = a.employeeName; bVal = b.employeeName; break;
                case "driverEfficiency": aVal = a.driverEfficiency; bVal = b.driverEfficiency; break;
                case "routesCompleted": aVal = a.routesCompleted; bVal = b.routesCompleted; break;
                case "stopCount": aVal = a.stopCount; bVal = b.stopCount; break;
                case "packageCount": aVal = a.packageCount; bVal = b.packageCount; break;
                case "wstDuration": aVal = a.wstDuration; bVal = b.wstDuration; break;
                default: aVal = (a as any)[sortKey] || ""; bVal = (b as any)[sortKey] || ""; break;
            }
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDir === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDir === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        const typeGroups: Record<string, RouteRow[]> = {};
        sorted.forEach(r => {
            const typeKey = r.type || "Unassigned";
            if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
            typeGroups[typeKey].push(r);
        });

        const groupKeys = Object.keys(typeGroups).sort((a, b) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            if (aLower === "route") return -1;
            if (bLower === "route") return 1;
            if (aLower === "off" || aLower === "unassigned" || aLower === "") return 1;
            if (bLower === "off" || bLower === "unassigned" || bLower === "") return -1;
            return a.localeCompare(b);
        });

        const groups = groupKeys.map(key => ({
            type: key,
            rows: typeGroups[key],
            count: typeGroups[key].length,
        }));

        return { groups, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered, groupCount: groups.length });
    }, [totalFiltered, groups.length, setStats]);
    useEffect(() => { return () => setStats({}); }, [setStats]);

    // ── Render read-only cell ──
    const renderCell = (_row: RouteRow, _field: string, value: any) => {
        const displayVal = value === 0 || value === "" ? "—" : String(value);
        return (
            <span className={cn(
                "text-[11px] whitespace-nowrap font-semibold",
                displayVal === "—" ? "text-muted-foreground/30" : "text-foreground"
            )}>
                {displayVal}
            </span>
        );
    };



    // ── Empty / Loading States ──
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
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-orange-500 to-red-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500">
                        <MapPin className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Routes</h2>
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

    // ── Routes Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                    {/* Scrollable table container */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full border-collapse" style={{ minWidth: 1200 }}>
                            {/* Header */}
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-muted/50 border-b border-border/50">
                                    {COLUMNS.map((col) => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className={cn(
                                                "text-left px-2 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap",
                                                col.sticky && "sticky left-0 z-20 bg-muted/50"
                                            )}
                                            style={{ minWidth: col.minW }}
                                        >
                                            <span className="inline-flex items-center gap-0.5">
                                                {col.label}
                                                {sortKey === col.key && (
                                                    sortDir === "asc"
                                                        ? <ChevronUp className="h-2.5 w-2.5" />
                                                        : <ChevronDown className="h-2.5 w-2.5" />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Body with groups */}
                            <tbody>
                                {groups.map((group) => {
                                    const isCollapsed = collapsedGroups[group.type] ?? false;
                                    const typeOpt = TYPE_MAP.get(group.type.toLowerCase());
                                    const GroupIcon = typeOpt?.icon;
                                    const groupStyle = getTypeStyle(group.type);

                                    return (
                                        <React.Fragment key={group.type}>
                                            {/* Group Header Row */}
                                            <tr
                                                onClick={() => toggleGroup(group.type)}
                                                className="cursor-pointer hover:bg-muted/60 transition-colors bg-muted/30 border-b border-border/30"
                                            >
                                                <td colSpan={COLUMNS.length} className="px-2 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronRight className={cn(
                                                            "h-3 w-3 text-muted-foreground transition-transform",
                                                            !isCollapsed && "rotate-90"
                                                        )} />
                                                        <div className={cn(
                                                            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border",
                                                            groupStyle.bg, groupStyle.text, groupStyle.border
                                                        )}>
                                                            {GroupIcon && <GroupIcon className="h-3 w-3" />}
                                                            {group.type || "Unassigned"}
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                                            {group.count}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Group Data Rows */}
                                            {!isCollapsed && group.rows.map((row) => {
                                                const auditCount = auditCounts[row.transporterId] || 0;

                                                return (
                                                    <tr
                                                        key={row._id}
                                                        className="border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer"
                                                        onClick={() => setDetailModal({
                                                            open: true,
                                                            routeId: row._id,
                                                            employeeName: row.employeeName,
                                                            profileImage: row.profileImage,
                                                        })}
                                                    >
                                                        {/* 1. Employee */}
                                                        <td className={cn("px-2 py-1.5", "sticky left-0 z-[5] bg-card")}>
                                                            <div className="flex items-center gap-2">
                                                                {/* Avatar */}
                                                                {row.profileImage ? (
                                                                    <img
                                                                        src={row.profileImage}
                                                                        alt={row.employeeName}
                                                                        className="w-6 h-6 rounded-full object-cover ring-1 ring-border shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
                                                                        <span className="text-[8px] font-bold text-primary">
                                                                            {row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <span className="text-[11px] font-bold text-foreground whitespace-nowrap">
                                                                    {row.employeeName}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 2. Efficiency */}
                                                        <td className="px-2 py-1.5">
                                                            {row.driverEfficiency > 0 ? (
                                                                <span className={cn(
                                                                    "text-[11px] font-bold",
                                                                    row.driverEfficiency >= 90 ? "text-emerald-400" :
                                                                        row.driverEfficiency >= 70 ? "text-amber-400" : "text-red-400"
                                                                )}>
                                                                    {row.driverEfficiency}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-muted-foreground/40">—</span>
                                                            )}
                                                        </td>

                                                        {/* 3. WST */}
                                                        <td className="px-2 py-1.5">
                                                            {row.wst ? (
                                                                <span className={cn(
                                                                    "text-[11px] font-semibold whitespace-nowrap",
                                                                    row.serviceType
                                                                        ? row.wst.toLowerCase() === row.serviceType.toLowerCase()
                                                                            ? "text-emerald-500"
                                                                            : "text-red-500"
                                                                        : "text-foreground"
                                                                )}>
                                                                    {row.wst}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>
                                                            )}
                                                        </td>

                                                        {/* 4. Route # */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "routeNumber", row.routeNumber)}</td>

                                                        {/* 5. Van */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "van", row.van)}</td>

                                                        {/* 6. Bags */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "bags", row.bags)}</td>

                                                        {/* 7. OV */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "ov", row.ov)}</td>

                                                        {/* 8. Service Type (auto from Van) */}
                                                        <td className="px-2 py-1.5">
                                                            <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">
                                                                {row.serviceType || <span className="text-muted-foreground/30 font-semibold">&mdash;</span>}
                                                            </span>
                                                        </td>

                                                        {/* 9. Dashcam (auto from Van) */}
                                                        <td className="px-2 py-1.5">
                                                            {row.dashcam ? (
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <Video className={cn(
                                                                        "h-3.5 w-3.5 shrink-0",
                                                                        row.dashcam.toLowerCase() === "verizon" ? "text-red-500" :
                                                                            row.dashcam.toLowerCase() === "netradyne" ? "text-blue-500" :
                                                                                "text-muted-foreground"
                                                                    )} />
                                                                    <span className={cn(
                                                                        "text-[11px] font-semibold",
                                                                        row.dashcam.toLowerCase() === "verizon" ? "text-red-500" :
                                                                            row.dashcam.toLowerCase() === "netradyne" ? "text-blue-500" :
                                                                                "text-foreground"
                                                                    )}>
                                                                        {row.dashcam}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground/30 text-[11px] font-semibold">&mdash;</span>
                                                            )}
                                                        </td>

                                                        {/* 10. Routes Completed */}
                                                        <td className="px-2 py-1.5">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                                                                        <TrendingUp className="h-2.5 w-2.5 text-primary/50" />
                                                                        <span className="text-[11px] font-medium">{row.routesCompleted}</span>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Total routes completed</TooltipContent>
                                                            </Tooltip>
                                                        </td>

                                                        {/* 11. Rt Size */}
                                                        <td className="px-2 py-1.5">
                                                            <span className="text-[11px] font-medium text-foreground whitespace-nowrap">
                                                                {row.routeSize || "—"}
                                                            </span>
                                                        </td>

                                                        {/* 12. Stops */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "stopCount", row.stopCount)}</td>

                                                        {/* 13. Packages */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "packageCount", row.packageCount)}</td>

                                                        {/* 14. Duration */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "routeDuration", row.routeDuration)}</td>

                                                        {/* 15. Wave Time */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "waveTime", row.waveTime)}</td>

                                                        {/* 16. PAD */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "pad", row.pad)}</td>

                                                        {/* 17. WST Duration */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "wstDuration", row.wstDuration)}</td>

                                                        {/* 18. Staging */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "stagingLocation", row.stagingLocation)}</td>

                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}

                                {groups.length === 0 && (
                                    <tr>
                                        <td colSpan={COLUMNS.length} className="text-center py-12 text-sm text-muted-foreground">
                                            No employees found for this date
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 flex items-center justify-between p-2 border-t border-border/50 bg-muted/20">
                        <span className="text-[10px] text-muted-foreground">
                            {totalFiltered} of {totalForDate} employees
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Audit Panel (slide-out) ── */}
            {showAuditPanel && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setShowAuditPanel(false)} />
                    <div className="relative w-full max-w-[100vw] sm:max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
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
                                    <p className="text-xs text-muted-foreground/60 mt-1">Changes will appear here when modifications are made.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                                    <div className="space-y-1">
                                        {auditLogs.map((log: any, i: number) => {
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
                                                    <div className={`absolute left-1.5 top-3.5 w-5 h-5 rounded-full ring-1 flex items-center justify-center ${config.bg}`}>
                                                        <ActionIcon className={`h-2.5 w-2.5 ${config.color}`} />
                                                    </div>
                                                    <div className="bg-muted/30 hover:bg-muted/50 rounded-xl px-3.5 py-2.5 transition-all border border-transparent hover:border-border/50">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>{config.label}</span>
                                                            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                                                        </div>
                                                        <p className="text-xs font-semibold mt-1">{log.employeeName || log.transporterId}</p>
                                                        {log.dayOfWeek && (
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {log.dayOfWeek}
                                                                {log.date && ` · ${new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`}
                                                            </p>
                                                        )}
                                                        {(log.oldValue || log.newValue) && (
                                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                                {log.oldValue && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/20 line-through">
                                                                        {log.oldValue || "(empty)"}
                                                                    </span>
                                                                )}
                                                                {log.oldValue && log.newValue && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                                                {log.newValue && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                                                                        {log.newValue || "(empty)"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-muted-foreground/50 mt-1.5">by {log.performedByName || log.performedBy}</p>
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

            {/* ── Route Detail Modal ── */}
            <RouteDetailModal
                open={detailModal.open}
                onClose={() => setDetailModal({ open: false, routeId: "", employeeName: "", profileImage: "" })}
                routeId={detailModal.routeId}
                employeeName={detailModal.employeeName}
                profileImage={detailModal.profileImage}
            />
        </TooltipProvider>
    );
}
