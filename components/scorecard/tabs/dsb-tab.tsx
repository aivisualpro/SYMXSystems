"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldAlert } from "lucide-react";

interface DsbTabProps {
  dsbRows: any[];
}

export function DsbTab({ dsbRows }: DsbTabProps) {
  return (
    <div className="mt-4">
      {dsbRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[160px]">Driver</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">DSB Count</TableHead>
              <TableHead className="text-right">DSB DPMO</TableHead>
              <TableHead className="text-right">Attended</TableHead>
              <TableHead className="text-right">Unattended</TableHead>
              <TableHead className="text-right">Simultaneous</TableHead>
              <TableHead className="text-right">Over 50m</TableHead>
              <TableHead className="text-right">Scan Att.</TableHead>
              <TableHead className="text-right">Scan Unatt.</TableHead>
              <TableHead className="text-right">No POD</TableHead>
              <TableHead className="text-right">SNDNR</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {dsbRows.map((r: any, i: number) => (
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
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No DSB data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
