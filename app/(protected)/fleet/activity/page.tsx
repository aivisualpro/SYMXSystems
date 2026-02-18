"use client";

import React from "react";
import { IconActivity, IconEdit, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { useFleet } from "../layout";
import { GlassCard, SectionHeader, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

export default function FleetActivityPage() {
  const { data, loading, openCreateModal, openEditModal, handleDelete } = useFleet();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
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
      <FleetFormModal />
    </>
  );
}
