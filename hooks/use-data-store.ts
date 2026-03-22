"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  useDataStore — Global prefetch engine for SYMX Systems
//
//  V2 — "Instant Load" architecture:
//    • Split datasets into CRITICAL (blocks UI ~1s) and DEFERRED (background)
//    • Phase 1 (Critical): Admin config + navigation essentials → instant UI
//    • Phase 2 (Deferred): Heavy data loads silently in background
//    • Phase 3 (Week-dependent): Only after weeks list is ready
//
//  Result: App shell renders in < 1 second instead of 10-20 seconds
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface DatasetConfig {
  key: string;
  /** The URL (or function returning URL) to fetch data from */
  url: string | (() => string);
  /** Transform the raw JSON response before caching */
  transform?: (raw: any) => any;
  /** Time-to-live in ms before auto background refresh. Default: 5 min */
  ttl?: number;
  /** Whether to refetch when the window regains focus. Default: true */
  refetchOnFocus?: boolean;
  /** Whether this dataset is enabled. Default: true */
  enabled?: boolean;
  /** Priority: 'critical' loads first and blocks UI briefly, 'deferred' loads in background */
  priority?: "critical" | "deferred";
}

export interface DatasetState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  stale: boolean;
}

interface StoreState {
  datasets: Record<string, DatasetState>;
  globalLoading: boolean;
  globalProgress: number; // 0-100
  initialized: boolean;
}

// ── Default datasets for SYMX Systems ────────────────────────────────────────

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const FOCUS_STALE_THRESHOLD = 2 * 60 * 1000; // 2 min — refetch on focus if older

const DATASETS: DatasetConfig[] = [
  // ═══════════════════════════════════════
  //  CRITICAL — Tiny payloads, needed for nav/UI. Blocks overlay ~0.5-1s
  // ═══════════════════════════════════════
  {
    key: "admin.routeTypes",
    url: "/api/admin/settings/route-types",
    priority: "critical",
    transform: (raw: any) => {
      const map: Record<string, { color: string; startTime: string }> = {};
      if (Array.isArray(raw)) {
        raw.forEach((t: any) => {
          map[t.name?.toLowerCase()] = {
            color: t.color,
            startTime: t.startTime || "",
          };
        });
      }
      return map;
    },
    ttl: 30 * 60 * 1000,
  },
  {
    key: "admin.dropdowns",
    url: "/api/admin/settings/dropdowns",
    priority: "critical",
    ttl: 30 * 60 * 1000,
  },
  {
    key: "admin.modules",
    url: "/api/admin/modules",
    priority: "critical",
    ttl: 10 * 60 * 1000,
  },
  {
    key: "scheduling.weeks",
    url: "/api/schedules?weeksList=true",
    priority: "critical",
    transform: (raw: any) => raw?.weeks ?? [],
    ttl: 10 * 60 * 1000,
  },

  // ═══════════════════════════════════════
  //  DEFERRED — Heavy payloads, load silently in background
  // ═══════════════════════════════════════
  {
    key: "admin.wst",
    url: "/api/admin/settings/wst",
    priority: "deferred",
    ttl: 30 * 60 * 1000,
  },
  {
    key: "fleet.dashboard",
    url: "/api/fleet?section=dashboard",
    priority: "deferred",
    ttl: DEFAULT_TTL,
  },
  {
    key: "fleet.vehicles",
    url: "/api/fleet?section=vehicles",
    priority: "deferred",
    transform: (raw: any) => raw?.vehicles ?? [],
    ttl: DEFAULT_TTL,
  },
  {
    key: "fleet.repairs",
    url: "/api/fleet?section=repairs&skip=0&limit=50&excludeCompleted=true",
    priority: "deferred",
    transform: (raw: any) => ({
      data: raw?.repairs ?? [],
      total: raw?.total ?? 0,
      hasMore: raw?.hasMore ?? false,
    }),
    ttl: DEFAULT_TTL,
  },
  {
    key: "fleet.inspections",
    url: "/api/fleet?section=inspections&skip=0&limit=50",
    priority: "deferred",
    transform: (raw: any) => ({
      data: raw?.inspections ?? [],
      total: raw?.total ?? 0,
      hasMore: raw?.hasMore ?? false,
    }),
    ttl: DEFAULT_TTL,
  },
  {
    key: "fleet.rentals",
    url: "/api/fleet?section=rentals",
    priority: "deferred",
    transform: (raw: any) => raw?.rentals ?? [],
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.dashboard",
    url: "/api/admin/employees/dashboard",
    priority: "deferred",
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.claimsKpi",
    url: "/api/admin/claims?skip=0&limit=1",
    priority: "deferred",
    transform: (raw: any) => raw?.kpi || null,
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.reimbursementsKpi",
    url: "/api/admin/reimbursements?skip=0&limit=1",
    priority: "deferred",
    transform: (raw: any) => raw?.kpi || null,
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.reimbursements",
    url: "/api/admin/reimbursements?skip=0&limit=50",
    priority: "deferred",
    transform: (raw: any) => ({
      records: raw?.records ?? raw ?? [],
      totalCount: raw?.totalCount ?? 0,
      hasMore: raw?.hasMore ?? false,
      kpi: raw?.kpi ?? null,
    }),
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.claims",
    url: "/api/admin/claims?skip=0&limit=50",
    priority: "deferred",
    transform: (raw: any) => ({
      records: raw?.records ?? raw ?? [],
      totalCount: raw?.totalCount ?? 0,
      hasMore: raw?.hasMore ?? false,
      kpi: raw?.kpi ?? null,
    }),
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.audit",
    url: "/api/admin/employees?filter=audit&limit=9999&terminated=false",
    priority: "deferred",
    transform: (raw: any) => (Array.isArray(raw) ? raw : raw?.records ?? []),
    ttl: DEFAULT_TTL,
  },
  {
    key: "hr.tickets",
    url: "/api/admin/hr-tickets",
    priority: "deferred",
    transform: (raw: any) => (Array.isArray(raw) ? raw : raw?.records ?? []),
    ttl: DEFAULT_TTL,
  },
  {
    key: "employees",
    url: "/api/admin/employees?skip=0&limit=50&terminated=false",
    priority: "deferred",
    transform: (raw: any) => ({
      records: raw?.records ?? raw ?? [],
      totalCount: raw?.totalCount ?? 0,
      hasMore: raw?.hasMore ?? false,
    }),
    ttl: DEFAULT_TTL,
  },
  {
    key: "admin.users",
    url: "/api/admin/users",
    priority: "deferred",
    ttl: 10 * 60 * 1000,
  },
  {
    key: "admin.roles",
    url: "/api/admin/roles",
    priority: "deferred",
    ttl: 10 * 60 * 1000,
  },
];

