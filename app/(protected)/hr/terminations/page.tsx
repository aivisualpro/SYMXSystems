"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconUserOff } from "@tabler/icons-react";

export default function TerminationsPage() {
  return (
    <ComingSoonTab
      title="Terminations"
      description="Handle employee separations with structured offboarding checklists, final pay processing, and exit documentation."
      icon={IconUserOff}
      accentColor="from-red-500 to-rose-500"
    />
  );
}
