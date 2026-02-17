"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity } from "lucide-react";
import { TierBadge } from "../shared-components";

interface DeliveryExcellenceTabProps {
  deliveryExcellenceRows: any[];
}

export function DeliveryExcellenceTab({ deliveryExcellenceRows }: DeliveryExcellenceTabProps) {
  return (
    <div className="mt-4">
      {deliveryExcellenceRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[160px]">Driver</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-center">Standing</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">FICO</TableHead>
              <TableHead className="text-right">Speeding</TableHead>
              <TableHead className="text-right">Seatbelt</TableHead>
              <TableHead className="text-right">Distractions</TableHead>
              <TableHead className="text-right">Sign/Signal</TableHead>
              <TableHead className="text-right">Follow Dist</TableHead>
              <TableHead className="text-right">CDF DPMO</TableHead>
              <TableHead className="text-right">CED</TableHead>
              <TableHead className="text-right">DCR</TableHead>
              <TableHead className="text-right">DSB</TableHead>
              <TableHead className="text-right">POD</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {deliveryExcellenceRows.map((r: any, i: number) => (
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
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Delivery Excellence data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
