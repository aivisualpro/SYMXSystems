"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconUserPlus } from "@tabler/icons-react";

export default function OnboardingPage() {
  return (
    <ComingSoonTab
      title="Onboarding"
      description="Streamline new hire onboarding with task checklists, document collection, training schedules, and welcome workflows."
      icon={IconUserPlus}
      accentColor="from-green-500 to-emerald-500"
    />
  );
}