// ── Phase 3: Week-dependent datasets (fetched after weeks list is available) ──

function _getPhase3Datasets(firstWeek: string): DatasetConfig[] {
  return [
    {
      key: "scheduling.weekData",
      url: `/api/schedules?yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      ttl: 3 * 60 * 1000,
    },
    {
      key: "dispatching.routes",
      url: `/api/dispatching/routes?yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      ttl: 3 * 60 * 1000,
    },
    {
      key: "messaging.employees.future-shift",
      url: `/api/messaging/employees?filter=future-shift&yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      transform: (raw: any) => raw?.employees ?? [],
      ttl: 3 * 60 * 1000,
    },
    {
      key: "messaging.employees.shift",
      url: `/api/messaging/employees?filter=shift&yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      transform: (raw: any) => raw?.employees ?? [],
      ttl: 3 * 60 * 1000,
    },
    {
      key: "messaging.employees.off-tomorrow",
      url: `/api/messaging/employees?filter=off-tomorrow&yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      transform: (raw: any) => raw?.employees ?? [],
      ttl: 3 * 60 * 1000,
    },
    {
      key: "messaging.employees.week-schedule",
      url: `/api/messaging/employees?filter=week-schedule&yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      transform: (raw: any) => raw?.employees ?? [],
      ttl: 3 * 60 * 1000,
    },
    {
      key: "messaging.employees.route-itinerary",
      url: `/api/messaging/employees?filter=route-itinerary&yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      transform: (raw: any) => raw?.employees ?? [],
      ttl: 3 * 60 * 1000,
    },
    {
      key: "messaging.employees.flyer",
      url: `/api/messaging/employees?filter=flyer&yearWeek=${encodeURIComponent(firstWeek)}`,
      priority: "deferred",
      transform: (raw: any) => raw?.employees ?? [],
      ttl: 5 * 60 * 1000,
    },
  ];
}

// ── Singleton Store ──────────────────────────────────────────────────────────

let _state: StoreState = {
  datasets: {},
  globalLoading: false,
  globalProgress: 0,
  initialized: false,
};

const _listeners = new Set<() => void>();
const _inflightRequests = new Map<string, Promise<any>>();

function _emit() {
  _listeners.forEach((l) => l());
}

function _setState(partial: Partial<StoreState>) {
  _state = { ..._state, ...partial };
  _emit();
}

function _setDataset(key: string, partial: Partial<DatasetState>) {
  _state = {
    ..._state,
    datasets: {
      ..._state.datasets,
      [key]: { ...(_state.datasets[key] || { data: null, loading: false, error: null, fetchedAt: null, stale: false }), ...partial },
    },
  };
  _emit();
}

// ── Core fetch logic ─────────────────────────────────────────────────────────

async function _fetchDataset(config: DatasetConfig, force = false): Promise<void> {
  const { key, url, transform, ttl = DEFAULT_TTL } = config;
  const existing = _state.datasets[key];

  // Skip if recently fetched and not forced
  if (!force && existing?.fetchedAt && Date.now() - existing.fetchedAt < ttl && !existing.stale) {
    return;
  }

  // Dedup — don't fire concurrent requests for same key
  if (_inflightRequests.has(key)) {
    return _inflightRequests.get(key)!;
  }

  const promise = (async () => {
    _setDataset(key, { loading: true, error: null, stale: false });

    try {
      const resolvedUrl = typeof url === "function" ? url() : url;
      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const data = transform ? transform(raw) : raw;

      _setDataset(key, {
        data,
        loading: false,
        error: null,
        fetchedAt: Date.now(),
        stale: false,
      });
    } catch (err: any) {
      _setDataset(key, {
        loading: false,
        error: err.message || "Fetch failed",
        stale: true,
      });
    } finally {
      _inflightRequests.delete(key);
    }
  })();

  _inflightRequests.set(key, promise);
  return promise;
}

/**
 * V2 Prefetch — "Instant Load" Strategy
 *
 * Phase 1 (Critical): Route types, dropdowns, modules, weeks → ~0.5s
 *   → Sets initialized=true immediately after Phase 1 ✅
 *   → App shell + pages render instantly
 *
 * Phase 2 (Deferred): Fleet, employees, admin users/roles → background
 * Phase 3 (Week-dependent): Schedule data, messaging → background
 *
 * The overlay only shows for Phase 1 (~0.5-1s), not all 20+ datasets.
 */
async function _prefetchAll(force = false): Promise<void> {
  const allDatasets = DATASETS.filter((d) => d.enabled !== false);
  const criticalDatasets = allDatasets.filter((d) => d.priority === "critical");
  const deferredDatasets = allDatasets.filter((d) => d.priority !== "critical");

  _setState({ globalLoading: true, globalProgress: 0 });

  // ── Phase 1: Critical datasets (blocks UI briefly) ──
  let completed = 0;
  const criticalTotal = criticalDatasets.length;

  const criticalPromises = criticalDatasets.map(async (config) => {
    await _fetchDataset(config, force);
    completed++;
    _setState({ globalProgress: Math.round((completed / criticalTotal) * 100) });
  });

  await Promise.allSettled(criticalPromises);

  // ✅ Mark initialized NOW — pages can render immediately!
  _setState({
    globalLoading: false,
    globalProgress: 100,
    initialized: true,
  });

  // ── Phase 2: Deferred datasets (silent background) ──
  // Small delay to let the UI paint before firing heavy requests
  await new Promise((r) => setTimeout(r, 100));

  const deferredPromises = deferredDatasets.map(async (config) => {
    await _fetchDataset(config, force);
  });

  await Promise.allSettled(deferredPromises);

  // ── Phase 3: Week-dependent datasets (silent background) ──
  const weeks = _state.datasets["scheduling.weeks"]?.data as string[] | null;
  const firstWeek = weeks?.[0];

  if (firstWeek) {
    const phase3Datasets = _getPhase3Datasets(firstWeek);
    const phase3Promises = phase3Datasets.map(async (config) => {
      await _fetchDataset(config, force);
    });
    await Promise.allSettled(phase3Promises);
  }
}

/** Refresh a single dataset by key */
async function _refreshDataset(key: string): Promise<void> {
  const config = [...DATASETS, ..._getPhase3DatasetsFromCache()].find((d) => d.key === key);
  if (!config) return;
  await _fetchDataset(config, true);
}

/** Helper to get phase 3 datasets from cached weeks */
function _getPhase3DatasetsFromCache(): DatasetConfig[] {
  const weeks = _state.datasets["scheduling.weeks"]?.data as string[] | null;
  return weeks?.[0] ? _getPhase3Datasets(weeks[0]) : [];
}

/** Refresh all datasets */
async function _refreshAll(): Promise<void> {
  await _prefetchAll(true);
}

// ── Auto-refresh timer ───────────────────────────────────────────────────────

let _refreshTimer: ReturnType<typeof setInterval> | null = null;

function _startAutoRefresh() {
  if (_refreshTimer) return;
  _refreshTimer = setInterval(() => {
    // Background refresh stale datasets — don't show loading
    [...DATASETS, ..._getPhase3DatasetsFromCache()]
      .filter((d) => d.enabled !== false)
      .forEach((config) => {
        const state = _state.datasets[config.key];
        const ttl = config.ttl ?? DEFAULT_TTL;
        if (state?.fetchedAt && Date.now() - state.fetchedAt >= ttl) {
          _fetchDataset(config, true);
        }
      });
  }, 60_000); // check every minute
}

function _stopAutoRefresh() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}

// ── Focus refetch ────────────────────────────────────────────────────────────

let _focusListenerAttached = false;

function _attachFocusListener() {
  if (_focusListenerAttached || typeof window === "undefined") return;
  _focusListenerAttached = true;

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      DATASETS.filter((d) => d.enabled !== false && d.refetchOnFocus !== false).forEach((config) => {
        const state = _state.datasets[config.key];
        if (state?.fetchedAt && Date.now() - state.fetchedAt >= FOCUS_STALE_THRESHOLD) {
          _fetchDataset(config, true); // silent background refresh
        }
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  useDataStore() — The main hook
// ─────────────────────────────────────────────────────────────────────────────

export function useDataStore() {
  const [state, setState] = useState<StoreState>(_state);

  // Subscribe to store changes
  useEffect(() => {
    // Sync immediately in case state changed between render and effect
    setState(_state);

    const listener = () => setState(_state);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  // Initialize once
  const hasInitRef = useRef(false);
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    _prefetchAll();
    _startAutoRefresh();
    _attachFocusListener();

    return () => {
      _stopAutoRefresh();
    };
  }, []);

  // ── Convenience getters ────────────────────────────────────────────────────

  const get = useCallback(<T = any>(key: string): T | null => {
    return (state.datasets[key]?.data as T) ?? null;
  }, [state.datasets]);

  const getState = useCallback((key: string): DatasetState => {
    return state.datasets[key] || { data: null, loading: false, error: null, fetchedAt: null, stale: false };
  }, [state.datasets]);

  const isLoading = useCallback((key: string): boolean => {
    return state.datasets[key]?.loading ?? false;
  }, [state.datasets]);

  const refresh = useCallback(async (key?: string) => {
    if (key) {
      await _refreshDataset(key);
    } else {
      await _refreshAll();
    }
  }, []);

  return {
    // Global state
    initialized: state.initialized,
    globalLoading: state.globalLoading,
    globalProgress: state.globalProgress,

    // Per-dataset access
    get,
    getState,
    isLoading,

    // Quick accessors for common datasets
    fleet: {
      dashboard: state.datasets["fleet.dashboard"]?.data ?? null,
      vehicles: state.datasets["fleet.vehicles"]?.data ?? [],
      repairs: state.datasets["fleet.repairs"]?.data ?? { data: [], total: 0, hasMore: false },
      inspections: state.datasets["fleet.inspections"]?.data ?? { data: [], total: 0, hasMore: false },
      rentals: state.datasets["fleet.rentals"]?.data ?? [],
    },
    employees: state.datasets["employees"]?.data ?? { records: [], totalCount: 0, hasMore: false },
    hrStats: state.datasets["hr.dashboard"]?.data ?? null,
    hrClaimsKpi: state.datasets["hr.claimsKpi"]?.data ?? null,
    hrReimbursementsKpi: state.datasets["hr.reimbursementsKpi"]?.data ?? null,
    hrReimbursements: state.datasets["hr.reimbursements"]?.data ?? null,
    hrClaims: state.datasets["hr.claims"]?.data ?? null,
    hrAudit: state.datasets["hr.audit"]?.data ?? null,
    hrTickets: state.datasets["hr.tickets"]?.data ?? null,
    schedulingWeeks: state.datasets["scheduling.weeks"]?.data ?? [],
    schedulingWeekData: state.datasets["scheduling.weekData"]?.data ?? null,
    dispatchingWeeks: state.datasets["scheduling.weeks"]?.data ?? [],
    dispatchingRoutes: state.datasets["dispatching.routes"]?.data ?? null,
    messagingEmployees: {
      "future-shift": state.datasets["messaging.employees.future-shift"]?.data ?? null,
      "shift": state.datasets["messaging.employees.shift"]?.data ?? null,
      "off-tomorrow": state.datasets["messaging.employees.off-tomorrow"]?.data ?? null,
      "week-schedule": state.datasets["messaging.employees.week-schedule"]?.data ?? null,
      "route-itinerary": state.datasets["messaging.employees.route-itinerary"]?.data ?? null,
      "flyer": state.datasets["messaging.employees.flyer"]?.data ?? null,
    },
    admin: {
      users: state.datasets["admin.users"]?.data ?? [],
      roles: state.datasets["admin.roles"]?.data ?? [],
      modules: state.datasets["admin.modules"]?.data ?? [],
      routeTypes: state.datasets["admin.routeTypes"]?.data ?? {},
      dropdowns: state.datasets["admin.dropdowns"]?.data ?? [],
      wst: state.datasets["admin.wst"]?.data ?? [],
    },

    // Actions
    refresh,
    refreshAll: _refreshAll,
    refreshDataset: _refreshDataset,
  };
}
