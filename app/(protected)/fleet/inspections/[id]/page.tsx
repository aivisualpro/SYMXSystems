"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
    IconCalendar, IconUser, IconGauge,
    IconCamera, IconTool, IconClock, IconAdjustmentsHorizontal,
    IconChevronLeft, IconChevronRight, IconArrowsLeftRight,
    IconX, IconCheck, IconMinus, IconMaximize, IconEdit, IconArrowLeft,
    IconMessageCircle, IconId, IconAlertTriangle,
} from "@tabler/icons-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useFleet } from "../../layout";
import FleetFormModal from "../../components/fleet-form-modal";

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
            className={`relative w-full ${aspectClass || "aspect-video"} overflow-hidden rounded-2xl select-none cursor-col-resize group touch-none`}
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

/* ── Lightbox ────────────────────────────────────────────────────── */
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
    useEffect(() => {
        const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pb-[max(12px,env(safe-area-inset-bottom))]" onClick={onClose}>
            <button className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 z-10" onClick={onClose}>
                <IconX size={20} />
            </button>
            <img src={url} alt="full" className="max-w-full max-h-full rounded-xl sm:rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
    );
}

/* ── Bento Card wrapper ─────────────────────────────────────────── */
function BentoCard({
    children,
    className = "",
    gradient,
    onClick,
}: {
    children: React.ReactNode;
    className?: string;
    gradient?: string;
    onClick?: () => void;
}) {
    return (
        <div
            className={`relative rounded-2xl sm:rounded-[20px] overflow-hidden transition-all duration-300 [@media(hover:hover)]:hover:scale-[1.015] [@media(hover:hover)]:hover:shadow-xl ${className}`}
            onClick={onClick}
            style={onClick ? { cursor: "pointer" } : undefined}
        >
            {gradient && (
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.06] dark:opacity-[0.12]`} />
            )}
            <div className="relative h-full">{children}</div>
        </div>
    );
}

/* ── Photo tile for bento gallery ───────────────────────────────── */
function BentoPhoto({ url, label, onClick, className = "" }: { url?: string; label: string; onClick?: () => void; className?: string }) {
    if (!url) return (
        <div className={`rounded-2xl sm:rounded-[20px] bg-muted/30 dark:bg-white/[0.03] border border-border/30 flex flex-col items-center justify-center gap-1.5 sm:gap-2 text-muted-foreground/25 ${className}`}>
            <IconCamera size={20} className="sm:w-6 sm:h-6" />
            <span className="text-[9px] sm:text-[10px] font-medium">{label}</span>
        </div>
    );
    return (
        <button
            onClick={onClick}
            className={`relative rounded-2xl sm:rounded-[20px] overflow-hidden group border border-border/20 focus:outline-none shadow-sm [@media(hover:hover)]:hover:shadow-xl transition-all duration-300 [@media(hover:hover)]:hover:scale-[1.02] active:scale-[0.98] ${className}`}
        >
            <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-110" />
            {/* Always-visible label on mobile, hover-reveal on desktop */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 sm:from-black/70 via-black/0 to-transparent sm:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-all duration-300" />
            <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 sm:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-all duration-300 sm:translate-y-2 [@media(hover:hover)]:group-hover:translate-y-0 flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-white font-semibold drop-shadow-lg">{label}</span>
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/20 backdrop-blur-sm">
                    <IconMaximize size={10} className="text-white sm:w-3 sm:h-3" />
                </div>
            </div>
        </button>
    );
}

/* ══════════════════════════════════════════════════════════════════
   Main page — Apple-style Bento Grid
   ══════════════════════════════════════════════════════════════════ */
export default function InspectionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params?.id as string;
    const returnTo = searchParams?.get("returnTo");

    const { openEditModal } = useFleet();

    const [inspection, setInspection] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lightbox, setLightbox] = useState<string | null>(null);

    // Standard Photo
    const [isStandardPhoto, setIsStandardPhoto] = useState(false);
    const [togglingStandard, setTogglingStandard] = useState(false);
    const [hasStandardPhoto, setHasStandardPhoto] = useState(false);

    // Comparison
    const [compareMode, setCompareMode] = useState(false);
    const [compareSource, setCompareSource] = useState<"previous" | "master">("previous");
    const [compareLoading, setCompareLoading] = useState(false);
    const [previous, setPrevious] = useState<any>(null);
    const [master, setMaster] = useState<any>(null);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [showCompareMenu, setShowCompareMenu] = useState(false);

    const { setRightContent, setLeftContent } = useHeaderActions();

    useEffect(() => {
        setLeftContent(
            <button
                onClick={() => {
                    if (returnTo) {
                        router.push(returnTo);
                    } else {
                        router.push(`/fleet/inspections?highlight=${id}`);
                    }
                }}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <IconArrowLeft size={16} />
                <span>{returnTo && returnTo.includes("/dispatching") ? "Back" : "Inspections"}</span>
            </button>
        );
        return () => setLeftContent(null);
    }, [id, router, returnTo, setLeftContent]);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/fleet?section=inspection-detail&id=${id}`)
            .then(r => r.json())
            .then(j => {
                setInspection(j.inspection);
                setIsStandardPhoto(j.inspection?.isStandardPhoto || false);
                setHasStandardPhoto(j.inspection?.hasStandardPhoto || false);
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
                {/* Edit button */}
                <button
                    onClick={() => openEditModal("inspection", inspection)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border bg-card border-border hover:border-blue-400/60 hover:text-blue-500"
                    title="Edit Inspection"
                >
                    <IconEdit size={14} />
                    <span className="hidden sm:inline">Edit</span>
                </button>

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
                                <div className="relative group/master">
                                    <button
                                        onClick={() => hasStandardPhoto ? loadCompare("master") : undefined}
                                        disabled={!hasStandardPhoto}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left ${!hasStandardPhoto
                                            ? "opacity-40 cursor-not-allowed"
                                            : compareMode && compareSource === "master" ? "bg-primary/5 text-primary hover:bg-muted/60" : "text-foreground hover:bg-muted/60"
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${compareMode && compareSource === "master" ? "bg-primary/15" : "bg-amber-500/10"}`}>
                                            <span className={`text-base leading-none ${compareMode && compareSource === "master" ? "text-primary" : "text-amber-500"}`}>★</span>
                                        </div>
                                        <div>
                                            <p className="font-medium">Master Photo</p>
                                            <p className="text-[10px] text-muted-foreground">{hasStandardPhoto ? "Compare with standard reference" : "No standard photo available"}</p>
                                        </div>
                                        {compareMode && compareSource === "master" && (
                                            <span className="ml-auto text-primary text-xs">●</span>
                                        )}
                                    </button>
                                    {!hasStandardPhoto && (
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/master:block z-50 pointer-events-none">
                                            <div className="bg-foreground text-background text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap max-w-[220px] text-wrap text-center">
                                                No standard photo inspection found for this VIN. Mark one as Standard Photo first.
                                            </div>
                                        </div>
                                    )}
                                </div>
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
    }, [setRightContent, compareMode, compareLoading, loadCompare, isStandardPhoto, togglingStandard, toggleStandardPhoto, showCompareMenu, hasStandardPhoto, inspection, openEditModal, compareSource]);

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
        { url: inspection.vehiclePicture1, label: "Passenger Side" },
        { url: inspection.vehiclePicture2, label: "Back" },
        { url: inspection.vehiclePicture3, label: "Driver Side" },
        { url: inspection.vehiclePicture4, label: "Front" },
        { url: inspection.dashboardImage, label: "Dashboard" },
        { url: inspection.additionalPicture, label: "Additional" },
    ];
    const hasPhotos = photos.some(p => p.url);
    const missingPhotos = photos.filter(p => !p.url);
    const availablePhotos = photos.filter(p => p.url);

    const prevPhotos = compareData ? [
        { url: compareData.vehiclePicture1, label: "Passenger Side" },
        { url: compareData.vehiclePicture2, label: "Back" },
        { url: compareData.vehiclePicture3, label: "Driver Side" },
        { url: compareData.vehiclePicture4, label: "Front" },
        { url: compareData.dashboardImage, label: "Dashboard" },
        { url: compareData.additionalPicture, label: "Additional" },
    ] : [];

    return (
        <>
            <div className="h-full overflow-auto">
                {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}

                <div className="space-y-3 sm:space-y-4 pb-6">

                    {compareError && (
                        <div className="rounded-xl sm:rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm text-amber-500 flex items-center gap-2">
                            <IconAlertTriangle size={14} className="flex-shrink-0" /> {compareError}
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                       BENTO GRID — Apple-style data presentation
                       ═══════════════════════════════════════════════════════════ */}
                    <div className="grid grid-cols-12 gap-2 sm:gap-3 auto-rows-min">

                        {/* ── Date Card (span 3) ────────────────────────────────── */}
                        <BentoCard
                            className="col-span-6 sm:col-span-6 lg:col-span-3 bg-card border border-border/40 p-3.5 sm:p-5"
                            gradient="from-blue-500 to-cyan-500"
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20">
                                    <IconCalendar size={20} className="text-blue-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5 sm:mb-1">Date</p>
                                    <p className="text-xs sm:text-base font-bold text-foreground leading-snug">{fmtDate(inspection.routeDate)}</p>
                                    {compareMode && compareData && (
                                        <p className="text-xs text-muted-foreground/50 mt-1.5 flex items-center gap-1">
                                            vs {fmtDateShort(compareData.routeDate)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </BentoCard>

                        {/* ── VIN Card (span 3) ─────────────────────────────────── */}
                        <BentoCard
                            className="col-span-6 sm:col-span-6 lg:col-span-3 bg-card border border-border/40 p-3.5 sm:p-5"
                            gradient="from-emerald-500 to-teal-500"
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20">
                                    <IconId size={20} className="text-emerald-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5 sm:mb-1">VIN</p>
                                    <p className="font-mono text-[11px] sm:text-sm font-bold text-foreground break-all leading-snug">
                                        {inspection.vehicleName ? `${inspection.vehicleName}` : ""}{inspection.vehicleName && inspection.vin ? " · " : ""}{inspection.vin || "—"}
                                    </p>
                                </div>
                            </div>
                        </BentoCard>

                        {/* ── Driver Card (span 3) ──────────────────────────────── */}
                        <BentoCard
                            className="col-span-6 sm:col-span-6 lg:col-span-3 bg-card border border-border/40 p-3.5 sm:p-5"
                            gradient="from-violet-500 to-purple-500"
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20">
                                    <IconUser size={20} className="text-violet-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5 sm:mb-1">Driver</p>
                                    <p className="text-xs sm:text-base font-bold text-foreground uppercase leading-snug truncate">{driverDisplay}</p>
                                </div>
                            </div>
                        </BentoCard>

                        {/* ── Vehicle Image Card (span 3, tall) ─────────────────── */}
                        <BentoCard
                            className="col-span-12 sm:col-span-6 lg:col-span-3 sm:row-span-2 bg-card border border-border/40 overflow-hidden"
                            onClick={inspection.vehicleImage ? () => setLightbox(inspection.vehicleImage) : undefined}
                        >
                            {inspection.vehicleImage ? (
                                <div className="relative h-full min-h-[180px] sm:min-h-[200px] group">
                                    <img
                                        src={inspection.vehicleImage}
                                        alt="Vehicle"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Vehicle</p>
                                        <p className="text-white text-sm font-bold">{inspection.vehicleName || "VIN Image"}</p>
                                    </div>
                                    <div className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                        <IconMaximize size={14} className="text-white" />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full min-h-[140px] sm:min-h-[200px] bg-muted/10 flex flex-col items-center justify-center gap-2 sm:gap-3 text-muted-foreground/25 p-4 sm:p-6">
                                    <IconCamera size={36} />
                                    <span className="text-xs font-medium">No vehicle image</span>
                                </div>
                            )}
                        </BentoCard>

                        {/* ── Mileage Card (span 3 — big number) ────────────────── */}
                        <BentoCard
                            className="col-span-6 sm:col-span-4 lg:col-span-3 bg-card border border-border/40 p-3.5 sm:p-5"
                            gradient="from-orange-500 to-amber-500"
                        >
                            <div className="flex flex-col h-full">
                                <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 w-fit mb-2 sm:mb-3">
                                    <IconGauge size={20} className="text-orange-500" />
                                </div>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5 sm:mb-1">Mileage</p>
                                <p className="text-xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-none">
                                    {inspection.mileage > 0 ? inspection.mileage.toLocaleString() : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground/40 font-medium mt-0.5">miles</p>
                                {compareMode && compareData && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                        {(() => {
                                            const prev = compareData.mileage || 0;
                                            const diff = (inspection.mileage || 0) - prev;
                                            if (diff === 0) return <span className="text-[10px] text-muted-foreground/40">No change</span>;
                                            return (
                                                <span className={`text-xs font-bold ${diff > 0 ? "text-emerald-500" : "text-red-500"}`}>
                                                    {diff > 0 ? "+" : ""}{diff.toLocaleString()} mi
                                                </span>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </BentoCard>

                        {/* ── Repairs Status (span 3) ───────────────────────────── */}
                        <BentoCard
                            className={`col-span-6 sm:col-span-4 lg:col-span-3 border p-3.5 sm:p-5 ${hasRepair
                                ? "bg-red-500/[0.03] dark:bg-red-500/[0.06] border-red-500/20"
                                : "bg-card border-border/40"
                                }`}
                            gradient={hasRepair ? "from-red-500 to-rose-500" : "from-emerald-500 to-green-500"}
                        >
                            <div className="flex flex-col h-full">
                                <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl w-fit mb-2 sm:mb-3 ${hasRepair ? "bg-red-500/10 dark:bg-red-500/20" : "bg-emerald-500/10 dark:bg-emerald-500/20"}`}>
                                    <IconTool size={20} className={hasRepair ? "text-red-500" : "text-emerald-500"} />
                                </div>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5 sm:mb-1">Repairs</p>
                                <p className={`text-xl sm:text-3xl font-extrabold tracking-tight leading-none ${hasRepair ? "text-red-500" : "text-emerald-500"}`}>
                                    {hasRepair ? "Yes" : "No"}
                                </p>
                                {hasRepair && inspection.repairCurrentStatus && (
                                    <span className="mt-2 inline-flex self-start px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                                        {inspection.repairCurrentStatus}
                                    </span>
                                )}
                            </div>
                        </BentoCard>

                        {/* ── Comments Card (span 3) ────────────────────────────── */}
                        <BentoCard
                            className="col-span-12 sm:col-span-4 lg:col-span-3 bg-card border border-border/40 p-3.5 sm:p-5"
                            gradient="from-pink-500 to-rose-500"
                        >
                            <div className="flex flex-col h-full">
                                <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 w-fit mb-2 sm:mb-3">
                                    <IconMessageCircle size={20} className="text-pink-500" />
                                </div>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5 sm:mb-1">Comments</p>
                                <p className="text-sm text-foreground leading-relaxed flex-1">
                                    {inspection.comments || <span className="text-muted-foreground/30 italic">No comments</span>}
                                </p>
                            </div>
                        </BentoCard>

                        {/* ── Missing Photos Warning (span 6, conditional) ──────── */}
                        {missingPhotos.length > 0 && (
                            <BentoCard
                                className="col-span-12 sm:col-span-6 bg-amber-500/[0.03] dark:bg-amber-500/[0.06] border border-amber-500/20 p-3.5 sm:p-5"
                                gradient="from-amber-500 to-yellow-500"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex-shrink-0">
                                        <IconAlertTriangle size={20} className="text-amber-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">
                                            Missing Photos ({missingPhotos.length})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {missingPhotos.map(p => (
                                                <span key={p.label} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15">
                                                    {p.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </BentoCard>
                        )}

                        {/* ── Inspected By + Timestamp (span 6) ─────────────────── */}
                        <BentoCard
                            className={`${missingPhotos.length > 0 ? "col-span-12 sm:col-span-6" : "col-span-12"} bg-card border border-border/40 p-3.5 sm:p-5`}
                            gradient="from-indigo-500 to-blue-500"
                        >
                            <div className={`grid ${missingPhotos.length > 0 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-4`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex-shrink-0">
                                        <IconUser size={20} className="text-indigo-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Inspected By</p>
                                        <p className="text-sm font-bold text-foreground">{inspectedByDisplay}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 flex-shrink-0">
                                        <IconClock size={20} className="text-cyan-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Timestamp</p>
                                        <p className="text-sm font-bold text-foreground">{fmtDate(inspection.timeStamp)} · {fmtTime(inspection.timeStamp)}</p>
                                    </div>
                                </div>
                            </div>
                        </BentoCard>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════
                       REPAIR SECTION (if applicable)
                       ═══════════════════════════════════════════════════════════ */}
                    {hasRepair && (
                        <BentoCard
                            className="bg-red-500/[0.02] dark:bg-red-500/[0.04] border border-red-500/20 p-4 sm:p-6"
                            gradient="from-red-500 to-rose-500"
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2.5 rounded-2xl bg-red-500/10 dark:bg-red-500/15">
                                    <IconTool size={20} className="text-red-500" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground">Repair Information</h2>
                                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Active repair on this vehicle</p>
                                </div>
                                {inspection.repairCurrentStatus && (
                                    <span className="ml-auto px-3 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                        {inspection.repairCurrentStatus}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {inspection.repairDescription && (
                                    <div className="rounded-2xl bg-card/50 dark:bg-white/[0.03] border border-border/30 p-4">
                                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold mb-1.5">Description</p>
                                        <p className="text-sm text-foreground leading-relaxed">{inspection.repairDescription}</p>
                                    </div>
                                )}
                                {inspection.repairEstimatedDate && (
                                    <div className="rounded-2xl bg-card/50 dark:bg-white/[0.03] border border-border/30 p-4">
                                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold mb-1.5">Estimated Completion</p>
                                        <p className="text-sm font-semibold text-foreground">{fmtDate(inspection.repairEstimatedDate)}</p>
                                    </div>
                                )}
                            </div>
                            {inspection.repairImage && (
                                <div className="mt-4">
                                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold mb-2">Repair Image</p>
                                    <button
                                        onClick={() => setLightbox(inspection.repairImage)}
                                        className="relative rounded-2xl overflow-hidden group border border-border/20 hover:shadow-xl transition-all"
                                    >
                                        <img src={inspection.repairImage} alt="repair" className="h-40 object-cover transition-transform duration-300 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                </div>
                            )}
                        </BentoCard>
                    )}

                    {/* ═══════════════════════════════════════════════════════════
                       PHOTO GALLERY — Bento Grid or Compare Sliders
                       ═══════════════════════════════════════════════════════════ */}
                    {hasPhotos && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <IconCamera size={16} className="text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground">Inspection Photos</h2>
                                    <p className="text-[10px] text-muted-foreground/50">
                                        {availablePhotos.length} of 6 photos captured
                                        {compareMode && compareData && " — Drag slider to compare"}
                                    </p>
                                </div>
                            </div>

                            {/* Compare mode indicator */}
                            {compareMode && compareData && (
                                <div className="rounded-xl sm:rounded-2xl border border-primary/20 bg-primary/5 px-3 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm mb-3 sm:mb-4">
                                    {compareSource === "master" ? (
                                        <><span className="text-amber-500 text-base leading-none">★</span> Comparing with <strong>Standard Photo</strong> — {fmtDateShort(compareData.routeDate)}</>
                                    ) : (
                                        <><IconArrowsLeftRight size={14} className="text-primary" /> Comparing with <strong>Previous Inspection</strong> — {fmtDateShort(compareData.routeDate)}</>
                                    )}
                                </div>
                            )}

                            {compareMode && compareData ? (
                                /* ── Compare Mode: Side-by-side sliders ── */
                                <div className="space-y-3">
                                    {/* Row 1: Passenger Side & Driver Side */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{photos[0]?.label}</p>
                                            <ImageCompareSlider before={photos[0]?.url} after={prevPhotos[0]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{photos[2]?.label}</p>
                                            <ImageCompareSlider before={photos[2]?.url} after={prevPhotos[2]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                        </div>
                                    </div>
                                    {/* Row 2: Front & Back */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{photos[3]?.label}</p>
                                            <ImageCompareSlider before={photos[3]?.url} after={prevPhotos[3]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{photos[1]?.label}</p>
                                            <ImageCompareSlider before={photos[1]?.url} after={prevPhotos[1]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                        </div>
                                    </div>
                                    {/* Row 3: Dashboard & Additional */}
                                    {(photos[4]?.url || photos[5]?.url) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {photos[4]?.url && (
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{photos[4].label}</p>
                                                    <ImageCompareSlider before={photos[4].url} after={prevPhotos[4]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                                </div>
                                            )}
                                            {photos[5]?.url && (
                                                <div>
                                                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">{photos[5].label}</p>
                                                    <ImageCompareSlider before={photos[5].url} after={prevPhotos[5]?.url} beforeLabel={fmtDateShort(inspection.routeDate)} afterLabel={compareSource === "master" ? "★ Standard" : fmtDateShort(compareData.routeDate)} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Normal Mode: 3-Row Photo Grid ── */
                                <div className="space-y-3">
                                    {/* Row 1: Passenger Side & Driver Side (horizontal) */}
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        <BentoPhoto
                                            url={photos[0]?.url}
                                            label={photos[0]?.label || "Passenger Side"}
                                            onClick={photos[0]?.url ? () => setLightbox(photos[0].url!) : undefined}
                                            className="aspect-video"
                                        />
                                        <BentoPhoto
                                            url={photos[2]?.url}
                                            label={photos[2]?.label || "Driver Side"}
                                            onClick={photos[2]?.url ? () => setLightbox(photos[2].url!) : undefined}
                                            className="aspect-video"
                                        />
                                    </div>
                                    {/* Row 2: Front & Back */}
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        <BentoPhoto
                                            url={photos[3]?.url}
                                            label={photos[3]?.label || "Front"}
                                            onClick={photos[3]?.url ? () => setLightbox(photos[3].url!) : undefined}
                                            className="aspect-video"
                                        />
                                        <BentoPhoto
                                            url={photos[1]?.url}
                                            label={photos[1]?.label || "Back"}
                                            onClick={photos[1]?.url ? () => setLightbox(photos[1].url!) : undefined}
                                            className="aspect-video"
                                        />
                                    </div>
                                    {/* Row 3: Dashboard & Additional */}
                                    {(photos[4]?.url || photos[5]?.url) && (
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            <BentoPhoto
                                                url={photos[4]?.url}
                                                label={photos[4]?.label || "Dashboard"}
                                                onClick={photos[4]?.url ? () => setLightbox(photos[4].url!) : undefined}
                                                className="aspect-video"
                                            />
                                            <BentoPhoto
                                                url={photos[5]?.url}
                                                label={photos[5]?.label || "Additional"}
                                                onClick={photos[5]?.url ? () => setLightbox(photos[5].url!) : undefined}
                                                className="aspect-video"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <FleetFormModal />
        </>
    );
}
