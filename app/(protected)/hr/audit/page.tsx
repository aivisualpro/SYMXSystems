"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconFileSearch } from "@tabler/icons-react";

export default function EmployeeAuditPage() {
  return (
    <ComingSoonTab
      title="Employee Audit"
      description="Review employee records for compliance, track document expirations, and ensure all required certifications are up to date."
      icon={IconFileSearch}
      accentColor="from-amber-500 to-orange-500"
    />
  );
}
