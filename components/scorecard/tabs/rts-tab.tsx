"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RtsRow } from "../types";

interface RtsTabProps {
  rtsRows: RtsRow[];
}

export function RtsTab({ rtsRows }: RtsTabProps) {
  // Aggregate stats
  const totalRts = rtsRows.length;
  const impactsDcr = rtsRows.filter(r => r.impactDcr?.toLowerCase() === 'yes' || r.impactDcr?.toLowerCase() === 'true').length;
  const rtsCodeCounts: Record<string, number> = {};
  rtsRows.forEach(r => {
    const code = r.rtsCode || 'Unknown';
    rtsCodeCounts[code] = (rtsCodeCounts[code] || 0) + 1;
  });
  const topCodes = Object.entries(rtsCodeCounts).sort(([, a], [, b]) => b - a);

  return (
    <div className="mt-4 space-y-4">
      {/* Summary Cards */}
      {rtsRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="py-0"><CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total RTS</p>
            <p className="text-2xl font-black tabular-nums text-amber-500">{totalRts}</p>
          </CardContent></Card>
          <Card className="py-0"><CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Impacts DCR</p>
            <p className="text-2xl font-black tabular-nums text-red-500">{impactsDcr}</p>
          </CardContent></Card>
          <Card className="py-0"><CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Unique Drivers</p>
            <p className="text-2xl font-black tabular-nums">{new Set(rtsRows.map(r => r.transporterId)).size}</p>
          </CardContent></Card>
          <Card className="py-0"><CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Top RTS Code</p>
            <p className="text-lg font-black truncate">{topCodes[0]?.[0] || '—'}</p>
            <p className="text-xs text-muted-foreground">{topCodes[0]?.[1] || 0} occurrences</p>
          </CardContent></Card>
        </div>
      )}

      {/* RTS Code Breakdown */}
      {topCodes.length > 0 && (
        <Card className="py-0"><CardContent className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">RTS Code Breakdown</p>
          <div className="space-y-1.5">
            {topCodes.map(([code, count]) => {
              const pct = totalRts > 0 ? (count / totalRts * 100).toFixed(1) : '0';
              return (
                <div key={code} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-[200px] truncate">{code}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-muted-foreground w-14 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}

      {/* Data Table */}
      {rtsRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[120px]">Driver</TableHead>
              <TableHead>Tracking ID</TableHead>
              <TableHead className="text-center">Impact DCR</TableHead>
              <TableHead className="min-w-[180px]">RTS Code</TableHead>
              <TableHead className="text-center">Delivery Date</TableHead>
              <TableHead>Exemption</TableHead>
              <TableHead>Service Area</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rtsRows.map((r, i) => (
                <TableRow key={`${r.trackingId}-${i}`} className={cn(
                  r.impactDcr?.toLowerCase() === 'yes' || r.impactDcr?.toLowerCase() === 'true'
                    ? "bg-red-500/5" : "bg-amber-500/5"
                )}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{r.deliveryAssociate || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.trackingId || '—'}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn("text-xs font-bold",
                      r.impactDcr?.toLowerCase() === 'yes' || r.impactDcr?.toLowerCase() === 'true'
                        ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {r.impactDcr || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{r.rtsCode || '—'}</TableCell>
                  <TableCell className="text-center text-xs tabular-nums">{r.plannedDeliveryDate || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.exemptionReason}>{r.exemptionReason || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.serviceArea || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <RotateCcw className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Return to Station records for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
