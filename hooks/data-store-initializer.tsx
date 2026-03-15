"use client";

import { useDataStore } from "./use-data-store";
import { useEffect, useState } from "react";

/**
 * DataStoreInitializer
 *
 * Renders a premium full-screen loading overlay on the FIRST load,
 * then a slim progress bar for subsequent refreshes.
 * Mount once in the protected layout.
 */
export function DataStoreInitializer() {
  const { initialized, globalLoading, globalProgress } = useDataStore();
  const [showOverlay, setShowOverlay] = useState(!initialized);
  const [fadeOut, setFadeOut] = useState(false);

  // When initialized, fade out overlay
  useEffect(() => {
    if (initialized && showOverlay) {
      setFadeOut(true);
      const timer = setTimeout(() => setShowOverlay(false), 600);
      return () => clearTimeout(timer);
    }
  }, [initialized, showOverlay]);

  // Full-screen premium overlay on first load
  if (showOverlay) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl transition-opacity duration-500 ${
          fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* Animated logo / spinner */}
        <div className="relative mb-8">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent blur-2xl scale-150 animate-pulse" />

          {/* Spinning ring */}
          <div className="relative w-20 h-20">
            <svg className="w-full h-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: "3s" }}>
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
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="200 64"
              />
            </svg>

            {/* Inner percentage */}
            <div className="absolute inset-0 flex items-center justify-center" suppressHydrationWarning>
              <span className="text-lg font-bold font-mono tabular-nums text-primary" suppressHydrationWarning>
                {globalProgress}<span className="text-xs">%</span>
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-foreground mb-1 tracking-tight">
          Loading SYMX Systems
        </h2>



        {/* Progress bar */}
        <div className="w-64 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-300 ease-out"
            style={{ width: `${globalProgress}%` }}
          />
        </div>

        {/* Progress label */}


      </div>
    );
  }

  // Slim top bar for background refreshes (after initial load)
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
