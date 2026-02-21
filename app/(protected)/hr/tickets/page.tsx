"use client";
import { ComingSoonTab } from "@/components/coming-soon-tab";
import { IconTicket } from "@tabler/icons-react";

export default function HRTicketsPage() {
  return (
    <ComingSoonTab
      title="HR Tickets"
      description="Manage HR support requests, employee inquiries, and internal tickets with full tracking and resolution workflows."
      icon={IconTicket}
      accentColor="from-purple-500 to-violet-500"
    />
  );
}
