"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useDataStore } from "@/hooks/use-data-store";
import { sidebarCache } from "@/components/app-sidebar";
import {
  IconChartDonut, IconCar, IconTool, IconClipboardCheck,
  IconFileInvoice, IconSearch, IconPlus, IconRotate2, IconCheck,
} from "@tabler/icons-react";

// ── Fleet Context ─────────────────────────────────────────────────────
interface FleetData {
  [key: string]: any;
}

interface SeedPage {
  data: any[];
  total: number;
  hasMore: boolean;
  fetchedAt: number; // timestamp for cache freshness
}
interface FleetContextType {
  data: FleetData | null;
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  fetchData: () => void;
  openCreateModal: (type: string) => void;
  openEditModal: (type: string, item: any) => void;
  handleDelete: (type: string, id: string) => void;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  modalType: string;
  formData: any;
  updateForm: (key: string, value: any) => void;
  handleSave: () => void;
  saving: boolean;
  editId: string | null;
  repairsSeed: SeedPage | null;
  inspectionsSeed: SeedPage | null;
  rentalsSeed: any[] | null;
  showReturned: boolean;
  setShowReturned: (v: boolean) => void;
  showCompleted: boolean;
  setShowCompleted: (v: boolean) => void;
  showStandardOnly: boolean;
  setShowStandardOnly: (v: boolean) => void;
}

const FleetContext = createContext<FleetContextType | null>(null);

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetLayout");
  return ctx;
}

// ── Tabs config ───────────────────────────────────────────────────────
const tabs = [
  { id: "overview", label: "Overview", permModule: "Overview", icon: IconChartDonut, href: "/fleet" },
  { id: "vehicles", label: "Vehicles", permModule: "Vehicles", icon: IconCar, href: "/fleet/vehicles" },
  { id: "repairs", label: "Repairs", permModule: "Repairs", icon: IconTool, href: "/fleet/repairs" },
  { id: "inspections", label: "Inspections", permModule: "Inspections", icon: IconClipboardCheck, href: "/fleet/inspections" },
  { id: "rentals", label: "Rental Agreements", permModule: "Rental Agreements", icon: IconFileInvoice, href: "/fleet/rentals" },
];

