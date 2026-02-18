"use client";

import React from "react";
import { IconParking } from "@tabler/icons-react";
import { useFleet } from "../layout";
import { GlassCard, SectionHeader, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

export default function FleetSlotsPage() {
  const { data, loading, openCreateModal, openEditModal } = useFleet();

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
      <GlassCard className="p-4">
        <SectionHeader title="Vehicle Slots" icon={IconParking} count={data.slots.length} onAdd={() => openCreateModal("slot")} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {data.slots.map((s: any) => (
            <div key={s._id} onClick={() => openEditModal("slot", s)} className="relative cursor-pointer p-3 rounded-xl border border-border bg-muted/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-primary/30">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{s.vehicleSlotNumber}</p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{s.location || "No location"}</p>
              </div>
            </div>
          ))}
          {data.slots.length === 0 && <p className="col-span-full text-center py-10 text-xs text-muted-foreground/50">No slots created. Click &quot;Add&quot; to create your first slot.</p>}
        </div>
      </GlassCard>
      <FleetFormModal />
    </>
  );
}
