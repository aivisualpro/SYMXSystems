"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const POLL_INTERVAL = 60_000; // Check every 60 seconds

export default function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [initialVersion, setInitialVersion] = useState<string | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = await res.json();

      if (!initialVersion) {
        setInitialVersion(version);
      } else if (version !== initialVersion && version !== "dev") {
        setUpdateAvailable(true);
      }
    } catch {
      // Silently fail — network issues shouldn't disrupt the UI
    }
  }, [initialVersion]);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkVersion]);

  const handleUpdate = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    // Don't check again for 5 minutes after dismissal
    setDismissedUntil(Date.now() + 5 * 60_000);
  };

  if (!updateAvailable || Date.now() < dismissedUntil) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-500"
    >
      <div className="flex items-center gap-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/60 rounded-2xl px-4 py-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/5">
        {/* Pulse dot */}
        <div className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </div>

        <span className="text-[12px] text-zinc-300 font-medium whitespace-nowrap">
          New version available
        </span>

        <button
          onClick={handleUpdate}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all active:scale-95"
        >
          <RefreshCw className="h-3 w-3" />
          Update
        </button>

        <button
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
          aria-label="Dismiss"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
