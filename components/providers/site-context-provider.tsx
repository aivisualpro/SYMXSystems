"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ── Client-side site context ──────────────────────────────────────────
// Mirrors the server's view of which stations the user can reach and which
// are currently selected.
//
// This is presentation only. It is NEVER the thing that keeps one site's
// data away from another — that is enforced server-side. If this provider
// were deleted tomorrow, isolation would be unaffected.

export interface SiteOption {
  id: string;
  name: string;
  code: string;
  slug: string;
  siteType: "permanent" | "seasonal";
  isDefault: boolean;
  role: string;
}

export type SiteContextMode = "single" | "multi" | "org";

interface SiteContextValue {
  sites: SiteOption[];
  activeSiteIds: string[];
  mode: SiteContextMode;
  isOrgAdmin: boolean;
  isReadOnly: boolean;
  canSwitch: boolean;
  canViewOrgWide: boolean;
  /** Access came from the default-station fallback, not a real assignment. */
  usingDefaultFallback: boolean;
  loading: boolean;
  switching: boolean;
  error: string | null;
  activeLabel: string;
  setContext: (mode: SiteContextMode, siteIds: string[]) => Promise<void>;
}

const Ctx = createContext<SiteContextValue | null>(null);

export function useSiteContext() {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback so a component rendered outside the provider (or during
    // an error boundary) doesn't crash the page.
    return {
      sites: [], activeSiteIds: [], mode: "single" as SiteContextMode,
      isOrgAdmin: false, isReadOnly: false, canSwitch: false, canViewOrgWide: false,
      usingDefaultFallback: false,
      loading: false, switching: false, error: null, activeLabel: "",
      setContext: async () => {},
    };
  }
  return v;
}

export function SiteContextProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [activeSiteIds, setActiveSiteIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SiteContextMode>("single");
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const [canViewOrgWide, setCanViewOrgWide] = useState(false);
  const [usingDefaultFallback, setUsingDefaultFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/sites")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setSites(d.sites || []);
        setActiveSiteIds(d.context?.siteIds || []);
        setMode(d.context?.mode || "single");
        setIsOrgAdmin(!!d.isOrgAdmin);
        setIsReadOnly(!!d.isReadOnly);
        setCanSwitch(!!d.canSwitch);
        setCanViewOrgWide(!!d.canViewOrgWide);
        setUsingDefaultFallback(!!d.usingDefaultFallback);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setContext = useCallback(
    async (nextMode: SiteContextMode, siteIds: string[]) => {
      setSwitching(true);
      setError(null);
      try {
        const res = await fetch("/api/user/sites", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: nextMode, siteIds }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to switch site");
        setMode(json.context.mode);
        setActiveSiteIds(json.context.siteIds);

        // Switching station must REFETCH, never re-filter what's already in
        // memory. Cached rows belong to the previous context; showing them
        // under a new station label is exactly the kind of cross-site
        // confusion this whole project exists to prevent.
        await queryClient.invalidateQueries();
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setSwitching(false);
      }
    },
    [queryClient]
  );

  const activeLabel =
    mode === "org"
      ? `All stations (${sites.length})`
      : activeSiteIds
          .map((id) => sites.find((s) => s.id === id)?.code || "?")
          .join(" + ") || "—";

  return (
    <Ctx.Provider
      value={{
        sites, activeSiteIds, mode, isOrgAdmin, isReadOnly,
        canSwitch, canViewOrgWide, usingDefaultFallback, loading, switching, error,
        activeLabel, setContext,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
