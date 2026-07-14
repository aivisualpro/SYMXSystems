"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ClipboardList, MessageSquare, Settings } from "lucide-react";
import FormalWriteupsTab from "./_components/FormalWriteupsTab";
import VerbalCoachingsTab from "./_components/VerbalCoachingsTab";

export default function WriteupsPage() {
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

      <Tabs defaultValue="formal">
        <TabsList>
          <TabsTrigger value="formal">
            <ClipboardList className="h-4 w-4" /> Formal Write-Ups
          </TabsTrigger>
          <TabsTrigger value="verbal">
            <MessageSquare className="h-4 w-4" /> Verbal Coachings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="formal">
          <FormalWriteupsTab />
        </TabsContent>
        <TabsContent value="verbal">
          <VerbalCoachingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
