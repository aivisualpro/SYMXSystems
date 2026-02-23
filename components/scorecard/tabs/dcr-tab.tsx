"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package } from "lucide-react";
import { SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";

interface DcrTabProps {
  dcrRows: any[];
}

export function DcrTab({ dcrRows }: DcrTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(dcrRows, 'dcr', 'asc');

  return (
    <div className="mt-4">
      {dcrRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Driver" sortKey="deliveryAssociate" currentSort={sortConfig} requestSort={requestSort} className="min-w-[160px]" />
              <SortableTableHead label="ID" sortKey="transporterId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="DCR %" sortKey="dcr" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Delivered" sortKey="packagesDelivered" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Dispatched" sortKey="packagesDispatched" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="RTS" sortKey="packagesReturnedToStation" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="DA Ctrl" sortKey="packagesReturnedDAControllable" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Biz Closed" sortKey="rtsBusinessClosed" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Cust Unavail" sortKey="rtsCustomerUnavailable" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="No Secure" sortKey="rtsNoSecureLocation" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Unable Access" sortKey="rtsUnableToAccess" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Unable Locate" sortKey="rtsUnableToLocate" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Other" sortKey="rtsOther" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r: any, i: number) => (
                <TableRow key={r.transporterId + i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-right font-bold">{r.dcr}%</TableCell>
                  <TableCell className="text-right">{r.packagesDelivered}</TableCell>
                  <TableCell className="text-right">{r.packagesDispatched}</TableCell>
                  <TableCell className="text-right"><span className={r.packagesReturnedToStation > 0 ? "text-red-500 font-bold" : ""}>{r.packagesReturnedToStation}</span></TableCell>
                  <TableCell className="text-right">{r.packagesReturnedDAControllable}</TableCell>
                  <TableCell className="text-right">{r.rtsBusinessClosed}</TableCell>
                  <TableCell className="text-right">{r.rtsCustomerUnavailable}</TableCell>
                  <TableCell className="text-right">{r.rtsNoSecureLocation}</TableCell>
                  <TableCell className="text-right">{r.rtsUnableToAccess}</TableCell>
                  <TableCell className="text-right">{r.rtsUnableToLocate}</TableCell>
                  <TableCell className="text-right">{r.rtsOther}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No DCR data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
