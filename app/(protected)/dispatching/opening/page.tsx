"use client";
import { useQueryClient } from "@tanstack/react-query";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";

import { cn } from "@/lib/utils";
import {
    Users,
    Loader2,
    ChevronUp,
    ChevronDown,
    DoorOpen,
    Minus,
    Pencil,
    Check,
    X,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

// ── Column Definitions ──
const COLUMNS = [
    { key: "employee", label: "Employee", width: "flex-1 min-w-[160px]" },
    { key: "routeNumber", label: "Route #", width: "w-[90px]" },
    { key: "stopCount", label: "Stops", width: "w-[70px]" },
    { key: "packageCount", label: "Packages", width: "w-[80px]" },
    { key: "routeDuration", label: "Duration", width: "w-[80px]" },
    { key: "waveTime", label: "Wave Time", width: "w-[90px]" },
    { key: "pad", label: "PAD", width: "w-[70px]" },
    { key: "wst", label: "WST", width: "w-[70px]" },
    { key: "wstDuration", label: "WST Dur", width: "w-[70px]" },
    { key: "bags", label: "Bags", width: "w-[60px]" },
    { key: "ov", label: "OV", width: "w-[60px]" },
    { key: "stagingLocation", label: "Staging", width: "w-[90px]" },
] as const;

const GRID_TEMPLATE = "1fr 90px 70px 80px 80px 90px 70px 70px 70px 60px 60px 90px";

// ── Editable fields list ──
const EDITABLE_FIELDS = new Set([
    "routeNumber", "stopCount", "packageCount", "routeDuration",
    "waveTime", "pad", "wst", "wstDuration", "bags", "ov", "stagingLocation",
]);

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
}

type SortKey = typeof COLUMNS[number]["key"];

export default function OpeningPage() {
    const queryClient = useQueryClient();
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // ── Inline editing state ──
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
            };
        });
        setAllRoutes(rows);
        setLoading(false);
    }, [rawRouteData, rawRouteDataLoading]);

    // ── Handle inline edit save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        const numericFields = new Set(["stopCount", "packageCount", "wstDuration"]);
        const parsedValue = numericFields.has(field) ? (parseInt(value) || 0) : value;

        // Optimistic update
        setAllRoutes(prev => prev.map(r =>
            r._id === routeId ? { ...r, [field]: parsedValue } : r
        ));
        setEditingCell(null);

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId,
                    updates: { [field]: parsedValue },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"] });
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);

    // ── Sort handler ──
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    // ── Format date column ──
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

    // ── Filter + sort ──
    const { rows: displayRows, totalFiltered, totalForDate } = useMemo(() => {
        // 1. Filter by selected date
        let dateFiltered = allRoutes;
        if (selectedDate) {
            dateFiltered = allRoutes.filter(r => r.date ? toPacificDate(r.date) === selectedDate : false);
        }
        const totalForDate = dateFiltered.length;

        // 2. Search filter
        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(
                (r) =>
                    r.employeeName.toLowerCase().includes(q) ||
                    r.transporterId.toLowerCase().includes(q) ||
                    r.routeNumber.toLowerCase().includes(q) ||
                    r.stagingLocation.toLowerCase().includes(q)
            );
        }

        // 3. Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "employee":
                    aVal = a.employeeName; bVal = b.employeeName; break;
                case "stopCount":
                    aVal = a.stopCount; bVal = b.stopCount; break;
                case "packageCount":
                    aVal = a.packageCount; bVal = b.packageCount; break;
                case "wstDuration":
                    aVal = a.wstDuration; bVal = b.wstDuration; break;
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

        return { rows: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Push stats to layout ──
    useEffect(() => {
        setStats({ employeeCount: totalFiltered });
    }, [totalFiltered, setStats]);

    // ── Clear stats on unmount ──
    useEffect(() => {
        return () => setStats({});
    }, [setStats]);



    if (rawRouteData?.routes?.length > 0 && allRoutes.length === 0) {
        return <div className="flex-1 opacity-0 pointer-events-none" />;
    }

    if (!routesGenerated || allRoutes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-emerald-500 to-teal-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500">
                        <DoorOpen className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Opening</h2>
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

    // ── Helper: render cell (editable or read-only) ──
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
                    <button
                        onClick={() => handleSave(row._id, field, editValue)}
                        className="text-emerald-500 hover:text-emerald-400 shrink-0"
                    >
                        <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => setEditingCell(null)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                    >
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
                    className="group/cell flex items-center gap-1 text-left w-full"
                >
                    <span className={cn(
                        "text-[11px] truncate",
                        displayVal === "—" ? "text-muted-foreground/40" : "text-foreground"
                    )}>
                        {displayVal}
                    </span>
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
                </button>
            );
        }

        return (
            <span className={cn(
                "text-[11px] truncate",
                displayVal === "—" ? "text-muted-foreground/40" : "text-foreground"
            )}>
                {displayVal}
            </span>
        );
    };

    // ── Table ──
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
                                className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left"
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

                    {/* Rows */}
                    <div className="flex-1 overflow-auto">
                        {displayRows.map((row) => (
                            <div
                                key={row._id}
                                className="grid items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors"
                                style={{ gridTemplateColumns: GRID_TEMPLATE }}
                            >
                                {/* Employee */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-semibold truncate">
                                        {row.employeeName}
                                    </span>
                                </div>

                                {/* Route # */}
                                {renderCell(row, "routeNumber", row.routeNumber)}

                                {/* Stops */}
                                {renderCell(row, "stopCount", row.stopCount)}

                                {/* Packages */}
                                {renderCell(row, "packageCount", row.packageCount)}

                                {/* Duration */}
                                {renderCell(row, "routeDuration", row.routeDuration)}

                                {/* Wave Time */}
                                {renderCell(row, "waveTime", row.waveTime)}

                                {/* PAD */}
                                {renderCell(row, "pad", row.pad)}

                                {/* WST */}
                                {renderCell(row, "wst", row.wst)}

                                {/* WST Duration */}
                                {renderCell(row, "wstDuration", row.wstDuration)}

                                {/* Bags */}
                                {renderCell(row, "bags", row.bags)}

                                {/* OV */}
                                {renderCell(row, "ov", row.ov)}

                                {/* Staging Location */}
                                {renderCell(row, "stagingLocation", row.stagingLocation)}
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
                        <span className="text-[11px] text-muted-foreground">
                            {totalFiltered} of {totalForDate} employees
                        </span>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
