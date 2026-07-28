"use client";

import React, { useRef, useCallback, useEffect } from "react";
import { IconCamera, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

/* ── shared "no image" placeholder ──────────────────────────────── */
function NoImage({ label }: { label: string }) {
    return (
        <div className="w-full h-full bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <IconCamera size={28} />
            <span className="text-xs">No image — {label}</span>
        </div>
    );
}

/* ── Drag-to-reveal slider compare ──────────────────────────────── */
export function ImageCompareSlider({
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

    return (
        <div
            ref={containerRef}
            className={`relative w-full ${aspectClass || "aspect-video"} overflow-hidden rounded-2xl select-none cursor-col-resize group touch-none`}
            onPointerDown={onDown}
        >
            <div className="absolute inset-0 bg-black/80">
                {after ? <img src={after} alt={afterLabel} className="w-full h-full object-cover pointer-events-none" draggable={false} /> : <NoImage label={afterLabel} />}
            </div>
            <div ref={clipRef} className="absolute inset-0 bg-black/80" style={{ clipPath: "inset(0 50% 0 0)" }}>
                {before ? <img src={before} alt={beforeLabel} className="w-full h-full object-cover pointer-events-none" draggable={false} /> : <NoImage label={beforeLabel} />}
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

/* ── Side-by-side compare (two images, no drag) ─────────────────── */
export function ImageSideBySide({
    before, after, beforeLabel, afterLabel, aspectClass,
}: { before?: string; after?: string; beforeLabel: string; afterLabel: string; aspectClass?: string }) {
    const tile = (url: string | undefined, label: string) => (
        <div className={`relative w-full ${aspectClass || "aspect-video"} overflow-hidden rounded-2xl bg-black/80`}>
            {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <NoImage label={label} />}
            <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white border border-white/10">{label}</span>
            </div>
        </div>
    );
    return (
        <div className="grid grid-cols-2 gap-2">
            {tile(before, beforeLabel)}
            {tile(after, afterLabel)}
        </div>
    );
}

/* ── Mode-aware wrapper: pick slider or side-by-side ────────────── */
export type CompareMode = "slider" | "side-by-side";

export function PhotoCompareTile({
    mode, before, after, beforeLabel, afterLabel, aspectClass,
}: { mode: CompareMode; before?: string; after?: string; beforeLabel: string; afterLabel: string; aspectClass?: string }) {
    return mode === "side-by-side"
        ? <ImageSideBySide before={before} after={after} beforeLabel={beforeLabel} afterLabel={afterLabel} aspectClass={aspectClass} />
        : <ImageCompareSlider before={before} after={after} beforeLabel={beforeLabel} afterLabel={afterLabel} aspectClass={aspectClass} />;
}

/* ── Small toggle control for switching mode ────────────────────── */
export function CompareModeToggle({ mode, onChange }: { mode: CompareMode; onChange: (m: CompareMode) => void }) {
    return (
        <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/60">
            <button
                onClick={() => onChange("slider")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${mode === "slider" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
                Slider
            </button>
            <button
                onClick={() => onChange("side-by-side")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${mode === "side-by-side" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
                Side by Side
            </button>
        </div>
    );
}

/* ── Standard 4-angle (+dashboard+additional) photo set from a DailyInspection doc ── */
export function anglesFromInspection(insp: any | null | undefined) {
    return [
        { key: "vehiclePicture1", url: insp?.vehiclePicture1, label: "Passenger Side" },
        { key: "vehiclePicture2", url: insp?.vehiclePicture2, label: "Back" },
        { key: "vehiclePicture3", url: insp?.vehiclePicture3, label: "Driver Side" },
        { key: "vehiclePicture4", url: insp?.vehiclePicture4, label: "Front" },
        { key: "dashboardImage", url: insp?.dashboardImage, label: "Dashboard" },
        { key: "additionalPicture", url: insp?.additionalPicture, label: "Additional" },
    ];
}
