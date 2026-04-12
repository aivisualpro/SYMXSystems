"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Loader2, Save, MapPin, Check, X, FileText, Activity, AlertCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Navigation, FileDown, DoorOpen, DoorClosed, Coffee, PhoneOff, GraduationCap, TruckIcon, CalendarOff, UserCheck, BookOpen, Ban, ShieldAlert, PackageX, LifeBuoy, Search, ChevronDown, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { generateRoutesPDF } from "@/lib/generate-routes-pdf";
import { RoutesTable, type RoutesTableRow } from "@/app/(protected)/dispatching/_components/RoutesTable";

/** Business timezone — all date computations use Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";

function getTodayPacific(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

function getCurrentYearWeek(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00.000Z");
    const dayOfWeek = date.getUTCDay();
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

// ── Type Options — exact copy from dispatching/routes ──
interface TypeOption {
    label: string;
    icon: LucideIcon;
    bg: string;
    text: string;
    border: string;
}

const TYPE_OPTIONS: TypeOption[] = [
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

function getTypeStyle(value: string): { bg: string; text: string; border: string } {
    if (!value || value.trim() === "")
        return { bg: "bg-zinc-100 dark:bg-zinc-700", text: "text-zinc-400 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-600" };
    const opt = TYPE_MAP.get(value.trim().toLowerCase());
    if (opt) return { bg: opt.bg, text: opt.text, border: opt.border };
    return { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-600" };
}

export default function EverydayAfterDispatchingPage() {
    const { setLeftContent, setRightContent } = useHeaderActions();
    
    const [weeks, setWeeks] = useState<string[]>([]);
    const [selectedWeek, setSelectedWeek] = useState("");
    
    const [date, setDate] = useState("");
    const [notes, setNotes] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [loading, setLoading] = useState(true);

    const [routes, setRoutes] = useState<any[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
    const [schedulesMap, setSchedulesMap] = useState<Record<string, any>>({});
    const [pdfLoading, setPdfLoading] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const [debounceNotes, setDebounceNotes] = useState(notes);

    const [rtsModalOpen, setRtsModalOpen] = useState(false);
    const [rtsModalRoute, setRtsModalRoute] = useState<RoutesTableRow | null>(null);
    const [rtsTBA, setRtsTBA] = useState("");
    const [rtsReason, setRtsReason] = useState("");
    const [rtsReasonsList, setRtsReasonsList] = useState<string[]>([]);
    const [isSavingRTS, setIsSavingRTS] = useState(false);
    const [rtsMap, setRtsMap] = useState<Record<string, any>>({});

    const [rescueModalOpen, setRescueModalOpen] = useState(false);
    const [rescueModalRoute, setRescueModalRoute] = useState<RoutesTableRow | null>(null);
    const [rescueBy, setRescueBy] = useState("");
    const [rescueBySearch, setRescueBySearch] = useState("");
    const [rescueByOpen, setRescueByOpen] = useState(false);
    const [rescueStops, setRescueStops] = useState("");
    const [rescueReason, setRescueReason] = useState("");
    const [rescuePerformance, setRescuePerformance] = useState(false);
    const [rescueReasonsList, setRescueReasonsList] = useState<string[]>([]);
    const [rescueMap, setRescueMap] = useState<Record<string, any>>({});
    const [isSavingRescue, setIsSavingRescue] = useState(false);

    const [allEmployees, setAllEmployees] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/admin/employees?limit=2000&terminated=false")
            .then(r => r.json())
            .then(data => {
                const arr = data.records || data.employees || (Array.isArray(data) ? data : []);
                setAllEmployees(arr.sort((a: any, b: any) => {
                    const fnA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || "";
                    const fnB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || "";
                    return fnA.localeCompare(fnB);
                }));
            })
            .catch(err => console.error(err));
    }, []);

    const openRTSModal = (row: RoutesTableRow) => {
        setRtsModalRoute(row);
        const existingData = rtsMap[row._id];
        setRtsTBA(existingData ? existingData.tba : "");
        setRtsReason(existingData ? existingData.reason : "");
        setRtsModalOpen(true);
    };

    const handleSaveRTS = async () => {
        if (!rtsModalRoute || !rtsTBA.trim() || !rtsReason.trim()) {
            toast.error("TBA and Reason are required");
            return;
        }
        setIsSavingRTS(true);
        try {
            const res = await fetch("/api/everyday/rts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId: rtsModalRoute._id,
                    date: date,
                    transporterId: rtsModalRoute.transporterId,
                    tba: rtsTBA.trim(),
                    reason: rtsReason.trim()
                })
            });
            if (!res.ok) throw new Error("Failed to save RTS");
            
            toast.success("RTS recorded successfully");
            setRtsModalOpen(false);

            // Update Map optimistically so the icon refreshes immediately
            if (res.ok) {
                const updatedObj = await res.json();
                setRtsMap(prev => ({
                    ...prev,
                    [rtsModalRoute._id]: updatedObj.rts
                }));
            }

            if (!rtsReasonsList.includes(rtsReason.trim())) {
                setRtsReasonsList(prev => [...prev, rtsReason.trim()]);
            }
        } catch (e) {
            toast.error("Failed to save RTS record");
        } finally {
            setIsSavingRTS(false);
        }
    };

    const openRescueModal = (row: RoutesTableRow) => {
        setRescueModalRoute(row);
        const existingData = rescueMap[row._id];
        setRescueBy(existingData ? existingData.rescuedBytransporterId : "");
        setRescueStops(existingData ? existingData.stopsRescued.toString() : "");
        setRescueReason(existingData ? existingData.reason : "");
        setRescuePerformance(existingData ? existingData.performanceRescue : false);
        setRescueBySearch("");
        setRescueByOpen(false);
        setRescueModalOpen(true);
    };

    const handleSaveRescue = async () => {
        if (!rescueModalRoute || !rescueBy || !rescueStops || !rescueReason) {
            toast.error("Please fill in all rescue fields");
            return;
        }
        setIsSavingRescue(true);
        try {
            const res = await fetch("/api/everyday/rescue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId: rescueModalRoute._id,
                    date: date,
                    transporterId: rescueModalRoute.transporterId,
                    rescuedBytransporterId: rescueBy,
                    stopsRescued: Number(rescueStops),
                    reason: rescueReason.trim(),
                    performanceRescue: rescuePerformance
                })
            });
            if (!res.ok) throw new Error("Failed to save Rescue");
            
            toast.success("Rescue recorded successfully");
            setRescueModalOpen(false);

            if (res.ok) {
                const updatedObj = await res.json();
                setRescueMap(prev => ({
                    ...prev,
                    [rescueModalRoute._id]: updatedObj.rescue
                }));
            }

            if (!rescueReasonsList.includes(rescueReason.trim())) {
                setRescueReasonsList(prev => [...prev, rescueReason.trim()]);
            }
        } catch (e) {
            toast.error("Failed to save Rescue record");
        } finally {
            setIsSavingRescue(false);
        }
    };

    const toggleGroup = (group: string) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    useEffect(() => {
        setLeftContent(
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent leading-none">
                        Everyday
                    </h1>
                </div>
            </div>
        );
        return () => setLeftContent(null);
    }, [setLeftContent]);

    // Sync local notes state to debounce timer
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebounceNotes(notes);
        }, 1000);
        return () => clearTimeout(timer);
    }, [notes]);

    // Fetch available weeks on mount
    useEffect(() => {
        const fetchAvailability = async () => {
            try {
                const res = await fetch("/api/schedules?weeksList=true");
                const data = await res.json();
                if (data.weeks?.length) {
                    setWeeks(data.weeks);
                    const today = getTodayPacific();
                    const currentWeek = getCurrentYearWeek(today);
                    // Find closest default week
                    let initWeek = data.weeks.includes(currentWeek) ? currentWeek : data.weeks[0];
                    const prior = data.weeks.filter((w: string) => w <= currentWeek).sort().reverse();
                    if (prior.length > 0) initWeek = prior[0];
                    setSelectedWeek(initWeek);
                    
                    // Also default to today if currently in this week, otherwise first day of the week
                    const firstSunday = new Date(initWeek.split('-W')[0] + "-01-01T00:00:00Z");
                    const jan1Day = firstSunday.getUTCDay();
                    firstSunday.setUTCDate(firstSunday.getUTCDate() - jan1Day + (parseInt(initWeek.split('-W')[1]) - 1) * 7);
                    
                    if (currentWeek === initWeek) {
                        setDate(today);
                    } else {
                        setDate(firstSunday.toISOString().split("T")[0]);
                    }
                }
            } catch (err) {
                console.error("Failed to load weeks", err);
            }
        };
        fetchAvailability();
    }, []);

    // Compute week dates array based on selectedWeek
    const weekDates = useMemo(() => {
        if (!selectedWeek) return [];
        const year = parseInt(selectedWeek.split('-W')[0]);
        const weekNum = parseInt(selectedWeek.split('-W')[1]);
        const jan1 = new Date(Date.UTC(year, 0, 1));
        const jan1Day = jan1.getUTCDay();
        const firstSunday = new Date(jan1);
        firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
        const weekSunday = new Date(firstSunday);
        weekSunday.setUTCDate(firstSunday.getUTCDate() + (weekNum - 1) * 7);
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekSunday);
            d.setUTCDate(weekSunday.getUTCDate() + i);
            dates.push(d.toISOString().split("T")[0]);
        }
        return dates;
    }, [selectedWeek]);

    function formatWeekLabel(week: string) {
        const match = week.match(/(\d{4})-W(\d{2})/);
        if (!match) return week;
        return `${match[1]} – Week ${parseInt(match[2])}`;
    }

    // Set right content header arrows for selecting week
    useEffect(() => {
        const idx = weeks.indexOf(selectedWeek);
        
        setRightContent(
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                {weeks.length > 0 && (
                    <>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                                if (idx < weeks.length - 1) {
                                    const nextWeek = weeks[idx + 1];
                                    setSelectedWeek(nextWeek);
                                    // Set date to Sunday of that week
                                    const year = parseInt(nextWeek.split('-W')[0]);
                                    const weekNum = parseInt(nextWeek.split('-W')[1]);
                                    const d = new Date(Date.UTC(year, 0, 1));
                                    d.setUTCDate(d.getUTCDate() - d.getUTCDay() + (weekNum - 1) * 7);
                                    setDate(d.toISOString().split("T")[0]);
                                }
                            }}
                            disabled={idx >= weeks.length - 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Select value={selectedWeek} onValueChange={(val) => {
                            setSelectedWeek(val);
                            const year = parseInt(val.split('-W')[0]);
                            const weekNum = parseInt(val.split('-W')[1]);
                            const d = new Date(Date.UTC(year, 0, 1));
                            d.setUTCDate(d.getUTCDate() - d.getUTCDay() + (weekNum - 1) * 7);
                            setDate(d.toISOString().split("T")[0]);
                        }}>
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
                                    const prevWeek = weeks[idx - 1];
                                    setSelectedWeek(prevWeek);
                                    const year = parseInt(prevWeek.split('-W')[0]);
                                    const weekNum = parseInt(prevWeek.split('-W')[1]);
                                    const d = new Date(Date.UTC(year, 0, 1));
                                    d.setUTCDate(d.getUTCDate() - d.getUTCDay() + (weekNum - 1) * 7);
                                    setDate(d.toISOString().split("T")[0]);
                                }
                            }}
                            disabled={idx <= 0}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </>
                )}
            </div>
        );
        return () => setRightContent(null);
    }, [weeks, selectedWeek, setRightContent]);

    // Fetch data whenever date changes
    const fetchData = useCallback(async () => {
        if (!date || !selectedWeek) return;
        setLoading(true);
        try {
            // 1. Fetch notes
            const notesRes = await fetch(`/api/everyday?date=${date}`);
            if (notesRes.ok) {
                const notesData = await notesRes.json();
                const fetchedNotes = notesData.notes || "";
                setNotes(fetchedNotes);
                setDebounceNotes(fetchedNotes); // prevent instant auto-save on load
            }

            // 2. Fetch routes, schedules, rts, and rescue
            const [routesRes, schedulesRes, rtsRes, rescueRes] = await Promise.all([
                fetch(`/api/dispatching/routes?yearWeek=${selectedWeek}&date=${date}`),
                fetch(`/api/everyday/schedules?dateStr=${date}`),
                fetch(`/api/everyday/rts?dateStr=${date}`),
                fetch(`/api/everyday/rescue?dateStr=${date}`)
            ]);

            if (routesRes.ok) {
                const rData = await routesRes.json();
                setRoutes(rData.routes || []);
                setEmployeesMap(rData.employees || {});
            } else {
                setRoutes([]);
            }

            if (schedulesRes.ok) {
                const sData = await schedulesRes.json();
                const tempMap: Record<string, any> = {};
                (sData.schedules || []).forEach((s: any) => {
                    tempMap[s.transporterId] = s;
                });
                setSchedulesMap(tempMap);
            } else {
                setSchedulesMap({});
            }

            if (rtsRes.ok) {
                const rtsData = await rtsRes.json();
                if (rtsData.reasons) setRtsReasonsList(rtsData.reasons);
                const tm: Record<string, any> = {};
                (rtsData.records || []).forEach((r: any) => {
                    tm[r.routeId] = r;
                });
                setRtsMap(tm);
            } else {
                setRtsMap({});
            }

            if (rescueRes.ok) {
                const resData = await rescueRes.json();
                if (resData.reasons) setRescueReasonsList(resData.reasons);
                const rm: Record<string, any> = {};
                (resData.records || []).forEach((r: any) => {
                    rm[r.routeId] = r;
                });
                setRescueMap(rm);
            } else {
                setRescueMap({});
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    }, [date, selectedWeek]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-save logic
    const saveNotesToDB = useCallback(async (notesToSave: string) => {
        if (!date) return;
        setSavingNotes(true);
        try {
            const res = await fetch("/api/everyday", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, notes: notesToSave })
            });
            if (!res.ok) throw new Error("Failed to save notes");
        } catch (error) {
            toast.error("Error auto-saving notes");
        } finally {
            setSavingNotes(false);
        }
    }, [date]);

    useEffect(() => {
        // If debounceNotes differs from initial load, trigger save
        if (debounceNotes !== notes) return; // Wait until they match (debouncing active)
        // We need a ref to prevent saving on initial mount, but simpler:
        saveNotesToDB(debounceNotes);
    }, [debounceNotes, saveNotesToDB]); // eslint-disable-line react-hooks/exhaustive-deps

    // manual save override
    const handleSaveNotes = () => {
        setDebounceNotes(notes);
        saveNotesToDB(notes);
        toast.success("Notes saved successfully");
    };

    const toggleConfirmIcon = async (transporterId: string, currentVal: string) => {
        if (!date) return;
        const nextVal = currentVal === "true" ? "false" : "true";

        setSchedulesMap(prev => ({
            ...prev,
            [transporterId]: { ...prev[transporterId], dayBeforeConfirmation: nextVal }
        }));

        try {
            const res = await fetch("/api/everyday/schedules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transporterId, dateStr: date, dayBeforeConfirmation: nextVal })
            });
            if (!res.ok) throw new Error("Update failed");
        } catch (err) {
            toast.error("Failed to update status");
            // revert locally
            setSchedulesMap(prev => ({
                ...prev,
                [transporterId]: { ...prev[transporterId], dayBeforeConfirmation: currentVal }
            }));
        }
    };

    const toggleDeliveryCompletionTime = async (routeId: string, currentVal: string) => {
        let timeStr = "";
        if (!currentVal) {
            const now = new Date();
            timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        }

        setRoutes(prev => prev.map(r => r._id === routeId ? { ...r, deliveryCompletionTime: timeStr } : r));

        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { deliveryCompletionTime: timeStr } })
            });
            if (!res.ok) throw new Error("Update failed");
            if (timeStr) toast.success(`Marked delivery at ${timeStr}`);
        } catch (err) {
            toast.error("Failed to update delivery time");
            // revert locally
            setRoutes(prev => prev.map(r => r._id === routeId ? { ...r, deliveryCompletionTime: currentVal } : r));
        }
    };

    const groupedRoutes = useMemo(() => {
        const map: Record<string, RoutesTableRow[]> = {};
        routes.forEach(r => {
            const emp = employeesMap[r.transporterId] || {};
            const schedule = schedulesMap[r.transporterId] || {};
            const type = r.type || "Unassigned";
            if (!map[type]) map[type] = [];
            map[type].push({
                _id: r._id,
                transporterId: r.transporterId,
                type: r.type || "",
                employeeName: r.employeeName || emp.name || r.transporterId,
                profileImage: r.profileImage || emp.profileImage || "",
                phone: r.phone || emp.phoneNumber || emp.phone || "",
                dayBeforeConfirmation: schedule.dayBeforeConfirmation === "true",
                deliveryCompletionTime: r.deliveryCompletionTime || "",
                routeNumber: r.routeNumber || "",
                routeDuration: r.routeDuration || "",
                stopCount: r.stopCount ?? 0,
                packageCount: r.packageCount ?? 0,
                van: r.van || "",
                attendance: r.attendance || "",
            });
        });
        return Object.entries(map)
            .map(([type, rows]) => ({ type, rows, count: rows.length }))
            .sort((a, b) => {
                if (a.type.toLowerCase() === "route") return -1;
                if (b.type.toLowerCase() === "route") return 1;
                return a.type.localeCompare(b.type);
            });
    }, [routes, employeesMap, schedulesMap]);

    const rtsEntries = useMemo(() => {
        return Object.values(rtsMap).map((rts: any) => {
             const route = routes.find(r => r._id === rts.routeId);
             const emp = employeesMap[rts.transporterId] || {};
             return {
                 _id: rts._id || rts.routeId,
                 employeeName: route?.employeeName || emp.name || rts.transporterId,
                 routeNumber: route?.routeNumber || "—",
                 tba: rts.tba,
                 reason: rts.reason
             };
        });
    }, [rtsMap, routes, employeesMap]);

    const rescueEntries = useMemo(() => {
        return Object.values(rescueMap).map((rescue: any) => {
             const route = routes.find(r => r._id === rescue.routeId);
             const emp = employeesMap[rescue.transporterId] || {};
             const rescuerName = allEmployees.find(e => e.transporterId === rescue.rescuedBytransporterId)?.name || rescue.rescuedBytransporterId;
             return {
                 _id: rescue._id || rescue.routeId,
                 employeeName: route?.employeeName || emp.name || rescue.transporterId,
                 rescuerName,
                 stopsRescued: rescue.stopsRescued,
                 reason: rescue.reason,
                 performanceRescue: rescue.performanceRescue
             };
        });
    }, [rescueMap, routes, employeesMap, allEmployees]);

    if (!date || weeks.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <div className="flex-1 overflow-auto bg-background min-h-0">
            {/* Top row: Horizontal Date Selector & Notes inline */}
            <div className="mb-5 overflow-x-auto scrollbar-none">
                <div className="flex items-stretch gap-1 p-1 rounded-xl bg-muted/50 border border-border min-w-max flex-1">
                    {/* Date Tabs */}
                    {weekDates.map((dateStr) => {
                        const d = new Date(dateStr + "T12:00:00Z");
                        const dayName = SHORT_DAYS[d.getUTCDay()];
                        const dayNum = d.getUTCDate();
                        const monthShort = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
                        const isActive = date === dateStr;
                        const isToday = dateStr === getTodayPacific();
                        return (
                            <button
                                key={dateStr}
                                onClick={() => setDate(dateStr)}
                                className={cn(
                                    "flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap min-w-[48px] select-none",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                        : isToday
                                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <span className="text-[9px] uppercase tracking-wider leading-tight opacity-80">{dayName}</span>
                                <span className="text-xs font-bold leading-tight">{dayNum}</span>
                                <span className="text-[8px] uppercase leading-tight opacity-60">{monthShort}</span>
                            </button>
                        );
                    })}

                    {weekDates.length > 0 && <div className="w-px h-6 bg-border/60 mx-1 self-center shrink-0" />}

                    {/* PDF Generation Button */}
                    <button
                        onClick={async () => {
                            if (!selectedWeek || !date) {
                                toast.error("No date selected");
                                return;
                            }
                            setPdfLoading(true);
                            try {
                                await generateRoutesPDF(selectedWeek, date);
                                toast.success("PDF downloaded");
                            } catch (err: any) {
                                toast.error(err.message || "Failed to generate PDF");
                            } finally {
                                setPdfLoading(false);
                            }
                        }}
                        disabled={pdfLoading}
                        className={cn(
                            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap select-none self-center h-[34px]",
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

                    {/* Notes Input inline */}
                    <div className="flex-1 flex items-center relative group min-w-[300px] h-[34px] self-center">
                        <FileText className="absolute left-3 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notes"
                            className="w-full h-full bg-background border border-primary ring-1 ring-primary rounded-lg pl-9 pr-[85px] text-sm font-medium placeholder:text-muted-foreground/40 placeholder:font-bold placeholder:text-base focus:outline-none transition-all shadow-sm"
                        />
                        <div className="absolute right-1 flex items-center gap-1.5 pointer-events-auto">
                            <Button 
                                onClick={handleSaveNotes}
                                disabled={savingNotes}
                                size="sm"
                                className={cn(
                                    "h-7 px-3 text-[11px] font-bold tracking-wide rounded-md transition-all shadow-sm",
                                    debounceNotes === notes && notes.length > 0 && !savingNotes
                                        ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 shadow-none border border-emerald-500/20" 
                                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}
                            >
                                {savingNotes ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        Saving
                                    </>
                                ) : debounceNotes === notes && notes.length > 0 ? (
                                    <>
                                        <Check className="h-3 w-3 mr-1" />
                                        Saved
                                    </>
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
                {/* Middle Left: Routes Table (Tall) */}
                <Card className="lg:col-span-8 border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg flex flex-col h-full overflow-hidden p-0 gap-0">
                    <div className="p-4 border-b border-border/50 bg-muted/20 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                    <MapPin className="h-4 w-4 text-orange-500" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-foreground leading-none tracking-tight">Routes Overview</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                    <RoutesTable
                        groups={groupedRoutes}
                        loading={loading}
                        columns={[
                            { key: "employee",               label: "Employee",  minW: 160, sticky: true },
                            { key: "phone",                  label: "Phone",     minW: 120 },
                            { key: "dayBeforeConfirmation",  label: "DB Confirmation", minW: 120, align: "center" },
                            { key: "deliveryCompletionTime", label: "Del. Comp. Time",  minW: 120, align: "center"  },
                            { key: "rts",                    label: "RTS",       minW: 60,  align: "center" },
                            { key: "rescue",                 label: "Rescue",    minW: 70,  align: "center" },
                            { key: "routeNumber",            label: "Route #",   minW: 80  },
                            { key: "routeDuration",          label: "Duration",  minW: 80, align: "center"  },
                            { key: "stopCount",              label: "Stops",     minW: 56  },
                            { key: "packageCount",           label: "Pkgs",      minW: 56  },
                            { key: "van",                    label: "Van",       minW: 70  },
                            { key: "attendance",             label: "ATT",       minW: 80  },
                        ]}
                        renderCell={(key, row) => {
                            if (key === "dayBeforeConfirmation") {
                                const isTrue = !!row.dayBeforeConfirmation;
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        {isTrue ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleConfirmIcon(row.transporterId, "true"); }}
                                                className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider outline-none focus:outline-none transition-all shadow-sm border bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/25"
                                            >
                                                CONFIRMED
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleConfirmIcon(row.transporterId, "false"); }}
                                                className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted/80 hover:bg-red-500/15 transition-all focus:outline-none shadow-sm ring-1 ring-border/50"
                                            >
                                                <X className="h-4 w-4 text-foreground/70 group-hover:text-red-500 transition-colors cursor-pointer" />
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                            if (key === "deliveryCompletionTime") {
                                const val = row.deliveryCompletionTime;
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        {val ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleDeliveryCompletionTime(row._id, val); }}
                                                className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider outline-none focus:outline-none transition-all shadow-sm border bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
                                                title="Click to reset time"
                                            >
                                                {val}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleDeliveryCompletionTime(row._id, ""); }}
                                                className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted/80 hover:bg-blue-500/15 transition-all focus:outline-none shadow-sm ring-1 ring-border/50 title='Log completion time'"
                                            >
                                                <Clock className="h-4 w-4 text-foreground/70 group-hover:text-blue-500 transition-colors cursor-pointer" />
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                            if (key === "rts") {
                                const hasRts = !!rtsMap[row._id];
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        {hasRts ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRTSModal(row); }}
                                                className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/15 hover:bg-orange-500/25 transition-all shadow-sm border border-orange-500/20"
                                                title="View RTS"
                                            >
                                                <PackageX className="h-4 w-4 text-orange-600 group-hover:text-orange-700 transition-colors cursor-pointer" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRTSModal(row); }}
                                                className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted/80 hover:bg-orange-500/15 transition-all focus:outline-none shadow-sm ring-1 ring-border/50"
                                                title="Log RTS"
                                            >
                                                <PackageX className="h-4 w-4 text-foreground/70 group-hover:text-orange-500 transition-colors cursor-pointer" />
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                            if (key === "rescue") {
                                const hasRescue = !!rescueMap[row._id];
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        {hasRescue ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRescueModal(row); }}
                                                className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/15 hover:bg-blue-500/25 transition-all shadow-sm border border-blue-500/20"
                                                title="View Rescue"
                                            >
                                                <LifeBuoy className="h-4 w-4 text-blue-600 group-hover:text-blue-700 transition-colors cursor-pointer" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRescueModal(row); }}
                                                className="group inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted/80 hover:bg-blue-500/15 transition-all focus:outline-none shadow-sm ring-1 ring-border/50"
                                                title="Log Rescue"
                                            >
                                                <Activity className="h-4 w-4 text-foreground/70 group-hover:text-blue-500 transition-colors cursor-pointer" />
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                            if (key === "routeDuration") {
                                const dur = row.routeDuration || "—";
                                let formattedDur = dur;
                                if (dur !== "—") {
                                    const parts = dur.split(":");
                                    if (parts.length >= 2) {
                                        formattedDur = `${parts[0]}:${parts[1]}`;
                                    }
                                }
                                return (
                                    <div className="w-full text-center font-bold text-[11px] whitespace-nowrap">
                                        {formattedDur}
                                    </div>
                                );
                            }
                            return undefined;
                        }}
                        onConfirmToggle={(row) => toggleConfirmIcon(row.transporterId, row.dayBeforeConfirmation ? "true" : "false")}
                        emptyMessage="No routes scheduled for this date"
                    />
                </Card>

                {/* Right Side: 3 Stacked Boxes */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    {/* Rescue */}
                    <Card className="flex-1 border border-border/50 bg-card/60 backdrop-blur-xl shadow-md overflow-hidden relative group/box p-0 gap-0">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover/box:scale-110 group-hover/box:-rotate-12">
                            <Activity className="w-24 h-24" />
                        </div>
                        <div className="p-5 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Activity className="h-4 w-4 text-blue-500" />
                                </div>
                                <h3 className="font-bold tracking-wide">Rescue</h3>
                            </div>
                            <div className="flex-1 overflow-auto rounded-md border border-border/50 bg-background/40 max-h-[300px]">
                                {rescueEntries.length === 0 ? (
                                    <div className="flex h-full items-center justify-center p-4">
                                        <span className="text-muted-foreground/50 text-xs font-medium uppercase tracking-wider">No rescue records found</span>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs text-left relative">
                                        <thead className="bg-muted/40 text-muted-foreground uppercase sticky top-0 backdrop-blur-md z-10 border-b border-border/50 shadow-sm">
                                            <tr>
                                                <th className="font-semibold p-2.5 pl-3">Employee</th>
                                                <th className="font-semibold p-2.5">Rescued By</th>
                                                <th className="font-semibold p-2.5 text-center">Stops</th>
                                                <th className="font-semibold p-2.5 pr-3">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {rescueEntries.map((rescue) => (
                                                <tr key={rescue._id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="p-2 pl-3 font-medium text-foreground/90 whitespace-nowrap">{rescue.employeeName}</td>
                                                    <td className="p-2 text-muted-foreground">{rescue.rescuerName}</td>
                                                    <td className="p-2 text-center">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 font-mono tracking-wider text-[11px] border border-blue-500/20">{rescue.stopsRescued}</span>
                                                    </td>
                                                    <td className="p-2 pr-3 text-muted-foreground truncate max-w-[120px]" title={rescue.reason}>{rescue.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* RTS */}
                    <Card className="flex-1 border border-border/50 bg-card/60 backdrop-blur-xl shadow-md overflow-hidden relative group/box p-0 gap-0">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover/box:scale-110 group-hover/box:-rotate-12">
                            <AlertCircle className="w-24 h-24" />
                        </div>
                        <div className="p-5 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                </div>
                                <h3 className="font-bold tracking-wide">RTS</h3>
                            </div>
                            <div className="flex-1 overflow-auto rounded-md border border-border/50 bg-background/40 max-h-[300px]">
                                {rtsEntries.length === 0 ? (
                                    <div className="flex h-full items-center justify-center p-4">
                                        <span className="text-muted-foreground/50 text-xs font-medium uppercase tracking-wider">No records</span>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs text-left relative">
                                        <thead className="bg-muted/40 text-muted-foreground uppercase sticky top-0 backdrop-blur-md z-10 border-b border-border/50 shadow-sm">
                                            <tr>
                                                <th className="font-semibold p-2.5 pl-3">Employee</th>
                                                <th className="font-semibold p-2.5">TBA</th>
                                                <th className="font-semibold p-2.5 pr-3">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {rtsEntries.map((rts) => (
                                                <tr key={rts._id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="p-2 pl-3 font-medium text-foreground/90 whitespace-nowrap">{rts.employeeName}</td>
                                                    <td className="p-2">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-600 font-mono tracking-wider text-[10px] border border-orange-500/20">{rts.tba}</span>
                                                    </td>
                                                    <td className="p-2 pr-3 text-muted-foreground truncate max-w-[120px]" title={rts.reason}>{rts.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Fix Punches */}
                    <Card className="flex-1 border border-border/50 bg-card/60 backdrop-blur-xl shadow-md overflow-hidden relative group/box p-0 gap-0">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover/box:scale-110 group-hover/box:-rotate-12">
                            <Clock className="w-24 h-24" />
                        </div>
                        <div className="p-5 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                                    <Clock className="h-4 w-4 text-red-500" />
                                </div>
                                <h3 className="font-bold tracking-wide">Fix Punches</h3>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <span className="text-muted-foreground/40 text-sm font-medium border border-dashed border-border/60 rounded-xl px-4 py-2 bg-muted/10">Module pending implementation</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* RTS Modal */}
            <Dialog open={rtsModalOpen} onOpenChange={setRtsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add RTS Record</DialogTitle>
                    </DialogHeader>
                    {rtsModalRoute && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>
                                    <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">{rtsModalRoute.employeeName}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Date</label>
                                    <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">{date}</div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-foreground mb-1 block">TBA Number</label>
                                <Input placeholder="Enter TBA" value={rtsTBA} onChange={e => setRtsTBA(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-foreground mb-1 block">Reason</label>
                                <Input list="rts-reasons-list" placeholder="Select or type reason" value={rtsReason} onChange={e => setRtsReason(e.target.value)} />
                                <datalist id="rts-reasons-list">
                                    {rtsReasonsList.map(r => <option key={r} value={r} />)}
                                </datalist>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRtsModalOpen(false)}>Cancel</Button>
                        <Button disabled={isSavingRTS || !rtsTBA.trim() || !rtsReason.trim()} onClick={handleSaveRTS}>
                            {isSavingRTS && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save RTS
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rescue Modal */}
            <Dialog open={rescueModalOpen} onOpenChange={setRescueModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Rescue Record</DialogTitle>
                    </DialogHeader>
                    {rescueModalRoute && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>
                                    <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">{rescueModalRoute.employeeName}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Date</label>
                                    <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">{date}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase text-foreground mb-1 block">Rescued By</label>
                                    <Popover open={rescueByOpen} onOpenChange={setRescueByOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" aria-expanded={rescueByOpen} className="w-full justify-between font-normal h-10 border-input bg-background/50 hover:bg-muted/30">
                                                {rescueBy ? (
                                                    (() => {
                                                        const emp = allEmployees.find(e => e.transporterId === rescueBy);
                                                        const fullName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name : rescueBy;
                                                        return (
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                {emp?.profileImage ? (
                                                                    <img src={emp.profileImage} alt={fullName} className="w-5 h-5 rounded-full object-cover shrink-0 bg-muted" />
                                                                ) : (
                                                                    <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                                                                        {fullName.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <span className="truncate">{fullName}</span>
                                                            </div>
                                                        );
                                                    })()
                                                ) : <span className="text-muted-foreground/70">Select employee...</span>}
                                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-border/60" align="start">
                                            <div className="flex items-center border-b px-3">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input 
                                                    autoFocus
                                                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-none"
                                                    placeholder="Search employees..."
                                                    value={rescueBySearch}
                                                    onChange={(e) => setRescueBySearch(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                                {allEmployees.filter(emp => {
                                                    const fn = `${emp.firstName||''} ${emp.lastName||''}`.toLowerCase();
                                                        return fn.includes(rescueBySearch.toLowerCase()) || (emp.transporterId && emp.transporterId.toLowerCase().includes(rescueBySearch.toLowerCase()));
                                                    }).map(emp => {
                                                        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.transporterId;
                                                        const isSelected = rescueBy === emp.transporterId;
                                                        return (
                                                            <div 
                                                                key={emp.transporterId}
                                                                className={cn(
                                                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-muted/50 transition-colors",
                                                                    isSelected ? "bg-blue-500/10 text-blue-700 font-medium" : ""
                                                                )}
                                                                onClick={() => {
                                                                    setRescueBy(emp.transporterId);
                                                                    setRescueByOpen(false);
                                                                    setRescueBySearch("");
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2 w-full">
                                                                    {emp.profileImage ? (
                                                                        <img src={emp.profileImage} alt={fullName} className="w-6 h-6 rounded-full object-cover shadow-sm bg-muted shrink-0" />
                                                                    ) : (
                                                                        <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-bold uppercase ring-1 ring-blue-500/20 shrink-0">
                                                                            {fullName.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                    <span className="truncate">{fullName}</span>
                                                                    {isSelected && (
                                                                        <Check className="ml-auto h-4 w-4 text-blue-600 shrink-0" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {allEmployees.length > 0 && allEmployees.filter(emp => {
                                                        const fn = `${emp.firstName||''} ${emp.lastName||''}`.toLowerCase();
                                                        return fn.includes(rescueBySearch.toLowerCase()) || (emp.transporterId && emp.transporterId.toLowerCase().includes(rescueBySearch.toLowerCase()));
                                                    }).length === 0 && (
                                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                                            No results found.
                                                        </div>
                                                    )}
                                                </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase text-foreground mb-1 block">Stops Rescued</label>
                                    <Input type="number" placeholder="Stops" value={rescueStops} onChange={e => setRescueStops(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-foreground mb-1 block">Reason</label>
                                <Input list="rescue-reasons-list" placeholder="Select or type reason" value={rescueReason} onChange={e => setRescueReason(e.target.value)} />
                                <datalist id="rescue-reasons-list">
                                    {rescueReasonsList.map(r => <option key={r} value={r} />)}
                                </datalist>
                            </div>
                            <div className="flex items-center gap-3 p-3 mt-2 border rounded-lg bg-card shadow-sm">
                                <input
                                    type="checkbox"
                                    id="performance-rescue"
                                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                    checked={rescuePerformance}
                                    onChange={(e) => setRescuePerformance(e.target.checked)}
                                />
                                <label htmlFor="performance-rescue" className="text-sm font-semibold cursor-pointer select-none">
                                    Performance Rescue
                                </label>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRescueModalOpen(false)}>Cancel</Button>
                        <Button disabled={isSavingRescue || !rescueBy || !rescueStops || !rescueReason.trim()} onClick={handleSaveRescue} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSavingRescue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Rescue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
