"use client";

import React from "react";
import {
  IconCar, IconCheck, IconTool, IconAlertTriangle, IconParking,
  IconGasStation, IconChartDonut, IconSteeringWheel, IconEdit, IconTrash,
} from "@tabler/icons-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";
import { useFleet } from "./layout";
import { KPICard, GlassCard, SectionHeader, StatusBadge, FleetLoading } from "./components/fleet-ui";
import FleetFormModal from "./components/fleet-form-modal";

export default function FleetOverviewPage() {
  const { data, loading, search, openCreateModal, openEditModal, handleDelete } = useFleet();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load fleet data</div>;

  const { kpis } = data;

  return (
    <>
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
            {data.vehicles.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No vehicles added yet.</p>}
          </div>
        </GlassCard>
      </div>
      <FleetFormModal />
    </>
  );
}
