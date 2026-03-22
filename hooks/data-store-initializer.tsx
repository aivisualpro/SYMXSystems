"use client";

import { useDataStore } from "./use-data-store";
import { useEffect, useState } from "react";

/**
 * DataStoreInitializer — V2 "Instant Load"
 *
 * Only shows overlay for critical datasets (~0.5-1s).
 * Heavy datasets load silently in background after pages render.
 * Shows a slim top bar for any background refreshes.
 */
export function DataStoreInitializer() {
  const { initialized, globalLoading, globalProgress } = useDataStore();
  const [showOverlay, setShowOverlay] = useState(!initialized);
  const [fadeOut, setFadeOut] = useState(false);

  // When initialized, fade out overlay immediately
  useEffect(() => {
    if (initialized && showOverlay) {
      setFadeOut(true);
      const timer = setTimeout(() => setShowOverlay(false), 400);
      return () => clearTimeout(timer);
    }
  }, [initialized, showOverlay]);

  // Full-screen overlay — only visible for ~0.5-1 second (critical datasets only)
  if (showOverlay) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/98 backdrop-blur-2xl transition-opacity duration-400 ${
          fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* Animated spinner */}
        <div className="relative mb-6">
          {/* Outer glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent blur-2xl scale-[2] animate-pulse" />

          {/* Spinning ring */}
          <div className="relative w-16 h-16">
            <svg className="w-full h-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: "1.5s" }}>
              <defs>
                <linearGradient id="ds-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#ds-grad)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="200 64"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-foreground/80 tracking-tight">
          SYMX Systems
        </h2>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-muted/30 rounded-full overflow-hidden mt-3">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
            style={{ width: `${globalProgress}%` }}
          />
        </div>
      </div>
    );
  }

  // Slim top bar for background refreshes (deferred datasets loading)
  if (globalLoading && initialized) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9998] h-0.5">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-all duration-300 ease-out"
          style={{ width: `${globalProgress}%` }}
        />
      </div>
    );
  }

  return null;
}
