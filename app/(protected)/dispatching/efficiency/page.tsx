"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../_components/dispatching-context";
import { useRouteTypes } from "@/lib/query/hooks/useShared";
import { getContrastText } from "@/lib/route-types";
import { parseTime, parseStem, fmtDur, fmtTime } from "../routes/_components/routes-utils";

import { cn } from "@/lib/utils";
import {
    Users,
    Loader2,
    ChevronUp,
    ChevronDown,
    ChevronRight,
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
import { notify } from "@/lib/notify";
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
import { getTypeStyle, TYPE_OPTIONS, TYPE_MAP } from "@/lib/route-types";

/** Strip trailing seconds from time strings: "6:30:00" → "6:30" */
function stripSec(v: string): string {
    if (!v) return v;
    if ((v.match(/:/g) || []).length === 2) return v.replace(/:\d{2}$/, "");
    return v;
}
function isDelayPositive(d: string): boolean {
    return !!d && !d.startsWith("-") && d !== "0:00" && d !== "00:00";
}

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", width: "w-[260px] shrink-0 sticky left-0 z-20 bg-card border-r border-border/50 font-bold pl-3" },
    { key: "routeNumber", label: "Route #", width: "w-[80px] shrink-0" },
    { key: "stopCount", label: "Stops", width: "w-[70px] shrink-0" },
    { key: "routeDuration", label: "Duration", width: "w-[80px] shrink-0" },
    { key: "waveTime", label: "Wave", width: "w-[75px] shrink-0" },
    { key: "appSignIn", label: "App In", width: "w-[70px] shrink-0" },
    { key: "plannedDeparture", label: "Pln Dep", width: "w-[75px] shrink-0" },
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
    { key: "plannedEndTime", label: "Pln End", width: "w-[70px] shrink-0" },
    { key: "plannedRTSTime", label: "Pln RTS", width: "w-[75px] shrink-0" },
    { key: "estimatedRTSTime", label: "Est RTS", width: "w-[75px] shrink-0" },
    { key: "plannedInboundStem", label: "Pln IB", width: "w-[70px] shrink-0" },
    { key: "actualInboundStem", label: "Act IB", width: "w-[70px] shrink-0" },
    { key: "inboundDelay", label: "IB Delay", width: "w-[75px] shrink-0" },
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
    "appSignIn", "plannedEndTime",
    "actualDepartureTime",
    "plannedOutboundStem", "actualOutboundStem",
    "plannedFirstStop", "actualFirstStop",
    "plannedLastStop", "actualLastStop",
    "deliveryCompletionTime", "stopsRescued",
]);

