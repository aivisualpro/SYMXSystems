"use client";

import { Dispatch, SetStateAction } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Shield } from "lucide-react";
import { SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";

interface SafetyTabProps {
  safetyRows: any[];
  onPlayVideo: Dispatch<SetStateAction<string | null>>;
}

export function SafetyTab({ safetyRows, onPlayVideo }: SafetyTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(safetyRows, 'date', 'desc');

  return (
    <div className="mt-4">
      {safetyRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Driver" sortKey="deliveryAssociate" currentSort={sortConfig} requestSort={requestSort} className="min-w-[140px]" />
              <SortableTableHead label="ID" sortKey="transporterId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Type" sortKey="metricType" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Subtype" sortKey="metricSubtype" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Impact" sortKey="programImpact" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Source" sortKey="source" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="VIN" sortKey="vin" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Review Details" sortKey="reviewDetails" currentSort={sortConfig} requestSort={requestSort} className="min-w-[200px]" />
              <TableHead>Video</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r: any, i: number) => (
                <TableRow key={r.eventId + i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-xs">{r.date}</TableCell>
                  <TableCell className="text-xs">{r.metricType}</TableCell>
                  <TableCell className="text-xs">{r.metricSubtype}</TableCell>
                  <TableCell className="text-xs"><span className={r.programImpact?.toLowerCase().includes('tier') ? "text-red-500 font-semibold" : ""}>{r.programImpact}</span></TableCell>
                  <TableCell className="text-xs">{r.source}</TableCell>
                  <TableCell className="text-xs font-mono">{r.vin}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={r.reviewDetails}>{r.reviewDetails || '—'}</TableCell>
                  <TableCell className="text-xs">{r.videoLink ? <button onClick={() => onPlayVideo(r.videoLink)} className="text-blue-500 hover:underline cursor-pointer">View</button> : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Shield className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Safety events for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
