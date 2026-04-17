"use client";

import React, { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    UserCheck,
    Wrench,
    Clock,
    DoorClosed,
    TrendingUp,
    Search,
    Pencil,
    ChevronLeft,
    ChevronRight,
    Plus,
    Loader2,
    CalendarDays,
    MapPin,
    Users,
    TableProperties,
    FileDown,
} from "lucide-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import RoutesInfoPanel from "../dispatching/_components/RoutesInfoPanel";
import { useDataStore } from "@/hooks/use-data-store";
import { generateRoutesPDF } from "@/lib/generate-routes-pdf";

// ── Shared Tab Definitions ──
export const DISPATCHING_TABS = [
    { id: "routes", label: "Routes", href: "/dispatching/routes", icon: MapPin, gradient: "from-orange-500 to-red-500", description: "Route details, roster, and delivery tracking" },
    { id: "attendance", label: "Attendance", href: "/dispatching/attendance", icon: UserCheck, gradient: "from-violet-500 to-purple-500", description: "Driver attendance tracking and check-ins" },
    { id: "time", label: "Time", href: "/dispatching/time", icon: Clock, gradient: "from-rose-500 to-pink-500", description: "Time tracking and shift management" },
    { id: "closing", label: "Closing", href: "/dispatching/closing", icon: DoorClosed, gradient: "from-indigo-500 to-blue-500", description: "End-of-day dispatch closing procedures" },
    { id: "efficiency", label: "Efficiency", href: "/dispatching/efficiency", icon: TrendingUp, gradient: "from-teal-500 to-emerald-500", description: "Route efficiency and performance metrics" },
] as const;

// ── Day names ──
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Stats type for child pages to push up ──
export interface DispatchingStats {
    routes?: number;
    operations?: number;
    rescue?: number;
    trainer?: number;
    reduction?: number;
    avgRouteDuration?: number | string;
    avgPackageCount?: number;
    totalPackageCount?: number;
}

// ── Context to share state with child pages ──
interface DispatchingContextType {
    selectedWeek: string;
    selectedDate: string;
    setSelectedDate: (date: string) => void;
    weekDates: string[];
    searchQuery: string;
    routesGenerated: boolean;
    routesLoading: boolean;
    refreshRoutes: () => void;
    refreshKey: number;
    setStats: (stats: DispatchingStats) => void;
    showRoutesInfo: boolean;
    setShowRoutesInfo: (show: boolean) => void;
    globalEditMode: boolean;
    setGlobalEditMode: (mode: boolean) => void;
    confirmationFilter: string;
    setConfirmationFilter: (filter: string) => void;
    /** Shared raw route data for the selected week — fetched once by layout, consumed by all tabs */
    rawRouteData: any;
    rawRouteDataLoading: boolean;
}

const DispatchingContext = createContext<DispatchingContextType>({
    selectedWeek: "",
    selectedDate: "",
    setSelectedDate: () => { },
    weekDates: [],
    searchQuery: "",
    routesGenerated: false,
    routesLoading: false,
    refreshRoutes: () => { },
    refreshKey: 0,
    setStats: () => { },
    showRoutesInfo: false,
    setShowRoutesInfo: () => { },
    globalEditMode: false,
    setGlobalEditMode: () => { },
    confirmationFilter: "all",
    setConfirmationFilter: () => { },
    rawRouteData: null,
    rawRouteDataLoading: false,
});

export function useDispatching() {
    return useContext(DispatchingContext);
}

// ── Week helpers ──
function formatWeekLabel(week: string) {
    const match = week.match(/(\d{4})-W(\d{2})/);
    if (!match) return week;
    return `${match[1]} – Week ${parseInt(match[2])}`;
}