// Auto-computed fields (never editable)
const COMPUTED_FIELDS = new Set([
    "plannedDeparture", "departureDelay", "outboundDelay", "firstStopDelay", "lastStopDelay", "actualInboundStem", "inboundDelay",
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
    plannedDeparture: string;
    appSignIn: string;
    plannedEndTime: string;
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
    actualInboundStem: string;
    inboundDelay: string;
    plannedDuration1stToLast: string;
    actualDuration1stToLast: string;
    stopsPerHour: number;
    deliveryCompletionTime: string;
    dctDelay: string;
    stopsRescued: number;
    typeId: string;
    typeColor: string;
    driverEfficiency: number;
    cortexSyncedFields?: string[];
    cortexConflicts?: { field: string; cortexValue: string; currentValue: string; detectedAt: string }[];
}

const TIME_OF_DAY = new Set(["plannedDeparture", "actualDepartureTime", "plannedFirstStop", "actualFirstStop", "plannedLastStop", "actualLastStop", "deliveryCompletionTime", "appSignIn", "plannedEndTime"]);

// ── Delay severity (minutes late; negative = early) ──
// Bands: [green below, white through, yellow through, red-text through]; above the last = highlighted red.
const DELAY_BANDS: Record<string, [number, number, number]> = {
    departureDelay: [0, 5, 9],   // <1 green · 1–5 white · 6–9 yellow · 10–15 red · >15 highlighted
    outboundDelay: [0, 5, 9],
    inboundDelay: [0, 5, 9],
    dctDelay: [0, 5, 9],
    firstStopDelay: [0, 5, 14],  // compounds dep + outbound, so a wider yellow band
    lastStopDelay: [0, 14, 29],  // end-of-day drift: 1–14 white · 15–29 yellow · 30–45 red · 46+ highlighted
};
const DELAY_RED_MAX: Record<string, number> = { departureDelay: 15, outboundDelay: 15, inboundDelay: 15, dctDelay: 15, firstStopDelay: 29, lastStopDelay: 45 };
function delayMinutes(v: string): number | null {
    const m = String(v || "").trim().match(/^(-?)(\d+):(\d{2})/);
    if (!m) return null;
    const n = parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    return m[1] ? -n : n;
}
function delayTone(field: string, v: string): "green" | "white" | "yellow" | "red" | "critical" | null {
    const bands = DELAY_BANDS[field]; const mins = delayMinutes(v);
    if (!bands || mins === null) return null;
    if (mins <= bands[0]) return "green";
    if (mins <= bands[1]) return "white";
    if (mins <= bands[2]) return "yellow";
    if (mins <= DELAY_RED_MAX[field]) return "red";
    return "critical";
}
const TONE_CLASS: Record<string, string> = {
    green: "text-emerald-400",
    white: "text-foreground",
    yellow: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30 px-1.5 py-0.5 rounded-md",
    red: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30 px-1.5 py-0.5 rounded-md",
    critical: "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-md shadow-sm",
};

// ── Column groups (header band + divider on the first column of each group) ──
const COLUMN_GROUPS: { label: string; keys: string[]; tint: string; col: string; strong: string }[] = [
    { label: "Driver", keys: ["employee", "routeNumber", "stopCount", "routeDuration", "waveTime"], tint: "text-slate-300 bg-slate-500/10", col: "bg-slate-400/[0.04]", strong: "bg-slate-400/[0.08]" },
    { label: "Departure", keys: ["appSignIn", "plannedDeparture", "actualDepartureTime", "departureDelay"], tint: "text-sky-300 bg-sky-500/10", col: "bg-sky-400/[0.06]", strong: "bg-sky-400/[0.13]" },
    { label: "Outbound drive", keys: ["plannedOutboundStem", "actualOutboundStem", "outboundDelay"], tint: "text-violet-300 bg-violet-500/10", col: "bg-violet-400/[0.06]", strong: "bg-violet-400/[0.13]" },
    { label: "First stop", keys: ["plannedFirstStop", "actualFirstStop", "firstStopDelay"], tint: "text-emerald-300 bg-emerald-500/10", col: "bg-emerald-400/[0.06]", strong: "bg-emerald-400/[0.13]" },
    { label: "Last stop", keys: ["plannedLastStop", "actualLastStop", "lastStopDelay"], tint: "text-amber-300 bg-amber-500/10", col: "bg-amber-400/[0.06]", strong: "bg-amber-400/[0.13]" },
    { label: "Return to station", keys: ["plannedEndTime", "plannedRTSTime", "estimatedRTSTime", "plannedInboundStem", "actualInboundStem", "inboundDelay"], tint: "text-rose-300 bg-rose-500/10", col: "bg-rose-400/[0.06]", strong: "bg-rose-400/[0.13]" },
    { label: "Totals", keys: ["plannedDuration1stToLast", "actualDuration1stToLast", "stopsPerHour", "deliveryCompletionTime", "dctDelay", "stopsRescued", "driverEfficiency", "actions"], tint: "text-teal-300 bg-teal-500/10", col: "bg-teal-400/[0.06]", strong: "bg-teal-400/[0.13]" },
];
// Whole-column wash: soft tint per phase, stronger on the delay (answer) columns.
const COL_BG: Record<string, string> = {};
COLUMN_GROUPS.forEach(g => g.keys.forEach(k => { COL_BG[k] = String(k).toLowerCase().includes("delay") ? g.strong : g.col; }));
const GROUP_FIRST = new Set(COLUMN_GROUPS.map(g => g.keys[0]));
const colPx = (w: string) => Number((w.match(/w-\[(\d+)px\]/) || [])[1] || 0);

type SortKey = typeof COLUMNS[number]["key"];

export default function EfficiencyPage() {
    const queryClient = useQueryClient();
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats, globalEditMode, setGlobalEditMode } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = useCallback((type: string) => setCollapsedGroups(prev => ({ ...prev, [type]: !prev[type] })), []);

    // ── Quick Edit Modal State ──
    const [quickEditRow, setQuickEditRow] = useState<RouteRow | null>(null);
    const [quickEditForm, setQuickEditForm] = useState<Partial<RouteRow>>({});

    // ── Route Types for dynamic color resolution ──
    const { data: storeRouteTypes } = useRouteTypes();
    const routeTypeIdMap = useMemo(() => {
        const map = new Map<string, any>();
        if (Array.isArray(storeRouteTypes)) storeRouteTypes.forEach((rt: any) => map.set(String(rt._id), rt));
        return map;
    }, [storeRouteTypes]);
    const routeTypeNameMap = useMemo(() => {
        const map = new Map<string, any>();
        if (Array.isArray(storeRouteTypes)) storeRouteTypes.forEach((rt: any) => map.set((rt.name || "").trim().toLowerCase(), rt));
        return map;
    }, [storeRouteTypes]);
    const resolveRT = useCallback((row: { typeId?: string; type: string }) => {
        if (row.typeId) { const rt = routeTypeIdMap.get(row.typeId); if (rt) return rt; }
        return routeTypeNameMap.get((row.type || "").trim().toLowerCase()) || null;
    }, [routeTypeIdMap, routeTypeNameMap]);

    // ── Parse Smart Time ──
    // Time entry. Honors an explicit "a"/"p" ("1:05 PM", "105p"). With no
    // AM/PM typed, a time-of-day that would land well before the route's wave
    // ("105" on an 11:30 wave) is read as PM instead of silently saving 1:05 AM.
    const parseSmartTime = (val: string, waveTime?: string, timeOfDay = false) => {
        if (!val) return "";
        const lower = val.toLowerCase();
        const hasP = /p/.test(lower), hasA = /a/.test(lower);
        let clean = val.replace(/[^\d]/g, "");
        if (clean.length === 1 || clean.length === 2) clean = `${clean.padStart(2, "0")}00`;
        if (clean.length === 3) clean = `0${clean}`;
        if (clean.length !== 4) return val;
        let h = parseInt(clean.slice(0, 2));
        let m = parseInt(clean.slice(2, 4));
        if (h > 23) h = 23;
        if (m > 59) m = 59;
        if (hasP && h < 12) h += 12;
        else if (hasA && h === 12) h = 0;
        else if (!hasP && !hasA && timeOfDay && h < 12) {
            const waveM = parseTime(waveTime || "");
            if (waveM !== null && h * 60 + m < waveM - 60 && (h + 12) * 60 + m <= 23 * 60 + 59) h += 12;
        }
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    // ── Hydrate from layout's shared rawRouteData (no independent fetch) ──
    const { rawRouteData, rawRouteDataLoading } = useDispatching();
    // Minutes between wave time and planned departure for this station (Settings → Wave & PAD).
    const { data: wavePadCfg } = useQuery({
        queryKey: ["wave-pads-offset"],
        queryFn: async () => { const r = await fetch("/api/admin/settings/wave-pads"); return r.ok ? r.json() : { offset: 20 }; },
        staleTime: 30 * 1000,
    });
    const waveOffset: number = Number.isFinite(wavePadCfg?.offset) ? wavePadCfg.offset : 20;

    useEffect(() => {
        if (rawRouteDataLoading) { setLoading(true); return; }
        if (!rawRouteData || !rawRouteData.routes || rawRouteData.routes.length === 0) {
            setAllRoutes([]);
            setLoading(false);
            return;
        }
        const rows: RouteRow[] = rawRouteData.routes.map((rec: any) => {
            const emp = rawRouteData.employees?.[rec.transporterId];

            // Parse raw time values for computed fields
            const waveM = parseTime(rec.waveTime || "");
            const durM = parseTime(rec.routeDuration || "");
            const actDepM = parseTime(rec.actualDepartureTime || "");
            const planOBM = parseStem(rec.plannedOutboundStem || "");
            const actOBM = parseStem(rec.actualOutboundStem || "");
            const planFirstM = parseTime(rec.plannedFirstStop || "");
            const actFirstM = parseTime(rec.actualFirstStop || "");
            const planLastM = parseTime(rec.plannedLastStop || "");
            const actLastM = parseTime(rec.actualLastStop || "");
            const dctM = parseTime(rec.deliveryCompletionTime || "");

            // Compute derived fields (same logic as routes/page.tsx)
            const planDepM = waveM !== null ? waveM + waveOffset : null;
            const plannedDeparture = fmtTime(planDepM);
            const departureDelay = (actDepM !== null && planDepM !== null) ? fmtDur(actDepM - planDepM) : "";
            const outboundDelay = (actOBM !== null && planOBM !== null) ? fmtDur(actOBM - planOBM) : "";
            const firstStopDelay = (actFirstM !== null && planFirstM !== null) ? fmtDur(actFirstM - planFirstM) : "";
            const lastStopDelay = (actLastM !== null && planLastM !== null) ? fmtDur(actLastM - planLastM) : "";

            const plannedRTSM = (waveM !== null && durM !== null) ? waveM + durM + waveOffset : null;
            const plannedRTSTime = fmtTime(plannedRTSM);

            const planDur1LM = (planLastM !== null && planFirstM !== null) ? planLastM - planFirstM : null;
            const plannedDuration1stToLast = fmtDur(planDur1LM);

            const actDur1LM = (actLastM !== null && actFirstM !== null) ? actLastM - actFirstM : null;
            const actualDuration1stToLast = fmtDur(actDur1LM);

            const planIBM = (plannedRTSM !== null && planLastM !== null) ? plannedRTSM - planLastM : null;
            // Plan IB: Cortex's planned drive back (stored), else the old estimate only if sensible.
            const storedIB = parseStem(rec.plannedInboundStem || "");
            const planIBFinal = storedIB !== null ? storedIB : (planIBM !== null && planIBM >= 0 && planIBM <= 360 ? planIBM : null);
            const plannedInboundStem = fmtDur(planIBFinal);
            // Actual IB: last delivery -> back at station. Delay = actual - plan.
            const actRetM = parseTime(rec.actualReturnTime || "");
            const actIBM = (actRetM !== null && actLastM !== null && actRetM >= actLastM) ? actRetM - actLastM : null;
            const actualInboundStem = fmtDur(actIBM);
            const inboundDelay = (actIBM !== null && planIBFinal !== null) ? fmtDur(actIBM - planIBFinal) : "";

            const estRTSM = (dctM !== null && planIBFinal !== null) ? dctM + planIBFinal : null;
            const estimatedRTSTime = fmtTime(estRTSM);

            const stopCount = rec.stopCount || 0;
            const stopsPerHour = (planDur1LM && planDur1LM > 0 && stopCount > 0)
                ? Math.round((stopCount / (planDur1LM / 60)) * 10) / 10 : 0;

            const dctDelay = (dctM !== null && actLastM !== null) ? fmtDur(dctM - actLastM) : "";

            let driverEfficiency = rec.driverEfficiency || 0;
            if (planDur1LM && planDur1LM > 0 && actDur1LM && actDur1LM > 0) {
                const rescuedMins = stopsPerHour > 0 ? ((rec.stopsRescued || 0) * (60 / stopsPerHour)) : 0;
                const eff = (planDur1LM / (actDur1LM + rescuedMins)) * 100;
                if (isFinite(eff)) driverEfficiency = Math.round(eff);
            }

            return {
                _id: rec._id,
                transporterId: rec.transporterId,
                date: rec.date,
                weekDay: rec.weekDay || "",
                employeeName: emp?.name || rec.transporterId,
                type: rec.type || "",
                typeId: rec.typeId || "",
                typeColor: "",
                routeNumber: rec.routeNumber || "",
                stopCount,
                routeDuration: rec.routeDuration || "",
                waveTime: rec.waveTime || "",
                plannedDeparture,
                appSignIn: rec.appSignIn || "",
                plannedEndTime: rec.plannedEndTime || "",
                actualDepartureTime: rec.actualDepartureTime || "",
                departureDelay,
                plannedOutboundStem: rec.plannedOutboundStem || "",
                actualOutboundStem: rec.actualOutboundStem || "",
                outboundDelay,
                plannedFirstStop: rec.plannedFirstStop || "",
                actualFirstStop: rec.actualFirstStop || "",
                firstStopDelay,
                plannedLastStop: rec.plannedLastStop || "",
                actualLastStop: rec.actualLastStop || "",
                lastStopDelay,
                plannedRTSTime,
                estimatedRTSTime,
                plannedInboundStem,
                actualInboundStem,
                inboundDelay,
                plannedDuration1stToLast,
                actualDuration1stToLast,
                stopsPerHour,
                deliveryCompletionTime: rec.deliveryCompletionTime || "",
                dctDelay,
                stopsRescued: rec.stopsRescued || 0,
                driverEfficiency: Math.round(driverEfficiency * 10) / 10,
            };
        });
        // Resolve typeColor from DB types
        const resolvedRows = rows.map(row => {
            const rt = row.typeId ? routeTypeIdMap.get(row.typeId) : routeTypeNameMap.get((row.type || "").trim().toLowerCase());
            return { ...row, typeColor: rt?.color || "" };
        });
        setAllRoutes(resolvedRows);
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading, routeTypeIdMap, routeTypeNameMap, waveOffset]);

    // ── Helper: patch TanStack cache directly for instant cross-tab sync ──
    const patchRouteCache = useCallback((routeId: string, updates: Record<string, any>) => {
        const patchFn = (old: any) => {
            if (!old?.routes) return old;
            return {
                ...old,
                routes: old.routes.map((r: any) =>
                    r._id === routeId ? { ...r, ...updates } : r
                ),
            };
        };
        queryClient.setQueryData(["dispatching", "routes", selectedWeek], patchFn);
        if (selectedDate) {
            queryClient.setQueryData(["dispatching", "routes", selectedWeek, selectedDate], patchFn);
        }
    }, [queryClient, selectedWeek, selectedDate]);

    // ── Save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        const numericFields = new Set(["stopCount", "stopsPerHour", "stopsRescued", "driverEfficiency"]);
        const parsedValue = numericFields.has(field) ? (parseFloat(value) || 0) : value;

        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: parsedValue } : r));
        patchRouteCache(routeId, { [field]: parsedValue });
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { [field]: parsedValue } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            notify.success(`Updated ${field}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        } catch (err: any) {
            notify.error(err.message || "Failed to update");
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        }
    }, [queryClient, patchRouteCache]);

    // ── Cortex conflict resolution ──
    const [openConflictKey, setOpenConflictKey] = useState<string | null>(null);
    const resolveCortexConflict = useCallback(async (
        routeId: string, field: string, cortexValue: string, action: "use" | "keep"
    ) => {
        setOpenConflictKey(null);
        // Optimistic update
        setAllRoutes(prev => prev.map(r => {
            if (r._id !== routeId) return r;
            const remaining = (r.cortexConflicts || []).filter(c => c.field !== field);
            if (action === "use") {
                const owned = new Set(r.cortexSyncedFields || []);
                owned.add(field);
                return { ...r, [field]: cortexValue, cortexConflicts: remaining, cortexSyncedFields: Array.from(owned) };
            }
            return { ...r, cortexConflicts: remaining };
        }));
        try {
            const res = await fetch("/api/dispatching/routes/cortex-conflict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, field, action }),
            });
            if (!res.ok) throw new Error();
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        } catch {
            notify.error("Failed to resolve Cortex conflict");
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        }
    }, [queryClient]);

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
        patchRouteCache(routeId, updates as Record<string, any>);
        setQuickEditRow(null);

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates }),
            });
            if (!res.ok) throw new Error();
            notify.success(`Updated efficiency entry for ${quickEditRow.employeeName}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        } catch {
            notify.error("Failed to update efficiency entry");
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
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
    const { filteredRoutes, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        
        // Show everyone with an assigned route (Route type, Training OTR, Flight Risk, etc.) —
        // not just the plain "Route" type.
        dateFiltered = dateFiltered.filter(r => (r.type || "").trim().toLowerCase() === "route" || !!(r.routeNumber || "").trim());
        
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

        if (sortKey === "employee") {
            sorted.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
        }

        return { filteredRoutes: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Stats ──
    useEffect(() => { setStats({ employeeCount: totalFiltered }); }, [totalFiltered, setStats]);
    useEffect(() => { return () => setStats({}); }, [setStats]);

    if (rawRouteData?.routes?.length > 0 && allRoutes.length === 0) {
        return <div className="flex-1 opacity-0 pointer-events-none" />;
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
        const conflict = row.cortexConflicts?.find(c => c.field === field);
        const conflictKey = `${row._id}:${field}`;
        const raw = value === 0 || value === "" ? "—" : String(value);
        
        let displayVal = raw === "—" ? raw : stripSec(raw);
        if (TIME_OF_DAY.has(field as string) && raw !== "—") {
            const mins = parseTime(raw);
            if (mins !== null) displayVal = fmtTime(mins);
        } else if (field === "driverEfficiency" && raw !== "—") {
            displayVal = raw.endsWith("%") ? raw : `${raw}%`;
        }

        const isTimeField = field.toLowerCase().includes("time") || field.toLowerCase().includes("delay") || field.toLowerCase().includes("duration") || field.toLowerCase().includes("stem") || field.toLowerCase().includes("stop");
        const isNumeric = ["stopCount", "stopsPerHour", "stopsRescued", "driverEfficiency"].includes(field);
        const isDelayField = field.toLowerCase().includes("delay");

        const handleInputKey = (val: string) => isTimeField ? parseSmartTime(val, row.waveTime, TIME_OF_DAY.has(field)) : val;

        let customBg = String(field).startsWith("planned") || field === "plannedRTSTime" || field === "routeDuration" ? "text-muted-foreground" : "text-foreground";
        let Icon = null;
        if (displayVal === "—") {
            customBg = "text-muted-foreground/40";
        } else if (isDelayField) {
            const tone = delayTone(field as string, String(value));
            customBg = TONE_CLASS[tone || "white"];
            // Nobody should leave late: any departure delay over 0 is bold red.
            if (field === "departureDelay" && (delayMinutes(String(value)) ?? 0) > 0) customBg = "text-red-500 font-extrabold";
            if (tone === "critical") Icon = AlertCircle;
        } else {
            if (field === "actualDepartureTime") {
                const actDepParts = String(value).split(":");
                const waveParts = String(row.waveTime || "").split(":");
                if (actDepParts.length >= 2 && waveParts.length >= 2) {
                    const actMins = parseInt(actDepParts[0], 10) * 60 + parseInt(actDepParts[1], 10);
                    const waveMins = parseInt(waveParts[0], 10) * 60 + parseInt(waveParts[1], 10);
                    if (actMins >= waveMins + 80) { customBg = "bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm"; Icon = AlertCircle; }
                }
            }
        }

        // Cortex found a value that disagrees with what's already here — flag it
        // instead of silently overwriting (see cortex-sync route for the logic).
        const conflictBadge = conflict ? (
            <>
                <button
                    type="button"
                    title={`Cortex found ${conflict.cortexValue} (currently ${conflict.currentValue || "blank"})`}
                    onClick={(e) => { e.stopPropagation(); setOpenConflictKey(k => k === conflictKey ? null : conflictKey); }}
                    className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border border-background z-10 hover:scale-125 transition-transform"
                />
                {openConflictKey === conflictKey && (
                    <div
                        className="absolute top-full right-0 mt-1 z-30 w-52 rounded-md border border-border bg-popover shadow-lg p-2 text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-[10px] text-muted-foreground mb-1.5">
                            Cortex found <span className="font-semibold text-foreground">{conflict.cortexValue}</span>
                            {" "}— you have <span className="font-semibold text-foreground">{conflict.currentValue || "blank"}</span>
                        </p>
                        <div className="flex gap-1.5">
                            <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => resolveCortexConflict(row._id, field, conflict.cortexValue, "use")}>
                                Use Cortex
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={() => resolveCortexConflict(row._id, field, conflict.cortexValue, "keep")}>
                                Keep mine
                            </Button>
                        </div>
                    </div>
                )}
            </>
        ) : null;

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
                    {conflictBadge}
                </div>
            );
        }

        // Read-only display
        const CellContent = Icon ? (
            <div className={cn("flex items-center gap-1 w-max", customBg)}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] truncate">{displayVal}</span>
            </div>
        ) : (
            <span className={cn("text-[11px] truncate font-semibold", customBg)}>{displayVal}</span>
        );

        return (
            <div className="relative w-full h-7 flex items-center justify-start px-1.5 text-[11px]">
                {CellContent}
                {conflictBadge}
            </div>
        );
    };

    // ── Type pill — uses DB color via resolveRT ──
    const renderType = (row: RouteRow) => {
        const rt = resolveRT(row);
        const color = rt?.color || getTypeStyle(row.type).colorHex || "#6B7280";
        const label = row.type || "—";
        return (
            <div
                className="relative flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold border select-none px-1.5"
                style={{
                    backgroundColor: color,
                    color: getContrastText(color),
                    borderColor: color,
                }}
            >
                <span className="truncate">{label}</span>
            </div>
        );
    };

    // ── Efficiency cell with color ──
    const renderEfficiency = (row: RouteRow) => {
        const displayVal = row.driverEfficiency !== undefined && row.driverEfficiency !== 0 ? `${row.driverEfficiency}%` : "—";
        return renderCell(row, "driverEfficiency", displayVal);
    };

    // ── Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full rounded-xl border border-border/50 bg-card overflow-hidden">
                {/* Scrollable Container */}
                <div className="flex-1 overflow-auto w-full relative">
                    <div className="w-max min-w-full flex flex-col min-h-full">
                        {/* Header: group band + column labels */}
                        <div className="sticky top-0 z-30 bg-card shadow-sm">
                            <div className="flex items-stretch border-b border-border/30">
                                {COLUMN_GROUPS.map((g) => {
                                    const px = g.keys.reduce((a, k) => a + colPx(COLUMNS.find(c => c.key === k)?.width || ""), 0);
                                    return (
                                        <div key={g.label} style={{ width: px }}
                                            className={cn("shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] py-1 px-2 rounded-sm", g.tint,)}>
                                            {g.label}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-stretch border-b border-border/50">
                                {COLUMNS.map((col) => {
                                    const isSticky = col.key === "employee";
                                    const isDelayCol = String(col.key).toLowerCase().includes("delay");
                                    return (
                                        <button key={col.key} onClick={() => handleSort(col.key)}
                                            className={cn(
                                                "flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-semibold hover:text-foreground transition-colors text-left px-1.5 py-2.5",
                                                COL_BG[col.key as string],
                                                isDelayCol ? "text-foreground/90" : "text-muted-foreground",
                                                col.width,
                                                GROUP_FIRST.has(col.key) && !isSticky && "border-l border-border/40",
                                                isSticky ? "bg-card self-stretch" : ""
                                            )}>
                                            {col.label}
                                            {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rows */}
                        <div className="flex-1">
                            {filteredRoutes.map((row, i) => (
                                <div key={row._id} className={cn("flex items-stretch border-b border-border/15 hover:bg-primary/5 transition-colors group/row", i % 2 === 1 && "bg-muted/10")}>
                                    {COLUMNS.map((col) => {
                                        const k = col.key as string;
                                        const first = GROUP_FIRST.has(k) && k !== "employee";
                                        const wrap = cn("flex items-center px-1.5 py-2", COL_BG[k], first && "border-l border-border/30");
                                        if (k === "employee") return (
                                            <div key={k} className="w-[260px] shrink-0 sticky left-0 z-20 bg-card border-r border-border/50 font-bold flex items-center gap-2 min-w-0 pl-3 pr-2 overflow-hidden self-stretch py-2">
                                                <span className="text-[12px] font-semibold truncate" style={{ color: row.typeColor || getTypeStyle(row.type).colorHex || "inherit" }}>{row.employeeName}</span>
                                                {(row.type || "").trim().toLowerCase() !== "route" && row.type && (
                                                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{row.type}</span>
                                                )}
                                            </div>
                                        );
                                        if (k === "actions") return (
                                            <div key={k} className={cn("w-[40px] shrink-0 pr-1 text-right flex items-center justify-end", COL_BG[k])}>
                                                <button onClick={() => { setQuickEditRow(row); setQuickEditForm(row); }}
                                                    className="p-1.5 rounded bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors shadow-sm ml-auto">
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                        return (
                                            <div key={k} className={cn(col.width, wrap)}>
                                                {k === "driverEfficiency" ? renderEfficiency(row) : renderCell(row, k as keyof RouteRow, (row as any)[k])}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {filteredRoutes.length === 0 && (
                                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground w-full absolute left-0">
                                    No employees found for this date
                                </div>
                            )}
                        </div>
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
                                        { key: "appSignIn", label: "App Sign In" },
                                        { key: "plannedEndTime", label: "Planned End" },
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
                                                                    setQuickEditForm(prev => ({ ...prev, [f.key]: parseSmartTime((prev as any)[f.key] || "", quickEditRow?.waveTime, TIME_OF_DAY.has(f.key)) }))
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
