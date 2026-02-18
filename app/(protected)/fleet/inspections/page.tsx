"use client";

import React from "react";
import { IconClipboardCheck, IconEdit, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { useFleet } from "../layout";
import { GlassCard, SectionHeader, StatusBadge, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

export default function FleetInspectionsPage() {
  const { data, loading, openCreateModal, openEditModal, handleDelete } = useFleet();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
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
      <FleetFormModal />
    </>
  );
}
