"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardCheck } from "lucide-react";

interface DvicTabProps {
  dvicRawRows: any[];
}

export function DvicTab({ dvicRawRows }: DvicTabProps) {
  return (
    <div className="mt-4">
      {dvicRawRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[140px]">Driver</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Fleet Type</TableHead>
              <TableHead>Inspection Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {dvicRawRows.map((r: any, i: number) => (
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
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No DVIC inspection data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
