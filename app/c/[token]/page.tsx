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
    schedule?: {
        date: string;
        weekDay: string;
        type: string;
        startTime: string;
        van: string;
    };
}

function formatDate(d: string) {
    try {
        const date = new Date(d);
        return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    } catch { return d; }
}

function formatTime(t: string) {
    if (!t) return "";
    return t;
}

export default function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const [status, setStatus] = useState<Status>("loading");
    const [data, setData] = useState<ConfirmData | null>(null);
    const [error, setError] = useState("");
    const [showRemarks, setShowRemarks] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [successAction, setSuccessAction] = useState<"confirmed" | "change_requested" | null>(null);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
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
                            {/* Logo/Brand */}
                            <div className="flex items-center justify-center mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            </div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Schedule Confirmation</h1>
                            <p className="text-zinc-400 text-sm mt-1">SYMX Systems</p>
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
                                {data?.schedule && (
                                    <div className="bg-zinc-800/60 rounded-2xl p-4 border border-zinc-700/50 text-left">
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Date</span>
                                                <p className="text-zinc-200 font-medium mt-0.5">{data.schedule.weekDay} {data.scheduleDate ? formatDate(data.scheduleDate) : ""}</p>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Start Time</span>
                                                <p className="text-zinc-200 font-medium mt-0.5">{formatTime(data.schedule.startTime) || "—"}</p>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Type</span>
                                                <p className="text-zinc-200 font-medium mt-0.5">{data.schedule.type || "—"}</p>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Status</span>
                                                <p className="text-emerald-400 font-semibold mt-0.5">✅ Confirmed</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                <p className="text-zinc-300 text-sm">
                                    Hi <span className="text-white font-semibold">{data.employeeName}</span>,
                                </p>
                                <p className="text-zinc-400 text-sm mt-1">Please confirm or request a change for your upcoming schedule.</p>
                            </div>

                            {/* Schedule Info Card */}
                            {data.schedule && (
                                <div className="bg-zinc-800/60 rounded-2xl p-5 border border-zinc-700/50 mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <span className="text-zinc-200 text-sm font-semibold">Schedule Details</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Day</span>
                                            <p className="text-zinc-200 font-medium mt-1">{data.schedule.weekDay || "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Date</span>
                                            <p className="text-zinc-200 font-medium mt-1">{data.scheduleDate ? formatDate(data.scheduleDate) : "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Shift Type</span>
                                            <p className="text-zinc-200 font-medium mt-1">{data.schedule.type || "—"}</p>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block">Start Time</span>
                                            <p className="text-zinc-200 font-medium mt-1">{formatTime(data.schedule.startTime) || "—"}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

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

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-zinc-800/80 text-center">
                        <p className="text-zinc-600 text-[10px]">Powered by SYMX Systems</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
