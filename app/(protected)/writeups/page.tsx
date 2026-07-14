"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, MessageSquare } from "lucide-react";
import FormalWriteupsTab from "./_components/FormalWriteupsTab";
import VerbalCoachingsTab from "./_components/VerbalCoachingsTab";

export default function WriteupsPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Write-Ups &amp; Coaching</h1>
        <p className="text-sm text-muted-foreground">Formal progressive discipline and informal verbal coaching in one place.</p>
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
