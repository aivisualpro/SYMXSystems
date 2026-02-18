"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Camera } from "lucide-react";
import type { PodRow } from "../types";

interface PodTabProps {
  podRows: PodRow[];
}

export function PodTab({ podRows }: PodTabProps) {
  return (
    <div className="mt-4">
      {podRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead><TableHead>Transporter ID</TableHead><TableHead className="text-right">Opps</TableHead>
              <TableHead className="text-right">Success</TableHead><TableHead className="text-right">Bypass</TableHead>
              <TableHead className="text-right">Rejects</TableHead><TableHead className="text-right">Blurry</TableHead>
              <TableHead className="text-right">Human</TableHead><TableHead className="text-right">No Pkg</TableHead>
              <TableHead className="text-right">In Car</TableHead><TableHead className="text-right">In Hand</TableHead>
              <TableHead className="text-right">Not Visible</TableHead><TableHead className="text-right">Too Close</TableHead>
              <TableHead className="text-right">Too Dark</TableHead><TableHead className="text-right">Other</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {podRows.map((r, i) => (
                <TableRow key={r.transporterId} className={r.rejects > 0 ? "bg-red-500/5" : ""}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-right">{r.opportunities}</TableCell>
                  <TableCell className="text-right">{r.success}</TableCell>
                  <TableCell className="text-right">{r.bypass}</TableCell>
                  <TableCell className="text-right"><span className={r.rejects > 0 ? "text-red-500 font-bold" : ""}>{r.rejects}</span></TableCell>
                  <TableCell className="text-right">{r.blurryPhoto || "—"}</TableCell>
                  <TableCell className="text-right">{r.humanInThePicture || "—"}</TableCell>
                  <TableCell className="text-right">{r.noPackageDetected || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageInCar || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageInHand || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageNotClearlyVisible || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageTooClose || "—"}</TableCell>
                  <TableCell className="text-right">{r.photoTooDark || "—"}</TableCell>
                  <TableCell className="text-right">{r.other || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Camera className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No POD data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
