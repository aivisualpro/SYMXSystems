"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
    ChevronRight, ChevronUp, ChevronDown, Loader2, Navigation,
    DoorOpen, DoorClosed, Coffee, PhoneOff, GraduationCap,
    TruckIcon, CalendarOff, UserCheck, BookOpen, Ban, ShieldAlert,
    Clock, CheckCircle2, X, type LucideIcon,
} from "lucide-react";

import { getTypeStyle, TYPE_MAP, getContrastText } from "@/lib/route-types";
export const ROUTE_TYPE_MAP = TYPE_MAP;
export const getRouteTypeStyle = getTypeStyle;

// ── Column definition ──
export interface RoutesTableColumn {
    key: string;
    label: React.ReactNode;
    minW?: number;
    className?: string;
    sticky?: boolean;
    align?: "left" | "center" | "right";
}

// ── Row shape the component works with ──
export interface RoutesTableRow {
    _id: string;
    transporterId: string;
    type: string;
    employeeName: string;
    profileImage?: string;
    phone?: string;
    dayBeforeConfirmation?: boolean;
    deliveryCompletionTime?: string;
    routeNumber?: string;
    routeDuration?: string;
    stopCount?: number;
    packageCount?: number;
    van?: string;
    attendance?: string;
    // Allow any extra keys for full dispatching usage
    [key: string]: any;
}

interface RoutesGroup {
    type: string;
    rows: RoutesTableRow[];
    count: number;
}

interface RoutesTableProps {
    groups: RoutesGroup[];
    loading?: boolean;
    columns: RoutesTableColumn[];
    /** Render a single cell for a given column key + row */
    renderCell?: (key: string, row: RoutesTableRow) => React.ReactNode;
    onRowClick?: (row: RoutesTableRow) => void;
    /** Called when the Conf toggle is clicked in the default renderer */
    onConfirmToggle?: (row: RoutesTableRow) => void;
    emptyMessage?: string;
}

