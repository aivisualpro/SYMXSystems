"use client";

import { useRef, useEffect, useCallback } from "react";
import SignaturePadLib from "signature_pad";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  className?: string;
  height?: number;
  label?: string;
  timestamp?: string | null;
}

export default function SignaturePad({
  value,
  onChange,
  className,
  height = 100,
  label = "Signature",
  timestamp,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  // Initialize signature pad
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || value) return; // Don't init if signature already exists

    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current?.clear();
    };

    const isDark = document.documentElement.classList.contains("dark");

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      penColor: isDark ? "#e2e8f0" : "#1e293b",
      minWidth: 1.5,
      maxWidth: 3,
      velocityFilterWeight: 0.7,
    });

    pad.addEventListener("endStroke", () => {
      onChange(pad.toDataURL("image/png"));
    });

    padRef.current = pad;
    resizeCanvas();

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);

    return () => {
      pad.off();
      observer.disconnect();
      padRef.current = null;
    };
  }, [value, onChange]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    onChange("");
  }, [onChange]);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {value && (
          <button
            type="button"
            className="text-[9px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors"
            onClick={handleClear}
          >
            <RotateCcw className="h-2.5 w-2.5" /> Clear
          </button>
        )}
      </div>

      {value ? (
        <div className="rounded-lg border-2 border-border/50 bg-muted/10 p-2 flex items-center justify-center"
          style={{ height }}
        >
          <img
            src={value}
            alt={label}
            className="max-w-full max-h-full object-contain"
            style={{ filter: "var(--sig-filter, none)" }}
          />
        </div>
      ) : (
        <div className="relative rounded-lg border-2 border-dashed border-border/50 hover:border-[#1a7a8a]/40 transition-colors overflow-hidden"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none"
          />
          {/* Signing line */}
          <div className="absolute bottom-5 left-4 right-4 border-b border-border/30 pointer-events-none" />
          <span className="absolute bottom-1.5 left-4 text-[8px] text-muted-foreground/40 pointer-events-none uppercase tracking-widest">
            Sign here
          </span>
        </div>
      )}

      {timestamp && (
        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />
          Signed: {timestamp}
        </p>
      )}
    </div>
  );
}
