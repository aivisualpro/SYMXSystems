"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardCheck } from "lucide-react";
import { SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";

interface DvicTabProps {
  dvicRawRows: any[];
}

export function DvicTab({ dvicRawRows }: DvicTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(dvicRawRows, 'startDate', 'desc');

  return (
    <div className="mt-4">
      {dvicRawRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Driver" sortKey="transporterName" currentSort={sortConfig} requestSort={requestSort} className="min-w-[140px]" />
              <SortableTableHead label="ID" sortKey="transporterId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Date" sortKey="startDate" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="VIN" sortKey="vin" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Fleet Type" sortKey="fleetType" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Inspection Type" sortKey="inspectionType" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Status" sortKey="inspectionStatus" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Start Time" sortKey="startTime" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="End Time" sortKey="endTime" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Duration" sortKey="duration" currentSort={sortConfig} requestSort={requestSort} />
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r: any, i: number) => (
                <TableRow key={r.transporterId + r.vin + i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.transporterName || r.deliveryAssociate || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-xs">{r.startDate}</TableCell>
                  <TableCell className="text-xs font-mono">{r.vin}</TableCell>
                  <TableCell className="text-xs">{r.fleetType}</TableCell>
                  <TableCell className="text-xs">{r.inspectionType}</TableCell>
                  <TableCell className="text-xs"><span className={r.inspectionStatus?.toLowerCase() === 'rushed' ? "text-amber-500 font-semibold" : "text-emerald-500"}>{r.inspectionStatus}</span></TableCell>
                  <TableCell className="text-xs">{r.startTime}</TableCell>
                  <TableCell className="text-xs">{r.endTime}</TableCell>
                  <TableCell className="text-xs">{r.duration}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No DVIC inspection data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
