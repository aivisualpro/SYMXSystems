"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  IconCar, IconParking, IconTool, IconAlertTriangle, IconChartDonut,
  IconPlus, IconRefresh, IconSearch, IconFilter, IconChevronRight,
  IconTruck, IconGasStation, IconSteeringWheel, IconClipboardCheck,
  IconFileInvoice, IconActivity, IconEye, IconEdit, IconTrash,
  IconX, IconCheck, IconClock, IconMapPin, IconHash, IconId,
  IconCalendar, IconPhoto, IconUpload, IconLoader2,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────
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

type ActiveTab = "overview" | "vehicles" | "slots" | "repairs" | "inspections" | "rentals" | "activity";

// ── Status Colors (work in both light/dark) ────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Maintenance: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Grounded: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  Inactive: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  Empty: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Decommissioned: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "Not Started": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  "In Progress": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Waiting for Parts": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "Sent to Repair Shop": "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Pass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Fail: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Needs Attention": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

// ── Reusable Components ────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="relative group overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-primary/[0.03] group-hover:to-transparent transition-all duration-500" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color} transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUS_COLORS[status] || "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30"}`}>
      {status}
    </span>
  );
}

function SectionHeader({ title, icon: Icon, count, onAdd }: any) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {count !== undefined && (
          <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">{count}</span>
        )}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors">
          <IconPlus size={14} /> Add
        </button>
      )}
    </div>
  );
}

