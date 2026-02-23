"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";
import type { CdfNegativeRow } from "../types";

interface CdfNegativeTabProps {
  cdfNegativeRows: CdfNegativeRow[];
}

export function CdfNegativeTab({ cdfNegativeRows }: CdfNegativeTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(cdfNegativeRows, 'deliveryDate', 'desc');

  return (
    <div className="mt-4">
      {cdfNegativeRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Driver" sortKey="deliveryAssociateName" currentSort={sortConfig} requestSort={requestSort} className="min-w-[160px]" />
              <SortableTableHead label="Tracking ID" sortKey="trackingId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Delivery Date" sortKey="deliveryDate" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Mishandled" sortKey="mishandledPackage" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Unprofessional" sortKey="unprofessionalBehavior" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Didn't Follow Instructions" sortKey="didNotFollowDeliveryInstructions" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Wrong Address" sortKey="deliveredToWrongAddress" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Never Received" sortKey="neverReceivedDelivery" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Wrong Item" sortKey="deliveredWrongItem" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Feedback Details" sortKey="feedbackDetails" currentSort={sortConfig} requestSort={requestSort} className="min-w-[200px]" />
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r, i) => {
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
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <MessageSquareWarning className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No CDF Negative records for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
