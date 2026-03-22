"use client";

import React, { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import RoutesInfoPanel from "./_components/RoutesInfoPanel";
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
    employeeCount?: number;
    groupCount?: number;
    filteredFrom?: number;
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

    const searchParams = useSearchParams();
    const urlWeek = searchParams.get("week") || "";
    const urlDate = searchParams.get("date") || "";

    // ── State ──
    const [weeks, setWeeks] = useState<string[]>([]);
    const [selectedWeek, setSelectedWeekState] = useState(urlWeek);
    const [selectedDate, setSelectedDateState] = useState(urlDate);
    const [searchQuery, setSearchQuery] = useState("");
    const [generatingRoutes, setGeneratingRoutes] = useState(false);
    const [routesGenerated, setRoutesGenerated] = useState(false);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [stats, setStats] = useState<DispatchingStats>({});
    const [showRoutesInfo, setShowRoutesInfo] = useState(false);
    const [globalEditMode, setGlobalEditMode] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [confirmationFilter, setConfirmationFilter] = useState("all");

    /** Pick best default week: URL > current > closest ≤ current > latest */
    const pickDefaultWeek = useCallback((availableWeeks: string[], urlW: string) => {
        const currentWeek = getCurrentYearWeek();
        if (urlW && availableWeeks.includes(urlW)) return urlW;
        if (availableWeeks.includes(currentWeek)) return currentWeek;
        // Closest available week that is ≤ current week
        const prior = availableWeeks.filter(w => w <= currentWeek).sort((a, b) => b.localeCompare(a));
        return prior.length > 0 ? prior[0] : availableWeeks[0];
    }, []);

    // ── Sync state changes to URL (uses router.replace to notify Next.js) ──
    const updateURL = useCallback((week: string, date: string) => {
        const params = new URLSearchParams();
        if (week) params.set("week", week);
        if (date) params.set("date", date);
        const qs = params.toString();
        const currentPath = pathname;
        router.replace(`${currentPath}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, [pathname, router]);

    // Wrapped setters that also update the URL
    const setSelectedWeek = useCallback((week: string) => {
        setSelectedWeekState(week);
        // Sync week to URL immediately (date will be set by the weekDates effect)
        const params = new URLSearchParams();
        params.set("week", week);
        const currentPath = pathname;
        router.replace(`${currentPath}?${params.toString()}`, { scroll: false });
    }, [pathname, router]);

    const setSelectedDate = useCallback((date: string) => {
        setSelectedDateState(date);
        updateURL(selectedWeek, date);
    }, [selectedWeek, updateURL]);

    // ── Compute week dates ──
    const weekDates = useMemo(() => {
        if (!selectedWeek) return [];
        return getWeekDates(selectedWeek);
    }, [selectedWeek]);

    // ── Auto-select today's date when week changes (+ sync URL) ──
    useEffect(() => {
        if (weekDates.length === 0) return;
        const today = getTodayPacific();
        // If URL has a valid date for this week, use it
        if (urlDate && weekDates.includes(urlDate) && selectedWeek === urlWeek) {
            setSelectedDateState(urlDate);
            updateURL(selectedWeek, urlDate);
            return;
        }
        if (weekDates.includes(today)) {
            setSelectedDateState(today);
            updateURL(selectedWeek, today);
        } else {
            setSelectedDateState(weekDates[0]);
            updateURL(selectedWeek, weekDates[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekDates]);

    const store = useDataStore();

    // ── Hydrate weeks from global store for instant load ──
    const hydratedRef = React.useRef(false);
    React.useEffect(() => {
        if (hydratedRef.current) return;
        if (store.initialized && store.dispatchingWeeks?.length) {
            hydratedRef.current = true;
            setWeeks(store.dispatchingWeeks);
            const initWeek = pickDefaultWeek(store.dispatchingWeeks, urlWeek);
            setSelectedWeek(initWeek);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.initialized, store.dispatchingWeeks]);

    // ── Fetch available weeks (fallback if store not ready) ──
    useEffect(() => {
        if (hydratedRef.current) return; // already hydrated from store
        const fetchWeeks = async () => {
            try {
                const res = await fetch("/api/schedules?weeksList=true");
                const data = await res.json();
                if (data.weeks?.length) {
                    setWeeks(data.weeks);
                    const initWeek = pickDefaultWeek(data.weeks, urlWeek);
                    setSelectedWeek(initWeek);
                }
            } catch {
                toast.error("Failed to load available weeks");
            }
        };
        fetchWeeks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            ? `/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}&date=${encodeURIComponent(targetDate)}`
            : `/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}`;

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
                    fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}`)
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

    // ── Generate routes for selected week ──
    const handleGenerateRoutes = useCallback(async () => {
        if (!selectedWeek) return;
        setGeneratingRoutes(true);
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ yearWeek: selectedWeek, regenerate: routesGenerated }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate routes");

            if (data.created > 0) {
                toast.success(`${routesGenerated ? "Regenerated" : "Generated"} ${data.created} route records for ${formatWeekLabel(selectedWeek)}`);
            } else {
                toast.info(data.message || "Routes already exist for this week");
            }
            setRoutesGenerated(true);
            setRefreshKey((k) => k + 1);
        } catch (err: any) {
            toast.error(err.message || "Failed to generate routes");
        } finally {
            setGeneratingRoutes(false);
        }
    }, [selectedWeek, routesGenerated]);

    const refreshRoutes = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    // ── Push title into global header ──
    const pageTitle = useMemo(() => {
        if (pathname.includes("/dispatching/routes")) return "Routes";
        if (pathname.includes("/dispatching/attendance")) return "Attendance";
        if (pathname.includes("/dispatching/time")) return "Time";
        if (pathname.includes("/dispatching/closing")) return "Closing";
        if (pathname.includes("/dispatching/efficiency")) return "Efficiency";
        return "Dispatching";
    }, [pathname]);

    useEffect(() => {
        setLeftContent(
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {pageTitle}
            </h1>
        );
        return () => setLeftContent(null);
    }, [setLeftContent, pageTitle]);

    // ── Push search + week selector + generate button into right side of header ──
    useEffect(() => {
        const idx = weeks.indexOf(selectedWeek);
        setRightContent(
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 w-[120px] sm:w-[200px] text-sm"
                    />
                </div>

                {/* Week selector */}
                {weeks.length > 0 && (
                    <>
                        <div className="w-px h-5 bg-border/60 hidden sm:block" />
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                                if (idx < weeks.length - 1) {
                                    setSelectedWeek(weeks[idx + 1]);
                                }
                            }}
                            disabled={idx >= weeks.length - 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                            <SelectTrigger className="w-[110px] sm:w-[170px] h-8 text-xs sm:text-sm" suppressHydrationWarning>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {weeks.map((w) => (
                                    <SelectItem key={w} value={w}>
                                        {formatWeekLabel(w)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                                if (idx > 0) {
                                    setSelectedWeek(weeks[idx - 1]);
                                }
                            }}
                            disabled={idx <= 0}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </>
                )}

                {/* Generate Routes Button */}
                <div className="w-px h-5 bg-border/60 hidden sm:block" />
                <Button
                    variant={routesGenerated ? "outline" : "default"}
                    size="sm"
                    className={cn(
                        "h-8 gap-1.5 text-xs font-semibold",
                        !routesGenerated && "bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20"
                    )}
                    onClick={handleGenerateRoutes}
                    disabled={generatingRoutes || !selectedWeek}
                >
                    {generatingRoutes ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Plus className="h-3.5 w-3.5" />
                    )}
                    {generatingRoutes ? "Generating..." : routesGenerated ? "Regenerate" : "Generate Routes"}
                </Button>
            </div>
        );
        return () => setRightContent(null);
    }, [setRightContent, searchQuery, weeks, selectedWeek, generatingRoutes, routesGenerated, handleGenerateRoutes]);

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
                {/* ── Tab Bar + Date Tabs (inline) ── */}
                <div className="shrink-0 overflow-x-auto scrollbar-none">
                    <div data-tab-nav className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border min-w-max">
                        {DISPATCHING_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = pathname.startsWith(tab.href);
                            const tabParams = new URLSearchParams();
                            if (selectedWeek) tabParams.set("week", selectedWeek);
                            if (selectedDate) tabParams.set("date", selectedDate);
                            const tabQs = tabParams.toString();
                            return (
                                <Link
                                    key={tab.id}
                                    href={`${tab.href}${tabQs ? `?${tabQs}` : ""}`}
                                    prefetch={true}
                                    className={cn(
                                        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap select-none",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    {tab.label}
                                </Link>
                            );
                        })}

                        {/* Divider + Date Tabs */}
                        {weekDates.length > 0 && (
                            <>
                                <div className="w-px h-6 bg-border/60 mx-1" />
                                {weekDates.map((dateStr, idx) => {
                                    const isActive = selectedDate === dateStr;
                                    const d = new Date(dateStr + "T00:00:00Z");
                                    const dayNum = d.getUTCDate();
                                    const monthShort = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
                                    const today = getTodayPacific();
                                    const isToday = dateStr === today;

                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => setSelectedDate(dateStr)}
                                            className={cn(
                                                "flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap min-w-[48px] select-none",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                                    : isToday
                                                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <span className="text-[9px] uppercase tracking-wider leading-tight opacity-80">{SHORT_DAYS[d.getUTCDay()]}</span>
                                            <span className="text-xs font-bold leading-tight">{dayNum}</span>
                                            <span className="text-[8px] uppercase leading-tight opacity-60">{monthShort}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}

                        {/* Routes Info + PDF + Filter — only on /dispatching/routes */}
                        {pathname.includes("/dispatching/routes") && (
                            <>
                                <div className="w-px h-6 bg-border/60 mx-1" />
                                <button
                                    onClick={() => setShowRoutesInfo(true)}
                                    className={cn(
                                        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap select-none",
                                        "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 hover:shadow-xl hover:shadow-primary/30"
                                    )}
                                >
                                    <TableProperties className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    Routes Info
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!selectedWeek || !selectedDate) {
                                            toast.error("No date selected");
                                            return;
                                        }
                                        setPdfLoading(true);
                                        try {
                                            await generateRoutesPDF(selectedWeek, selectedDate);
                                            toast.success("PDF downloaded");
                                        } catch (err: any) {
                                            toast.error(err.message || "Failed to generate PDF");
                                        } finally {
                                            setPdfLoading(false);
                                        }
                                    }}
                                    disabled={pdfLoading}
                                    className={cn(
                                        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap select-none",
                                        "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:brightness-110 hover:shadow-xl hover:shadow-emerald-600/30"
                                    )}
                                >
                                    {pdfLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                    ) : (
                                        <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    )}
                                    PDF
                                </button>
                                <Select value={confirmationFilter} onValueChange={setConfirmationFilter}>
                                    <SelectTrigger className="h-8 sm:h-9 min-w-[130px] sm:min-w-[150px] bg-card text-[11px] sm:text-xs" suppressHydrationWarning>
                                        <SelectValue placeholder="All Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Conf Status</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="change_requested">Change Requested</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="none">None (—)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </>
                        )}

                        {(pathname.includes("/dispatching/time") || pathname.includes("/dispatching/efficiency")) && (
                            <>
                                <div className="w-px h-6 bg-border/60 mx-1" />
                                <button
                                    onClick={() => setGlobalEditMode(!globalEditMode)}
                                    className={cn(
                                        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap select-none",
                                        globalEditMode
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                    )}
                                >
                                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    {globalEditMode ? "Finish Editing" : "Quick Edit Table"}
                                </button>
                            </>
                        )}

                        {/* Spacer + Stats badges on right */}
                        {(stats.employeeCount !== undefined || stats.groupCount !== undefined) && (
                            <>
                                <div className="flex-1" />
                                {stats.employeeCount !== undefined && (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background/50 border border-border/40">
                                        <Users className="h-3 w-3 text-primary" />
                                        <span className="text-[11px] font-semibold">{stats.employeeCount}</span>
                                        <span className="text-[10px] text-muted-foreground">employees</span>
                                    </div>
                                )}
                                {stats.groupCount !== undefined && (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background/50 border border-border/40">
                                        <span className="text-[10px] text-muted-foreground">{stats.groupCount} groups</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

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
