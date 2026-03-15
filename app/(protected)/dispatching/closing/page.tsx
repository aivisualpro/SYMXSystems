"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDispatching } from "../layout";
import { useDataStore } from "@/hooks/use-data-store";
import { cn } from "@/lib/utils";
import {
    Loader2,
    ChevronUp,
    ChevronDown,
    UserCheck,
    Check,
    Minus,
    CheckCircle2,
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
    Search,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import RouteInspectionModal from "./_components/RouteInspectionModal";

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
    { key: "type", label: "Type", width: "w-[110px]" },
    { key: "routeNumber", label: "Route #", width: "w-[80px]" },
    { key: "van", label: "Van", width: "w-[70px]" },
    { key: "routeDuration", label: "Duration", width: "w-[80px]" },
    { key: "waveTime", label: "Wave Time", width: "w-[85px]" },
    { key: "inspectionTime", label: "Inspected At", width: "w-[100px]" },
    { key: "actualDepartureTime", label: "Departure", width: "w-[85px]" },
    { key: "deliveryCompletionTime", label: "Delivered", width: "w-[85px]" },
] as const;

const GRID_TEMPLATE = "minmax(150px, 250px) 110px 80px 70px 80px 85px 100px 85px 85px";

interface RouteRow {
    _id: string;
    transporterId: string;
    date: string;
    weekDay: string;
    employeeName: string;
    type: string;
    routeNumber: string;
    van: string;
    routeDuration: string;
    waveTime: string;
    inspectionTime: string;
    actualDepartureTime: string;
    deliveryCompletionTime: string;
    inspectionId: string;
    profileImage?: string;
}

type SortKey = typeof COLUMNS[number]["key"];

