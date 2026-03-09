"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    IconCalendar, IconUser, IconGauge,
    IconCamera, IconTool, IconClock, IconAdjustmentsHorizontal,
    IconChevronLeft, IconChevronRight, IconArrowsLeftRight,
    IconX, IconCheck, IconMinus, IconMaximize,
} from "@tabler/icons-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtDate = (d: any) => !d ? "—" : new Date(d).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
});
const fmtDateShort = (d: any) => !d ? "—" : new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
});
const fmtTime = (d: any) => !d ? "—" : new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
});

/* ── Image Compare Slider (ref-based, zero re-renders) ───────────── */
function ImageCompareSlider({
    before, after, beforeLabel, afterLabel, aspectClass,
}: { before?: string; after?: string; beforeLabel: string; afterLabel: string; aspectClass?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const clipRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);

    const applyPos = useCallback((pct: number) => {
        if (!clipRef.current || !handleRef.current) return;
        clipRef.current.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
        handleRef.current.style.left = `${pct}%`;
    }, []);

    const calcPos = useCallback((clientX: number) => {
        if (!containerRef.current) return 50;
        const rect = containerRef.current.getBoundingClientRect();
        return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    }, []);

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!draggingRef.current) return;
            e.preventDefault();
            applyPos(calcPos(e.clientX));
        };
        const onUp = () => { draggingRef.current = false; };
        window.addEventListener("pointermove", onMove, { passive: false });
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [applyPos, calcPos]);

    const onDown = (e: React.PointerEvent) => {
        draggingRef.current = true;
        applyPos(calcPos(e.clientX));
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const noImg = (label: string) => (
        <div className="w-full h-full bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <IconCamera size={28} />
            <span className="text-xs">No image — {label}</span>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={`relative w-full ${aspectClass || "aspect-video"} overflow-hidden rounded-xl select-none cursor-col-resize group touch-none`}
            onPointerDown={onDown}
        >
            <div className="absolute inset-0 bg-black/80">
                {after ? <img src={after} alt={afterLabel} className="w-full h-full object-cover pointer-events-none" draggable={false} /> : noImg(afterLabel)}
            </div>
            <div ref={clipRef} className="absolute inset-0 bg-black/80" style={{ clipPath: "inset(0 50% 0 0)" }}>
                {before ? <img src={before} alt={beforeLabel} className="w-full h-full object-cover pointer-events-none" draggable={false} /> : noImg(beforeLabel)}
            </div>
            <div ref={handleRef} className="absolute inset-y-0 pointer-events-none" style={{ left: "50%" }}>
                <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center gap-0.5 border-2 border-white/20">
                    <IconChevronLeft size={12} className="text-gray-600" />
                    <IconChevronRight size={12} className="text-gray-600" />
                </div>
            </div>
            <div className="absolute top-2 left-2 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white border border-white/10">{beforeLabel}</span>
            </div>
            <div className="absolute top-2 right-2 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white border border-white/10">{afterLabel}</span>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white/70">Drag to compare</span>
            </div>
        </div>
    );
}

/* ── Photo card ──────────────────────────────────────────────────── */
function PhotoCard({ url, label, onClick }: { url?: string; label: string; onClick?: () => void }) {
    if (!url) return (
        <div className="aspect-video rounded-xl bg-muted/20 border border-border/20 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/30">
            <IconCamera size={20} />
            <span className="text-[10px]">{label}</span>
        </div>
    );
    return (
        <button onClick={onClick} className="relative aspect-video rounded-xl overflow-hidden group border border-border/30 shadow-sm focus:outline-none w-full">
            <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                <span className="text-[10px] text-white font-medium">{label}</span>
                <IconMaximize size={12} className="text-white/70" />
            </div>
        </button>
    );
}

/* ── Diff badge ──────────────────────────────────────────────────── */
function DiffBadge({ curr, prev }: { curr: any; prev: any }) {
    if (prev === undefined || prev === null || curr === prev) return <span className="text-muted-foreground/40 text-[10px]">—</span>;
    const currN = Number(curr), prevN = Number(prev);
    if (!isNaN(currN) && !isNaN(prevN)) {
        const diff = currN - prevN;
        if (diff === 0) return <span className="text-muted-foreground/40 text-[10px]">No change</span>;
        return (
            <span className={`text-[10px] font-semibold ${diff > 0 ? "text-emerald-500" : "text-red-500"}`}>
                {diff > 0 ? "+" : ""}{diff.toLocaleString()}
            </span>
        );
    }
    return <span className="text-amber-500 text-[10px] font-medium">Changed</span>;
}

