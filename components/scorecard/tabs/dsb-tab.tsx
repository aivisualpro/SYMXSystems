"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldAlert } from "lucide-react";
import { SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";

interface DsbTabProps {
  dsbRows: any[];
}

export function DsbTab({ dsbRows }: DsbTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(dsbRows, 'dsbCount', 'desc');

  return (
    <div className="mt-4">
      {dsbRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Driver" sortKey="deliveryAssociate" currentSort={sortConfig} requestSort={requestSort} className="min-w-[160px]" />
              <SortableTableHead label="ID" sortKey="transporterId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="DSB Count" sortKey="dsbCount" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="DSB DPMO" sortKey="dsbDpmo" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Attended" sortKey="attendedDeliveryCount" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Unattended" sortKey="unattendedDeliveryCount" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Simultaneous" sortKey="simultaneousDeliveries" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Over 50m" sortKey="deliveredOver50m" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Scan Att." sortKey="incorrectScanUsageAttended" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Scan Unatt." sortKey="incorrectScanUsageUnattended" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="No POD" sortKey="noPodOnDelivery" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="SNDNR" sortKey="scannedNotDeliveredNotReturned" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r: any, i: number) => (
                <TableRow key={r.transporterId + i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-right"><span className={r.dsbCount > 0 ? "text-red-500 font-bold" : ""}>{r.dsbCount}</span></TableCell>
                  <TableCell className="text-right">{r.dsbDpmo}</TableCell>
                  <TableCell className="text-right">{r.attendedDeliveryCount}</TableCell>
                  <TableCell className="text-right">{r.unattendedDeliveryCount}</TableCell>
                  <TableCell className="text-right">{r.simultaneousDeliveries}</TableCell>
                  <TableCell className="text-right">{r.deliveredOver50m}</TableCell>
                  <TableCell className="text-right">{r.incorrectScanUsageAttended}</TableCell>
                  <TableCell className="text-right">{r.incorrectScanUsageUnattended}</TableCell>
                  <TableCell className="text-right">{r.noPodOnDelivery}</TableCell>
                  <TableCell className="text-right">{r.scannedNotDeliveredNotReturned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No DSB data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
