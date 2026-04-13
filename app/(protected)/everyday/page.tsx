"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Loader2, Save, MapPin, Check, X, FileText, Activity, AlertCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Navigation, FileDown, DoorOpen, DoorClosed, Coffee, PhoneOff, GraduationCap, TruckIcon, CalendarOff, UserCheck, BookOpen, Ban, ShieldAlert, PackageX, LifeBuoy, Search, ChevronDown, Edit2, Phone, Timer, Package, Hash, ThumbsUp, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn, formatPhoneNumber } from "@/lib/utils";
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

const HeaderIcon = ({ icon: Icon, title, className, strokeWidth }: any) => (
    <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex cursor-help items-center justify-center w-full focus:outline-none">
                    <Icon className={className} strokeWidth={strokeWidth} />
                </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="z-50 border border-border/50 bg-black/90 text-white shadow-xl">
                <p className="font-bold text-[11px] tracking-wide uppercase">{title}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

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
    const [tomorrowRoutes, setTomorrowRoutes] = useState<any[]>([]);
    const [tomorrowSchedulesMap, setTomorrowSchedulesMap] = useState<Record<string, any>>({});
    const [routeTypeConfigs, setRouteTypeConfigs] = useState<Record<string, any>>({});
    const [pdfLoading, setPdfLoading] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const [debounceNotes, setDebounceNotes] = useState(notes);

    const [rtsModalOpen, setRtsModalOpen] = useState(false);
    const [rtsModalEditId, setRtsModalEditId] = useState<string | null>(null);
    const [rtsModalRoute, setRtsModalRoute] = useState<RoutesTableRow | null>(null);
    const [rtsTBA, setRtsTBA] = useState("");
    const [rtsReason, setRtsReason] = useState("");
    const [rtsReasonsList, setRtsReasonsList] = useState<string[]>([]);
    const [isSavingRTS, setIsSavingRTS] = useState(false);
    const [rtsMap, setRtsMap] = useState<Record<string, any>>({});

    const [rescueModalOpen, setRescueModalOpen] = useState(false);
    const [rescueModalEditId, setRescueModalEditId] = useState<string | null>(null);
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

    const openRTSModal = (row: RoutesTableRow, existingRecord?: any) => {
        setRtsModalRoute(row);
        setRtsModalEditId(existingRecord ? existingRecord._id : null);
        setRtsTBA(existingRecord ? existingRecord.tba : "");
        setRtsReason(existingRecord ? existingRecord.reason : "");
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
                    _id: rtsModalEditId,
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
                setRtsMap(prev => {
                    const currentArr = prev[rtsModalRoute._id] || [];
                    const index = currentArr.findIndex((r: any) => r._id === updatedObj.rts._id);
                    let newArr = [...currentArr];
                    if (index > -1) {
                        newArr[index] = updatedObj.rts;
                    } else {
                        newArr.push(updatedObj.rts);
                    }
                    return { ...prev, [rtsModalRoute._id]: newArr };
                });
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

    const handleDeleteRTS = async () => {
        if (!rtsModalEditId || !rtsModalRoute) return;
        try {
            const res = await fetch(`/api/everyday/rts?id=${rtsModalEditId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete RTS");
            toast.success("RTS record deleted");
            setRtsModalOpen(false);
            setRtsMap(prev => {
                const newMap = { ...prev };
                Object.keys(newMap).forEach(k => {
                    newMap[k] = newMap[k].filter((r: any) => String(r._id) !== String(rtsModalEditId));
                });
                return newMap;
            });
        } catch (e) {
            toast.error("Failed to delete RTS record");
        }
    };

    const openRescueModal = (row: RoutesTableRow, existingRecord?: any) => {
        setRescueModalRoute(row);
        setRescueModalEditId(existingRecord ? existingRecord._id : null);
        setRescueBy(existingRecord ? existingRecord.rescuedBytransporterId : "");
        setRescueStops(existingRecord ? String(existingRecord.stopsRescued) : "");
        setRescueReason(existingRecord ? existingRecord.reason : "");
        setRescuePerformance(existingRecord ? existingRecord.performanceRescue : false);
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
                    _id: rescueModalEditId,
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
                setRescueMap(prev => {
                    const currentArr = prev[rescueModalRoute._id] || [];
                    const index = currentArr.findIndex((r: any) => r._id === updatedObj.rescue._id);
                    let newArr = [...currentArr];
                    if (index > -1) {
                        newArr[index] = updatedObj.rescue;
                    } else {
                        newArr.push(updatedObj.rescue);
                    }
                    return { ...prev, [rescueModalRoute._id]: newArr };
                });
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

    const handleDeleteRescue = async () => {
        if (!rescueModalEditId || !rescueModalRoute) return;
        try {
            const res = await fetch(`/api/everyday/rescue?id=${rescueModalEditId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete Rescue");
            toast.success("Rescue record deleted");
            setRescueModalOpen(false);
            setRescueMap(prev => {
                const newMap = { ...prev };
                Object.keys(newMap).forEach(k => {
                    newMap[k] = newMap[k].filter((r: any) => String(r._id) !== String(rescueModalEditId));
                });
                return newMap;
            });
        } catch (e) {
            toast.error("Failed to delete Rescue record");
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
        const today = getTodayPacific();
        setDate(today);
        const currentWeek = getCurrentYearWeek(today);
        setSelectedWeek(currentWeek);
        setWeeks([currentWeek]); // set to unlock loading logic
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

    // Removed week selection widget

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

            // 2. Fetch routes, schedules, rts, and rescue FOR TODAY, plus tomorrow's routes/schedules
            const tomorrow = (() => {
                const tDate = new Date(date + "T12:00:00Z");
                tDate.setUTCDate(tDate.getUTCDate() + 1);
                return tDate.toISOString().split("T")[0];
            })();
            const tomorrowWeek = getCurrentYearWeek(tomorrow);

            const [routesRes, schedulesRes, rtsRes, rescueRes, tRoutesRes, tSchedulesRes, routeTypesRes] = await Promise.all([
                fetch(`/api/dispatching/routes?yearWeek=${selectedWeek}&date=${date}`),
                fetch(`/api/everyday/schedules?dateStr=${date}&yearWeek=${selectedWeek}`),
                fetch(`/api/everyday/rts?dateStr=${date}`),
                fetch(`/api/everyday/rescue?dateStr=${date}`),
                fetch(`/api/dispatching/routes?yearWeek=${tomorrowWeek}&date=${tomorrow}`),
                fetch(`/api/everyday/schedules?dateStr=${tomorrow}&yearWeek=${tomorrowWeek}`),
                fetch(`/api/admin/settings/route-types`)
            ]);

            let empMap: Record<string, any> = {};

            if (routesRes.ok) {
                const rData = await routesRes.json();
                setRoutes(rData.routes || []);
                empMap = { ...empMap, ...(rData.employees || {}) };
            } else {
                setRoutes([]);
            }

            if (tRoutesRes.ok) {
                const tData = await tRoutesRes.json();
                setTomorrowRoutes(tData.routes || []);
                empMap = { ...empMap, ...(tData.employees || {}) };
            } else {
                setTomorrowRoutes([]);
            }

            setEmployeesMap(empMap);

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

            if (tSchedulesRes.ok) {
                const tSData = await tSchedulesRes.json();
                const tempMap: Record<string, any> = {};
                (tSData.schedules || []).forEach((s: any) => {
                    tempMap[s.transporterId] = s;
                });
                setTomorrowSchedulesMap(tempMap);
            } else {
                setTomorrowSchedulesMap({});
            }

            if (rtsRes.ok) {
                const rtsData = await rtsRes.json();
                if (rtsData.reasons) setRtsReasonsList(rtsData.reasons);
                const tm: Record<string, any[]> = {};
                (rtsData.records || []).forEach((r: any) => {
                    if (!tm[r.routeId]) tm[r.routeId] = [];
                    tm[r.routeId].push(r);
                });
                setRtsMap(tm);
            } else {
                setRtsMap({});
            }

            if (rescueRes.ok) {
                const resData = await rescueRes.json();
                if (resData.reasons) setRescueReasonsList(resData.reasons);
                const rm: Record<string, any[]> = {};
                (resData.records || []).forEach((r: any) => {
                    if (!rm[r.routeId]) rm[r.routeId] = [];
                    rm[r.routeId].push(r);
                });
                setRescueMap(rm);
            } else {
                setRescueMap({});
            }

            if (routeTypesRes.ok) {
                const rtData = await routeTypesRes.json();
                const map: Record<string, any> = {};
                (Array.isArray(rtData) ? rtData : []).forEach((rt: any) => {
                    map[rt.name.toLowerCase()] = rt;
                });
                setRouteTypeConfigs(map);
            } else {
                setRouteTypeConfigs({});
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

    const toggleConfirmIcon = async (transporterId: string, currentVal: string, isTomorrow = false) => {
        if (!date) return;

        const targetDate = isTomorrow ? (() => {
            const tDate = new Date(date + "T12:00:00Z");
            tDate.setUTCDate(tDate.getUTCDate() + 1);
            return tDate.toISOString().split("T")[0];
        })() : date;

        const nextVal = currentVal === "true" ? "false" : "true";

        if (isTomorrow) {
            setTomorrowSchedulesMap(prev => ({
                ...prev,
                [transporterId]: { ...prev[transporterId], dayBeforeConfirmation: nextVal }
            }));
        } else {
            setSchedulesMap(prev => ({
                ...prev,
                [transporterId]: { ...prev[transporterId], dayBeforeConfirmation: nextVal }
            }));
        }

        try {
            const res = await fetch("/api/everyday/schedules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transporterId, dateStr: targetDate, dayBeforeConfirmation: nextVal })
            });
            if (!res.ok) throw new Error("Update failed");
        } catch (err) {
            toast.error("Failed to update status");
            // revert locally
            if (isTomorrow) {
                setTomorrowSchedulesMap(prev => ({ ...prev, [transporterId]: { ...prev[transporterId], dayBeforeConfirmation: currentVal } }));
            } else {
                setSchedulesMap(prev => ({ ...prev, [transporterId]: { ...prev[transporterId], dayBeforeConfirmation: currentVal } }));
            }
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

    const groupedTomorrowRoutes = useMemo(() => {
        const map: Record<string, RoutesTableRow[]> = {};

        // Drive from tomorrowRoutes — this has all employees + types from the dispatching API
        tomorrowRoutes.forEach(r => {
            const typeLower = (r.type || "Unassigned").toLowerCase();
            const config = routeTypeConfigs[typeLower];
            
            // Filter: Route Status must be Scheduled
            if (config && config.routeStatus?.toLowerCase() !== "scheduled") return;
            // Also maintain the hardcoded "off" check just in case it takes time to load configs
            if (typeLower === "off") return;

            const type = r.type || "Unassigned";
            const empFromMap = employeesMap[r.transporterId] || {};
            // Look up confirmation from schedules fetched for tomorrow
            const schedule = tomorrowSchedulesMap[r.transporterId] || {};

            if (!map[type]) map[type] = [];
            map[type].push({
                _id: r._id,
                transporterId: r.transporterId,
                type: type,
                employeeName: r.employeeName || empFromMap.name || r.transporterId,
                profileImage: r.profileImage || empFromMap.profileImage || "",
                phone: r.phone || empFromMap.phoneNumber || empFromMap.phone || "",
                dayBeforeConfirmation: schedule.dayBeforeConfirmation === "true" || schedule.futureShiftConfirmed === true,
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
    }, [tomorrowRoutes, tomorrowSchedulesMap, employeesMap, routeTypeConfigs]);

    const rtsEntries = useMemo(() => {
        return Object.values(rtsMap).flat().map((rts: any) => {
            const route = routes.find(r => r._id === rts.routeId);
            const emp = employeesMap[rts.transporterId] || {};
            return {
                _id: rts._id || rts.routeId,
                routeObj: route,
                originalRecord: rts,
                employeeName: route?.employeeName || emp.name || rts.transporterId,
                employeeImage: emp.profileImage,
                routeNumber: route?.routeNumber || "—",
                tba: rts.tba,
                reason: rts.reason
            };
        });
    }, [rtsMap, routes, employeesMap]);

    const rescueEntries = useMemo(() => {
        return Object.values(rescueMap).flat().map((rescue: any) => {
            const route = routes.find(r => r._id === rescue.routeId);
            const emp = employeesMap[rescue.transporterId] || {};
            const rescuer = allEmployees.find(e => e.transporterId === rescue.rescuedBytransporterId);
            const rescuerName = rescuer ? (`${rescuer.firstName || ''} ${rescuer.lastName || ''}`.trim() || rescuer.name || rescue.rescuedBytransporterId) : rescue.rescuedBytransporterId;
            return {
                _id: rescue._id || rescue.routeId,
                routeObj: route,
                originalRecord: rescue,
                employeeName: route?.employeeName || emp.name || rescue.transporterId,
                employeeImage: emp.profileImage,
                rescuerName,
                rescuerImage: rescuer?.profileImage,
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

    const parsedDate = date ? new Date(date + "T12:00:00Z") : new Date();
    const formattedDate = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const parsedTomorrow = new Date(parsedDate);
    parsedTomorrow.setUTCDate(parsedTomorrow.getUTCDate() + 1);
    const formattedTomorrow = parsedTomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-background">
            {/* Top row: Horizontal Date Selector & Notes inline */}
            <div className="mb-2 shrink-0 overflow-x-auto scrollbar-none">
                <div className="flex items-stretch gap-1 p-1 rounded-xl bg-muted/50 border border-border min-w-max flex-1">
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

            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5">
                {/* Middle Left: Tables */}
                <div className="xl:col-span-9 grid grid-cols-1 xl:grid-cols-[2.1fr_1fr] gap-4 lg:gap-5 min-h-0">
                    {/* Routes Overview */}
                    <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden p-0 gap-0 min-h-0">
                        <div className="py-2.5 px-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground leading-none tracking-tight flex items-center">
                                            Routes Overview <span className="text-[11px] opacity-60 font-medium ml-1.5 bg-orange-500/10 text-foreground px-1.5 py-0.5 rounded-sm">({formattedDate})</span>
                                        </h2>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <RoutesTable
                            groups={groupedRoutes}
                            loading={loading}
                            columns={[
                                { key: "employee", label: "Employee", minW: 120, sticky: true },
                                { key: "deliveryCompletionTime", label: <HeaderIcon title="Delivery Completion Time" icon={Clock} className="h-[18px] w-[18px] text-blue-500" strokeWidth={1.5} />, minW: 70, align: "center" },
                                { key: "rts", label: <span className="font-semibold text-xs text-orange-600">RTS</span>, minW: 55, align: "center" },
                                { key: "rescue", label: <span className="font-semibold text-xs text-teal-600">Rescue</span>, minW: 65, align: "center" },
                                { key: "routeNumber", label: <HeaderIcon title="Route Number" icon={Hash} className="h-[18px] w-[18px] text-rose-500" strokeWidth={1.5} />, minW: 55, align: "center" },
                                { key: "routeDuration", label: <HeaderIcon title="Route Duration" icon={Timer} className="h-[18px] w-[18px] text-yellow-500" strokeWidth={1.5} />, minW: 45, align: "center" },
                                { key: "stopCount", label: <HeaderIcon title="Total Stops" icon={MapPin} className="h-[18px] w-[18px] text-blue-500" strokeWidth={1.5} />, minW: 40, align: "center" },
                                { key: "packageCount", label: <HeaderIcon title="Total Packages" icon={Package} className="h-[18px] w-[18px] text-orange-500" strokeWidth={1.5} />, minW: 40, align: "center" },
                                { key: "van", label: <HeaderIcon title="Van Number" icon={TruckIcon} className="h-[18px] w-[18px] text-emerald-500" strokeWidth={1.5} />, minW: 40, align: "center" },
                                { key: "attendance", label: <HeaderIcon title="Attendance Tracker" icon={UserCheck} className="h-[18px] w-[18px] text-purple-500" strokeWidth={1.5} />, minW: 40, align: "center" },
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
                                                    className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider outline-none focus:outline-none transition-all shadow-sm border bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 whitespace-nowrap"
                                                    title="Click to reset time"
                                                >
                                                    {val}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleDeliveryCompletionTime(row._id, ""); }}
                                                    className="group inline-flex items-center justify-center w-12 h-8 rounded-full bg-blue-500/15 hover:bg-blue-500/25 transition-all focus:outline-none shadow-sm ring-1 ring-blue-500/30 title='Log completion time'"
                                                >
                                                    <Clock className="h-[18px] w-[18px] text-blue-500 transition-transform group-hover:scale-110 cursor-pointer" strokeWidth={1.5} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                }
                                if (key === "rts") {
                                    const rtsList = rtsMap[row._id] || [];
                                    const count = rtsList.length;
                                    return (
                                        <div className="w-full flex items-center justify-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRTSModal(row); }}
                                                className={`group inline-flex items-center justify-center h-8 ${count > 0 ? 'px-3' : 'w-12'} rounded-full bg-orange-500/10 hover:bg-orange-500/20 transition-all focus:outline-none shadow-sm ring-1 ring-orange-500/30 gap-1.5`}
                                                title="Add RTS"
                                            >
                                                <PackageX className="h-[18px] w-[18px] text-orange-500 transition-transform group-hover:scale-110 cursor-pointer" strokeWidth={1.5} />
                                                {count > 0 && <span className="text-[11px] font-bold text-orange-600">{count}</span>}
                                            </button>
                                        </div>
                                    );
                                }
                                if (key === "rescue") {
                                    const list = rescueMap[row._id] || [];
                                    const count = list.length;
                                    return (
                                        <div className="w-full flex items-center justify-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openRescueModal(row); }}
                                                className={`group inline-flex items-center justify-center h-8 ${count > 0 ? 'px-3' : 'w-12'} rounded-full bg-teal-500/10 hover:bg-teal-500/20 transition-all focus:outline-none shadow-sm ring-1 ring-teal-500/30 gap-1.5`}
                                                title="Add Rescue"
                                            >
                                                <Activity className="h-[18px] w-[18px] text-teal-500 transition-transform group-hover:scale-110 cursor-pointer" strokeWidth={1.5} />
                                                {count > 0 && <span className="text-[11px] font-bold text-teal-600">{count}</span>}
                                            </button>
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

                    {/* Roster Plan */}
                    <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden p-0 gap-0 min-h-0">
                        <div className="py-2.5 px-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground leading-none tracking-tight flex items-center">
                                            Roster Plan <span className="text-[11px] opacity-60 font-medium ml-1.5 bg-indigo-500/10 text-foreground px-1.5 py-0.5 rounded-sm">({formattedTomorrow})</span>
                                        </h2>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <RoutesTable
                            groups={groupedTomorrowRoutes}
                            loading={loading}
                            columns={[
                                { key: "employee", label: "Employee", minW: 100, sticky: true },
                                { key: "dayBeforeConfirmation", label: <HeaderIcon title="Day Before Confirmation" icon={ThumbsUp} className="h-[18px] w-[18px] text-emerald-500" strokeWidth={1.5} />, minW: 46, align: "center" },
                                { key: "phone", label: <HeaderIcon title="Phone Number" icon={Phone} className="h-[18px] w-[18px] text-blue-500" strokeWidth={1.5} />, minW: 105, align: "center" },
                            ]}
                            renderCell={(key, row) => {
                                if (key === "phone") {
                                    const val = row.phone;
                                    return (
                                        <div className="w-full flex items-center justify-center">
                                            {val ? (
                                                <a
                                                    href={`tel:${val}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center justify-center px-2 py-1 rounded-[4px] bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all border border-blue-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-[11px] font-mono font-medium tracking-wide whitespace-nowrap"
                                                    title={`Call ${val}`}
                                                >
                                                    <Phone className="h-3 w-3 mr-1.5 text-blue-500" strokeWidth={2} />
                                                    {formatPhoneNumber(String(val))}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground/30 text-[11px] font-bold">—</span>
                                            )}
                                        </div>
                                    );
                                }
                                if (key === "dayBeforeConfirmation") {
                                    const isTrue = !!row.dayBeforeConfirmation;
                                    return (
                                        <div className="w-full flex items-center justify-center">
                                            {isTrue ? (
                                                <button
                                                    onClick={(e) => {
                                                        if (row.autoConfirmed) return;
                                                        e.stopPropagation();
                                                        toggleConfirmIcon(row.transporterId, "true", true);
                                                    }}
                                                    className={cn(
                                                        "group inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/15 shadow-sm ring-1 ring-emerald-500/20 transition-all focus:outline-none",
                                                        row.autoConfirmed ? "opacity-90 !cursor-default pointer-events-none" : "cursor-pointer hover:bg-emerald-500/25"
                                                    )}
                                                >
                                                    <ThumbsUp className={cn("h-[15px] w-[15px] text-emerald-500", !row.autoConfirmed && "transition-transform group-hover:scale-110")} strokeWidth={2.5} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleConfirmIcon(row.transporterId, "false", true); }}
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
                                                    className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider outline-none focus:outline-none transition-all shadow-sm border bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 whitespace-nowrap"
                                                    title="Click to reset time"
                                                >
                                                    {val}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleDeliveryCompletionTime(row._id, ""); }}
                                                    className="group inline-flex items-center justify-center w-12 h-8 rounded-full bg-blue-500/15 hover:bg-blue-500/25 transition-all focus:outline-none shadow-sm ring-1 ring-blue-500/30 title='Log completion time'"
                                                >
                                                    <Clock className="h-[18px] w-[18px] text-blue-500 transition-transform group-hover:scale-110 cursor-pointer" strokeWidth={1.5} />
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
                                                    className="group inline-flex items-center justify-center w-12 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500/20 transition-all focus:outline-none shadow-sm ring-1 ring-orange-500/30"
                                                    title="Log RTS"
                                                >
                                                    <PackageX className="h-[18px] w-[18px] text-orange-500 transition-transform group-hover:scale-110 cursor-pointer" strokeWidth={1.5} />
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
                                                    className="group inline-flex items-center justify-center w-12 h-8 rounded-full bg-teal-500/10 hover:bg-teal-500/20 transition-all focus:outline-none shadow-sm ring-1 ring-teal-500/30"
                                                    title="Log Rescue"
                                                >
                                                    <Activity className="h-[18px] w-[18px] text-teal-500 transition-transform group-hover:scale-110 cursor-pointer" strokeWidth={1.5} />
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
                            onConfirmToggle={(row) => toggleConfirmIcon(row.transporterId, row.dayBeforeConfirmation ? "true" : "false", true)}
                            emptyMessage="No roster scheduled for tomorrow"
                        />
                    </Card>
                </div>

                {/* Right Side: 3 Stacked Boxes */}
                <div className="xl:col-span-3 flex flex-col gap-4 min-h-0">
                    {/* Fix Punches */}
                    <Card className="flex-1 border border-border/50 bg-card/60 backdrop-blur-xl shadow-md flex flex-col overflow-hidden relative group/box p-0 gap-0 min-h-0">
                        <div className="py-2.5 px-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                            <h3 className="text-sm font-bold tracking-wide">Fix Punches</h3>
                        </div>
                        <div className="flex-1 flex items-center justify-center bg-background/40">
                            <span className="text-muted-foreground/40 text-sm font-medium border border-dashed border-border/60 rounded-xl px-4 py-2 bg-muted/10">Module pending implementation</span>
                        </div>
                    </Card>

                    {/* Rescue */}
                    <Card className="flex-1 border border-border/50 bg-card/60 backdrop-blur-xl shadow-md flex flex-col overflow-hidden relative group/box p-0 gap-0 min-h-0">
                        <div className="py-2.5 px-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                            <h3 className="text-sm font-bold tracking-wide">Rescue</h3>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto bg-background/40">
                            {rescueEntries.length === 0 ? (
                                <div className="flex h-full items-center justify-center p-4">
                                    <span className="text-muted-foreground/50 text-xs font-medium uppercase tracking-wider">No rescue records found</span>
                                </div>
                            ) : (
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-muted text-muted-foreground uppercase sticky top-0 z-10 border-b border-border/50 shadow-sm">
                                        <tr>
                                            <th className="font-semibold p-2.5 pl-3">Employee</th>
                                            <th className="font-semibold p-2.5">Rescued By</th>
                                            <th className="font-semibold p-2.5 text-center">Stops</th>
                                            <th className="font-semibold p-2.5">Reason</th>
                                            <th className="font-semibold p-2.5 pr-3 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {rescueEntries.map((rescue) => (
                                            <tr key={rescue._id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-2 pl-3 font-normal text-foreground/90 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 max-w-[140px] xl:max-w-max">
                                                        {rescue.employeeImage ? (
                                                            <img src={rescue.employeeImage} alt={rescue.employeeName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center text-[9px] font-bold shrink-0 uppercase">
                                                                {(rescue.employeeName || "-").charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="truncate">{rescue.employeeName}</span>
                                                        {rescue.performanceRescue && (
                                                            <span title="Performance Rescue" className="flex items-center justify-center shrink-0">
                                                                <AlertCircle strokeWidth={1.5} className="h-[14px] w-[14px] text-orange-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-muted-foreground whitespace-nowrap">
                                                    <div className="flex items-center gap-2 max-w-[140px] xl:max-w-max">
                                                        {rescue.rescuerImage ? (
                                                            <img src={rescue.rescuerImage} alt={rescue.rescuerName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[9px] font-bold shrink-0 uppercase border border-blue-500/20">
                                                                {(rescue.rescuerName || "-").charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="truncate">{rescue.rescuerName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <span className="inline-flex px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 font-mono tracking-wider text-[11px] border border-blue-500/20">{rescue.stopsRescued}</span>
                                                </td>
                                                <td className="p-2 text-muted-foreground truncate max-w-[120px]" title={rescue.reason}>{rescue.reason}</td>
                                                <td className="p-2 pr-3 text-right">
                                                    <button
                                                        onClick={() => {
                                                            const rObj = rescue.routeObj || { _id: rescue.originalRecord.routeId, transporterId: rescue.originalRecord.transporterId, employeeName: rescue.employeeName };
                                                            openRescueModal(rObj, rescue.originalRecord);
                                                        }}
                                                        className="p-1.5 hover:bg-muted/50 rounded-md transition-colors text-muted-foreground hover:text-foreground inline-flex items-center"
                                                        title="Edit Rescue"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>

                    {/* RTS */}
                    <Card className="flex-1 border border-border/50 bg-card/60 backdrop-blur-xl shadow-md flex flex-col overflow-hidden relative group/box p-0 gap-0 min-h-0">
                        <div className="py-2.5 px-3.5 border-b border-border/50 bg-muted/20 shrink-0">
                            <h3 className="text-sm font-bold tracking-wide">RTS</h3>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto bg-background/40">
                            {rtsEntries.length === 0 ? (
                                <div className="flex h-full items-center justify-center p-4">
                                    <span className="text-muted-foreground/50 text-xs font-medium uppercase tracking-wider">No records</span>
                                </div>
                            ) : (
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-muted text-muted-foreground uppercase sticky top-0 z-10 border-b border-border/50 shadow-sm">
                                        <tr>
                                            <th className="font-semibold p-2.5 pl-3">Employee</th>
                                            <th className="font-semibold p-2.5">TBA</th>
                                            <th className="font-semibold p-2.5">Reason</th>
                                            <th className="font-semibold p-2.5 pr-3 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {rtsEntries.map((rts) => (
                                            <tr key={rts._id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-2 pl-3 font-normal text-foreground/90 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 max-w-[160px] xl:max-w-max">
                                                        {rts.employeeImage ? (
                                                            <img src={rts.employeeImage} alt={rts.employeeName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center text-[9px] font-bold shrink-0 uppercase">
                                                                {(rts.employeeName || "-").charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="truncate">{rts.employeeName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    <span className="inline-flex px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-600 font-mono tracking-wider text-[10px] border border-orange-500/20">{rts.tba}</span>
                                                </td>
                                                <td className="p-2 text-muted-foreground truncate max-w-[120px]" title={rts.reason}>{rts.reason}</td>
                                                <td className="p-2 pr-3 text-right">
                                                    <button
                                                        onClick={() => {
                                                            const rObj = rts.routeObj || { _id: rts.originalRecord.routeId, transporterId: rts.originalRecord.transporterId, employeeName: rts.employeeName };
                                                            openRTSModal(rObj, rts.originalRecord);
                                                        }}
                                                        className="p-1.5 hover:bg-muted/50 rounded-md transition-colors text-muted-foreground hover:text-foreground inline-flex items-center"
                                                        title="Edit RTS"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* RTS Modal */}
            <Dialog open={rtsModalOpen} onOpenChange={setRtsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{rtsModalEditId ? "Edit" : "Add"} RTS Record</DialogTitle>
                    </DialogHeader>
                    {rtsModalRoute && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>
                                    <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">{employeesMap[rtsModalRoute.transporterId]?.name || rtsModalRoute.employeeName || rtsModalRoute.transporterId}</div>
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
                    <DialogFooter className="w-full flex justify-between sm:justify-between items-center sm:items-center">
                        <div>
                            {rtsModalEditId && (
                                <Button variant="destructive" onClick={handleDeleteRTS}>Delete</Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setRtsModalOpen(false)}>Cancel</Button>
                            <Button disabled={isSavingRTS || !rtsTBA.trim() || !rtsReason.trim()} onClick={handleSaveRTS}>
                                {isSavingRTS && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save RTS
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rescue Modal */}
            <Dialog open={rescueModalOpen} onOpenChange={setRescueModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{rescueModalEditId ? "Edit" : "Add"} Rescue Record</DialogTitle>
                    </DialogHeader>
                    {rescueModalRoute && (
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>
                                    <div className="p-2 border rounded-md bg-muted/50 text-sm font-medium">{employeesMap[rescueModalRoute.transporterId]?.name || rescueModalRoute.employeeName || rescueModalRoute.transporterId}</div>
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
                                            <div
                                                className="max-h-[250px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent overscroll-contain"
                                                onWheel={(e) => e.stopPropagation()}
                                                onTouchMove={(e) => e.stopPropagation()}
                                            >
                                                {allEmployees.filter(emp => {
                                                    if (rescueModalRoute && emp.transporterId === rescueModalRoute.transporterId) return false;
                                                    const fn = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
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
                                                    if (rescueModalRoute && emp.transporterId === rescueModalRoute.transporterId) return false;
                                                    const fn = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
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
                    <DialogFooter className="w-full flex justify-between sm:justify-between items-center sm:items-center">
                        <div>
                            {rescueModalEditId && (
                                <Button variant="destructive" onClick={handleDeleteRescue}>Delete</Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setRescueModalOpen(false)}>Cancel</Button>
                            <Button disabled={isSavingRescue || !rescueBy || !rescueStops || !rescueReason.trim()} onClick={handleSaveRescue} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {isSavingRescue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Rescue
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
