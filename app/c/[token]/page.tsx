"use client";

import { useState, useEffect, use } from "react";

type Status = "loading" | "pending" | "confirmed" | "change_requested" | "error" | "expired" | "submitting";

interface ConfirmData {
    token: string;
    employeeName: string;
    status: string;
    yearWeek: string;
    messageType: string;
    scheduleDate?: string;
    confirmedAt?: string;
    changeRequestedAt?: string;
    changeRemarks?: string;
    messageContent?: string;
    schedule?: {
        date: string;
        weekDay: string;
        type: string;
        startTime: string;
        van: string;
    };
    weekSchedules?: {
        date: string;
        weekDay: string;
        type: string;
        startTime: string;
        van: string;
    }[];
}

/** Schedule dates are stored as UTC midnight. Shift to noon UTC to prevent
 *  timezone conversion from rolling back to the previous calendar day. */
function safeDate(d: string): Date {
    const date = new Date(d);
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
        date.setUTCHours(12);
    }
    return date;
}

function formatDate(d: string) {
    try {
        return safeDate(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
    } catch { return d; }
}

function formatDateOnly(d: string) {
    try {
        return safeDate(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
    } catch { return d; }
}

function formatShortDate(d: string) {
    try {
        return safeDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
    } catch { return d; }
}

function formatDayName(d: string) {
    try {
        return safeDate(d).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Los_Angeles" });
    } catch { return d; }
}

function formatFullDay(d: string) {
    try {
        return safeDate(d).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
    } catch { return d; }
}

function formatTime(t: string) {
    if (!t) return "";
    return t;
}

function getShiftConfig(type: string) {
    const t = (type || "").toLowerCase().trim();
    if (t === "off" || !type) return { label: "OFF", color: "text-zinc-400", bg: "bg-zinc-700", isOff: true };
    if (t === "route") return { label: "Route", color: "text-white", bg: "bg-emerald-600", isOff: false };
    if (t === "open") return { label: "Open", color: "text-white", bg: "bg-amber-500", isOff: false };
    if (t === "close") return { label: "Close", color: "text-white", bg: "bg-rose-500", isOff: false };
    if (t === "fleet") return { label: "Fleet", color: "text-white", bg: "bg-blue-600", isOff: false };
    if (t === "call out") return { label: "Call Out", color: "text-white", bg: "bg-yellow-500", isOff: false };
    if (t === "request off") return { label: "Request Off", color: "text-white", bg: "bg-purple-600", isOff: true };
    if (t === "amz training") return { label: "AMZ Training", color: "text-white", bg: "bg-indigo-600", isOff: false };
    if (t === "trainer") return { label: "Trainer", color: "text-white", bg: "bg-teal-600", isOff: false };
    if (t === "training otr") return { label: "Training OTR", color: "text-white", bg: "bg-violet-600", isOff: false };
    if (t.includes("modified")) return { label: "Modified Duty", color: "text-white", bg: "bg-amber-600", isOff: false };
    if (t.includes("stand")) return { label: "Stand By", color: "text-white", bg: "bg-cyan-600", isOff: false };
    if (t.includes("suspend")) return { label: "Suspension", color: "text-white", bg: "bg-rose-700", isOff: true };
    if (t.includes("pending")) return { label: type, color: "text-white", bg: "bg-amber-500", isOff: false };
    return { label: type, color: "text-white", bg: "bg-zinc-600", isOff: false };
}

function getMessageTitle(messageType: string) {
    const MAP: Record<string, string> = {
        "future-shift": "Future Shift Notification",
        "shift": "Shift Notification",
        "off-tomorrow": "Off Today / Schedule Tomorrow",
        "week-schedule": "Week Schedule",
        "route-itinerary": "Route Itinerary",
    };
    return MAP[messageType] || "Schedule Notification";
}

function WeeklyScheduleCard({ weekSchedules, yearWeek }: { weekSchedules: ConfirmData["weekSchedules"]; yearWeek: string }) {
    if (!weekSchedules || weekSchedules.length === 0) return null;

    // Parse yearWeek for display
    const weekMatch = yearWeek?.match(/(\d{4})-W?(\d{1,2})/);
    const weekLabel = weekMatch ? `Week ${parseInt(weekMatch[2])}, ${weekMatch[1]}` : yearWeek;

    const workDays = weekSchedules.filter(s => getShiftConfig(s.type).isOff === false);

    return (
        <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700/50 overflow-hidden mb-5">
            {/* Header */}
            <div className="relative px-4 py-3 bg-gradient-to-r from-blue-600/20 via-violet-600/15 to-blue-600/10 border-b border-zinc-700/40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/30">
                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Weekly Schedule</h3>
                            <p className="text-[10px] text-zinc-400">{weekLabel}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Working</span>
                        <p className="text-sm font-bold text-emerald-400">{workDays.length} day{workDays.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex items-center px-4 py-1.5 bg-zinc-800/40 border-b border-zinc-700/30 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                <span className="w-[68px] shrink-0">Date</span>
                <span className="w-[52px] shrink-0">Day</span>
                <span className="flex-1">Shift</span>
                <span className="w-[60px] text-right shrink-0">Time</span>
            </div>

            {/* Schedule Rows */}
            <div className="divide-y divide-zinc-700/20">
                {weekSchedules.map((day, i) => {
                    const config = getShiftConfig(day.type);
                    const isToday = (() => {
                        try {
                            const d = safeDate(day.date);
                            const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
                            const dayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
                            return dayStr === todayStr;
                        } catch { return false; }
                    })();

                    return (
                        <div
                            key={i}
                            className={`flex items-center px-4 py-2 transition-all ${isToday ? "bg-blue-500/8" : ""} ${config.isOff ? "opacity-50" : ""}`}
                        >
                            {/* Date */}
                            <span className={`w-[68px] shrink-0 text-[11px] font-medium ${isToday ? "text-blue-300" : "text-zinc-300"}`}>
                                {formatShortDate(day.date)}
                            </span>

                            {/* Day */}
                            <span className={`w-[52px] shrink-0 text-[11px] ${isToday ? "text-blue-400 font-semibold" : "text-zinc-400"}`}>
                                {formatDayName(day.date)}
                            </span>

                            {/* Shift Type */}
                            <div className="flex-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                                    {config.label}
                                </span>
                            </div>

                            {/* Time */}
                            <span className={`w-[60px] text-right shrink-0 text-[11px] font-medium ${!config.isOff && day.startTime ? "text-zinc-200" : "text-zinc-600"}`}>
                                {!config.isOff && day.startTime ? day.startTime : "—"}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [status, setStatus] = useState<Status>("loading");
    const [data, setData] = useState<ConfirmData | null>(null);
    const [error, setError] = useState("");
    const [showRemarks, setShowRemarks] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [successAction, setSuccessAction] = useState<"confirmed" | "change_requested" | null>(null);

    // Override root layout's overflow-hidden so this public page can scroll
    useEffect(() => {
        const body = document.body;
        const origOverflow = body.style.overflow;
        const origHeight = body.style.height;
        body.style.overflow = "auto";
        body.style.height = "auto";
        return () => {
            body.style.overflow = origOverflow;
            body.style.height = origHeight;
        };
    }, []);

    useEffect(() => {
        fetch(`/api/public/confirm/${token}`)
            .then(async (res) => {
                if (res.status === 410) { setStatus("expired"); return; }
                if (!res.ok) { setError("This link is invalid or has expired."); setStatus("error"); return; }
                const d = await res.json();
                setData(d);
                if (d.status === "confirmed") setStatus("confirmed");
                else if (d.status === "change_requested") setStatus("change_requested");
                else setStatus("pending");
            })
            .catch(() => { setError("Could not load. Please try again."); setStatus("error"); });
    }, [token]);

    const handleConfirm = async () => {
        setStatus("submitting");
        try {
            const res = await fetch(`/api/public/confirm/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "confirm" }),
            });
            if (!res.ok) throw new Error("Failed");
            setSuccessAction("confirmed");
            setStatus("confirmed");
        } catch {
            setError("Failed to confirm. Please try again.");
            setStatus("error");
        }
    };

    const handleChangeRequest = async () => {
        if (!remarks.trim()) return;
        setStatus("submitting");
        try {
            const res = await fetch(`/api/public/confirm/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "change_request", remarks: remarks.trim() }),
            });
            if (!res.ok) throw new Error("Failed");
            setSuccessAction("change_requested");
            setStatus("change_requested");
        } catch {
            setError("Failed to submit. Please try again.");
            setStatus("error");
        }
    };

    // Helper: render the schedule card (weekly or single day)
    const renderScheduleCard = () => {
        if (data?.weekSchedules && data.weekSchedules.length > 0) {
            return <WeeklyScheduleCard weekSchedules={data.weekSchedules} yearWeek={data.yearWeek} />;
        }
        if (data?.schedule) {
            const config = getShiftConfig(data.schedule.type);
            return (
                <div className="bg-zinc-800/60 rounded-2xl p-5 border border-zinc-700/50 mb-6">
                    <div className="grid grid-cols-2 gap-5 text-sm">
                        <div className="text-center">
                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Date</span>
                            <p className="text-zinc-100 font-semibold mt-1.5 text-base">{data.scheduleDate ? formatDateOnly(data.scheduleDate) : "—"}</p>
                        </div>
                        <div className="text-center">
                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Day</span>
                            <p className="text-zinc-100 font-semibold mt-1.5 text-base">{data.schedule.weekDay || "—"}</p>
                        </div>
                        <div className="text-center">
                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Shift Type</span>
                            <div className="mt-1.5 flex justify-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                                    {config.label}
                                </span>
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Start Time</span>
                            <p className="text-zinc-100 font-semibold mt-1.5 text-base">{formatTime(data.schedule.startTime) || "—"}</p>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-start justify-center p-4 overflow-y-auto">
            {/* Background decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-3xl" />
                <div className="absolute -bottom-[30%] -left-[10%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden">

                    {/* Header */}
                    <div className="relative px-6 pt-8 pb-6 text-center">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent" />
                        <div className="relative">
                            <h1 className="text-xl font-bold text-white tracking-tight">{getMessageTitle(data?.messageType || "")}</h1>
                            {data?.employeeName && (
                                <p className="text-lg font-bold text-zinc-200 mt-2">{data.employeeName}</p>
                            )}
                        </div>
                    </div>

                    {/* LOADING */}
                    {status === "loading" && (
                        <div className="px-6 pb-10 flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-sm text-zinc-400">Loading your schedule…</p>
                        </div>
                    )}

                    {/* ERROR */}
                    {status === "error" && (
                        <div className="px-6 pb-10 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <p className="text-red-400 font-medium text-sm">{error}</p>
                        </div>
                    )}

                    {/* EXPIRED */}
                    {status === "expired" && (
                        <div className="px-6 pb-10 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-semibold text-white mb-1">Link Expired</h2>
                            <p className="text-zinc-400 text-sm">This confirmation link has expired. Please contact your supervisor.</p>
                        </div>
                    )}

                    {/* ALREADY CONFIRMED */}
                    {status === "confirmed" && (
                        <div className="px-6 pb-10">
                            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 ring-4 ring-emerald-500/20">
                                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <h2 className="text-lg font-bold text-white mb-1">
                                    {successAction === "confirmed" ? "Shift Confirmed!" : "Already Confirmed"}
                                </h2>
                                <p className="text-zinc-400 text-sm mb-4">
                                    {data?.employeeName && <span className="text-emerald-400 font-medium">{data.employeeName}</span>}
                                    {successAction === "confirmed" ? ", your schedule has been confirmed. Thank you!" : ", this schedule was already confirmed."}
                                </p>
                                {renderScheduleCard()}

                            </div>
                        </div>
                    )}

                    {/* CHANGE REQUESTED */}
                    {status === "change_requested" && (
                        <div className="px-6 pb-10">
                            <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-5 ring-4 ring-amber-500/20">
                                <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <h2 className="text-lg font-bold text-white mb-1">
                                    {successAction === "change_requested" ? "Change Request Submitted" : "Change Already Requested"}
                                </h2>
                                <p className="text-zinc-400 text-sm mb-4">
                                    Your change request has been submitted. Your supervisor will review it shortly.
                                </p>
                                {(data?.changeRemarks || remarks) && (
                                    <div className="bg-zinc-800/60 rounded-2xl p-4 border border-zinc-700/50 text-left">
                                        <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Your Remarks</span>
                                        <p className="text-zinc-300 text-sm mt-1 italic">&ldquo;{data?.changeRemarks || remarks}&rdquo;</p>
                                    </div>
                                )}
                                {renderScheduleCard()}

                            </div>
                        </div>
                    )}

                    {/* SUBMITTING */}
                    {status === "submitting" && (
                        <div className="px-6 pb-10 flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-sm text-zinc-400">Submitting…</p>
                        </div>
                    )}

                    {/* PENDING — Main Action */}
                    {status === "pending" && data && (
                        <div className="px-6 pb-8">
                            {/* Greeting */}
                            <div className="text-center mb-5">
                                <p className="text-zinc-400 text-sm">Please confirm or request a change for your upcoming schedule.</p>
                            </div>



                            {/* Schedule Card — Weekly or Single Day */}
                            {renderScheduleCard()}

                            {/* Change Remarks Input */}
                            {showRemarks && (
                                <div className="mb-5 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-zinc-800/60 rounded-2xl p-4 border border-amber-500/30">
                                        <label className="text-zinc-300 text-xs font-semibold block mb-2">
                                            Why do you need a change?
                                        </label>
                                        <textarea
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            placeholder="E.g., I have a doctor's appointment, family emergency, etc."
                                            className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none transition-all"
                                            rows={3}
                                            autoFocus
                                        />
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={handleChangeRequest}
                                                disabled={!remarks.trim()}
                                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                Submit Change Request
                                            </button>
                                            <button
                                                onClick={() => { setShowRemarks(false); setRemarks(""); }}
                                                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium border border-zinc-700/50 hover:text-zinc-200 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {!showRemarks && (
                                <div className="space-y-3">
                                    <button
                                        onClick={handleConfirm}
                                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-base font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Confirm Schedule
                                    </button>
                                    <button
                                        onClick={() => setShowRemarks(true)}
                                        className="w-full py-3.5 rounded-2xl bg-zinc-800/80 text-zinc-300 text-sm font-semibold border border-zinc-700/60 hover:border-amber-500/40 hover:text-amber-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Request Change
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer with Logo */}
                    <div className="px-6 py-4 border-t border-zinc-800/80 flex items-center justify-center">
                        <div className="bg-white rounded-xl px-4 py-2 shadow-lg shadow-blue-500/10">
                            <img src="/symx-logo.png" alt="SYMX Logistics" className="h-6 object-contain" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
