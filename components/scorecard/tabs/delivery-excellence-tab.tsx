"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity } from "lucide-react";
import { TierBadge, SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";

interface DeliveryExcellenceTabProps {
  deliveryExcellenceRows: any[];
}

export function DeliveryExcellenceTab({ deliveryExcellenceRows }: DeliveryExcellenceTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(deliveryExcellenceRows, 'overallScore', 'desc');

  return (
    <div className="mt-4">
      {deliveryExcellenceRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Driver" sortKey="deliveryAssociate" currentSort={sortConfig} requestSort={requestSort} className="min-w-[160px]" />
              <SortableTableHead label="ID" sortKey="transporterId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Standing" sortKey="overallStanding" currentSort={sortConfig} requestSort={requestSort} className="text-center" />
              <SortableTableHead label="Score" sortKey="overallScore" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="FICO" sortKey="ficoMetric" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Speeding" sortKey="speedingEventRate" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Seatbelt" sortKey="seatbeltOffRate" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Distractions" sortKey="distractionsRate" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Sign/Signal" sortKey="signSignalViolationsRate" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Follow Dist" sortKey="followingDistanceRate" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="CDF DPMO" sortKey="cdfDpmo" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="CED" sortKey="ced" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="DCR" sortKey="dcr" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="DSB" sortKey="dsb" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="POD" sortKey="pod" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Delivered" sortKey="packagesDelivered" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r: any, i: number) => (
                <TableRow key={r.transporterId + i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.deliveryAssociate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-center"><TierBadge tier={r.overallStanding} className="text-[9px]" /></TableCell>
                  <TableCell className="text-right font-bold">{r.overallScore}</TableCell>
                  <TableCell className="text-right">{r.ficoMetric ?? '—'}</TableCell>
                  <TableCell className="text-right">{r.speedingEventRate}</TableCell>
                  <TableCell className="text-right">{r.seatbeltOffRate}</TableCell>
                  <TableCell className="text-right">{r.distractionsRate}</TableCell>
                  <TableCell className="text-right">{r.signSignalViolationsRate}</TableCell>
                  <TableCell className="text-right">{r.followingDistanceRate}</TableCell>
                  <TableCell className="text-right">{r.cdfDpmo}</TableCell>
                  <TableCell className="text-right">{r.ced}</TableCell>
                  <TableCell className="text-right">{r.dcr}</TableCell>
                  <TableCell className="text-right">{r.dsb}</TableCell>
                  <TableCell className="text-right">{r.pod}</TableCell>
                  <TableCell className="text-right">{r.packagesDelivered}</TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Delivery Excellence data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
