"use client";

import React from "react";
import { IconCar, IconEdit, IconTrash } from "@tabler/icons-react";
import { useFleet } from "../layout";
import { GlassCard, SectionHeader, StatusBadge, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

export default function FleetVehiclesPage() {
  const { data, loading, openCreateModal, openEditModal, handleDelete } = useFleet();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
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
      <FleetFormModal />
    </>
  );
}
