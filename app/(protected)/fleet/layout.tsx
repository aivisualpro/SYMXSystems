"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  IconChartDonut, IconCar, IconParking, IconTool, IconClipboardCheck,
  IconFileInvoice, IconActivity, IconRefresh, IconSearch,
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
  slots: any[];
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
  { id: "slots", label: "Vehicle Slots", icon: IconParking, href: "/fleet/slots" },
  { id: "repairs", label: "Repairs", icon: IconTool, href: "/fleet/repairs" },
  { id: "inspections", label: "Inspections", icon: IconClipboardCheck, href: "/fleet/inspections" },
  { id: "rentals", label: "Rental Agreements", icon: IconFileInvoice, href: "/fleet/rentals" },
  { id: "activity", label: "Activity Logs", icon: IconActivity, href: "/fleet/activity" },
];

// ── Layout ────────────────────────────────────────────────────────────
export default function FleetLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setRightContent } = useHeaderActions();

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

  const openCreateModal = (type: string) => {
    setModalType(type);
    setEditId(null);
    if (type === "slot" && data) {
      const slotNumbers = data.slots.map((s: any) => parseInt(s.vehicleSlotNumber, 10) || 0);
      const maxNum = slotNumbers.length > 0 ? Math.max(...slotNumbers) : 0;
      setFormData({ vehicleSlotNumber: String(maxNum + 1).padStart(4, "0") });
    } else {
      setFormData({});
    }
    setModalOpen(true);
  };

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

  // Inject search + refresh into site header
  useEffect(() => {
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
        <button
          onClick={() => fetchData()}
          className="p-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <IconRefresh size={14} />
        </button>
      </div>
    );
    return () => setRightContent(null);
  }, [search, setRightContent, fetchData]);

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
        {/* ── Tab Navigation ─────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
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
