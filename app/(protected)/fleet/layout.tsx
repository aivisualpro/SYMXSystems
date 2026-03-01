"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  IconChartDonut, IconCar, IconTool, IconClipboardCheck,
  IconFileInvoice, IconActivity, IconRefresh, IconSearch, IconPlus, IconUpload,
} from "@tabler/icons-react";

// ── Fleet Context ─────────────────────────────────────────────────────
interface FleetData {
  kpis: any;
  statusBreakdown: any[];
  ownershipBreakdown: any[];
  repairStatusBreakdown: any[];
  openRepairs: any[];
  recentActivity: any[];
  recentInspections: any[];
  rentalAgreements: any[];
  vehicles: any[];

}

interface FleetContextType {
  data: FleetData | null;
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  fetchData: () => Promise<void>;
  openCreateModal: (type: string) => void;
  openEditModal: (type: string, item: any) => void;
  handleDelete: (type: string, id: string) => void;
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  modalType: string;
  formData: any;
  updateForm: (key: string, value: any) => void;
  handleSave: () => Promise<void>;
  saving: boolean;
  editId: string | null;
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
  { id: "activity", label: "Activity Logs", icon: IconActivity, href: "/fleet/activity" },
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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  // ── Fleet Repairs CSV Import ──────────────────────────────────────────
  const repairFileRef = useRef<HTMLInputElement>(null);
  const [importingRepairs, setImportingRepairs] = useState(false);

  const handleRepairImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportingRepairs(true);
    try {
      const parsed: any[] = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data as any[]),
          error: (err) => reject(err),
        });
      });

      if (parsed.length === 0) {
        toast.error("CSV file is empty or has no valid rows");
        setImportingRepairs(false);
        return;
      }

      const CHUNK_SIZE = 500;
      const chunks: any[][] = [];
      for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
        chunks.push(parsed.slice(i, i + CHUNK_SIZE));
      }

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        toast.info(`Uploading batch ${i + 1} of ${chunks.length}...`);
        const res = await fetch("/api/admin/imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "fleet-repairs", data: chunks[i] }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Import failed on batch ${i + 1}`);
        totalInserted += result.inserted || 0;
        totalUpdated += result.updated || 0;
        totalCount += result.count || 0;
      }

      toast.success(`Imported ${totalCount} repairs (${totalInserted} new, ${totalUpdated} updated)`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Fleet repairs import failed");
    } finally {
      setImportingRepairs(false);
    }
  };

  // Determine active tab from pathname (used for header content)
  const isVehiclesPage = pathname === "/fleet/vehicles";
  const vehicleCount = data?.vehicles?.length ?? 0;

  // Inject search + refresh + add into site header
  useEffect(() => {
    // Show counter in left header on the vehicles page
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
    } else {
      setLeftContent(null);
    }

    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 w-48"
          />
        </div>
        {isVehiclesPage && (
          <>
            <button
              onClick={() => repairFileRef.current?.click()}
              disabled={importingRepairs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Import Fleet Repairs CSV"
            >
              <IconUpload size={14} className={importingRepairs ? "animate-pulse" : ""} />
              {importingRepairs ? "Importing..." : "Import Repairs"}
            </button>
            <button
              onClick={() => openCreateModal("vehicle")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <IconPlus size={14} />
              Add
            </button>
          </>
        )}
        <button
          onClick={() => fetchData()}
          className="p-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <IconRefresh size={14} />
        </button>
      </div>
    );
    return () => {
      setRightContent(null);
      setLeftContent(null);
    };
  }, [search, setRightContent, setLeftContent, fetchData, isVehiclesPage, vehicleCount, openCreateModal, importingRepairs]);

  // Hidden file input for repair CSV import
  const repairImportInput = (
    <input
      type="file"
      ref={repairFileRef}
      className="hidden"
      accept=".csv"
      onChange={handleRepairImport}
    />
  );

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
    }}>
      <div className="space-y-4 max-w-[1600px] mx-auto">
        {/* Hidden file input for fleet repairs CSV import */}
        {repairImportInput}

        {/* ── Tab Navigation ─────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
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

        {/* ── Page Content ────────────────────────────────────────── */}
        {children}
      </div>
    </FleetContext.Provider>
  );
}
