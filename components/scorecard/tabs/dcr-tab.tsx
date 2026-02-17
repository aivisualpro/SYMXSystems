"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package } from "lucide-react";

interface DcrTabProps {
  dcrRows: any[];
}

export function DcrTab({ dcrRows }: DcrTabProps) {
  return (
    <div className="mt-4">
      {dcrRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[160px]">Driver</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">DCR %</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Dispatched</TableHead>
              <TableHead className="text-right">RTS</TableHead>
              <TableHead className="text-right">DA Ctrl</TableHead>
              <TableHead className="text-right">Biz Closed</TableHead>
              <TableHead className="text-right">Cust Unavail</TableHead>
              <TableHead className="text-right">No Secure</TableHead>
              <TableHead className="text-right">Unable Access</TableHead>
              <TableHead className="text-right">Unable Locate</TableHead>
              <TableHead className="text-right">Other</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {dcrRows.map((r: any, i: number) => (
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
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No DCR data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
