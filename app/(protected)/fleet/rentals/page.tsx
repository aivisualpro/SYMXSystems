"use client";

import React from "react";
import { IconFileInvoice, IconEdit, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { useFleet } from "../layout";
import { GlassCard, SectionHeader, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

export default function FleetRentalsPage() {
  const { loading, rentalsSeed, openCreateModal, openEditModal, handleDelete } = useFleet();

  // Use cached rentals from the layout — no separate fetch needed
  const rentals = rentalsSeed ?? [];

  if (loading) return <FleetLoading />;

  return (
    <>
      <GlassCard className="p-4">
        <SectionHeader title="Rental Agreements" icon={IconFileInvoice} count={rentals.length} onAdd={() => openCreateModal("rental")} />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              {["Unit #", "Agreement #", "Invoice #", "Start", "End", "Due Date", "Amount", "Files", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rentals.map((ra: any) => (
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
          {rentals.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">No rental agreements.</p>}
        </div>
      </GlassCard>
      <FleetFormModal />
    </>
  );
}
