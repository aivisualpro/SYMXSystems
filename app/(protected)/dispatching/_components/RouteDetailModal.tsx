"use client";

import React, { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    X,
    Navigation,
    Truck,
    MapPin,
    Clock,
    Package,
    TrendingUp,
    User,
    Calendar,
    Timer,
    DollarSign,
    Activity,
    Shield,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteDetailModalProps {
    open: boolean;
    onClose: () => void;
    routeId: string;
    employeeName: string;
    profileImage: string;
}

interface RouteDetail {
    _id: string;
    transporterId: string;
    date: string;
    weekDay: string;
    yearWeek: string;
    type: string;
    subType: string;
    trainingDay: string;
    routeSize: string;
    van: string;
    serviceType: string;
    dashcam: string;
    routeNumber: string;
    stopCount: number;
    packageCount: number;
    routeDuration: string;
    waveTime: string;
    pad: string;
    wst: string;
    wstDuration: number;
    wstRevenue: number;
    notes: string;
    stagingLocation: string;
    extraStops: number;
    stopsRescued: number;
    departureDelay: string;
    actualDepartureTime: string;
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
    plannedInboundStem: string;
    estimatedRTSTime: string;
    plannedDuration1stToLast: string;
    actualDuration1stToLast: string;
    stopsPerHour: number;
    deliveryCompletionTime: string;
    dctDelay: string;
    driverEfficiency: number;
    attendance: string;
    attendanceTime: string;
    amazonOutLunch: string;
    amazonInLunch: string;
    amazonAppLogout: string;
    inspectionTime: string;
    paycomInDay: string;
    paycomOutLunch: string;
    paycomInLunch: string;
    paycomOutDay: string;
    driversUpdatedForLunch: string;
    totalHours: string;
    regHrs: string;
    otHrs: string;
    totalCost: number;
    regPay: number;
    otPay: number;
    punchStatus: string;
    bags: string;
    ov: string;
}

interface SectionField {
    label: string;
    key: string;
    format?: "number" | "currency" | "percent" | "date";
}

interface Section {
    title: string;
    icon: React.ReactNode;
    color: string;
    fields: SectionField[];
}

function formatValue(value: any, format?: string): string {
    if (value === undefined || value === null || value === "" || value === 0) return "—";
    if (format === "currency") return `$${Number(value).toFixed(2)}`;
    if (format === "percent") return `${value}%`;
    if (format === "date") {
        try {
            return new Date(value).toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric", year: "numeric"
            });
        } catch { return String(value); }
    }
    return String(value);
}

