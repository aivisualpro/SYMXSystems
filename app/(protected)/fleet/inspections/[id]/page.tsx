"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    IconCalendar, IconUser, IconGauge,
    IconCamera, IconTool, IconClock, IconAdjustmentsHorizontal,
    IconChevronLeft, IconChevronRight, IconArrowsLeftRight,
    IconX, IconCheck, IconMinus, IconMaximize,
} from "@tabler/icons-react";

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
    before, after, beforeLabel, afterLabel,
}: { before?: string; after?: string; beforeLabel: string; afterLabel: string }) {
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
            className="relative w-full aspect-video overflow-hidden rounded-xl select-none cursor-col-resize group touch-none"
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

    // Comparison
    const [compareMode, setCompareMode] = useState(false);
    const [compareLoading, setCompareLoading] = useState(false);
    const [previous, setPrevious] = useState<any>(null);
    const [compareError, setCompareError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/fleet?section=inspection-detail&id=${id}`)
            .then(r => r.json())
            .then(j => { setInspection(j.inspection); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    const loadCompare = useCallback(async () => {
        if (previous !== null) { setCompareMode(true); return; }
        setCompareLoading(true);
        setCompareError(null);
        try {
            const res = await fetch(`/api/fleet?section=inspection-compare&id=${id}`);
            const j = await res.json();
            if (j.previous) { setPrevious(j.previous); setCompareMode(true); }
            else setCompareError("No previous inspection found for this VIN before this date.");
        } catch { setCompareError("Failed to load comparison."); }
        finally { setCompareLoading(false); }
    }, [id, previous]);

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

    const prevPhotos = previous ? [
        { url: previous.vehiclePicture1, label: "Vehicle Photo 1" },
        { url: previous.vehiclePicture2, label: "Vehicle Photo 2" },
        { url: previous.vehiclePicture3, label: "Vehicle Photo 3" },
        { url: previous.vehiclePicture4, label: "Vehicle Photo 4" },
        { url: previous.dashboardImage, label: "Dashboard" },
        { url: previous.additionalPicture, label: "Additional" },
    ] : [];

    return (
        <div className="h-full overflow-auto">
            {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

                {/* ── Compare toggle (top right) ──────────────────────── */}
                <div className="flex items-center justify-end">
                    <button
                        onClick={compareMode ? () => setCompareMode(false) : loadCompare}
                        disabled={compareLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border ${compareMode
                                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                                : "bg-card border-border hover:border-primary/50 hover:text-primary"
                            }`}
                    >
                        {compareLoading
                            ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : <IconArrowsLeftRight size={14} />}
                        {compareMode ? "Exit Compare" : "Compare with Previous"}
                    </button>
                </div>

                {compareError && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-500 flex items-center gap-2">
                        <IconMinus size={14} /> {compareError}
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════
            TOP SECTION: Date · VIN · Driver Name | Vehicle Image
           ══════════════════════════════════════════════════════════ */}
                <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-lg bg-card">
                    <div className="flex flex-col md:flex-row">
                        {/* Left — info */}
                        <div className="flex-1 px-6 py-6 flex flex-col justify-center gap-4">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Daily Inspection</span>
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

                            {/* Date */}
                            <div>
                                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Date</p>
                                <p className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <IconCalendar size={16} className="text-primary" />
                                    {fmtDate(inspection.routeDate)}
                                </p>
                            </div>

                            {/* VIN */}
                            <div>
                                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">VIN</p>
                                <p className="font-mono text-sm font-bold text-foreground">{inspection.vin || "—"}</p>
                                {inspection.unitNumber && (
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">Unit #{inspection.unitNumber}</p>
                                )}
                                {inspection.vehicleName && (
                                    <p className="text-xs text-muted-foreground/50">{inspection.vehicleName}</p>
                                )}
                            </div>

                            {/* Driver Name */}
                            <div>
                                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Driver</p>
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <IconUser size={14} className="text-primary" />
                                    {driverDisplay}
                                </p>
                            </div>

                            {/* Mileage */}
                            {inspection.mileage > 0 && (
                                <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/30 px-3 py-2 w-fit">
                                    <IconGauge size={14} className="text-primary" />
                                    <span className="text-sm font-bold text-foreground">{inspection.mileage.toLocaleString()}</span>
                                    <span className="text-xs text-muted-foreground/50">mi</span>
                                </div>
                            )}
                        </div>

                        {/* Right — Vehicle image from vehicles table */}
                        <div className="md:w-80 lg:w-96 flex-shrink-0 relative group">
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

                {/* ── Normal Mode ────────────────────────────────────── */}
                {!compareMode && (
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

                        {/* Photo gallery */}
                        {hasPhotos && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <IconCamera size={14} className="text-muted-foreground/60" />
                                    <h2 className="text-sm font-bold text-foreground">Inspection Photos</h2>
                                    <span className="text-[10px] text-muted-foreground/40">({photos.filter(p => p.url).length} of 6)</span>
                                </div>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                    {photos[0]?.url && (
                                        <div className="col-span-2 row-span-2 md:col-span-2 md:row-span-2">
                                            <PhotoCard url={photos[0].url} label={photos[0].label} onClick={() => setLightbox(photos[0].url!)} />
                                        </div>
                                    )}
                                    {photos.slice(photos[0]?.url ? 1 : 0).map((p) => (
                                        <PhotoCard key={p.label} url={p.url} label={p.label}
                                            onClick={p.url ? () => setLightbox(p.url!) : undefined} />
                                    ))}
                                </div>
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
                                        {inspection.inspectedByName && inspection.inspectedBy && (
                                            <p className="text-[10px] text-muted-foreground/40 mt-0.5">{inspection.inspectedBy}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                                        <IconClock size={16} className="text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Timestamp</p>
                                        <p className="text-sm font-semibold text-foreground">{fmtDate(inspection.timeStamp)}</p>
                                        <p className="text-xs text-muted-foreground/50">{fmtTime(inspection.timeStamp)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Comparison Mode ────────────────────────────────── */}
                {compareMode && previous && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Current", date: inspection.routeDate, driver: driverDisplay, accent: "bg-primary/10 border-primary/20" },
                                { label: "Previous", date: previous.routeDate, driver: previous.driverName || previous.driver || "—", accent: "bg-muted/40 border-border/40" },
                            ].map(side => (
                                <div key={side.label} className={`rounded-xl border px-4 py-3 ${side.accent}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{side.label} Inspection</p>
                                    <p className="text-base font-bold text-foreground">{fmtDateShort(side.date)}</p>
                                    <p className="text-xs text-muted-foreground/70">{side.driver}</p>
                                </div>
                            ))}
                        </div>

                        {/* Image comparisons */}
                        <div>
                            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                <IconArrowsLeftRight size={14} className="text-primary" />
                                Photo Comparison
                                <span className="text-[10px] text-muted-foreground/40 font-normal">Drag the slider to compare</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {photos.map((curr, i) => (
                                    <div key={curr.label}>
                                        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{curr.label}</p>
                                        {curr.url || prevPhotos[i]?.url ? (
                                            <ImageCompareSlider
                                                before={curr.url}
                                                after={prevPhotos[i]?.url}
                                                beforeLabel={fmtDateShort(inspection.routeDate)}
                                                afterLabel={fmtDateShort(previous.routeDate)}
                                            />
                                        ) : (
                                            <div className="aspect-video rounded-xl bg-muted/10 border border-border/20 flex items-center justify-center text-muted-foreground/30">
                                                <IconCamera size={24} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Field diff table */}
                        <div>
                            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                <IconAdjustmentsHorizontal size={14} className="text-primary" />
                                Field Comparison
                            </h2>
                            <div className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-sm">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-muted/40 border-b border-border/40">
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 w-36">Field</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-primary/70">
                                                Current · {fmtDateShort(inspection.routeDate)}
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                Previous · {fmtDateShort(previous.routeDate)}
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 w-24">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {[
                                            { label: "Driver", curr: driverDisplay, prev: previous.driverName || previous.driver || "—" },
                                            { label: "Inspected By", curr: inspectedByDisplay, prev: previous.inspectedByName || previous.inspectedBy || "—" },
                                            { label: "Mileage", curr: inspection.mileage, prev: previous.mileage },
                                            { label: "Comments", curr: inspection.comments, prev: previous.comments },
                                            { label: "Any Repairs", curr: inspection.anyRepairs, prev: previous.anyRepairs },
                                            { label: "Repair Status", curr: inspection.repairCurrentStatus, prev: previous.repairCurrentStatus },
                                            { label: "Repair Desc.", curr: inspection.repairDescription, prev: previous.repairDescription },
                                            { label: "Compared?", curr: inspection.isCompared ? "Yes" : "No", prev: previous.isCompared ? "Yes" : "No" },
                                        ].map(({ label, curr, prev }) => {
                                            const changed = curr !== prev && curr !== undefined && prev !== undefined;
                                            return (
                                                <tr key={label} className={`${changed ? "bg-amber-500/[0.04]" : ""} hover:bg-muted/30 transition-colors`}>
                                                    <td className="px-4 py-2.5 text-muted-foreground/60 font-medium">{label}</td>
                                                    <td className="px-4 py-2.5 text-foreground font-medium max-w-[200px] truncate">
                                                        {curr !== undefined && curr !== "" && curr !== 0 ? String(curr) : <span className="text-muted-foreground/30">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                                                        {prev !== undefined && prev !== "" && prev !== 0 ? String(prev) : <span className="text-muted-foreground/30">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {changed
                                                            ? <DiffBadge curr={curr} prev={prev} />
                                                            : <span className="text-emerald-500/60 text-[10px] flex items-center gap-1"><IconCheck size={10} />Same</span>
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