function GlassCard({ children, className = "" }: any) {
  return (
    <div className={`rounded-xl border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

// ── Form Modal ─────────────────────────────────────────────────────────
function FormModal({ open, onClose, title, children, onSubmit, loading }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><IconX size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">{children}</div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50">
              {loading && <IconLoader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }: any) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";
const selectClass = inputClass;

// ── Main Dashboard ────────────────────────────────────────────────────
export default function FleetDashboard() {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
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
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch fleet data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateModal = (type: string) => {
    setModalType(type);
    setFormData({});
    setEditId(null);
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
      if (res.ok) {
        setModalOpen(false);
        fetchData();
      }
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

  const updateForm = (key: string, value: any) => setFormData((prev: any) => ({ ...prev, [key]: value }));

  // ── Tabs ──────────────────────────────────────────────────────────
  const tabs: { id: ActiveTab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: IconChartDonut },
    { id: "vehicles", label: "Vehicles", icon: IconCar },
    { id: "slots", label: "Vehicle Slots", icon: IconParking },
    { id: "repairs", label: "Repairs", icon: IconTool },
    { id: "inspections", label: "Inspections", icon: IconClipboardCheck },
    { id: "rentals", label: "Rental Agreements", icon: IconFileInvoice },
    { id: "activity", label: "Activity Logs", icon: IconActivity },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <IconCar size={20} className="absolute inset-0 m-auto text-primary" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Loading Fleet Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load fleet data</div>;

  const { kpis } = data;

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <IconTruck size={18} className="text-white" />
            </div>
            Fleet Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Real-time fleet operations & management dashboard</p>
        </div>
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
          <button onClick={fetchData} className="p-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Refresh">
            <IconRefresh size={14} />
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* ── Overview Tab ───────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={IconCar} label="Total Fleet" value={kpis.totalVehicles} sub="All vehicles" color="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
            <KPICard icon={IconCheck} label="Active" value={kpis.activeVehicles} sub="Operational" color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
            <KPICard icon={IconTool} label="In Maintenance" value={kpis.maintenanceVehicles} sub="Under service" color="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
            <KPICard icon={IconAlertTriangle} label="Grounded" value={kpis.groundedVehicles} sub="Non-operational" color="bg-red-500/15 text-red-600 dark:text-red-400" />
            <KPICard icon={IconParking} label="Empty Slots" value={kpis.emptySlots} sub={`of ${kpis.totalSlots} total`} color="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
            <KPICard icon={IconGasStation} label="Utilization" value={`${kpis.utilizationRate}%`} sub="Fleet usage" color="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" />
          </div>

          {/* Charts & Repairs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Fleet Status Donut */}
            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <IconChartDonut size={16} className="text-blue-500" /> Fleet Status
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.statusBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                      {data.statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--popover-foreground)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {data.statusBreakdown.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}: {s.value}
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Ownership Donut */}
            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <IconSteeringWheel size={16} className="text-purple-500" /> Ownership
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.ownershipBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                      {data.ownershipBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--popover-foreground)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {data.ownershipBreakdown.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}: {s.value}
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Open Repairs */}
            <GlassCard className="p-4">
              <SectionHeader title="Open Repairs" icon={IconTool} count={data.openRepairs.length} onAdd={() => openCreateModal("repair")} />
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {data.openRepairs.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 text-center py-8">No open repairs 🎉</p>
                ) : (
                  data.openRepairs.slice(0, 8).map((r: any, i: number) => (
                    <div key={r._id || i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{r.description || "Unnamed repair"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{r.unitNumber ? `Unit ${r.unitNumber}` : ""} {r.estimatedDate ? `• Due ${format(new Date(r.estimatedDate), "MMM dd")}` : ""}</p>
                      </div>
                      <StatusBadge status={r.currentStatus} />
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Vehicle List Quick View */}
          <GlassCard className="p-4">
            <SectionHeader title="Fleet Vehicles" icon={IconCar} count={data.vehicles.length} onAdd={() => openCreateModal("vehicle")} />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Unit #", "VIN", "Year", "Make", "Model", "License", "Status", "Location", "Ownership", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.vehicles.filter((v: any) => {
                    if (!search) return true;
                    const s = search.toLowerCase();
                    return (v.unitNumber?.toLowerCase().includes(s) || v.vin?.toLowerCase().includes(s) || v.make?.toLowerCase().includes(s) || v.licensePlate?.toLowerCase().includes(s));
                  }).slice(0, 15).map((v: any) => (
                    <tr key={v._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">{v.unitNumber || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{v.vin?.slice(-6) || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.year || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.make || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.vehicleModel || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.licensePlate || "—"}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={v.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.location || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.ownership || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal("vehicle", v)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                          <button onClick={() => handleDelete("vehicle", v._id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.vehicles.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No vehicles added yet. Click &quot;Add&quot; to get started.</p>}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Vehicles Tab ───────────────────────────────────────────── */}
      {activeTab === "vehicles" && (
        <GlassCard className="p-4">
          <SectionHeader title="All Vehicles" icon={IconCar} count={data.vehicles.length} onAdd={() => openCreateModal("vehicle")} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {["Slot #", "Unit #", "VIN", "Year", "Make", "Model", "License", "State", "Status", "Dashcam", "Provider", "Ownership", "Location", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.vehicles.map((v: any) => (
                  <tr key={v._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.vehicleSlotNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{v.unitNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{v.vin || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.year || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.make || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.vehicleModel || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.licensePlate || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.state || "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={v.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.dashcam || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.vehicleProvider || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.ownership || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.location || "—"}</td>
                    <td className="px-3 py-2.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal("vehicle", v)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                      <button onClick={() => handleDelete("vehicle", v._id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.vehicles.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No vehicles yet.</p>}
          </div>
        </GlassCard>
      )}

      {/* ── Slots Tab ──────────────────────────────────────────────── */}
      {activeTab === "slots" && (
        <GlassCard className="p-4">
          <SectionHeader title="Vehicle Slots" icon={IconParking} count={data.slots.length} onAdd={() => openCreateModal("slot")} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {data.slots.map((s: any) => (
              <div key={s._id} onClick={() => openEditModal("slot", s)} className={`relative cursor-pointer p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
                s.status === "Active" ? "border-emerald-500/30 bg-emerald-500/[0.06]" :
                s.status === "Maintenance" ? "border-amber-500/30 bg-amber-500/[0.06]" :
                s.status === "Inactive" ? "border-red-500/30 bg-red-500/[0.06]" :
                "border-border bg-muted/30"
              }`}>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{s.vehicleSlotNumber}</p>
                  <StatusBadge status={s.status} />
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{s.location || "No location"}</p>
                  {s.currentVIN && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{s.currentVIN.slice(-6)}</p>}
                </div>
              </div>
            ))}
            {data.slots.length === 0 && <p className="col-span-full text-center py-10 text-xs text-muted-foreground/50">No slots created. Click &quot;Add&quot; to create your first slot.</p>}
          </div>
        </GlassCard>
      )}

      {/* ── Repairs Tab ────────────────────────────────────────────── */}
      {activeTab === "repairs" && (
        <GlassCard className="p-4">
          <SectionHeader title="Vehicle Repairs" icon={IconTool} count={data.openRepairs.length} onAdd={() => openCreateModal("repair")} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {["Unit #", "Description", "Status", "Estimated Date", "Duration (days)", "Created", "Last Edit", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.openRepairs.map((r: any) => (
                  <tr key={r._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{r.unitNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{r.description || "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={r.currentStatus} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.estimatedDate ? format(new Date(r.estimatedDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.repairDuration || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.creationDate ? format(new Date(r.creationDate), "MMM dd") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.lastEditOn ? format(new Date(r.lastEditOn), "MMM dd") : "—"}</td>
                    <td className="px-3 py-2.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal("repair", r)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                      <button onClick={() => handleDelete("repair", r._id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.openRepairs.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No repairs.</p>}
          </div>
        </GlassCard>
      )}

      {/* ── Inspections Tab ────────────────────────────────────────── */}
      {activeTab === "inspections" && (
        <GlassCard className="p-4">
          <SectionHeader title="Vehicle Inspections" icon={IconClipboardCheck} count={data.recentInspections.length} onAdd={() => openCreateModal("inspection")} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {["Unit #", "Type", "Inspector", "Date", "Result", "Mileage", "Defects", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.recentInspections.map((ins: any) => (
                  <tr key={ins._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{ins.unitNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ins.inspectionType || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ins.inspectorName || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ins.inspectionDate ? format(new Date(ins.inspectionDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={ins.overallResult} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ins.mileage ? ins.mileage.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{ins.defectsFound || "None"}</td>
                    <td className="px-3 py-2.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal("inspection", ins)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                      <button onClick={() => handleDelete("inspection", ins._id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recentInspections.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No inspections.</p>}
          </div>
        </GlassCard>
      )}

      {/* ── Rental Agreements Tab ──────────────────────────────────── */}
      {activeTab === "rentals" && (
        <GlassCard className="p-4">
          <SectionHeader title="Rental Agreements" icon={IconFileInvoice} count={data.rentalAgreements.length} onAdd={() => openCreateModal("rental")} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {["Unit #", "Agreement #", "Invoice #", "Start", "End", "Due Date", "Amount", "Files", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.rentalAgreements.map((ra: any) => (
                  <tr key={ra._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{ra.unitNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ra.agreementNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ra.invoiceNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ra.registrationStartDate ? format(new Date(ra.registrationStartDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ra.registrationEndDate ? format(new Date(ra.registrationEndDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ra.dueDate ? format(new Date(ra.dueDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{ra.amount ? `$${ra.amount.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{ra.rentalAgreementFilesImages?.length || 0} files</td>
                    <td className="px-3 py-2.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal("rental", ra)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                      <button onClick={() => handleDelete("rental", ra._id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rentalAgreements.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No rental agreements.</p>}
          </div>
        </GlassCard>
      )}

      {/* ── Activity Logs Tab ──────────────────────────────────────── */}
      {activeTab === "activity" && (
        <GlassCard className="p-4">
          <SectionHeader title="Activity Logs" icon={IconActivity} count={data.recentActivity.length} onAdd={() => openCreateModal("activity")} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {["VIN", "Service Type", "Mileage", "Start Date", "End Date", "Reg. Expiry", "Notes", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.recentActivity.map((a: any) => (
                  <tr key={a._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{a.vin?.slice(-6) || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.serviceType || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.mileage ? a.mileage.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.startDate ? format(new Date(a.startDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.endDate ? format(new Date(a.endDate), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.registrationExpiration ? format(new Date(a.registrationExpiration), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{a.notes || "—"}</td>
                    <td className="px-3 py-2.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal("activity", a)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                      <button onClick={() => handleDelete("activity", a._id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recentActivity.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No activity logs.</p>}
          </div>
        </GlassCard>
      )}

      {/* ── Create/Edit Modal ──────────────────────────────────────── */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={`${editId ? "Edit" : "New"} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`} onSubmit={handleSave} loading={saving}>
        {modalType === "vehicle" && (<>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="VIN"><input className={inputClass} value={formData.vin || ""} onChange={e => updateForm("vin", e.target.value)} placeholder="Vehicle VIN" required /></FormField>
            <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} placeholder="Unit #" /></FormField>
            <FormField label="Year"><input className={inputClass} value={formData.year || ""} onChange={e => updateForm("year", e.target.value)} placeholder="2024" /></FormField>
            <FormField label="Make"><input className={inputClass} value={formData.make || ""} onChange={e => updateForm("make", e.target.value)} placeholder="Ford" /></FormField>
            <FormField label="Model"><input className={inputClass} value={formData.vehicleModel || ""} onChange={e => updateForm("vehicleModel", e.target.value)} placeholder="Transit" /></FormField>
            <FormField label="License Plate"><input className={inputClass} value={formData.licensePlate || ""} onChange={e => updateForm("licensePlate", e.target.value)} /></FormField>
            <FormField label="Status"><select className={selectClass} value={formData.status || "Active"} onChange={e => updateForm("status", e.target.value)}>
              {["Active","Inactive","Maintenance","Grounded","Decommissioned"].map(s => <option key={s} value={s}>{s}</option>)}
            </select></FormField>
            <FormField label="Ownership"><select className={selectClass} value={formData.ownership || "Owned"} onChange={e => updateForm("ownership", e.target.value)}>
              {["Owned","Leased","Rented"].map(s => <option key={s} value={s}>{s}</option>)}
            </select></FormField>
            <FormField label="State"><input className={inputClass} value={formData.state || ""} onChange={e => updateForm("state", e.target.value)} /></FormField>
            <FormField label="Location"><input className={inputClass} value={formData.location || ""} onChange={e => updateForm("location", e.target.value)} /></FormField>
            <FormField label="Dashcam"><input className={inputClass} value={formData.dashcam || ""} onChange={e => updateForm("dashcam", e.target.value)} /></FormField>
            <FormField label="Provider"><input className={inputClass} value={formData.vehicleProvider || ""} onChange={e => updateForm("vehicleProvider", e.target.value)} /></FormField>
          </div>
          <FormField label="Info"><textarea className={inputClass} rows={2} value={formData.info || ""} onChange={e => updateForm("info", e.target.value)} /></FormField>
        </>)}

        {modalType === "slot" && (<>
          <FormField label="Location"><input className={inputClass} value={formData.location || ""} onChange={e => updateForm("location", e.target.value)} placeholder="Lot A, Bay 1" /></FormField>
          <FormField label="Status"><select className={selectClass} value={formData.status || "Empty"} onChange={e => updateForm("status", e.target.value)}>
            {["Active","Inactive","Maintenance","Empty"].map(s => <option key={s} value={s}>{s}</option>)}
          </select></FormField>
          <FormField label="Current VIN"><input className={inputClass} value={formData.currentVIN || ""} onChange={e => updateForm("currentVIN", e.target.value)} /></FormField>
        </>)}

        {modalType === "repair" && (<>
          <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} /></FormField>
          <FormField label="Description"><textarea className={inputClass} rows={3} value={formData.description || ""} onChange={e => updateForm("description", e.target.value)} required /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Status"><select className={selectClass} value={formData.currentStatus || "Not Started"} onChange={e => updateForm("currentStatus", e.target.value)}>
              {["Not Started","In Progress","Waiting for Parts","Sent to Repair Shop","Completed"].map(s => <option key={s} value={s}>{s}</option>)}
            </select></FormField>
            <FormField label="Estimated Date"><input type="date" className={inputClass} value={formData.estimatedDate ? formData.estimatedDate.split("T")[0] : ""} onChange={e => updateForm("estimatedDate", e.target.value)} /></FormField>
            <FormField label="Duration (days)"><input type="number" className={inputClass} value={formData.repairDuration || ""} onChange={e => updateForm("repairDuration", parseInt(e.target.value) || 0)} /></FormField>
          </div>
        </>)}

        {modalType === "inspection" && (<>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} /></FormField>
            <FormField label="Inspector Name"><input className={inputClass} value={formData.inspectorName || ""} onChange={e => updateForm("inspectorName", e.target.value)} /></FormField>
            <FormField label="Type"><select className={selectClass} value={formData.inspectionType || "Pre-Trip"} onChange={e => updateForm("inspectionType", e.target.value)}>
              {["Pre-Trip","Post-Trip","Monthly","Annual","DOT","Safety"].map(s => <option key={s} value={s}>{s}</option>)}
            </select></FormField>
            <FormField label="Result"><select className={selectClass} value={formData.overallResult || "Pass"} onChange={e => updateForm("overallResult", e.target.value)}>
              {["Pass","Fail","Needs Attention"].map(s => <option key={s} value={s}>{s}</option>)}
            </select></FormField>
            <FormField label="Date"><input type="date" className={inputClass} value={formData.inspectionDate ? formData.inspectionDate.split("T")[0] : ""} onChange={e => updateForm("inspectionDate", e.target.value)} /></FormField>
            <FormField label="Mileage"><input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} /></FormField>
          </div>
          <FormField label="Defects Found"><textarea className={inputClass} rows={2} value={formData.defectsFound || ""} onChange={e => updateForm("defectsFound", e.target.value)} /></FormField>
          <FormField label="Notes"><textarea className={inputClass} rows={2} value={formData.notes || ""} onChange={e => updateForm("notes", e.target.value)} /></FormField>
        </>)}

        {modalType === "rental" && (<>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} /></FormField>
            <FormField label="Agreement #"><input className={inputClass} value={formData.agreementNumber || ""} onChange={e => updateForm("agreementNumber", e.target.value)} /></FormField>
            <FormField label="Invoice #"><input className={inputClass} value={formData.invoiceNumber || ""} onChange={e => updateForm("invoiceNumber", e.target.value)} /></FormField>
            <FormField label="Amount"><input type="number" className={inputClass} value={formData.amount || ""} onChange={e => updateForm("amount", parseFloat(e.target.value) || 0)} /></FormField>
            <FormField label="Start Date"><input type="date" className={inputClass} value={formData.registrationStartDate ? formData.registrationStartDate.split("T")[0] : ""} onChange={e => updateForm("registrationStartDate", e.target.value)} /></FormField>
            <FormField label="End Date"><input type="date" className={inputClass} value={formData.registrationEndDate ? formData.registrationEndDate.split("T")[0] : ""} onChange={e => updateForm("registrationEndDate", e.target.value)} /></FormField>
            <FormField label="Due Date"><input type="date" className={inputClass} value={formData.dueDate ? formData.dueDate.split("T")[0] : ""} onChange={e => updateForm("dueDate", e.target.value)} /></FormField>
          </div>
        </>)}

        {modalType === "activity" && (<>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="VIN"><input className={inputClass} value={formData.vin || ""} onChange={e => updateForm("vin", e.target.value)} /></FormField>
            <FormField label="Service Type"><input className={inputClass} value={formData.serviceType || ""} onChange={e => updateForm("serviceType", e.target.value)} placeholder="Oil Change, Tire Rotation..." /></FormField>
            <FormField label="Mileage"><input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} /></FormField>
            <FormField label="Start Date"><input type="date" className={inputClass} value={formData.startDate ? formData.startDate.split("T")[0] : ""} onChange={e => updateForm("startDate", e.target.value)} /></FormField>
            <FormField label="End Date"><input type="date" className={inputClass} value={formData.endDate ? formData.endDate.split("T")[0] : ""} onChange={e => updateForm("endDate", e.target.value)} /></FormField>
            <FormField label="Reg. Expiration"><input type="date" className={inputClass} value={formData.registrationExpiration ? formData.registrationExpiration.split("T")[0] : ""} onChange={e => updateForm("registrationExpiration", e.target.value)} /></FormField>
          </div>
          <FormField label="Notes"><textarea className={inputClass} rows={3} value={formData.notes || ""} onChange={e => updateForm("notes", e.target.value)} /></FormField>
        </>)}
      </FormModal>
    </div>
  );
}