export default function RouteDetailModal({ open, onClose, routeId, employeeName, profileImage }: RouteDetailModalProps) {
    const [route, setRoute] = useState<RouteDetail | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchRoute = useCallback(async () => {
        if (!routeId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/dispatching/routes/${routeId}`);
            const data = await res.json();
            if (res.ok) setRoute(data.route);
        } catch { }
        setLoading(false);
    }, [routeId]);

    useEffect(() => {
        if (open && routeId) fetchRoute();
    }, [open, routeId, fetchRoute]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!open) return null;

    const initials = employeeName
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2);

    const sections: Section[] = [
        {
            title: "Route Information",
            icon: <Navigation className="h-4 w-4" />,
            color: "text-primary",
            fields: [
                { label: "Route #", key: "routeNumber" },
                { label: "Route Size", key: "routeSize" },
                { label: "Type", key: "type" },
                { label: "Sub Type", key: "subType" },
                { label: "Training Day", key: "trainingDay" },
                { label: "Wave Time", key: "waveTime" },
                { label: "PAD", key: "pad" },
                { label: "WST", key: "wst" },
                { label: "WST Duration", key: "wstDuration" },
                { label: "WST Revenue", key: "wstRevenue", format: "currency" },
                { label: "Staging Location", key: "stagingLocation" },
                { label: "Notes", key: "notes" },
            ],
        },
        {
            title: "Vehicle",
            icon: <Truck className="h-4 w-4" />,
            color: "text-blue-400",
            fields: [
                { label: "Van", key: "van" },
                { label: "Service Type", key: "serviceType" },
                { label: "Dashcam", key: "dashcam" },
            ],
        },
        {
            title: "Stops & Packages",
            icon: <Package className="h-4 w-4" />,
            color: "text-amber-400",
            fields: [
                { label: "Stop Count", key: "stopCount", format: "number" },
                { label: "Package Count", key: "packageCount", format: "number" },
                { label: "Extra Stops", key: "extraStops", format: "number" },
                { label: "Stops Rescued", key: "stopsRescued", format: "number" },
                { label: "Stops Per Hour", key: "stopsPerHour", format: "number" },
                { label: "Bags", key: "bags" },
                { label: "OV", key: "ov" },
            ],
        },
        {
            title: "Timing & Duration",
            icon: <Clock className="h-4 w-4" />,
            color: "text-cyan-400",
            fields: [
                { label: "Route Duration", key: "routeDuration" },
                { label: "Planned 1st→Last", key: "plannedDuration1stToLast" },
                { label: "Actual 1st→Last", key: "actualDuration1stToLast" },
                { label: "Departure Delay", key: "departureDelay" },
                { label: "Actual Departure", key: "actualDepartureTime" },
            ],
        },
        {
            title: "Stops Timeline",
            icon: <MapPin className="h-4 w-4" />,
            color: "text-emerald-400",
            fields: [
                { label: "Planned First Stop", key: "plannedFirstStop" },
                { label: "Actual First Stop", key: "actualFirstStop" },
                { label: "First Stop Delay", key: "firstStopDelay" },
                { label: "Planned Last Stop", key: "plannedLastStop" },
                { label: "Actual Last Stop", key: "actualLastStop" },
                { label: "Last Stop Delay", key: "lastStopDelay" },
            ],
        },
        {
            title: "Stems & RTS",
            icon: <Timer className="h-4 w-4" />,
            color: "text-violet-400",
            fields: [
                { label: "Planned Outbound Stem", key: "plannedOutboundStem" },
                { label: "Actual Outbound Stem", key: "actualOutboundStem" },
                { label: "Outbound Delay", key: "outboundDelay" },
                { label: "Planned RTS Time", key: "plannedRTSTime" },
                { label: "Planned Inbound Stem", key: "plannedInboundStem" },
                { label: "Estimated RTS Time", key: "estimatedRTSTime" },
            ],
        },
        {
            title: "Delivery & Efficiency",
            icon: <TrendingUp className="h-4 w-4" />,
            color: "text-rose-400",
            fields: [
                { label: "Delivery Completion", key: "deliveryCompletionTime" },
                { label: "DCT Delay", key: "dctDelay" },
                { label: "Driver Efficiency", key: "driverEfficiency", format: "percent" },
            ],
        },
        {
            title: "Attendance",
            icon: <User className="h-4 w-4" />,
            color: "text-teal-400",
            fields: [
                { label: "Status", key: "attendance" },
                { label: "Time", key: "attendanceTime" },
                { label: "Punch Status", key: "punchStatus" },
            ],
        },
        {
            title: "Amazon & Paycom",
            icon: <Activity className="h-4 w-4" />,
            color: "text-orange-400",
            fields: [
                { label: "Amazon Out Lunch", key: "amazonOutLunch" },
                { label: "Amazon In Lunch", key: "amazonInLunch" },
                { label: "Amazon App Logout", key: "amazonAppLogout" },
                { label: "Inspection Time", key: "inspectionTime" },
                { label: "Paycom In Day", key: "paycomInDay" },
                { label: "Paycom Out Lunch", key: "paycomOutLunch" },
                { label: "Paycom In Lunch", key: "paycomInLunch" },
                { label: "Paycom Out Day", key: "paycomOutDay" },
                { label: "Drivers Updated Lunch", key: "driversUpdatedForLunch" },
            ],
        },
        {
            title: "Hours & Pay",
            icon: <DollarSign className="h-4 w-4" />,
            color: "text-emerald-400",
            fields: [
                { label: "Total Hours", key: "totalHours" },
                { label: "Regular Hours", key: "regHrs" },
                { label: "Overtime Hours", key: "otHrs" },
                { label: "Total Cost", key: "totalCost", format: "currency" },
                { label: "Regular Pay", key: "regPay", format: "currency" },
                { label: "Overtime Pay", key: "otPay", format: "currency" },
            ],
        },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col animate-in fade-in-0 zoom-in-95 duration-200 overflow-hidden">
                {/* ── Header ── */}
                <div className="shrink-0 p-5 sm:p-6 border-b border-border bg-muted/30">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="relative">
                                {profileImage ? (
                                    <img
                                        src={profileImage}
                                        alt={employeeName}
                                        className="w-14 h-14 rounded-xl object-cover ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center ring-2 ring-primary/30 shadow-lg shadow-primary/10">
                                        <span className="text-lg font-bold text-primary">{initials}</span>
                                    </div>
                                )}
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" />
                            </div>

                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                                    {employeeName}
                                </h2>
                                {route && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                                            {route.weekDay}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {route.date ? new Date(route.date).toLocaleDateString("en-US", {
                                                month: "short", day: "numeric", year: "numeric"
                                            }) : ""}
                                        </span>
                                        {route.type && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                                                {route.type}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading route details...</span>
                        </div>
                    ) : !route ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Shield className="h-8 w-8 text-muted-foreground/40" />
                            <span className="text-sm text-muted-foreground">No route data found</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sections.map((section) => {
                                // Check if section has any non-empty values
                                const hasData = section.fields.some(f => {
                                    const val = (route as any)[f.key];
                                    return val !== undefined && val !== null && val !== "" && val !== 0;
                                });

                                return (
                                    <div
                                        key={section.title}
                                        className={cn(
                                            "rounded-xl border border-border/60 bg-muted/20 overflow-hidden transition-all hover:border-border",
                                            !hasData && "opacity-50"
                                        )}
                                    >
                                        {/* Section header */}
                                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                                            <span className={section.color}>{section.icon}</span>
                                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground/80">
                                                {section.title}
                                            </h3>
                                        </div>

                                        {/* Fields */}
                                        <div className="p-3 space-y-0">
                                            {section.fields.map((field) => {
                                                const val = (route as any)[field.key];
                                                const display = formatValue(val, field.format);
                                                const hasValue = display !== "—";

                                                return (
                                                    <div
                                                        key={field.key}
                                                        className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-muted/30 transition-colors"
                                                    >
                                                        <span className="text-[11px] text-muted-foreground font-medium">
                                                            {field.label}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[11px] font-semibold text-right max-w-[50%] truncate",
                                                            hasValue ? "text-foreground" : "text-muted-foreground/30"
                                                        )}>
                                                            {display}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 border-t border-border bg-muted/30 px-5 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                            {route?.yearWeek || ""} · {route?.transporterId || ""}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
