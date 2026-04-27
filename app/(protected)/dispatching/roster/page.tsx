import React from 'react';
"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouteTypes } from "@/lib/query/hooks/useShared";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";

import RoutesInfoPanel from "../_components/RoutesInfoPanel";
import { cn } from "@/lib/utils";
import {
    Users,
    Phone,
    Loader2,
    TrendingUp,
    TrendingDown,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
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
    History,
    RefreshCw,
    Pencil,
    Plus,
    FileText,
    ArrowRight,
    X,
    type LucideIcon,
    TableProperties,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

// ── Type Options with Icons & Colors (same as scheduling) ──
import { getTypeStyle, TYPE_OPTIONS, TYPE_MAP, formatRouteTypes, getContrastText } from "@/lib/route-types";

// ── Column Definitions ──
const COLUMNS = [
    { key: "routeSize", label: "Route Size", width: "w-[90px]" },
    { key: "employee", label: "Employee", width: "flex-1 min-w-[160px]" },
    { key: "driverEfficiency", label: "Efficiency", width: "w-[90px]" },
    { key: "type", label: "Type", width: "w-[120px]" },
    { key: "subType", label: "Sub Type", width: "w-[100px]" },
    { key: "van", label: "Van", width: "w-[80px]" },
    { key: "serviceType", label: "Service", width: "w-[90px]" },
    { key: "dashcam", label: "Dashcam", width: "w-[80px]" },
    { key: "routesCompleted", label: "Routes Done", width: "w-[90px]" },
    { key: "phone", label: "Phone", width: "w-[110px]" },
    { key: "audit", label: "Audit", width: "w-[50px]" },
] as const;

const GRID_TEMPLATE = "90px 1fr 90px 120px 100px 80px 90px 80px 90px 110px 50px";

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
    // Enriched
    employeeName: string;
    phone: string;
    routesCompleted: number;
    routesCompletedPrev: number;
}

type SortKey = typeof COLUMNS[number]["key"];

