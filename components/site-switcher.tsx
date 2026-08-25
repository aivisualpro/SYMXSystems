"use client";

import * as React from "react";
import { Building2, Check, ChevronDown, Globe, Loader2, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSiteContext } from "@/components/providers/site-context-provider";
import { cn } from "@/lib/utils";

/**
 * Station selector for the app header.
 *
 * A user with access to exactly one station sees a static label, not a
 * dropdown — there is nothing to choose, and a disabled control invites
 * people to wonder what they're missing.
 */
export function SiteSwitcher() {
  const {
    sites, activeSiteIds, mode, canSwitch, canViewOrgWide,
    loading, switching, activeLabel, setContext,
  } = useSiteContext();

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }

  // No sites at all — surfaced rather than hidden, because it means the
  // account has no site assignment and will see nothing anywhere.
  if (sites.length === 0) {
    return (
      <span
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
        title="This account isn't assigned to any station. Ask an administrator to assign one."
      >
        No station
      </span>
    );
  }

  if (!canSwitch && !canViewOrgWide) {
    const only = sites[0];
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
        <Building2 className="h-3 w-3" />
        {only.code}
      </span>
    );
  }

  const isOrg = mode === "org";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={switching}
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs font-medium",
            // Company-wide is visually distinct on purpose. Consolidated
            // numbers misread as one station's numbers is a real reporting
            // hazard, so the mode should never be ambiguous at a glance.
            isOrg && "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400"
          )}
        >
          {switching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isOrg ? (
            <Globe className="h-3.5 w-3.5" />
          ) : (
            <Building2 className="h-3.5 w-3.5" />
          )}
          <span className="max-w-[140px] truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Station
        </DropdownMenuLabel>

        {sites.map((site) => {
          const selected = mode !== "org" && activeSiteIds.includes(site.id);
          return (
            <DropdownMenuItem
              key={site.id}
              onClick={() => setContext("single", [site.id]).catch(() => {})}
              className="gap-2"
            >
              <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 truncate font-medium">
                  {site.code}
                  {site.siteType === "seasonal" && (
                    <Snowflake
                      className="h-3 w-3 text-sky-500"
                      // Seasonal stations run only part of the year; worth
                      // flagging so nobody reads a short window as a decline.
                      aria-label="Seasonal station"
                    />
                  )}
                </span>
                {site.role && (
                  <span className="truncate text-[10px] text-muted-foreground">{site.role}</span>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}

        {canViewOrgWide && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setContext("org", []).catch(() => {})}
              className="gap-2"
            >
              <Check className={cn("h-3.5 w-3.5", isOrg ? "opacity-100" : "opacity-0")} />
              <Globe className="h-3.5 w-3.5 text-violet-500" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">All stations</span>
                <span className="text-[10px] text-muted-foreground">
                  Company-wide consolidated view
                </span>
              </div>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-amber-600 dark:text-amber-400">Preview.</span>{" "}
          Switching records your selection, but pages don&apos;t filter by station yet —
          you&apos;ll still see DFO2 data everywhere until scoping ships.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
