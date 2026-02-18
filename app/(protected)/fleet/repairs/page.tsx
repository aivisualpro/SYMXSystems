"use client";

import React from "react";
import { IconTool, IconEdit, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { useFleet } from "../layout";
import { GlassCard, SectionHeader, StatusBadge, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

export default function FleetRepairsPage() {
  const { data, loading, openCreateModal, openEditModal, handleDelete } = useFleet();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
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
      <FleetFormModal />
    </>
  );
}