// ── Layout ────────────────────────────────────────────────────────────
export default function FleetLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setRightContent, setLeftContent } = useHeaderActions();
  const store = useDataStore();

  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Permissions for tab filtering — read from sidebar cache (already loaded by sidebar)
  const [permissions, setPermissions] = useState<any[]>(() => {
    // Sidebar loads before fleet layout, so cache is usually already populated
    if (sidebarCache) {
      return sidebarCache.isAdmin ? [] : sidebarCache.permissions;
    }
    return [];
  });

  // Prefetched first pages — populated on layout mount, consumed by tab pages
  const [repairsSeed, setRepairsSeed] = useState<SeedPage | null>(null);
  const [inspectionsSeed, setInspectionsSeed] = useState<SeedPage | null>(null);
  const [rentalsSeed, setRentalsSeed] = useState<any[] | null>(null);
  const [showReturned, setShowReturned] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showStandardOnly, setShowStandardOnly] = useState(false);

  // Fallback: if sidebar cache wasn't ready, fetch permissions
  useEffect(() => {
    if (sidebarCache) return; // Already have permissions from cache
    fetch("/api/user/permissions")
      .then(r => r.json())
      .then(d => {
        if (d.role === "Super Admin") {
          setPermissions([]);
        } else {
          setPermissions(d.permissions || []);
        }
      })
      .catch(() => setPermissions([]));
  }, []);

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter(tab => {
    if (permissions.length === 0) return true; // Super Admin or no restrictions
    const perm = permissions.find((p: any) => p.module === tab.permModule);
    if (!perm) return true; // Not in permissions array → allowed by default
    return perm.actions?.view !== false;
  });

  // Redirect to first allowed tab if current page is not permitted
  const isOnRestrictedPage = (() => {
    if (visibleTabs.length === 0) return false;
    const currentTab = tabs.find(t => t.href === pathname || (t.href === "/fleet" && pathname === "/fleet"));
    if (!currentTab) return false; // Detail page or unknown, allow
    return !visibleTabs.find(t => t.id === currentTab.id);
  })();

  useEffect(() => {
    if (isOnRestrictedPage && visibleTabs.length > 0) {
      router.replace(visibleTabs[0].href);
    }
  }, [isOnRestrictedPage, visibleTabs, router]);

  // ── Hydrate from global data store for instant load ──
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (store.initialized && store.fleet.dashboard) {
      hydratedRef.current = true;
      // Use prefetched data — instant, zero loading
      setData({ ...store.fleet.dashboard, vehicles: store.fleet.vehicles || [] });
      const rep = store.fleet.repairs;
      if (rep) setRepairsSeed({ data: rep.data ?? [], total: rep.total ?? 0, hasMore: rep.hasMore ?? false, fetchedAt: Date.now() });
      const ins = store.fleet.inspections;
      if (ins) setInspectionsSeed({ data: ins.data ?? [], total: ins.total ?? 0, hasMore: ins.hasMore ?? false, fetchedAt: Date.now() });
      if (store.fleet.rentals?.length) setRentalsSeed(store.fleet.rentals);
      setLoading(false);
    }
  }, [store.initialized, store.fleet]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fire ALL fetches in parallel — everything loads at once
      const [dashRes, vehRes, repRes, insRes, renRes] = await Promise.all([
        fetch("/api/fleet?section=dashboard"),
        fetch(`/api/fleet?section=vehicles${showReturned ? "&includeReturned=true" : ""}`),
        fetch(`/api/fleet?section=repairs&skip=0&limit=50${showCompleted ? "" : "&excludeCompleted=true"}`),
        fetch("/api/fleet?section=inspections&skip=0&limit=50"),
        fetch("/api/fleet?section=rentals"),
      ]);

      const [dashData, vehData, repData, insData, renData] = await Promise.all([
        dashRes.ok ? dashRes.json() : {},
        vehRes.ok ? vehRes.json() : {},
        repRes.ok ? repRes.json() : null,
        insRes.ok ? insRes.json() : null,
        renRes.ok ? renRes.json() : null,
      ]);

      // Merge dashboard + vehicles into data
      setData({ ...dashData, vehicles: (vehData as any).vehicles || [] });

      // Populate seeds for sub-pages — instant display on tab switch
      if (repData) setRepairsSeed({ data: repData.repairs ?? [], total: repData.total ?? 0, hasMore: repData.hasMore ?? false, fetchedAt: Date.now() });
      if (insData) setInspectionsSeed({ data: insData.inspections ?? [], total: insData.total ?? 0, hasMore: insData.hasMore ?? false, fetchedAt: Date.now() });
      if (renData) setRentalsSeed(renData.rentals ?? []);
    } catch (err) {
      console.error("Failed to fetch fleet data:", err);
    } finally {
      setLoading(false);
    }
  }, [showReturned, showCompleted]);

  // Re-fetch vehicles when showReturned changes (after initial mount)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    // Only re-fetch vehicles, not the whole dashboard
    (async () => {
      try {
        const vehRes = await fetch(`/api/fleet?section=vehicles${showReturned ? "&includeReturned=true" : ""}`);
        const vehData = vehRes.ok ? await vehRes.json() : {};
        setData((prev) => prev ? { ...prev, vehicles: (vehData as any).vehicles || [] } : prev);
      } catch (err) {
        console.error("Failed to re-fetch vehicles:", err);
      }
    })();
  }, [showReturned]);

  useEffect(() => {
    // Skip fetch if already hydrated from global store
    if (hydratedRef.current) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  const openCreateModal = useCallback((type: string) => {
    setModalType(type);
    setEditId(null);
    setFormData({});
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((type: string, item: any) => {
    setModalType(type);
    setFormData({ ...item });
    setEditId(item._id);
    setModalOpen(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { type: modalType, id: editId, data: formData }
        : { type: modalType, data: formData };
      const res = await fetch("/api/fleet", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setModalOpen(false); fetchData(); }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await fetch(`/api/fleet?type=${type}&id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const updateForm = (key: string, value: any) =>
    setFormData((prev: any) => ({ ...prev, [key]: value }));

  // Determine active tab from pathname (used for header content)
  const isVehiclesPage = pathname === "/fleet/vehicles";
  const isRepairsPage = pathname === "/fleet/repairs";
  const isInspectionsPage = pathname === "/fleet/inspections";
  const isRentalsPage = pathname === "/fleet/rentals";
  // Detail pages (e.g. /fleet/inspections/[id]) — 3+ segments after splitting
  const isDetailPage = pathname.replace("/fleet/", "").split("/").filter(Boolean).length >= 2;
  const vehicleCount = data?.vehicles?.length ?? 0;
  const rentalsCount = rentalsSeed?.length ?? 0;

  // Stable ref so search input's onChange never needs to recreate
  const setSearchRef = useRef(setSearch);
  setSearchRef.current = setSearch;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clear search when navigating between fleet pages
  useEffect(() => {
    setSearch("");
    if (searchInputRef.current) searchInputRef.current.value = "";
  }, [pathname, setSearch]);

  // Inject header content — only on LIST pages, not detail pages (detail pages set their own header buttons)
  useEffect(() => {
    // Skip if we're on a detail page — the detail component handles its own header
    if (isDetailPage) return;

    // Left: page title with count
    if (isVehiclesPage) {
      setLeftContent(
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Fleet - Vehicles
          </h1>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {vehicleCount}
          </span>
        </div>
      );
    } else if (isRentalsPage) {
      setLeftContent(
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Fleet – Rental Agreements
          </h1>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {rentalsCount}
          </span>
        </div>
      );
    } else if (!isRepairsPage && !isInspectionsPage) {
      setLeftContent(null);
    }

    setRightContent(
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Uncontrolled input — ref-driven so it never loses focus */}
        <div className="relative">
          <IconSearch size={14} className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            defaultValue=""
            onChange={(e) => setSearchRef.current(e.target.value)}
            placeholder="Search..."
            className="pl-7 sm:pl-8 pr-2 sm:pr-3 py-1 sm:py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 w-24 sm:w-48"
          />
        </div>
        {isVehiclesPage && (
          <>
            {/* Toggle for showing returned vehicles */}
            <button
              onClick={() => setShowReturned(!showReturned)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex-shrink-0 border ${showReturned
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              title={showReturned ? "Hide returned vehicles" : "Show returned vehicles"}
            >
              <IconRotate2 size={14} />
              <span className="hidden sm:inline">Returned</span>
              {/* Toggle indicator */}
              <div className={`w-6 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${showReturned ? "bg-amber-500" : "bg-muted-foreground/30"
                }`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all ${showReturned ? "left-3" : "left-0.5"
                  }`} />
              </div>
            </button>
            <button
              onClick={() => openCreateModal("vehicle")}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0"
            >
              <IconPlus size={14} />
              <span className="hidden sm:inline">Add</span>
            </button>
          </>
        )}
        {isRepairsPage && (
          <>
            {/* Toggle for showing completed repairs */}
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex-shrink-0 border ${showCompleted
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              title={showCompleted ? "Hide completed repairs" : "Show completed repairs"}
            >
              <IconCheck size={14} />
              <span className="hidden sm:inline">Completed</span>
              <div className={`w-6 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${showCompleted ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all ${showCompleted ? "left-3" : "left-0.5"
                  }`} />
              </div>
            </button>
            <button
              onClick={() => openCreateModal("repair")}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0"
            >
              <IconPlus size={14} />
              <span className="hidden sm:inline">Add Repair</span>
            </button>
          </>
        )}
        {isInspectionsPage && (
          <>
            <button
              onClick={() => setShowStandardOnly(!showStandardOnly)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex-shrink-0 border ${showStandardOnly
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              title={showStandardOnly ? "Show all inspections" : "Show only master photo inspections"}
            >
              <span className="text-sm leading-none">{showStandardOnly ? "★" : "☆"}</span>
              <span className="hidden sm:inline">Master Only</span>
              <div className={`w-6 h-3.5 rounded-full transition-colors relative flex-shrink-0 ${showStandardOnly ? "bg-amber-500" : "bg-muted-foreground/30"
                }`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all ${showStandardOnly ? "left-3" : "left-0.5"
                  }`} />
              </div>
            </button>
            <button
              onClick={() => openCreateModal("inspection")}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0"
            >
              <IconPlus size={14} />
              <span className="hidden sm:inline">Add Inspection</span>
            </button>
          </>
        )}
        {isRentalsPage && (
          <button
            onClick={() => openCreateModal("rental")}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0"
          >
            <IconPlus size={14} />
            <span className="hidden sm:inline">Add Rental</span>
          </button>
        )}
      </div>
    );
    return () => {
      setRightContent(null);
      setLeftContent(null);
    };
  }, [setRightContent, setLeftContent, isVehiclesPage, isRepairsPage, isInspectionsPage, isRentalsPage, isDetailPage, vehicleCount, rentalsCount, openCreateModal, pathname, showReturned, showCompleted, showStandardOnly]);

  // Determine active tab from pathname (first segment after /fleet/)
  const activeTab = (() => {
    if (pathname === "/fleet" || pathname === "/fleet/overview") return "overview";
    const seg = pathname.replace("/fleet/", "").split("/")[0];
    return seg || "overview";
  })();

  return (
    <FleetContext.Provider value={{
      data, loading, search, setSearch, fetchData,
      openCreateModal, openEditModal, handleDelete,
      modalOpen, setModalOpen, modalType, formData, updateForm, handleSave, saving, editId,
      repairsSeed, inspectionsSeed, rentalsSeed,
      showReturned, setShowReturned,
      showCompleted, setShowCompleted,
      showStandardOnly, setShowStandardOnly,
    }}>
      <div className="flex flex-col w-full h-[calc(100vh-var(--header-height)-2rem)]">

        {/* ── Tab Navigation (sticky) ──────────────────────────── */}
        <div data-tab-nav className="flex-shrink-0 flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch={true}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 select-none ${activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </Link>
          ))}
        </div>

        {/* ── Page Content (fills remaining height, scrollable) ── */}
        <div className="flex-1 min-h-0 mt-3 rounded-[var(--radius-xl)] bg-card overflow-y-auto p-4">
          {isOnRestrictedPage ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : children}
        </div>
      </div>
    </FleetContext.Provider>
  );
}
