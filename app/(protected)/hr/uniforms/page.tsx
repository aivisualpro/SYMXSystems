"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconShirt } from "@tabler/icons-react";

export default function UniformsPage() {
  return (
    <ComingSoonTab
      title="Uniforms"
      description="Manage uniform inventory, track issuance and returns, and handle size exchanges and replacement requests."
      icon={IconShirt}
      accentColor="from-indigo-500 to-purple-500"
    />
  );
}
