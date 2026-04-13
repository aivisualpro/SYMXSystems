"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDispatching } from "../layout";
import { useDataStore } from "@/hooks/use-data-store";
import { cn } from "@/lib/utils";
import { MessageStatusBadge } from "@/components/ui-elements/message-status-badge";
import {
    Users,
    Phone,
    Loader2,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    AlertCircle,
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
    TrendingDown,
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

// ── Time arithmetic helpers ──
function parseTime(t: string): number | null {
    if (!t || !t.trim()) return null;
    const s = t.trim();
    // Handle negative duration: "-H:MM" or "H:MM"
    const mNeg = s.match(/^(-?)(\d{1,2}):(\d{2})$/);
    if (mNeg) {
        const val = parseInt(mNeg[2]) * 60 + parseInt(mNeg[3]);
        return mNeg[1] === "-" ? -val : val;
    }
    // Handle 12h format: "2:00 PM"
    const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
        let h = parseInt(m12[1]);
        const min = parseInt(m12[2]);
        const pm = m12[3].toUpperCase() === "PM";
        if (pm && h < 12) h += 12;
        if (!pm && h === 12) h = 0;
        return h * 60 + min;
    }
    return null;
}
function isDelayPositive(d: string): boolean {
    return !!d && !d.startsWith("-") && d !== "0:00";
}
function fmtDur(mins: number | null): string {
    if (mins === null || isNaN(mins)) return "";
    const neg = mins < 0;
    const abs = Math.abs(Math.round(mins));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${neg ? "-" : ""}${h}:${m.toString().padStart(2, "0")}`;
}
function fmtTime(mins: number | null): string {
    if (mins === null || isNaN(mins)) return "";
    let m = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const mn = m % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${mn.toString().padStart(2, "0")} ${ampm}`;
}
function durToHrs(t: string): number {
    const m = parseTime(t);
    return m !== null ? m / 60 : 0;
}
/** Strip trailing seconds (":00" or ":SS") from time strings like "6:30:00" → "6:30" */
function stripSec(v: string): string {
    if (!v) return v;
    return v.replace(/:\d{2}$/, "");
}

