"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconUserCheck } from "@tabler/icons-react";

export default function HiredPage() {
  return (
    <ComingSoonTab
      title="Hired"
      description="Track newly hired employees, monitor their integration progress, and manage probation period milestones."
      icon={IconUserCheck}
      accentColor="from-teal-500 to-cyan-500"
    />
  );
}