export function RoutesTable({
    groups,
    loading = false,
    columns,
    renderCell,
    onRowClick,
    onConfirmToggle,
    emptyMessage = "No routes for this date",
}: RoutesTableProps) {
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [sortKey, setSortKey] = useState("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const handleSort = (key: string) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const toggleGroup = (type: string) => {
        setCollapsedGroups(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const colCount = columns.length;

    const defaultCellRenderer = (key: string, row: RoutesTableRow): React.ReactNode => {
        switch (key) {
            case "employee":
                return (
                    <div className="flex items-center gap-2 w-full pr-1">
                        {row.profileImage ? (
                            <img
                                src={row.profileImage}
                                alt={row.employeeName}
                                className="w-6 h-6 rounded-full object-cover ring-1 ring-border shrink-0"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
                                <span className="text-[8px] font-bold text-primary">
                                    {row.employeeName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </span>
                            </div>
                        )}
                        <span 
                            className="text-[13px] font-bold truncate flex-1 min-w-0" 
                            title={row.employeeName}
                            style={{ color: getRouteTypeStyle(row.type).colorHex || "inherit" }}
                        >
                            {row.employeeName}
                        </span>
                    </div>
                );
            case "type": {
                const s = getRouteTypeStyle(row.type);
                const Ico = ROUTE_TYPE_MAP.get((row.type || "").toLowerCase())?.icon;
                return (
                    <div 
                        className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border shadow-sm",
                            !s.colorHex && s.bg,
                            !s.colorHex && s.text,
                            !s.colorHex && s.border
                        )}
                        style={{
                            backgroundColor: s.colorHex || undefined,
                            color: s.colorHex ? getContrastText(s.colorHex) : undefined,
                            borderColor: s.colorHex ? 'transparent' : undefined
                        }}
                    >
                        {Ico && <Ico className="h-3 w-3" />}
                        {row.type || "—"}
                    </div>
                );
            }
            case "dayBeforeConfirmation":
            case "conf":
                return (
                    <button
                        onClick={e => { e.stopPropagation(); onConfirmToggle?.(row); }}
                        className="p-1 rounded-full hover:bg-muted/50 transition-colors outline-none focus:outline-none"
                    >
                        {row.dayBeforeConfirmation ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <X className="h-4 w-4 text-muted-foreground/30 hover:text-red-400 transition-colors" />
                        )}
                    </button>
                );
            case "phone":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.phone || "—"}</span>;
            case "deliveryCompletionTime":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.deliveryCompletionTime || "—"}</span>;
            case "routeNumber":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.routeNumber || "—"}</span>;
            case "routeDuration":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.routeDuration || "—"}</span>;
            case "stopCount":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.stopCount ?? 0}</span>;
            case "packageCount":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.packageCount ?? 0}</span>;
            case "van":
                return <span className="text-[13px] font-semibold whitespace-nowrap text-primary">{row.van || "—"}</span>;
            case "attendance":
                return <span className="text-[13px] font-semibold whitespace-nowrap">{row.attendance || "—"}</span>;
            default: {
                const val = row[key];
                return <span className="text-[13px] font-semibold whitespace-nowrap">{val ?? "—"}</span>;
            }
        }
    };

    return (
        <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto relative">
                {loading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-30 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                <table className="w-full border-collapse" style={{ minWidth: columns.reduce((sum, col) => sum + (col.minW || 90), 0) }}>
                    {/* Header */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-muted border-b border-border/50">
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className={cn(
                                        "px-2 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap",
                                        col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left",
                                        col.sticky && "sticky left-0 z-30 bg-muted",
                                        col.className
                                    )}
                                    style={{ minWidth: col.minW ?? 80 }}
                                >
                                    <span className={cn(
                                        "inline-flex items-center gap-0.5",
                                        col.align === "center" && "w-full justify-center",
                                        col.align === "right" && "w-full justify-end"
                                    )}>
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

                    {/* Body */}
                    <tbody>
                        {!loading && groups.length === 0 ? (
                            <tr>
                                <td colSpan={colCount}>
                                    <div className="p-10 text-center text-muted-foreground/60 text-sm flex flex-col items-center gap-2">
                                        <Navigation className="h-10 w-10 opacity-20" />
                                        {emptyMessage}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            groups.map(group => {
                                const isCollapsed = collapsedGroups[group.type] ?? false;
                                const typeOpt = ROUTE_TYPE_MAP.get(group.type.toLowerCase());
                                const GroupIcon = typeOpt?.icon;
                                const gs = getRouteTypeStyle(group.type);

                                return (
                                    <React.Fragment key={group.type}>
                                        {/* Group header row */}
                                        <tr
                                            onClick={() => toggleGroup(group.type)}
                                            className="cursor-pointer hover:bg-muted/60 transition-colors bg-muted/30 border-b border-border/30"
                                        >
                                            <td colSpan={colCount} className="px-2 py-1.5">
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight className={cn(
                                                        "h-3 w-3 text-muted-foreground transition-transform",
                                                        !isCollapsed && "rotate-90"
                                                    )} />
                                                    <div 
                                                        className={cn(
                                                            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border shadow-sm",
                                                            !gs.colorHex && gs.bg,
                                                            !gs.colorHex && gs.text,
                                                            !gs.colorHex && gs.border
                                                        )}
                                                        style={{
                                                            backgroundColor: gs.colorHex || undefined,
                                                            color: gs.colorHex ? getContrastText(gs.colorHex) : undefined,
                                                            borderColor: gs.colorHex ? 'transparent' : undefined
                                                        }}
                                                    >
                                                        {GroupIcon && <GroupIcon className="h-3 w-3" />}
                                                        {group.type || "Unassigned"}
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                                        {group.count}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Data rows */}
                                        {!isCollapsed && group.rows.map(row => (
                                            <tr
                                                key={row._id}
                                                className={cn(
                                                    "border-b border-border/20 hover:bg-muted/30 transition-colors group/row",
                                                    onRowClick && "cursor-pointer"
                                                )}
                                                onClick={() => onRowClick?.(row)}
                                            >
                                                {columns.map(col => (
                                                    <td
                                                        key={col.key}
                                                        className={cn(
                                                            "px-2 py-1.5",
                                                            col.sticky && "sticky left-0 z-[5] bg-card group-hover/row:bg-muted/30 transition-colors",
                                                            (col.key === "dayBeforeConfirmation" || col.key === "conf" || col.align === "center") && "text-center",
                                                            col.align === "right" && "text-right",
                                                            col.align === "left" && "text-left",
                                                            col.className
                                                        )}
                                                    >
                                                        {renderCell
                                                            ? (renderCell(col.key, row) ?? defaultCellRenderer(col.key, row))
                                                            : defaultCellRenderer(col.key, row)
                                                        }
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
