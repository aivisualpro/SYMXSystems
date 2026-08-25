"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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

        // ── Hard reload, deliberately ──
        // Switching station must REFETCH everything. Data already on screen
        // belongs to the previous station, and rendering it under a new
        // station's label is precisely the cross-site confusion this project
        // exists to prevent.
        //
        // A full reload rather than a targeted cache invalidation because
        // this app has no single data-fetching layer to invalidate: nothing
        // uses React Query's useQuery — ~70 components call fetch() directly
        // in their own useEffect and hold results in local state. An earlier
        // version called queryClient.invalidateQueries() here, which did
        // nothing at all: the station label changed while the table below it
        // kept showing the previous station's records.
        //
        // Losing scroll position and filters on a station switch is a fair
        // price for the guarantee that what's on screen belongs to the
        // station named in the header. Revisit only if data fetching is ever
        // unified behind one cache.
        window.location.reload();

        // Not reached — reload replaces the page. State is set anyway so the
        // UI is correct in the instant before navigation, and in case a
        // browser defers the reload.
        setMode(json.context.mode);
        setActiveSiteIds(json.context.siteIds);
      } catch (e: any) {
        setError(e.message);
        setSwitching(false);
        throw e;
      }
    },
    []
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
