"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CdfNegativeRow } from "../types";

interface CdfNegativeTabProps {
  cdfNegativeRows: CdfNegativeRow[];
}

export function CdfNegativeTab({ cdfNegativeRows }: CdfNegativeTabProps) {
  return (
    <div className="mt-4">
      {cdfNegativeRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[160px]">Driver</TableHead>
              <TableHead>Tracking ID</TableHead>
              <TableHead className="text-center">Delivery Date</TableHead>
              <TableHead className="text-center">Mishandled</TableHead>
              <TableHead className="text-center">Unprofessional</TableHead>
              <TableHead className="text-center">Didn&apos;t Follow Instructions</TableHead>
              <TableHead className="text-center">Wrong Address</TableHead>
              <TableHead className="text-center">Never Received</TableHead>
              <TableHead className="text-center">Wrong Item</TableHead>
              <TableHead className="min-w-[200px]">Feedback Details</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cdfNegativeRows.map((r, i) => {
                const flagClass = (val: string) => val && val.toLowerCase() === 'yes'
                  ? 'text-red-500 font-bold'
                  : 'text-muted-foreground/40';
                const flagLabel = (val: string) => val && val.toLowerCase() === 'yes' ? 'Yes' : '—';
                return (
                  <TableRow key={`${r.trackingId}-${i}`} className="bg-red-500/5">
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.deliveryAssociateName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{r.trackingId || '—'}</TableCell>
                    <TableCell className="text-center text-xs">{r.deliveryDate || '—'}</TableCell>
                    <TableCell className={cn("text-center text-xs", flagClass(r.daMishandledPackage))}>{flagLabel(r.daMishandledPackage)}</TableCell>
                    <TableCell className={cn("text-center text-xs", flagClass(r.daWasUnprofessional))}>{flagLabel(r.daWasUnprofessional)}</TableCell>
                    <TableCell className={cn("text-center text-xs", flagClass(r.daDidNotFollowInstructions))}>{flagLabel(r.daDidNotFollowInstructions)}</TableCell>
                    <TableCell className={cn("text-center text-xs", flagClass(r.deliveredToWrongAddress))}>{flagLabel(r.deliveredToWrongAddress)}</TableCell>
                    <TableCell className={cn("text-center text-xs", flagClass(r.neverReceivedDelivery))}>{flagLabel(r.neverReceivedDelivery)}</TableCell>
                    <TableCell className={cn("text-center text-xs", flagClass(r.receivedWrongItem))}>{flagLabel(r.receivedWrongItem)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={r.feedbackDetails}>{r.feedbackDetails || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <MessageSquareWarning className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No CDF Negative records for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