export default function ClosingPage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats } = useDispatching();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [vehiclesMap, setVehiclesMap] = useState<Record<string, string>>({});
    const [vehicleNamesMap, setVehicleNamesMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // Modal & Highlight State
    const [inspectingRoute, setInspectingRoute] = useState<RouteRow | null>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // ── Handle highlight timer ──
    useEffect(() => {
        const h = searchParams.get("highlight");
        if (h) {
            setHighlightId(h);
            const timer = setTimeout(() => {
                setHighlightId(null);
                // Remove highlight from URL safely
                router.replace("/dispatching/closing", { scroll: false });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, router]);

    // ── Fetch routes for the week ──
    const fetchRoutes = useCallback(() => {
        if (!selectedWeek) return;
        setLoading(true);

        fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}&_t=${Date.now()}`)
            .then((r) => r.json())
            .then((data) => {
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
                        type: rec.type || "",
                        routeNumber: rec.routeNumber || "",
                        van: rec.van || "",
                        routeDuration: rec.routeDuration || "",
                        waveTime: rec.waveTime || "",
                        inspectionTime: rec.inspectionTime || "",
                        inspectionId: rec.inspectionId || "",
                        actualDepartureTime: rec.actualDepartureTime || "",
                        deliveryCompletionTime: rec.deliveryCompletionTime || "",
                        profileImage: emp?.profileImage || "",
                    };
                });

                setAllRoutes(rows);
            })
            .catch(() => setAllRoutes([]))
            .finally(() => {
                setLoading(false);
            });

        // Also fetch vehicles slightly quietly to map Van # => VIN
        fetch("/api/fleet?section=vehicles")
            .then(r => r.json())
            .then(d => {
                if (d.vehicles) {
                    const dict: Record<string, string> = {};
                    const nameDict: Record<string, string> = {};
                    d.vehicles.forEach((v: any) => {
                        if (v.unitNumber) {
                            dict[v.unitNumber] = v.vin;
                            if (v.vehicleName) nameDict[v.unitNumber] = v.vehicleName;
                        }
                        if (v.vehicleName) {
                            dict[v.vehicleName] = v.vin;
                            nameDict[v.vehicleName] = v.vehicleName;
                        }
                    });
                    setVehiclesMap(dict);
                    setVehicleNamesMap(nameDict);
                }
            })
            .catch(() => { });
    }, [selectedWeek]);

    const store = useDataStore();
    const hydratedRoutesRef = useRef(false);

    useEffect(() => {
        // Try hydrating from global store for the first/default week
        if (
            !hydratedRoutesRef.current &&
            store.initialized &&
            store.dispatchingRoutes &&
            store.dispatchingWeeks?.[0] === selectedWeek &&
            selectedWeek
        ) {
            hydratedRoutesRef.current = true;
            const data = store.dispatchingRoutes;
            if (data.routes && data.routes.length > 0) {
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
                        van: rec.van || "",
                        routeDuration: rec.routeDuration || "",
                        waveTime: rec.waveTime || "",
                        inspectionTime: rec.inspectionTime || "",
                        inspectionId: rec.inspectionId || "",
                        actualDepartureTime: rec.actualDepartureTime || "",
                        deliveryCompletionTime: rec.deliveryCompletionTime || "",
                        profileImage: emp?.profileImage || "",
                    };
                });
                setAllRoutes(rows);
            }
            // Also hydrate vehicles from store
            if (store.fleet.vehicles && Array.isArray(store.fleet.vehicles)) {
                const dict: Record<string, string> = {};
                const nameDict: Record<string, string> = {};
                store.fleet.vehicles.forEach((v: any) => {
                    if (v.unitNumber) {
                        dict[v.unitNumber] = v.vin;
                        if (v.vehicleName) nameDict[v.unitNumber] = v.vehicleName;
                    }
                    if (v.vehicleName) {
                        dict[v.vehicleName] = v.vin;
                        nameDict[v.vehicleName] = v.vehicleName;
                    }
                });
                setVehiclesMap(dict);
                setVehicleNamesMap(nameDict);
            }
            setLoading(false);
            return;
        }
        fetchRoutes();
    }, [fetchRoutes, routesGenerated]);

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

        // Only include "Route" type for closing as only Routes need inspections
        dateFiltered = dateFiltered.filter(r => (r.type || "").toLowerCase() === "route");

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(
                (r) =>
                    r.employeeName.toLowerCase().includes(q) ||
                    r.transporterId.toLowerCase().includes(q) ||
                    r.routeNumber.toLowerCase().includes(q) ||
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
        const pending = sorted.filter(r => !r.inspectionTime || r.inspectionTime.trim() === "");
        const done = sorted.filter(r => r.inspectionTime && r.inspectionTime.trim() !== "");

        return { pendingRows: pending, doneRows: done, totalFiltered: sorted.length };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered });
        return () => setStats({});
    }, [totalFiltered, setStats]);

    // ── Loading / Empty states ──
    if (routesLoading || (loading && allRoutes.length === 0)) {
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
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Closing</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {!routesGenerated
                        ? "No routes generated for this week yet. Click \"Generate Routes\" in the header to create route records from the schedule."
                        : "No route data available for this week."}
                </p>
            </div>
        );
    }

    // ── Helper: render cell ──
    const renderCell = (value: any) => {
        const raw = value === 0 || value === "" ? "—" : String(value);
        const displayVal = raw === "—" ? raw : raw.replace(/:\d{2}$/, "");
        return (
            <span className={cn(
                "text-[11px] truncate font-semibold",
                displayVal === "—" ? "text-muted-foreground/30" : "text-foreground"
            )}>
                {displayVal}
            </span>
        );
    };

    // ── Render ──
    return (
        <div className="flex flex-col lg:flex-row h-full gap-4">

            {/* ── LEFT: Awaiting Inspection ── */}
            <div className="flex-none lg:w-[320px] xl:w-[380px] h-[45vh] lg:h-full flex flex-col rounded-xl border border-border/50 bg-card overflow-hidden shadow-lg shrink-0">
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <h2 className="text-sm font-bold tracking-tight">Awaiting Inspection</h2>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full ring-1 ring-amber-500/30">
                        {pendingRows.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {pendingRows.map(row => {
                        const initials = row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2);
                        return (
                            <button
                                key={row._id}
                                onClick={() => {
                                    setInspectingRoute({
                                        ...row,
                                        genuineVin: (row.van && vehiclesMap[row.van]) ? vehiclesMap[row.van] : ""
                                    } as any);
                                }}
                                className="w-full text-left p-3 rounded-xl border border-border/40 bg-zinc-500/5 hover:bg-zinc-500/10 hover:border-primary/40 transition-all flex items-center gap-3 group relative overflow-hidden"
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
                                                <span>{vehicleNamesMap[row.van] || `Van ${row.van}`}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/30 font-bold text-[10px] uppercase tracking-wider transition-colors z-10">
                                        Inspect
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {pendingRows.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground opacity-70">
                            <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500/50" />
                            <p className="text-sm font-medium">All routes inspected!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT: Inspected Routes ── */}
            <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-border/50 bg-card overflow-hidden shadow-lg h-[45vh] lg:h-full">
                <div className="shrink-0 flex items-center justify-between px-3 py-3 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <h2 className="text-sm font-bold tracking-tight">Inspected Routes</h2>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-500 px-2.5 py-1 rounded-full ring-1 ring-emerald-500/30">
                        {doneRows.length}
                    </span>
                </div>

                {/* Table Header */}
                <div className="shrink-0 overflow-x-auto">
                    <div className="grid items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/10 min-w-[750px]"
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
                                    sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table Rows */}
                <div className="flex-1 overflow-x-auto">
                    <div className="min-w-[750px]">
                        {doneRows.map((row) => {
                            const isHighlighted = highlightId === row._id;
                            return (
                                <div
                                    key={row._id}
                                    onClick={() => {
                                        if (row.inspectionId) {
                                            const returnUrl = encodeURIComponent(`/dispatching/closing?highlight=${row._id}`);
                                            router.push(`/fleet/inspections/${row.inspectionId}?returnTo=${returnUrl}`);
                                        } else {
                                            toast.error("No Inspection Record found");
                                        }
                                    }}
                                    className={cn(
                                        "grid items-center gap-2 px-3 py-2 border-b border-border/20 transition-all cursor-pointer relative overflow-hidden duration-500",
                                        isHighlighted ? "bg-primary/20 border-l-4 border-l-primary" : "hover:bg-muted/30"
                                    )}
                                    style={{ gridTemplateColumns: GRID_TEMPLATE }}
                                >
                                    {/* Employee */}
                                    <div className="flex items-center gap-2 min-w-0">
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

                                    {/* Fields */}
                                    {renderCell(row.routeNumber)}
                                    {renderCell(row.van)}
                                    {renderCell(row.routeDuration)}
                                    {renderCell(row.waveTime)}

                                    {/* Highlighted Inspection Time */}
                                    <span className="inline-flex items-center justify-start px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-500 w-fit">
                                        {row.inspectionTime}
                                    </span>

                                    {renderCell(row.actualDepartureTime)}
                                    {renderCell(row.deliveryCompletionTime)}
                                </div>
                            );
                        })}

                        {doneRows.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground opacity-60">
                                <Search className="h-8 w-8 mb-2 opacity-50" />
                                No inspected routes yet
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <RouteInspectionModal
                open={!!inspectingRoute}
                onClose={() => setInspectingRoute(null)}
                route={inspectingRoute}
                onSaved={(routeId) => {
                    toast.success("Inspection saved successfully!");
                    fetchRoutes(); // refresh to show under "Inspected"
                }}
            />
        </div>
    );
}
