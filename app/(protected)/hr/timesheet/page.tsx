"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconClock } from "@tabler/icons-react";

export default function TimesheetPage() {
  return (
    <ComingSoonTab
      title="Timesheet"
      description="View and manage employee timesheets, track hours worked, overtime, and time-off balances with detailed reporting."
      icon={IconClock}
      accentColor="from-cyan-500 to-blue-500"
    />
  );
}