// ── Short day label ──
const SHORT_DAYS: Record<string, string> = {
    Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

export default function RosterPage() {
  const { data: routeTypesListData } = useRouteTypes();
  const dynamicTypeOptions = React.useMemo(() => formatRouteTypes(routeTypesListData), [routeTypesListData]);
    const queryClient = useQueryClient();
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, refreshRoutes, refreshKey, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
    const [routeCountsByDate, setRouteCountsByDate] = useState<Record<string, Record<string, number>>>({});
    const [initialRoutesComp, setInitialRoutesComp] = useState<Record<string, number>>({});

    // Audit panel state
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [auditEmployee, setAuditEmployee] = useState<{ transporterId: string; name: string } | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    // Routes Info panel state
    const [showRoutesInfo, setShowRoutesInfo] = useState(false);



    // ── Hydrate from layout's shared rawRouteData (no independent fetch) ──
    const { rawRouteData, rawRouteDataLoading } = useDispatching();

    useEffect(() => {
        if (rawRouteDataLoading) { setLoading(true); return; }
        if (!rawRouteData || !rawRouteData.routes || rawRouteData.routes.length === 0) {
            setAllRoutes([]);
            setAuditCounts({});
            setLoading(false);
            return;
        }
        setAuditCounts(rawRouteData.auditCounts || {});
        setRouteCountsByDate(rawRouteData.routeCountsByDate || {});
        setInitialRoutesComp(rawRouteData.initialRoutesComp || {});

        const rows: RouteRow[] = rawRouteData.routes.map((rec: any) => {
            const emp = rawRouteData.employees?.[rec.transporterId];
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
                routesCompleted: rawRouteData.routeCounts?.[rec.transporterId] || 0,
                routesCompletedPrev: 0,
            };
        });
        setAllRoutes(rows);
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading]);

    // ── Handle type change ──
    const handleTypeChange = useCallback(async (routeId: string, newType: string, transporterId: string) => {
        // Optimistic update
        setAllRoutes(prev => prev.map(r =>
            r._id === routeId ? { ...r, type: newType } : r
        ));

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId,
                    updates: { type: newType },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Type updated to ${newType}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"] });
            // Increment audit count for this employee
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
        if (key === "audit") return; // Not sortable
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
        // 1. Filter by selected date
        let dateFiltered = allRoutes;
        if (selectedDate) {
            dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        }

        const totalForDate = dateFiltered.length;

        // Compute date-aware routesCompleted
        const computeDateStr = selectedDate || dateFiltered.reduce((latest, r) => {
            const d = r.date ? toPacificDate(r.date) : "";
            return d > latest ? d : latest;
        }, "");

        if (computeDateStr) {
            const prevDate = new Date(computeDateStr + "T12:00:00Z");
            prevDate.setUTCDate(prevDate.getUTCDate() - 1);
            const prevDateStr = toPacificDate(prevDate);

            const empCumulative: Record<string, number> = {};
            const empCumulativePrev: Record<string, number> = {};

            Object.entries(routeCountsByDate).forEach(([tid, dateCounts]) => {
                let totalUpTo = 0;
                let totalUpToPrev = 0;
                Object.entries(dateCounts).forEach(([dt, count]) => {
                    if (dt <= computeDateStr) totalUpTo += count;
                    if (dt <= prevDateStr) totalUpToPrev += count;
                });
                const initComp = initialRoutesComp[tid] || 0;
                empCumulative[tid] = totalUpTo + initComp;
                empCumulativePrev[tid] = totalUpToPrev + initComp;
            });
            Object.entries(initialRoutesComp).forEach(([tid, initVal]) => {
                if (!(tid in empCumulative) && initVal > 0) {
                    empCumulative[tid] = initVal;
                    empCumulativePrev[tid] = initVal;
                }
            });

            dateFiltered.forEach(r => {
                r.routesCompleted = empCumulative[r.transporterId] || 0;
                r.routesCompletedPrev = empCumulativePrev[r.transporterId] || 0;
            });
        }

        // 2. Search filter
        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(
                (r) =>
                    r.employeeName.toLowerCase().includes(q) ||
                    r.transporterId.toLowerCase().includes(q) ||
                    r.phone.includes(q) ||
                    r.type.toLowerCase().includes(q) ||
                    r.van.toLowerCase().includes(q)
            );
        }

        // 3. Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "employee":
                    aVal = a.employeeName; bVal = b.employeeName; break;
                case "driverEfficiency":
                    aVal = a.driverEfficiency; bVal = b.driverEfficiency; break;
                case "routesCompleted":
                    aVal = a.routesCompleted; bVal = b.routesCompleted; break;
                case "phone":
                    aVal = a.phone; bVal = b.phone; break;
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

        // 4. Group by type
        const typeGroups: Record<string, RouteRow[]> = {};
        sorted.forEach(r => {
            const typeKey = r.type || "Unassigned";
            if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
            typeGroups[typeKey].push(r);
        });

        // Sort group keys: prioritize Route, then others alphabetically, Off/Unassigned last
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
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir, routeCountsByDate, initialRoutesComp]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered, groupCount: groups.length });
    }, [totalFiltered, groups.length, setStats]);

    // ── Clear stats on unmount ──
    useEffect(() => {
        return () => setStats({});
    }, [setStats]);

    // ── Format date for the Day column: mm/dd/yy ddd ──
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



    if (rawRouteData?.routes?.length > 0 && allRoutes.length === 0) {
        return <div className="flex-1 opacity-0 pointer-events-none" />;
    }

    if (!routesGenerated || allRoutes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-blue-500 to-cyan-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
                        <Users className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Roster</h2>
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

    // ── Roster Table ──
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
                                className={cn(
                                    "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left",
                                    col.key === "audit" && "justify-center"
                                )}
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

                    {/* Groups + Rows */}
                    <div className="flex-1 overflow-auto">
                        {groups.map((group) => {
                            const isCollapsed = collapsedGroups[group.type] ?? false;
                            const typeOpt = TYPE_MAP.get(group.type.toLowerCase());
                            const GroupIcon = typeOpt?.icon;
                            const groupStyle = getTypeStyle(group.type);

                            return (
                                <div key={group.type}>
                                    {/* Group Header */}
                                    <button
                                        onClick={() => toggleGroup(group.type)}
                                        className="flex items-center gap-2 w-full px-3 py-2 bg-muted/40 border-b border-border/30 hover:bg-muted/60 transition-colors sticky top-0 z-[5]"
                                    >
                                        <ChevronRight className={cn(
                                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                            !isCollapsed && "rotate-90"
                                        )} />
                                        <div className={cn(
                                            "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border",
                                            groupStyle.bg, groupStyle.text, groupStyle.border
                                        )}>
                                            {GroupIcon && <GroupIcon className="h-3 w-3" />}
                                            {group.type || "Unassigned"}
                                        </div>
                                        <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                            {group.count}
                                        </span>
                                    </button>

                                    {/* Group Rows */}
                                    {!isCollapsed && group.rows.map((row) => {
                                        const typeStyle = getTypeStyle(row.type);
                                        const matchedOpt = TYPE_MAP.get((row.type || "").trim().toLowerCase());
                                        const CellIcon = matchedOpt?.icon;
                                        const auditCount = auditCounts[row.transporterId] || 0;

                                        return (
                                            <div
                                                key={row._id}
                                                className="grid items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors"
                                                style={{ gridTemplateColumns: GRID_TEMPLATE }}
                                            >
                                                {/* Route Size */}
                                                <span className="text-xs font-medium text-foreground truncate">
                                                    {row.routeSize || "—"}
                                                </span>

                                                {/* Employee */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3 w-3 shrink-0" style={{ color: getTypeStyle(row.type).colorHex || "#FE9EC7" }} />}
                                                    {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3 w-3 shrink-0" style={{ color: getTypeStyle(row.type).colorHex || "#FE9EC7" }} />}
                                                    <span
                                                        className="text-xs font-semibold truncate"
                                                        style={{ color: getTypeStyle(row.type).colorHex || "inherit" }}
                                                    >
                                                        {row.employeeName}
                                                    </span>
                                                </div>

                                                {/* Efficiency */}
                                                <div className="flex items-center gap-1">
                                                    {row.driverEfficiency > 0 ? (
                                                        <span className={cn(
                                                            "text-xs font-semibold",
                                                            row.driverEfficiency >= 90 ? "text-emerald-500" :
                                                                row.driverEfficiency >= 70 ? "text-amber-500" : "text-red-500"
                                                        )}>
                                                            {row.driverEfficiency}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/40">—</span>
                                                    )}
                                                </div>

                                                {/* Type — colored pill with dropdown */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <div
                                                            className={cn(
                                                                "relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold transition-all border cursor-pointer select-none px-1.5",
                                                                typeStyle.bg,
                                                                typeStyle.text,
                                                                typeStyle.border,
                                                                "hover:brightness-110 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                                            )}
                                                        >
                                                            {CellIcon && <CellIcon className="h-3 w-3 shrink-0" />}
                                                            <span className="truncate">{row.type || <Minus className="h-3 w-3 opacity-40" />}</span>
                                                        </div>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="start"
                                                        side="bottom"
                                                        className="w-48 max-h-[320px] overflow-y-auto"
                                                    >
                                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                            Change Type
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {dynamicTypeOptions.map(opt => {
                                                            const Icon = opt.icon;
                                                            const isActive = (row.type || "").toLowerCase() === opt.label.toLowerCase();
                                                            return (
                                                                <DropdownMenuItem
                                                                    key={opt.label}
                                                                    className={cn(
                                                                        "flex items-center gap-2 cursor-pointer text-xs",
                                                                        isActive && "bg-accent"
                                                                    )}
                                                                    onClick={() => handleTypeChange(row._id, opt.label, row.transporterId)}
                                                                >
                                                                    <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", opt.bg)} style={opt.colorHex ? { backgroundColor: opt.colorHex } : undefined}>
                                                                        <Icon className={cn("h-3 w-3", opt.text)} style={opt.colorHex ? { color: getContrastText(opt.colorHex) } : undefined} />
                                                                    </div>
                                                                    <span className="font-medium">{opt.label}</span>
                                                                    {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                                                                </DropdownMenuItem>
                                                            );
                                                        })}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                {/* Sub Type */}
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    {row.subType || "—"}
                                                </span>

                                                {/* Van */}
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    {row.van || "—"}
                                                </span>

                                                {/* Service Type */}
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    {row.serviceType || "—"}
                                                </span>

                                                {/* Dashcam */}
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    {row.dashcam || "—"}
                                                </span>

                                                {/* Routes Completed */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1">
                                                            {row.routesCompleted > 0 && row.routesCompletedPrev > 0 ? (
                                                                row.routesCompleted > row.routesCompletedPrev ? (
                                                                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                                                                ) : row.routesCompleted === row.routesCompletedPrev ? (
                                                                    <Minus className="h-3 w-3 text-amber-400" />
                                                                ) : (
                                                                    <TrendingDown className="h-3 w-3 text-red-400" />
                                                                )
                                                            ) : (
                                                                <TrendingUp className="h-3 w-3 text-primary/50" />
                                                            )}
                                                            <span className="text-xs font-medium">{row.routesCompleted}</span>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Routes completed (up to selected date)
                                                        {row.routesCompletedPrev > 0 && (
                                                            <span className="block text-[10px] text-muted-foreground">
                                                                Previous day: {row.routesCompletedPrev}
                                                                {row.routesCompleted > row.routesCompletedPrev
                                                                    ? ` (+${row.routesCompleted - row.routesCompletedPrev})`
                                                                    : row.routesCompleted === row.routesCompletedPrev
                                                                        ? " (no change)"
                                                                        : ` (${row.routesCompleted - row.routesCompletedPrev})`}
                                                            </span>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>

                                                {/* Phone */}
                                                <div className="flex items-center gap-1 min-w-0">
                                                    {row.phone ? (
                                                        <>
                                                            <Phone className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                                            <span className="text-[11px] text-muted-foreground truncate">
                                                                {row.phone}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px] text-muted-foreground/40">—</span>
                                                    )}
                                                </div>

                                                {/* Audit */}
                                                <div className="flex justify-center">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => openAuditPanel(row.transporterId, row.employeeName)}
                                                                className={cn(
                                                                    "inline-flex items-center justify-center h-6 min-w-[24px] rounded-md transition-all",
                                                                    auditCount > 0
                                                                        ? "bg-violet-500/15 hover:bg-violet-500/25 ring-1 ring-violet-500/30 text-violet-400 hover:text-violet-300"
                                                                        : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/30"
                                                                )}
                                                            >
                                                                {auditCount > 0 ? (
                                                                    <span className="text-[10px] font-bold">{auditCount}</span>
                                                                ) : (
                                                                    <History className="h-3 w-3" />
                                                                )}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="left" className="text-xs">
                                                            {auditCount > 0
                                                                ? `${auditCount} change${auditCount !== 1 ? "s" : ""} this week`
                                                                : "No changes recorded"}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {groups.length === 0 && (
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
                        <Button
                            size="sm"
                            className="h-7 gap-1.5 text-[10px] font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
                            onClick={() => setShowRoutesInfo(true)}
                        >
                            <TableProperties className="h-3 w-3" />
                            Routes Info
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Audit Panel (slide-out) ── */}
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
            {/* ── Routes Info Panel ── */}
            <RoutesInfoPanel
                open={showRoutesInfo}
                onClose={() => setShowRoutesInfo(false)}
                date={selectedDate}
            />
        </TooltipProvider>
    );
}