/** Compute the 7 dates (Sun–Sat) for a given yearWeek string like "2026-W10". */
function getWeekDates(yearWeek: string): string[] {
    const match = yearWeek.match(/(\d{4})-W(\d{2})/);
    if (!match) return [];
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay();
    const firstSunday = new Date(jan1);
    firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
    const weekSunday = new Date(firstSunday);
    weekSunday.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekSunday);
        d.setUTCDate(weekSunday.getUTCDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

/** Business timezone — all "today" checks use Pacific Time. */
const BUSINESS_TZ = "America/Los_Angeles";

/** Get today's date string (YYYY-MM-DD) in Pacific Time. */
function getTodayPacific(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/** Compute current yearWeek (Sun-based) from today's date in Pacific Time. */
function getCurrentYearWeek(): string {
    const todayStr = getTodayPacific();
    const date = new Date(todayStr + "T00:00:00.000Z");
    const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat
    // Find the Sunday of this week
    const sundayOfThisWeek = new Date(date);
    sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
    const year = sundayOfThisWeek.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay();
    const firstSunday = new Date(jan1);
    firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
    const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

export default function DispatchingLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { setLeftContent, setRightContent } = useHeaderActions();

    // ── State ──
    const [weeks, setWeeks] = useState<string[]>([]);
    const [selectedWeek, setSelectedWeek] = useState(getCurrentYearWeek());
    const [selectedDate, setSelectedDate] = useState(getTodayPacific());
    const [searchQuery, setSearchQuery] = useState("");
    const [routesGenerated, setRoutesGenerated] = useState(false);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [stats, setStats] = useState<DispatchingStats>({});
    const [showRoutesInfo, setShowRoutesInfo] = useState(false);
    const [globalEditMode, setGlobalEditMode] = useState(false);
    const [confirmationFilter, setConfirmationFilter] = useState("all");

    // ── Compute week dates ──
    const weekDates = useMemo(() => {
        if (!selectedWeek) return [];
        return getWeekDates(selectedWeek);
    }, [selectedWeek]);

    const store = useDataStore();

    // ── Shared raw route data for all child tabs ──
    const [rawRouteData, setRawRouteData] = useState<any>(null);
    const [rawRouteDataLoading, setRawRouteDataLoading] = useState(false);
    const rawRouteWeekRef = React.useRef("");
    const fullWeekLoadedRef = React.useRef("");

    // ── Two-Phase Progressive Loading ──
    // Phase 1: Fetch ONLY the selected date's routes (small, fast ~200ms)
    // Phase 2: Fetch the FULL week in background, merge seamlessly
    useEffect(() => {
        if (!selectedWeek) return;
        let cancelled = false;

        // Try DataStore first for the default week (instant if available)
        if (
            store.initialized &&
            store.dispatchingRoutes &&
            store.dispatchingWeeks?.[0] === selectedWeek
        ) {
            setRawRouteData(store.dispatchingRoutes);
            setRawRouteDataLoading(false);
            setRoutesGenerated(!!(store.dispatchingRoutes?.routes?.length));
            setRoutesLoading(false);
            rawRouteWeekRef.current = selectedWeek;
            fullWeekLoadedRef.current = selectedWeek;
            return;
        }

        // Already have full week cached? Skip.
        if (fullWeekLoadedRef.current === selectedWeek && rawRouteData) {
            return;
        }

        if (!store.initialized) return;

        // ── PHASE 1: Fetch only the selected date ──
        const targetDate = selectedDate || weekDates[0] || "";
        rawRouteWeekRef.current = selectedWeek;
        setRawRouteDataLoading(true);
        setRoutesLoading(true);

        const phase1Url = targetDate
            ? `/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}&date=${encodeURIComponent(targetDate)}&cb=${Date.now()}`
            : `/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}&cb=${Date.now()}`;

        // Phase 1: Quick load (just 1 day)
        fetch(phase1Url)
            .then((r) => r.json())
            .then((dayData) => {
                if (cancelled) return;
                // Show the single day's data immediately
                setRawRouteData(dayData);
                setRoutesGenerated(!!(dayData?.routes?.length));
                setRawRouteDataLoading(false);
                setRoutesLoading(false);

                // ── PHASE 2: Full week in background ──
                if (targetDate) {
                    fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}&cb=${Date.now()}`)
                        .then((r) => r.json())
                        .then((fullData) => {
                            if (cancelled) return;
                            setRawRouteData(fullData);
                            setRoutesGenerated(!!(fullData?.routes?.length));
                            fullWeekLoadedRef.current = selectedWeek;
                        })
                        .catch(() => { /* silently fail — partial data already shown */ });
                } else {
                    fullWeekLoadedRef.current = selectedWeek;
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setRawRouteData(null);
                    setRawRouteDataLoading(false);
                    setRoutesLoading(false);
                }
            });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWeek, refreshKey, store.initialized, store.dispatchingRoutes]);

    // Force re-fetch when routes are regenerated
    useEffect(() => {
        if (refreshKey > 0) {
            rawRouteWeekRef.current = ""; // invalidate cache
            fullWeekLoadedRef.current = "";
        }
    }, [refreshKey]);

    const refreshRoutes = useCallback(() => {
        store.refresh("dispatching.routes");
        setRefreshKey((k) => k + 1);
    }, [store]);

    // ── Push title into global header ──
    const pageTitle = useMemo(() => {
        return "Load Out";
    }, [pathname]);

    useEffect(() => {
        setLeftContent(
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {pageTitle}
            </h1>
        );
        return () => setLeftContent(null);
    }, [setLeftContent, pageTitle]);

    // ── Push search into right side of header ──
    useEffect(() => {
        setRightContent(
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 w-[120px] sm:w-[200px] text-sm"
                    />
                </div>
            </div>
        );
        return () => setRightContent(null);
    }, [setRightContent, searchQuery]);

    return (
        <DispatchingContext.Provider
            value={{
                selectedWeek, selectedDate, setSelectedDate, weekDates, searchQuery,
                routesGenerated, routesLoading, refreshRoutes, refreshKey, setStats,
                showRoutesInfo, setShowRoutesInfo,
                globalEditMode, setGlobalEditMode,
                confirmationFilter, setConfirmationFilter,
                rawRouteData, rawRouteDataLoading,
            }}
        >
            <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden gap-2 sm:gap-3">
                {/* ── Stats Bar ── */}
                {Object.keys(stats).length > 0 && (
                    <div className="shrink-0 pt-2 pb-1 px-1 overflow-x-auto scrollbar-none">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
                            {stats.routes !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Routes</span>
                                    <span className="text-[13px] font-bold">{stats.routes}</span>
                                </div>
                            )}
                            {stats.operations !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Operations</span>
                                    <span className="text-[13px] font-bold">{stats.operations}</span>
                                </div>
                            )}
                            {stats.rescue !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Rescue</span>
                                    <span className="text-[13px] font-bold">{stats.rescue}</span>
                                </div>
                            )}
                            {stats.trainer !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Trainer</span>
                                    <span className="text-[13px] font-bold">{stats.trainer}</span>
                                </div>
                            )}
                            {stats.reduction !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Reduction</span>
                                    <span className="text-[13px] font-bold">{stats.reduction}</span>
                                </div>
                            )}
                            {stats.avgRouteDuration !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Avg Route Dur</span>
                                    <span className="text-[13px] font-bold">{stats.avgRouteDuration}</span>
                                </div>
                            )}
                            {stats.avgPackageCount !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Avg Pkg Count</span>
                                    <span className="text-[13px] font-bold">{stats.avgPackageCount}</span>
                                </div>
                            )}
                            {stats.totalPackageCount !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 shadow-sm text-zinc-100">
                                    <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Total Pkg Count</span>
                                    <span className="text-[13px] font-bold text-primary">{stats.totalPackageCount.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Tab Content ── */}
                <div className="flex-1 min-h-0 overflow-auto">
                    {children}
                </div>
            </div>

            {/* ── Routes Info Panel ── */}
            <RoutesInfoPanel
                open={showRoutesInfo}
                onClose={() => setShowRoutesInfo(false)}
                date={selectedDate}
            />


        </DispatchingContext.Provider>
    );
}
