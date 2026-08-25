"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getScopingState } from "@/lib/site-scoping-registry";
import { useSiteContext } from "@/components/providers/site-context-provider";

/**
 * Warns when the current page does NOT yet filter by station.
 *
 * During the migration some modules are scoped and some aren't. Without
 * this, selecting DXC8 and seeing DFO2's records looks like the switcher
 * is broken — or worse, gets mistaken for real DXC8 data.
 *
 * Only shown when it could actually mislead: if the user can only reach
 * one station anyway, there is nothing to be confused about.
 */
export function StationScopeBanner() {
  const pathname = usePathname();
  const { sites, activeLabel, loading, canSwitch, canViewOrgWide, mode } = useSiteContext();

  if (loading) return null;

  // One station and no company-wide view — the switcher isn't a choice, so
  // an unscoped page can't show them anything unexpected.
  if (!canSwitch && !canViewOrgWide) return null;
  if (sites.length <= 1) return null;

  const state = getScopingState(pathname);
  if (state !== "unscoped") return null;

  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span className="leading-relaxed">
        <strong>Showing all stations.</strong> This page doesn&apos;t filter by station yet, so
        these records are from every station — not just{" "}
        <strong>{mode === "org" ? "the selected stations" : activeLabel}</strong>. Station
        filtering is live for Write-Ups so far and is being rolled out module by module.
      </span>
    </div>
  );
}
