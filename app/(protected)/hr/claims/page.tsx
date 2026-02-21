"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconReportAnalytics } from "@tabler/icons-react";

export default function ClaimsDashboardPage() {
  return (
    <ComingSoonTab
      title="Claims Dashboard"
      description="Monitor insurance claims, worker's compensation cases, and dispute resolution status across your workforce."
      icon={IconReportAnalytics}
      accentColor="from-blue-500 to-indigo-500"
    />
  );
}