/* ── Lightbox ────────────────────────────────────────────────────── */
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
    useEffect(() => {
        const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={onClose}>
                <IconX size={18} />
            </button>
            <img src={url} alt="full" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
   Main page
   ══════════════════════════════════════════════════════════════════ */
export default function InspectionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [inspection, setInspection] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lightbox, setLightbox] = useState<string | null>(null);

    // Standard Photo
    const [isStandardPhoto, setIsStandardPhoto] = useState(false);
    const [togglingStandard, setTogglingStandard] = useState(false);

    // Comparison
    const [compareMode, setCompareMode] = useState(false);
    const [compareSource, setCompareSource] = useState<"previous" | "master">("previous");
    const [compareLoading, setCompareLoading] = useState(false);
    const [previous, setPrevious] = useState<any>(null);
    const [master, setMaster] = useState<any>(null);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [showCompareMenu, setShowCompareMenu] = useState(false);

    const { setRightContent } = useHeaderActions();

    useEffect(() => {
        if (!id) return;
        fetch(`/api/fleet?section=inspection-detail&id=${id}`)
            .then(r => r.json())
            .then(j => {
                setInspection(j.inspection);
                setIsStandardPhoto(j.inspection?.isStandardPhoto || false);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    const toggleStandardPhoto = useCallback(async () => {
        setTogglingStandard(true);
        try {
            const res = await fetch("/api/fleet", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggle-standard-photo", id }),
            });
            const j = await res.json();
            if (j.success) setIsStandardPhoto(j.isStandardPhoto);
        } catch { }
        finally { setTogglingStandard(false); }
    }, [id]);

    const loadCompare = useCallback(async (source: "previous" | "master") => {
        setShowCompareMenu(false);
        setCompareError(null);

        if (source === "previous" && previous !== null) {
            setCompareSource("previous"); setCompareMode(true); return;
        }
        if (source === "master" && master !== null) {
            setCompareSource("master"); setCompareMode(true); return;
        }

        setCompareLoading(true);
        try {
            const section = source === "master" ? "inspection-master" : "inspection-compare";
            const res = await fetch(`/api/fleet?section=${section}&id=${id}`);
            const j = await res.json();
            if (source === "previous") {
                if (j.previous) { setPrevious(j.previous); setCompareSource("previous"); setCompareMode(true); }
                else setCompareError("No previous inspection found for this VIN before this date.");
            } else {
                if (j.master) { setMaster(j.master); setCompareSource("master"); setCompareMode(true); }
                else setCompareError("No standard photo inspection found for this VIN. Mark one as Standard Photo first.");
            }
        } catch { setCompareError("Failed to load comparison."); }
        finally { setCompareLoading(false); }
    }, [id, previous, master]);

    // Get the active compare data based on source
    const compareData = compareSource === "master" ? master : previous;

    // Inject header buttons
    useEffect(() => {
        setRightContent(
            <div className="flex items-center gap-2 relative">
                {/* Standard Photo toggle */}
                <button
                    onClick={toggleStandardPhoto}
                    disabled={togglingStandard}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border ${isStandardPhoto
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                        : "bg-card border-border hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400"
                        }`}
                    title={isStandardPhoto ? "Remove as Standard Photo" : "Set as Standard Photo"}
                >
                    {togglingStandard
                        ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : <span className="text-base leading-none">{isStandardPhoto ? "★" : "☆"}</span>}
                    <span className="hidden sm:inline">Standard Photo</span>
                </button>

                {/* Compare button/dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowCompareMenu(!showCompareMenu)}
                        disabled={compareLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border ${compareMode
                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            : "bg-card border-border hover:border-primary/50 hover:text-primary"
                            }`}
                    >
                        {compareLoading
                            ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : <IconArrowsLeftRight size={14} />}
                        {compareMode
                            ? (compareSource === "master" ? "vs Master" : "vs Previous")
                            : "Compare"}
                        <svg className={`w-3 h-3 ml-0.5 transition-transform ${showCompareMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showCompareMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCompareMenu(false)} />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                {/* Compare with Previous */}
                                <button
                                    onClick={() => loadCompare("previous")}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/60 transition-colors text-left ${compareMode && compareSource === "previous" ? "bg-primary/5 text-primary" : "text-foreground"}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${compareMode && compareSource === "previous" ? "bg-primary/15" : "bg-blue-500/10"}`}>
                                        <IconArrowsLeftRight size={14} className={compareMode && compareSource === "previous" ? "text-primary" : "text-blue-500"} />
                                    </div>
                                    <div>
                                        <p className="font-medium">Previous</p>
                                        <p className="text-[10px] text-muted-foreground">Compare with last inspection</p>
                                    </div>
                                    {compareMode && compareSource === "previous" && (
                                        <span className="ml-auto text-primary text-xs">●</span>
                                    )}
                                </button>
                                <div className="h-px bg-border/60" />
                                {/* Compare with Master */}
                                <button
                                    onClick={() => loadCompare("master")}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/60 transition-colors text-left ${compareMode && compareSource === "master" ? "bg-primary/5 text-primary" : "text-foreground"}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${compareMode && compareSource === "master" ? "bg-primary/15" : "bg-amber-500/10"}`}>
                                        <span className={`text-base leading-none ${compareMode && compareSource === "master" ? "text-primary" : "text-amber-500"}`}>★</span>
                                    </div>
                                    <div>
                                        <p className="font-medium">Master Photo</p>
                                        <p className="text-[10px] text-muted-foreground">Compare with standard reference</p>
                                    </div>
                                    {compareMode && compareSource === "master" && (
                                        <span className="ml-auto text-primary text-xs">●</span>
                                    )}
                                </button>
                                {/* Exit Compare — only show when in compare mode */}
                                {compareMode && (
                                    <>
                                        <div className="h-px bg-border/60" />
                                        <button
                                            onClick={() => { setCompareMode(false); setShowCompareMenu(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/5 transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                                <IconX size={14} className="text-red-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium">Exit Compare</p>
                                                <p className="text-[10px] text-muted-foreground/70">Return to single view</p>
                                            </div>
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
        return () => setRightContent(null);
    }, [setRightContent, compareMode, compareLoading, loadCompare, isStandardPhoto, togglingStandard, toggleStandardPhoto, showCompareMenu]);

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground/50">Loading inspection…</p>
            </div>
        </div>
    );

    if (!inspection) return (
        <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Inspection not found.</p>
        </div>
    );

    const driverDisplay = inspection.driverName || inspection.driver || "—";
    const inspectedByDisplay = inspection.inspectedByName || inspection.inspectedBy || "—";
    const hasRepair = inspection.anyRepairs && inspection.anyRepairs !== "FALSE" && inspection.anyRepairs !== "false";

    const photos = [
        { url: inspection.vehiclePicture1, label: "Vehicle Photo 1" },
        { url: inspection.vehiclePicture2, label: "Vehicle Photo 2" },
        { url: inspection.vehiclePicture3, label: "Vehicle Photo 3" },
        { url: inspection.vehiclePicture4, label: "Vehicle Photo 4" },
        { url: inspection.dashboardImage, label: "Dashboard" },
        { url: inspection.additionalPicture, label: "Additional" },
    ];
    const hasPhotos = photos.some(p => p.url);

    const prevPhotos = compareData ? [
        { url: compareData.vehiclePicture1, label: "Vehicle Photo 1" },
        { url: compareData.vehiclePicture2, label: "Vehicle Photo 2" },
        { url: compareData.vehiclePicture3, label: "Vehicle Photo 3" },
        { url: compareData.vehiclePicture4, label: "Vehicle Photo 4" },
        { url: compareData.dashboardImage, label: "Dashboard" },
        { url: compareData.additionalPicture, label: "Additional" },
    ] : [];

    return (
        <div className="h-full overflow-auto">
            {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}

            <div className="space-y-6">

                {compareError && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-500 flex items-center gap-2">
                        <IconMinus size={14} /> {compareError}
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════
            TOP SECTION: Date · VIN · Driver Name | Vehicle Image
           ══════════════════════════════════════════════════════════ */}
                <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-lg bg-card">
                    <div className="flex flex-row">
                        {/* Left — info grid */}
                        <div className="flex-1 px-6 py-6 flex flex-col justify-center gap-4">
                            {/* Status badges */}
                            {(hasRepair || inspection.isCompared) && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {hasRepair && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-500 border border-red-500/20">
                                            <IconTool size={9} /> Repair Logged
                                        </span>
                                    )}
                                    {inspection.isCompared && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                            <IconCheck size={9} /> Compared
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* 3×2 grid — icon + value, with compare row when active */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* Date */}
                                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                        <IconCalendar size={16} className="text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground">{fmtDate(inspection.routeDate)}</p>
                                        {compareMode && compareData && (
                                            <p className="text-xs text-muted-foreground/60 mt-1">{fmtDate(compareData.routeDate)}</p>
                                        )}
                                    </div>
                                </div>

                                {/* VIN */}
                                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                        <IconCamera size={16} className="text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs font-bold text-foreground break-all">
                                            {inspection.vehicleName ? `${inspection.vehicleName} · ` : ""}{inspection.vin || "—"}
                                        </p>
                                        {compareMode && compareData && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <p className="font-mono text-[10px] text-muted-foreground/60 break-all">
                                                    {compareData.vin || "—"}
                                                </p>
                                                <span className="text-emerald-500/60 text-[10px] flex items-center gap-0.5 whitespace-nowrap"><IconCheck size={9} />Same</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Driver */}
                                {(() => {
                                    const prevDriver = compareData ? (compareData.driverName || compareData.driver || "—") : "—";
                                    const driverChanged = compareMode && compareData && driverDisplay !== prevDriver;
                                    return (
                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                                <IconUser size={16} className="text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground">{driverDisplay}</p>
                                                {compareMode && compareData && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <p className="text-xs text-muted-foreground/60">{prevDriver}</p>
                                                        {driverChanged
                                                            ? <span className="text-amber-500 text-[10px] font-medium whitespace-nowrap">Changed</span>
                                                            : <span className="text-emerald-500/60 text-[10px] flex items-center gap-0.5 whitespace-nowrap"><IconCheck size={9} />Same</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Mileage */}
                                {(() => {
                                    const prevMileage = compareData?.mileage || 0;
                                    const mileageChanged = compareMode && compareData && inspection.mileage !== prevMileage;
                                    const mileageDiff = inspection.mileage - prevMileage;
                                    return (
                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                                <IconGauge size={16} className="text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-foreground">
                                                    {inspection.mileage > 0 ? `${inspection.mileage.toLocaleString()} mi` : "—"}
                                                </p>
                                                {compareMode && compareData && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <p className="text-xs text-muted-foreground/60">{prevMileage > 0 ? `${prevMileage.toLocaleString()} mi` : "—"}</p>
                                                        {mileageChanged
                                                            ? <span className={`text-[10px] font-semibold whitespace-nowrap ${mileageDiff > 0 ? "text-emerald-500" : "text-red-500"}`}>{mileageDiff > 0 ? "+" : ""}{mileageDiff.toLocaleString()}</span>
                                                            : <span className="text-emerald-500/60 text-[10px] flex items-center gap-0.5 whitespace-nowrap"><IconCheck size={9} />Same</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Comments */}
                                {(() => {
                                    const prevComments = compareData?.comments || "—";
                                    const currComments = inspection.comments || "—";
                                    const commentsChanged = compareMode && compareData && currComments !== prevComments;
                                    return (
                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                                <IconClock size={16} className="text-primary" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-foreground truncate">{currComments}</p>
                                                {compareMode && compareData && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <p className="text-xs text-muted-foreground/60 truncate flex-1">{prevComments}</p>
                                                        {commentsChanged
                                                            ? <span className="text-amber-500 text-[10px] font-medium whitespace-nowrap">Changed</span>
                                                            : <span className="text-emerald-500/60 text-[10px] flex items-center gap-0.5 whitespace-nowrap"><IconCheck size={9} />Same</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Any Repairs */}
                                {(() => {
                                    const prevHasRepair = compareData?.anyRepairs && compareData.anyRepairs !== "FALSE" && compareData.anyRepairs !== "false";
                                    const repairsChanged = compareMode && compareData && hasRepair !== prevHasRepair;
                                    return (
                                        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                                <IconTool size={16} className="text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-semibold ${hasRepair ? "text-red-500" : "text-foreground"}`}>
                                                    {hasRepair ? "Yes" : "No"}
                                                </p>
                                                {compareMode && compareData && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <p className={`text-xs ${prevHasRepair ? "text-red-500/60" : "text-muted-foreground/60"}`}>{prevHasRepair ? "Yes" : "No"}</p>
                                                        {repairsChanged
                                                            ? <span className="text-amber-500 text-[10px] font-medium whitespace-nowrap">Changed</span>
                                                            : <span className="text-emerald-500/60 text-[10px] flex items-center gap-0.5 whitespace-nowrap"><IconCheck size={9} />Same</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Right — Vehicle image from vehicles table */}
                        <div className="w-80 lg:w-96 flex-shrink-0 relative group">
                            {inspection.vehicleImage ? (
                                <img
                                    src={inspection.vehicleImage}
                                    alt="Vehicle"
                                    className="w-full h-full min-h-[200px] object-cover"
                                    onClick={() => setLightbox(inspection.vehicleImage)}
                                    style={{ cursor: "zoom-in" }}
                                />
                            ) : (
                                <div className="w-full h-full min-h-[200px] bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground/30">
                                    <IconCamera size={32} />
                                    <span className="text-xs">No vehicle image</span>
                                </div>
                            )}
                            {/* Label */}
                            <div className="absolute bottom-2 left-2 pointer-events-none">
                                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white border border-white/10">
                                    VIN Image
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Content (always visible, photos switch to compare sliders when compareMode is on) ── */}
                {
                    <>
                        {/* Comments */}
                        {inspection.comments && (
                            <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Comments</p>
                                <p className="text-sm text-foreground leading-relaxed">{inspection.comments}</p>
                            </div>
                        )}

                        {/* Repair section */}
                        {hasRepair && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 rounded-lg bg-red-500/15">
                                        <IconTool size={14} className="text-red-500" />
                                    </div>
                                    <h2 className="text-sm font-bold text-foreground">Repair Information</h2>
                                    {inspection.repairCurrentStatus && (
                                        <span className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                                            {inspection.repairCurrentStatus}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {inspection.repairDescription && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Description</p>
                                            <p className="text-sm text-foreground">{inspection.repairDescription}</p>
                                        </div>
                                    )}
                                    {inspection.repairEstimatedDate && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Estimated Completion</p>
                                            <p className="text-sm text-foreground">{fmtDate(inspection.repairEstimatedDate)}</p>
                                        </div>
                                    )}
                                </div>
                                {inspection.repairImage && (
                                    <div className="mt-4">
                                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">Repair Image</p>
                                        <img
                                            src={inspection.repairImage} alt="repair"
                                            onClick={() => setLightbox(inspection.repairImage)}
                                            className="h-36 rounded-xl object-cover border border-border/30 shadow-sm cursor-zoom-in hover:shadow-md hover:scale-[1.02] transition-all"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Photo gallery — normal or compare mode */}
                        {hasPhotos && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <IconCamera size={14} className="text-muted-foreground/60" />
                                    <h2 className="text-sm font-bold text-foreground">Inspection Photos</h2>
                                    <span className="text-[10px] text-muted-foreground/40">({photos.filter(p => p.url).length} of 6)</span>
                                    {compareMode && compareData && (
                                        <span className="text-[10px] text-primary font-medium ml-1">— Drag slider to compare</span>
                                    )}
                                </div>

                                {/* Compare mode indicator */}
                                {compareMode && compareData && (
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center gap-3 text-sm mb-3">
                                        {compareSource === "master" ? (
                                            <><span className="text-amber-500 text-base leading-none">★</span> Comparing with <strong>Standard Photo</strong> — {fmtDateShort(compareData.routeDate)}</>
                                        ) : (
                                            <><IconArrowsLeftRight size={14} className="text-primary" /> Comparing with <strong>Previous Inspection</strong> — {fmtDateShort(compareData.routeDate)}</>
                                        )}
                                    </div>
                                )}

                                {/* Row 1: Vehicle Photo 1 + Vehicle Photo 3 — horizontal/landscape */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {compareMode && compareData ? (
                                        <>
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{photos[0]?.label}</p>
                                                <ImageCompareSlider before={photos[0]?.url} after={prevPhotos[0]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{photos[2]?.label}</p>
                                                <ImageCompareSlider before={photos[2]?.url} after={prevPhotos[2]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <PhotoCard url={photos[0]?.url} label={photos[0]?.label || "Vehicle Photo 1"} onClick={photos[0]?.url ? () => setLightbox(photos[0].url!) : undefined} />
                                            <PhotoCard url={photos[2]?.url} label={photos[2]?.label || "Vehicle Photo 3"} onClick={photos[2]?.url ? () => setLightbox(photos[2].url!) : undefined} />
                                        </>
                                    )}
                                </div>

                                {/* Row 2: Vehicle Photo 2 + Vehicle Photo 4 — vertical/portrait */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {compareMode && compareData ? (
                                        <>
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{photos[1]?.label}</p>
                                                <ImageCompareSlider before={photos[1]?.url} after={prevPhotos[1]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} aspectClass="aspect-[3/4]" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{photos[3]?.label}</p>
                                                <ImageCompareSlider before={photos[3]?.url} after={prevPhotos[3]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} aspectClass="aspect-[3/4]" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border/30 shadow-sm">
                                                {photos[1]?.url ? (
                                                    <button onClick={() => setLightbox(photos[1].url!)} className="w-full h-full group relative focus:outline-none">
                                                        <img src={photos[1].url} alt={photos[1].label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                                                            <span className="text-[10px] text-white font-medium">{photos[1].label}</span>
                                                            <IconMaximize size={12} className="text-white/70" />
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <div className="w-full h-full bg-muted/20 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/30">
                                                        <IconCamera size={20} />
                                                        <span className="text-[10px]">{photos[1]?.label || "Vehicle Photo 2"}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border/30 shadow-sm">
                                                {photos[3]?.url ? (
                                                    <button onClick={() => setLightbox(photos[3].url!)} className="w-full h-full group relative focus:outline-none">
                                                        <img src={photos[3].url} alt={photos[3].label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                                                            <span className="text-[10px] text-white font-medium">{photos[3].label}</span>
                                                            <IconMaximize size={12} className="text-white/70" />
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <div className="w-full h-full bg-muted/20 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/30">
                                                        <IconCamera size={20} />
                                                        <span className="text-[10px]">{photos[3]?.label || "Vehicle Photo 4"}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Row 3: Dashboard — full width, horizontal */}
                                {photos[4]?.url && (
                                    <div className="mb-2">
                                        {compareMode && compareData ? (
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{photos[4]?.label || "Dashboard"}</p>
                                                <ImageCompareSlider before={photos[4]?.url} after={prevPhotos[4]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                            </div>
                                        ) : (
                                            <PhotoCard url={photos[4]?.url} label={photos[4]?.label || "Dashboard"} onClick={() => setLightbox(photos[4].url!)} />
                                        )}
                                    </div>
                                )}

                                {/* Additional picture if exists */}
                                {photos[5]?.url && (
                                    <div>
                                        {compareMode && compareData ? (
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{photos[5]?.label || "Additional"}</p>
                                                <ImageCompareSlider before={photos[5]?.url} after={prevPhotos[5]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                            </div>
                                        ) : (
                                            <PhotoCard url={photos[5]?.url} label={photos[5]?.label || "Additional"} onClick={() => setLightbox(photos[5].url!)} />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Bottom: Inspected By + Timestamp ─────────────── */}
                        <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                        <IconUser size={16} className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Inspected By</p>
                                        <p className="text-sm font-semibold text-foreground">{inspectedByDisplay}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                        <IconClock size={16} className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Timestamp</p>
                                        <p className="text-sm font-semibold text-foreground">{fmtDate(inspection.timeStamp)} · {fmtTime(inspection.timeStamp)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                }
            </div>
        </div>
    );
}
