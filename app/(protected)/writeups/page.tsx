"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ClipboardList, MessageSquare, Settings, Inbox } from "lucide-react";
import FormalWriteupsTab from "./_components/FormalWriteupsTab";
import VerbalCoachingsTab from "./_components/VerbalCoachingsTab";

export default function WriteupsPage() {
  const [isManager, setIsManager] = useState(false);
  // Count of write-ups currently sitting in the manager review queue —
  // drives the badge on the Review Workbench tab so a manager notices
  // there's something waiting without having to click in first. Kept at
  // this level (not inside FormalWriteupsTab) so it stays visible/accurate
  // no matter which tab is actually open.
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    fetch("/api/user/permissions")
      .then((res) => res.json())
      .then((d) => setIsManager(d.role === "Super Admin" || !!d.isManager))
      .catch(() => {});
  }, []);

  // Fetched independently of which tab is mounted (Radix unmounts inactive
  // tab content) so the badge is accurate the moment the page loads, even
  // if the manager never clicks into the Workbench tab. The workbenchMode
  // instance below also reports live count changes via onCountChange while
  // it's actually open, so the badge stays in sync as items get reviewed.
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/writeups?status=pending_review")
      .then((res) => res.json())
      .then((d) => setPendingReviewCount((d.writeups || []).length))
      .catch(() => {});
  }, [isManager]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Write-Ups &amp; Coaching</h1>
          <p className="text-sm text-muted-foreground">Formal progressive discipline and informal verbal coaching in one place.</p>
        </div>
        {/* The sidebar doesn't render nested sub-links, so this is the only
            real entry point to the escalation ladder / corrective-action
            template settings — keep it visible here, not buried. */}
        <Link href="/admin/writeup-settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" /> Write-Up Settings
          </Button>
        </Link>
      </div>

      {/* Formal Write-Ups is always the landing tab — issue write-ups and
          see everything open from here. Review Workbench (managers only)
          is a focused second view onto the subset waiting on a decision. */}
      <Tabs defaultValue="formal">
        <TabsList>
          <TabsTrigger value="formal">
            <ClipboardList className="h-4 w-4" /> Formal Write-Ups
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="workbench" className="gap-1.5">
              <Inbox className="h-4 w-4" /> Review Workbench
              {pendingReviewCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                  {pendingReviewCount}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="verbal">
            <MessageSquare className="h-4 w-4" /> Verbal Coachings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="formal">
          <FormalWriteupsTab />
        </TabsContent>
        {isManager && (
          <TabsContent value="workbench">
            <FormalWriteupsTab workbenchMode onCountChange={setPendingReviewCount} />
          </TabsContent>
        )}
        <TabsContent value="verbal">
          <VerbalCoachingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
