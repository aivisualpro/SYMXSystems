"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  IconChartDonut, IconCar, IconTool, IconClipboardCheck,
  IconFileInvoice, IconSearch, IconPlus,
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
}

const FleetContext = createContext<FleetContextType | null>(null);

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetLayout");
  return ctx;
}

// ── Tabs config ───────────────────────────────────────────────────────
const tabs = [
  { id: "overview", label: "Overview", icon: IconChartDonut, href: "/fleet" },
  { id: "vehicles", label: "Vehicles", icon: IconCar, href: "/fleet/vehicles" },

  { id: "repairs", label: "Repairs", icon: IconTool, href: "/fleet/repairs" },
  { id: "inspections", label: "Inspections", icon: IconClipboardCheck, href: "/fleet/inspections" },
  { id: "rentals", label: "Rental Agreements", icon: IconFileInvoice, href: "/fleet/rentals" },
];

// ── Layout ────────────────────────────────────────────────────────────
export default function FleetLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setRightContent, setLeftContent } = useHeaderActions();

  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Prefetched first pages — populated on layout mount, consumed by tab pages
  const [repairsSeed, setRepairsSeed] = useState<SeedPage | null>(null);
  const [inspectionsSeed, setInspectionsSeed] = useState<SeedPage | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fleet?section=dashboard");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch fleet data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Prefetch first 100 repairs + 100 inspections once on mount — data ready before user navigates
  useEffect(() => {
    fetchData();
    // Fire both seed fetches in parallel
    Promise.all([
      fetch("/api/fleet?section=repairs&skip=0&limit=100")
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (j) setRepairsSeed({ data: j.repairs ?? [], total: j.total ?? 0, hasMore: j.hasMore ?? false, fetchedAt: Date.now() }); })
        .catch(() => { }),
      fetch("/api/fleet?section=inspections&skip=0&limit=100")
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (j) setInspectionsSeed({ data: j.inspections ?? [], total: j.total ?? 0, hasMore: j.hasMore ?? false, fetchedAt: Date.now() }); })
        .catch(() => { }),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  const openCreateModal = useCallback((type: string) => {
    setModalType(type);
    setEditId(null);
    setFormData({});
    setModalOpen(true);
  }, []);

  const openEditModal = (type: string, item: any) => {
    setModalType(type);
    setFormData({ ...item });
    setEditId(item._id);
    setModalOpen(true);
  };

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
  const vehicleCount = data?.vehicles?.length ?? 0;

  // Stable ref so search input's onChange never needs to recreate
  const setSearchRef = useRef(setSearch);
  setSearchRef.current = setSearch;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clear search when navigating between fleet pages
  useEffect(() => {
    setSearch("");
    if (searchInputRef.current) searchInputRef.current.value = "";
  }, [pathname, setSearch]);

  // Inject header content — only re-runs on page/count changes, NOT on every keystroke
  useEffect(() => {
    // Left: vehicles page shows count; repairs page is handled by repairs page itself
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
    } else if (!isRepairsPage && !isInspectionsPage) {
      // Only clear for pages that manage their own leftContent
      setLeftContent(null);
    }

    setRightContent(
      <div className="flex items-center gap-2">
        {/* Uncontrolled input — ref-driven so it never loses focus */}
        <div className="relative">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            defaultValue=""
            onChange={(e) => setSearchRef.current(e.target.value)}
            placeholder="Search fleet..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 w-48"
          />
        </div>
        {isVehiclesPage && (
          <button
            onClick={() => openCreateModal("vehicle")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <IconPlus size={14} />
            Add
          </button>
        )}
        {isRepairsPage && (
          <button
            onClick={() => openCreateModal("repair")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <IconPlus size={14} />
            Add Repair
          </button>
        )}
      </div>
    );
    return () => {
      setRightContent(null);
      setLeftContent(null);
    };
  }, [setRightContent, setLeftContent, isVehiclesPage, isRepairsPage, isInspectionsPage, vehicleCount, openCreateModal, pathname]);

  // Determine active tab from pathname
  const activeTab = (() => {
    if (pathname === "/fleet" || pathname === "/fleet/overview") return "overview";
    const seg = pathname.replace("/fleet/", "");
    return seg || "overview";
  })();

  return (
    <FleetContext.Provider value={{
      data, loading, search, setSearch, fetchData,
      openCreateModal, openEditModal, handleDelete,
      modalOpen, setModalOpen, modalType, formData, updateForm, handleSave, saving, editId,
      repairsSeed, inspectionsSeed,
    }}>
      <div className="flex flex-col max-w-[1600px] mx-auto h-[calc(100vh-var(--header-height)-2rem)]">

        {/* ── Tab Navigation (sticky) ──────────────────────────── */}
        <div className="flex-shrink-0 flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Page Content (fills remaining height) ──────────── */}
        <div className="flex-1 min-h-0 mt-4">
          {children}
        </div>
      </div>
    </FleetContext.Provider>
  );
}