/** Business timezone — all date comparisons use Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";
/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time.
 *  Shifts UTC-midnight dates to noon to prevent timezone rollback. */
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", minW: 140, sticky: true },
    { key: "confirmationStatus", label: "Conf Status", minW: 100, sticky: false },
    { key: "wst", label: "WST", minW: 50, sticky: false },
    { key: "routeNumber", label: "Route #", minW: 60, sticky: false },
    { key: "van", label: "Van", minW: 58, sticky: false },
    { key: "bags", label: "Bags", minW: 40, sticky: false },
    { key: "ov", label: "OV", minW: 36, sticky: false },
    { key: "serviceType", label: "Service", minW: 64, sticky: false },
    { key: "dashcam", label: "Dashcam", minW: 64, sticky: false },
    { key: "type", label: "Type", minW: 72, sticky: false },
    { key: "routesCompleted", label: "Routes", minW: 50, sticky: false },
    { key: "routeSize", label: "Rt Size", minW: 56, sticky: false },
    { key: "stopCount", label: "Stops", minW: 46, sticky: false },
    { key: "packageCount", label: "Pkgs", minW: 44, sticky: false },
    { key: "routeDuration", label: "Dur", minW: 48, sticky: false },
    { key: "waveTime", label: "Wave", minW: 56, sticky: false },
    { key: "pad", label: "PAD", minW: 42, sticky: false },
    { key: "wstDuration", label: "WST Dur", minW: 52, sticky: false },
    { key: "stagingLocation", label: "Staging", minW: 60, sticky: false },
    { key: "departureDelay", label: "Dep Delay", minW: 60, sticky: false },
    { key: "outboundDelay", label: "OB Delay", minW: 56, sticky: false },
    { key: "firstStopDelay", label: "1st Delay", minW: 56, sticky: false },
    { key: "lastStopDelay", label: "Last Delay", minW: 58, sticky: false },
    { key: "dctDelay", label: "DCT Delay", minW: 58, sticky: false },
    { key: "plannedRTSTime", label: "Plan RTS", minW: 56, sticky: false },
    { key: "plannedInboundStem", label: "Plan IB", minW: 52, sticky: false },
    { key: "estimatedRTSTime", label: "Est RTS", minW: 54, sticky: false },
    { key: "plannedDuration1stToLast", label: "Plan 1→L", minW: 56, sticky: false },
    { key: "actualDuration1stToLast", label: "Act 1→L", minW: 56, sticky: false },
    { key: "stopsPerHour", label: "Stops/Hr", minW: 52, sticky: false },
    { key: "totalHours", label: "Total Hrs", minW: 56, sticky: false },
    { key: "regHrs", label: "Reg Hrs", minW: 50, sticky: false },
    { key: "otHrs", label: "OT Hrs", minW: 48, sticky: false },
    { key: "regPay", label: "Reg Pay", minW: 56, sticky: false },
    { key: "otPay", label: "OT Pay", minW: 52, sticky: false },
    { key: "totalCost", label: "Total Cost", minW: 60, sticky: false },
    { key: "hoursWorkedLast7Days", label: "7d Hrs", minW: 48, sticky: false },
    { key: "driverEfficiency", label: "Eff %", minW: 48, sticky: false },
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
    confirmationStatus?: { status: string; changeRemarks?: string; updatedAt?: string; history?: Array<{ status: string; changeRemarks?: string; updatedAt?: string; messageType?: string }> } | null;
    phone: string;
    rate: number;
    routesCompleted: number;
    routeNumber: string;
    stopCount: number;
    packageCount: number;
    routeDuration: string;
    waveTime: string;
    pad: string;
    wst: string;
    wstRevenue: number;
    wstDuration: number;
    bags: string;
    ov: string;
    stagingLocation: string;
    attendance: string;
    profileImage: string;
    // Raw fields from DB
    actualDepartureTime: string;
    plannedOutboundStem: string;
    actualOutboundStem: string;
    plannedFirstStop: string;
    actualFirstStop: string;
    plannedLastStop: string;
    actualLastStop: string;
    deliveryCompletionTime: string;
    totalHours: string;
    stopsRescued: number;
    // Computed fields
    departureDelay: string;
    outboundDelay: string;
    firstStopDelay: string;
    lastStopDelay: string;
    plannedRTSTime: string;
    plannedInboundStem: string;
    estimatedRTSTime: string;
    plannedDuration1stToLast: string;
    actualDuration1stToLast: string;
    stopsPerHour: number;
    dctDelay: string;
    regHrs: number;
    otHrs: number;
    totalCost: number;
    regPay: number;
    otPay: number;
    hoursWorkedLast7Days: number;
    routesCompletedPrev: number;
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
    const [wstRevenueMap, setWstRevenueMap] = useState<Record<string, number>>({});
    const [routeCountsByDate, setRouteCountsByDate] = useState<Record<string, Record<string, number>>>({});
    const [initialRoutesComp, setInitialRoutesComp] = useState<Record<string, number>>({});


    // Audit panel state
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [auditEmployee, setAuditEmployee] = useState<{ transporterId: string; name: string } | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    // Route detail modal state
    const [detailModal, setDetailModal] = useState<{ open: boolean; routeId: string; employeeName: string; profileImage: string }>(
        { open: false, routeId: "", employeeName: "", profileImage: "" }
    );

    const store = useDataStore();

    // ── Hydrate active vehicles from DataStore ──
    const [vehicles, setVehicles] = useState<any[]>([]);
    useEffect(() => {
        const storeVehicles = store.fleet?.vehicles;
        if (storeVehicles && Array.isArray(storeVehicles) && storeVehicles.length > 0) {
            const sortedVans = [...storeVehicles].sort((a: any, b: any) => String(a.vehicleName).localeCompare(String(b.vehicleName), undefined, { numeric: true, sensitivity: 'base' }));
            setVehicles(sortedVans);
        }
    }, [store.fleet?.vehicles]);

    // ── Get available vans for a date ──
    const getAvailableVans = useCallback((dateStr: string, currentVan: string) => {
        if (!dateStr || !vehicles.length) return vehicles;
        
        const assignedOnDay = new Set<string>();
        allRoutes.forEach(r => {
            if (r.date && r.van) {
                const rd = r.date.split('T')[0];
                const cd = dateStr.split('T')[0];
                if (rd === cd) {
                    assignedOnDay.add(r.van);
                }
            }
        });

        return vehicles.filter(v => {
            if (v.vehicleName === currentVan) return true;
            return !assignedOnDay.has(v.vehicleName);
        });
    }, [vehicles, allRoutes]);

    // ── Handle Van Change ──
    const handleVanChange = useCallback(async (routeId: string, newVan: string, transporterId: string) => {
        const vehicle = vehicles.find(v => v.vehicleName === newVan);
        const serviceType = vehicle?.serviceType || "";
        const dashcam = vehicle?.dashcam || "";

        setAllRoutes(prev => prev.map(r =>
            r._id === routeId ? { ...r, van: newVan, serviceType, dashcam } : r
        ));
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { van: newVan } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update van");
            toast.success(newVan ? `Van updated to ${newVan}` : "Van cleared");
            setAuditCounts(prev => ({ ...prev, [transporterId]: (prev[transporterId] || 0) + 1 }));
        } catch (err: any) {
            toast.error(err.message || "Failed to update van");
            refreshRoutes();
        }
    }, [vehicles, refreshRoutes]);

    // ── Hydrate WST revenue from DataStore ──
    useEffect(() => {
        const wstData = store.admin?.wst;
        if (wstData && Array.isArray(wstData) && wstData.length > 0) {
            const map: Record<string, number> = {};
            wstData.forEach((w: any) => {
                if (w.wst && w.isActive !== false) {
                    map[w.wst.toLowerCase()] = w.revenue || 0;
                }
            });
            setWstRevenueMap(map);
        }
    }, [store.admin?.wst]);

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
                van: (rec.van && rawRouteData.vehicleNames?.[rec.van]) || rec.van || "",
                serviceType: rec.serviceType || "",
                dashcam: rec.dashcam || "",
                routeSize: rec.routeSize || "",
                driverEfficiency: rec.driverEfficiency || 0,
                employeeName: emp?.name || rec.transporterId,
                confirmationStatus: null,
                phone: emp?.phoneNumber || "",
                rate: emp?.rate || 0,
                routesCompleted: rawRouteData.routeCounts?.[rec.transporterId] || 0,
                routeNumber: rec.routeNumber || "",
                stopCount: rec.stopCount || 0,
                packageCount: rec.packageCount || 0,
                routeDuration: rec.routeDuration || "",
                waveTime: rec.waveTime || "",
                pad: rec.pad || "",
                wst: rec.wst || "",
                wstRevenue: 0,
                wstDuration: rec.wstDuration || 0,
                bags: rec.bags || "",
                ov: rec.ov || "",
                stagingLocation: rec.stagingLocation || "",
                attendance: rec.attendance || "",
                profileImage: emp?.profileImage || "",
                actualDepartureTime: rec.actualDepartureTime || "",
                plannedOutboundStem: rec.plannedOutboundStem || "",
                actualOutboundStem: rec.actualOutboundStem || "",
                plannedFirstStop: rec.plannedFirstStop || "",
                actualFirstStop: rec.actualFirstStop || "",
                plannedLastStop: rec.plannedLastStop || "",
                actualLastStop: rec.actualLastStop || "",
                deliveryCompletionTime: rec.deliveryCompletionTime || "",
                totalHours: rec.totalHours || "",
                stopsRescued: rec.stopsRescued || 0,
                departureDelay: "", outboundDelay: "", firstStopDelay: "", lastStopDelay: "",
                plannedRTSTime: "", plannedInboundStem: "", estimatedRTSTime: "",
                plannedDuration1stToLast: "", actualDuration1stToLast: "",
                stopsPerHour: 0, dctDelay: "",
                regHrs: 0, otHrs: 0, totalCost: 0, regPay: 0, otPay: 0,
                hoursWorkedLast7Days: 0,
                routesCompletedPrev: 0,
            };
        });

        // Populate confirmation status
        if (rawRouteData.confirmations) {
            rows.forEach(r => {
                const dateStr = r.date && typeof r.date === 'string' ? r.date.split('T')[0] : "";
                const key = `${r.transporterId}_${dateStr}`;
                const weeklyKey = `${r.transporterId}_`;
                if (rawRouteData.confirmations[key]) {
                    r.confirmationStatus = rawRouteData.confirmations[key];
                } else if (rawRouteData.confirmations[weeklyKey]) {
                    r.confirmationStatus = rawRouteData.confirmations[weeklyKey];
                }
            });
        }

        setAllRoutes(rows);
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading]);

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

    const { confirmationFilter } = useDispatching();

    // ── Filter by date, search, sort, and group ──
    const { groups, totalFiltered, totalForDate } = useMemo(() => {
        // STEP 1: Enrich ALL routes with computed fields (before date filter for 7d hrs)
        const enriched: RouteRow[] = allRoutes.map(r => {
            const waveM = parseTime(r.waveTime);
            const durM = parseTime(r.routeDuration);
            const actDepM = parseTime(r.actualDepartureTime);
            const planOBM = parseTime(r.plannedOutboundStem);
            const actOBM = parseTime(r.actualOutboundStem);
            const planFirstM = parseTime(r.plannedFirstStop);
            const actFirstM = parseTime(r.actualFirstStop);
            const planLastM = parseTime(r.plannedLastStop);
            const actLastM = parseTime(r.actualLastStop);
            const dctM = parseTime(r.deliveryCompletionTime);

            // 1. departureDelay = actualDepartureTime - (waveTime + 0:20)
            const departureDelay = (actDepM !== null && waveM !== null)
                ? fmtDur(actDepM - (waveM + 20)) : "";

            // 2. outboundDelay = actualOutboundStem - plannedOutboundStem
            const outboundDelay = (actOBM !== null && planOBM !== null)
                ? fmtDur(actOBM - planOBM) : "";

            // 3. firstStopDelay = actualFirstStop - plannedFirstStop
            const firstStopDelay = (actFirstM !== null && planFirstM !== null)
                ? fmtDur(actFirstM - planFirstM) : "";

            // 4. lastStopDelay = actualLastStop - plannedLastStop
            const lastStopDelay = (actLastM !== null && planLastM !== null)
                ? fmtDur(actLastM - planLastM) : "";

            // 5. plannedRTSTime = waveTime + routeDuration + 0:20
            const plannedRTSM = (waveM !== null && durM !== null)
                ? waveM + durM + 20 : null;
            const plannedRTSTime = fmtTime(plannedRTSM);

            // 8. plannedDuration1stToLast = plannedLastStop - plannedFirstStop
            const planDur1LM = (planLastM !== null && planFirstM !== null)
                ? planLastM - planFirstM : null;
            const plannedDuration1stToLast = fmtDur(planDur1LM);

            // 9. actualDuration1stToLast = actualLastStop - actualFirstStop
            const actDur1LM = (actLastM !== null && actFirstM !== null)
                ? actLastM - actFirstM : null;
            const actualDuration1stToLast = fmtDur(actDur1LM);

            // 6. plannedInboundStem = plannedRTSTime - plannedLastStop
            const planIBM = (plannedRTSM !== null && planLastM !== null)
                ? plannedRTSM - planLastM : null;
            const plannedInboundStem = fmtDur(planIBM);

            // 7. estimatedRTSTime = deliveryCompletionTime + plannedInboundStem
            const estRTSM = (dctM !== null && planIBM !== null)
                ? dctM + planIBM : null;
            const estimatedRTSTime = fmtTime(estRTSM);

            // 10. stopsPerHour = stopCount / (plannedDuration1stToLast in hours)
            const stopsPerHour = (planDur1LM && planDur1LM > 0 && r.stopCount > 0)
                ? Math.round((r.stopCount / (planDur1LM / 60)) * 10) / 10 : 0;

            // 11. dctDelay = deliveryCompletionTime - actualLastStop
            const dctDelay = (dctM !== null && actLastM !== null)
                ? fmtDur(dctM - actLastM) : "";

            // 12. driverEfficiency = plannedDuration1stToLast / (actualDuration1stToLast + stopsRescued * stopsPerHour_in_mins)
            let driverEfficiency = r.driverEfficiency;
            if (planDur1LM && planDur1LM > 0 && actDur1LM && actDur1LM > 0) {
                const rescuedMins = stopsPerHour > 0 ? (r.stopsRescued * (60 / stopsPerHour)) : 0;
                const eff = (planDur1LM / (actDur1LM + rescuedMins)) * 100;
                if (isFinite(eff)) driverEfficiency = Math.round(eff);
            }

            // 13-14. regHrs / otHrs from totalHours
            const totalHrsDecimal = durToHrs(r.totalHours);
            const regHrs = totalHrsDecimal > 0 ? Math.min(totalHrsDecimal, 8) : 0;
            const otHrs = totalHrsDecimal > 8 ? totalHrsDecimal - 8 : 0;

            // 15-17. pay calculations using employee rate
            const rate = r.rate || 0;
            const regPay = Math.round(rate * regHrs * 100) / 100;
            const otPay = Math.round(rate * 1.5 * otHrs * 100) / 100;
            const totalCost = Math.round((regPay + otPay) * 100) / 100;

            return {
                ...r,
                wstRevenue: r.wst ? (wstRevenueMap[r.wst.toLowerCase()] || 0) : 0,
                departureDelay, outboundDelay, firstStopDelay, lastStopDelay,
                plannedRTSTime, plannedInboundStem, estimatedRTSTime,
                plannedDuration1stToLast, actualDuration1stToLast,
                stopsPerHour, dctDelay, driverEfficiency,
                regHrs: Math.round(regHrs * 100) / 100,
                otHrs: Math.round(otHrs * 100) / 100,
                totalCost, regPay, otPay,
                hoursWorkedLast7Days: 0, // computed below
            };
        });

        // 18. hoursWorkedLast7Days: sum totalHours across all routes for same employee
        const empHrsMap: Record<string, number> = {};
        enriched.forEach(r => {
            const hrs = durToHrs(r.totalHours);
            empHrsMap[r.transporterId] = (empHrsMap[r.transporterId] || 0) + hrs;
        });
        enriched.forEach(r => {
            r.hoursWorkedLast7Days = Math.round((empHrsMap[r.transporterId] || 0) * 100) / 100;
        });

        let dateFiltered = enriched;
        if (selectedDate) {
            dateFiltered = enriched.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        }
        const totalForDate = dateFiltered.length;

        // ── Compute date-aware routesCompleted ──
        // For each employee, sum all per-date counts up to (and including) selectedDate
        // Also compute the count up to the day before for trend icon
        const computeDateStr = selectedDate || enriched.reduce((latest, r) => {
            const d = r.date ? toPacificDate(r.date) : "";
            return d > latest ? d : latest;
        }, "");

        if (computeDateStr) {
            // Get day before in Pacific Time
            // Create a date at noon UTC to avoid any DST edge cases, then subtract a day
            const prevDate = new Date(computeDateStr + "T12:00:00Z");
            prevDate.setUTCDate(prevDate.getUTCDate() - 1);
            const prevDateStr = toPacificDate(prevDate);

            // Build cumulative counts per employee up to selectedDate and prevDate
            const empCumulative: Record<string, number> = {};
            const empCumulativePrev: Record<string, number> = {};

            Object.entries(routeCountsByDate).forEach(([tid, dateCounts]) => {
                let totalUpTo = 0;
                let totalUpToPrev = 0;
                Object.entries(dateCounts).forEach(([dt, count]) => {
                    if (dt <= computeDateStr) totalUpTo += count;
                    if (dt <= prevDateStr) totalUpToPrev += count;
                });
                // Add initial routesComp baseline
                const initComp = initialRoutesComp[tid] || 0;
                empCumulative[tid] = totalUpTo + initComp;
                empCumulativePrev[tid] = totalUpToPrev + initComp;
            });
            // For employees with only initialRoutesComp and no route counts
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

        let filtered = dateFiltered;
        if (confirmationFilter !== "all") {
            filtered = filtered.filter(r => {
                const status = r.confirmationStatus?.status;
                if (confirmationFilter === "none") {
                    return !status;
                }
                return status === confirmationFilter;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
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

        const numericKeys = new Set([
            "driverEfficiency", "routesCompleted", "stopCount", "packageCount",
            "wstDuration", "wstRevenue", "stopsPerHour", "regHrs", "otHrs",
            "totalCost", "regPay", "otPay", "hoursWorkedLast7Days",
        ]);

        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            const key = sortKey;
            if (key === "employee") { aVal = a.employeeName; bVal = b.employeeName; }
            else if (key === "confirmationStatus") { aVal = a.confirmationStatus?.status || ""; bVal = b.confirmationStatus?.status || ""; }
            else if (numericKeys.has(key)) { aVal = (a as any)[key] || 0; bVal = (b as any)[key] || 0; }
            else { aVal = (a as any)[key] || ""; bVal = (b as any)[key] || ""; }

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
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir, wstRevenueMap, routeCountsByDate, initialRoutesComp, confirmationFilter]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered, groupCount: groups.length });
    }, [totalFiltered, groups.length, setStats]);
    useEffect(() => { return () => setStats({}); }, [setStats]);

    // ── Render read-only cell ──
    const renderCell = (_row: RouteRow, _field: string, value: any) => {
        const raw = value === 0 || value === "" ? "—" : String(value);
        const displayVal = raw === "—" ? raw : stripSec(raw);
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
                                <tr className="bg-muted border-b border-border/50">
                                    {COLUMNS.map((col) => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className={cn(
                                                "text-left px-2 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap",
                                                col.sticky && "sticky left-0 z-20 bg-muted"
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
                                                                {row.type.toLowerCase() === "training otr" && <TruckIcon className="h-3 w-3 shrink-0" style={{ color: "#FE9EC7" }} />}
                                                                {row.type.toLowerCase() === "trainer" && <UserCheck className="h-3 w-3 shrink-0" style={{ color: "#FE9EC7" }} />}
                                                                <span
                                                                    className="text-[11px] font-bold whitespace-nowrap"
                                                                    style={row.type.toLowerCase() === "training otr" || row.type.toLowerCase() === "trainer" ? { color: "#FE9EC7" } : undefined}
                                                                >
                                                                    {row.employeeName}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Confirmation Status — clickable to update */}
                                                        <td className="px-2 py-1.5 align-middle">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="cursor-pointer hover:scale-110 transition-transform focus:outline-none">
                                                                        {row.confirmationStatus ? (
                                                                            <MessageStatusBadge
                                                                                status={row.confirmationStatus.status}
                                                                                createdAt={row.confirmationStatus.updatedAt}
                                                                                changeRemarks={row.confirmationStatus.changeRemarks}
                                                                                history={row.confirmationStatus.history}
                                                                                iconOnly
                                                                            />
                                                                        ) : (
                                                                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                                                                <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start" className="min-w-[180px]">
                                                                    <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                                        Set Confirmation
                                                                    </DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {[
                                                                        { value: "confirmed", label: "Confirmed", icon: CheckCircle2, color: "text-emerald-400" },
                                                                        { value: "change_requested", label: "Change Requested", icon: RefreshCw, color: "text-amber-400" },
                                                                        { value: "pending", label: "Pending", icon: Clock, color: "text-blue-400" },
                                                                    ].map((opt) => (
                                                                        <DropdownMenuItem
                                                                            key={opt.value}
                                                                            className="gap-2 cursor-pointer"
                                                                            disabled={row.confirmationStatus?.status === opt.value}
                                                                            onClick={async () => {
                                                                                let remarks = "";
                                                                                if (opt.value === "change_requested") {
                                                                                    const input = window.prompt("Change remarks (optional):");
                                                                                    if (input === null) return; // cancelled
                                                                                    remarks = input;
                                                                                }
                                                                                try {
                                                                                    const dateStr = row.date && typeof row.date === 'string' ? row.date.split('T')[0] : "";
                                                                                    const res = await fetch("/api/dispatching/confirmation-status", {
                                                                                        method: "PUT",
                                                                                        headers: { "Content-Type": "application/json" },
                                                                                        body: JSON.stringify({
                                                                                            transporterId: row.transporterId,
                                                                                            scheduleDate: dateStr,
                                                                                            yearWeek: selectedWeek,
                                                                                            status: opt.value,
                                                                                            changeRemarks: remarks,
                                                                                        }),
                                                                                    });
                                                                                    const data = await res.json();
                                                                                    if (!res.ok) throw new Error(data.error);
                                                                                    toast.success(`${row.employeeName}: ${opt.label}`);
                                                                                    refreshRoutes();
                                                                                } catch (err: any) {
                                                                                    toast.error(err.message || "Failed to update status");
                                                                                }
                                                                            }}
                                                                        >
                                                                            <opt.icon className={cn("h-3.5 w-3.5", opt.color)} />
                                                                            <span className="text-xs font-medium">{opt.label}</span>
                                                                            {row.confirmationStatus?.status === opt.value && (
                                                                                <Check className="h-3 w-3 ml-auto text-primary" />
                                                                            )}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
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
                                                        <td className="px-2 py-1.5 align-middle" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="cursor-pointer hover:bg-muted/50 rounded py-0.5 px-1 -ml-1 transition-colors focus:outline-none flex items-center gap-1 w-full text-left group">
                                                                        {renderCell(row, "van", row.van)}
                                                                        <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start" className="min-w-[150px] max-h-[300px] overflow-y-auto">
                                                                    <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover z-10 pt-2 pb-1">
                                                                        Select Van
                                                                    </DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem 
                                                                        onClick={() => handleVanChange(row._id, "", row.transporterId)}
                                                                        className="text-[11px] cursor-pointer text-muted-foreground"
                                                                    >
                                                                        <span className="flex-1">Clear Van</span>
                                                                        {!row.van && <Check className="h-3 w-3 ml-auto text-primary" />}
                                                                    </DropdownMenuItem>
                                                                    {getAvailableVans(row.date, row.van).map(v => {
                                                                        const isInactive = v.status && v.status.toLowerCase() !== "active";
                                                                        return (
                                                                            <DropdownMenuItem
                                                                                key={v.vehicleName}
                                                                                onClick={() => handleVanChange(row._id, v.vehicleName, row.transporterId)}
                                                                                className="text-[11px] cursor-pointer font-medium"
                                                                            >
                                                                                <div className="flex-1 flex items-center gap-1.5">
                                                                                    <span>{v.vehicleName}</span>
                                                                                    {isInactive && (
                                                                                        <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                                                                                            <AlertCircle className="h-3 w-3 text-red-500" />
                                                                                            <span className="text-[9px] font-bold text-red-500 uppercase">{v.status}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {row.van === v.vehicleName && (
                                                                                    <Check className="h-3 w-3 ml-auto text-primary" />
                                                                                )}
                                                                            </DropdownMenuItem>
                                                                        );
                                                                    })}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>

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

                                                        {/* Type (inline dropdown) */}
                                                        <td className="px-2 py-1.5 align-middle" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="cursor-pointer hover:bg-muted/50 rounded py-0.5 px-1 -ml-1 transition-colors focus:outline-none flex items-center gap-1 w-full text-left group">
                                                                        {(() => {
                                                                            const typeOpt = TYPE_MAP.get((row.type || "").trim().toLowerCase());
                                                                            const style = getTypeStyle(row.type);
                                                                            const Icon = typeOpt?.icon;
                                                                            return (
                                                                                <span className={cn(
                                                                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                                                                                    style.bg, style.text, style.border
                                                                                )}>
                                                                                    {Icon && <Icon className="h-2.5 w-2.5" />}
                                                                                    {row.type || "—"}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                        <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start" className="min-w-[170px] max-h-[320px] overflow-y-auto">
                                                                    <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover z-10 pt-2 pb-1">
                                                                        Set Type
                                                                    </DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {TYPE_OPTIONS.map(opt => {
                                                                        const isActive = (row.type || "").trim().toLowerCase() === opt.label.toLowerCase();
                                                                        return (
                                                                            <DropdownMenuItem
                                                                                key={opt.label}
                                                                                onClick={() => handleTypeChange(row._id, opt.label, row.transporterId)}
                                                                                className="gap-2 cursor-pointer"
                                                                                disabled={isActive}
                                                                            >
                                                                                <div className={cn(
                                                                                    "flex items-center justify-center w-5 h-5 rounded",
                                                                                    opt.bg, opt.border, "border"
                                                                                )}>
                                                                                    <opt.icon className={cn("h-3 w-3", opt.text)} />
                                                                                </div>
                                                                                <span className="text-xs font-medium flex-1">{opt.label}</span>
                                                                                {isActive && <Check className="h-3 w-3 ml-auto text-primary" />}
                                                                            </DropdownMenuItem>
                                                                        );
                                                                    })}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>

                                                        {/* 10. Routes Completed */}
                                                        <td className="px-2 py-1.5">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                                                                        {row.routesCompleted > 0 && row.routesCompletedPrev > 0 ? (
                                                                            row.routesCompleted > row.routesCompletedPrev ? (
                                                                                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                                                                            ) : row.routesCompleted === row.routesCompletedPrev ? (
                                                                                <Minus className="h-2.5 w-2.5 text-amber-400" />
                                                                            ) : (
                                                                                <TrendingDown className="h-2.5 w-2.5 text-red-400" />
                                                                            )
                                                                        ) : (
                                                                            <TrendingUp className="h-2.5 w-2.5 text-primary/50" />
                                                                        )}
                                                                        <span className="text-[11px] font-medium">{row.routesCompleted}</span>
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

                                                        {/* Departure Delay (computed) */}
                                                        <td className="px-2 py-1.5">
                                                            {row.departureDelay ? (
                                                                <span className={cn("text-[11px] font-semibold whitespace-nowrap", isDelayPositive(row.departureDelay) ? "text-red-400" : "text-emerald-500")}>
                                                                    {stripSec(row.departureDelay)}
                                                                </span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* OB Delay (computed) */}
                                                        <td className="px-2 py-1.5">
                                                            {row.outboundDelay ? (
                                                                <span className={cn("text-[11px] font-semibold whitespace-nowrap", isDelayPositive(row.outboundDelay) ? "text-red-400" : "text-emerald-500")}>
                                                                    {stripSec(row.outboundDelay)}
                                                                </span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* 1st Stop Delay (computed) */}
                                                        <td className="px-2 py-1.5">
                                                            {row.firstStopDelay ? (
                                                                <span className={cn("text-[11px] font-semibold whitespace-nowrap", isDelayPositive(row.firstStopDelay) ? "text-red-400" : "text-emerald-500")}>
                                                                    {stripSec(row.firstStopDelay)}
                                                                </span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Last Stop Delay (computed) */}
                                                        <td className="px-2 py-1.5">
                                                            {row.lastStopDelay ? (
                                                                <span className={cn("text-[11px] font-semibold whitespace-nowrap", isDelayPositive(row.lastStopDelay) ? "text-red-400" : "text-emerald-500")}>
                                                                    {stripSec(row.lastStopDelay)}
                                                                </span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* DCT Delay (computed) */}
                                                        <td className="px-2 py-1.5">
                                                            {row.dctDelay ? (
                                                                <span className={cn("text-[11px] font-semibold whitespace-nowrap", isDelayPositive(row.dctDelay) ? "text-red-400" : "text-emerald-500")}>
                                                                    {stripSec(row.dctDelay)}
                                                                </span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Plan RTS */}
                                                        <td className="px-2 py-1.5">
                                                            {row.plannedRTSTime ? (
                                                                <span className="text-[11px] font-semibold text-blue-400 whitespace-nowrap">{stripSec(row.plannedRTSTime)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Plan IB */}
                                                        <td className="px-2 py-1.5">
                                                            {row.plannedInboundStem ? (
                                                                <span className="text-[11px] font-semibold text-foreground/70 whitespace-nowrap">{stripSec(row.plannedInboundStem)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Est RTS */}
                                                        <td className="px-2 py-1.5">
                                                            {row.estimatedRTSTime ? (
                                                                <span className="text-[11px] font-semibold text-violet-400 whitespace-nowrap">{stripSec(row.estimatedRTSTime)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Plan 1st→Last */}
                                                        <td className="px-2 py-1.5">
                                                            {row.plannedDuration1stToLast ? (
                                                                <span className="text-[11px] font-semibold text-foreground/70 whitespace-nowrap">{stripSec(row.plannedDuration1stToLast)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Act 1st→Last */}
                                                        <td className="px-2 py-1.5">
                                                            {row.actualDuration1stToLast ? (
                                                                <span className="text-[11px] font-semibold text-foreground/70 whitespace-nowrap">{stripSec(row.actualDuration1stToLast)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Stops/Hr */}
                                                        <td className="px-2 py-1.5">
                                                            {row.stopsPerHour > 0 ? (
                                                                <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">{row.stopsPerHour}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Total Hours */}
                                                        <td className="px-2 py-1.5">{renderCell(row, "totalHours", row.totalHours)}</td>

                                                        {/* Reg Hours */}
                                                        <td className="px-2 py-1.5">
                                                            {row.regHrs > 0 ? (
                                                                <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">{row.regHrs.toFixed(2)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* OT Hours */}
                                                        <td className="px-2 py-1.5">
                                                            {row.otHrs > 0 ? (
                                                                <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">{row.otHrs.toFixed(2)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Reg Pay */}
                                                        <td className="px-2 py-1.5">
                                                            {row.regPay > 0 ? (
                                                                <span className="text-[11px] font-semibold text-emerald-500 whitespace-nowrap">${row.regPay.toFixed(2)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* OT Pay */}
                                                        <td className="px-2 py-1.5">
                                                            {row.otPay > 0 ? (
                                                                <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">${row.otPay.toFixed(2)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Total Cost */}
                                                        <td className="px-2 py-1.5">
                                                            {row.totalCost > 0 ? (
                                                                <span className="text-[11px] font-bold text-emerald-400 whitespace-nowrap">${row.totalCost.toFixed(2)}</span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* 7d Hrs */}
                                                        <td className="px-2 py-1.5">
                                                            {row.hoursWorkedLast7Days > 0 ? (
                                                                <span className={cn("text-[11px] font-bold whitespace-nowrap", row.hoursWorkedLast7Days > 40 ? "text-red-400" : "text-blue-400")}>
                                                                    {row.hoursWorkedLast7Days.toFixed(1)}h
                                                                </span>
                                                            ) : <span className="text-[11px] text-muted-foreground/30 font-semibold">—</span>}
                                                        </td>

                                                        {/* Eff % */}
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
