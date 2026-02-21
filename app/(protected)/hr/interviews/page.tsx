"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconUserSearch } from "@tabler/icons-react";

export default function InterviewsPage() {
  return (
    <ComingSoonTab
      title="Interviews"
      description="Schedule, track, and manage candidate interviews with automated reminders, scoring rubrics, and feedback collection."
      icon={IconUserSearch}
      accentColor="from-rose-500 to-pink-500"
    />
  );
}
