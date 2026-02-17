"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Smile } from "lucide-react";
import { TierBadge } from "../shared-components";
import type { CdfRow } from "../types";

interface CdfTabProps {
  cdfRows: CdfRow[];
}

export function CdfTab({ cdfRows }: CdfTabProps) {
  return (
    <div className="mt-4">
      {cdfRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[160px]">Driver</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-center">CDF DPMO</TableHead>
              <TableHead className="text-center">Tier</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Negative Feedback</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cdfRows.map((r, i) => (
                <TableRow key={r.transporterId} className={r.negativeFeedbackCount > 0 ? "bg-red-500/5" : ""}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-center tabular-nums">{r.cdfDpmo}</TableCell>
                  <TableCell className="text-center"><TierBadge tier={r.cdfDpmoTier} className="text-[9px]" /></TableCell>
                  <TableCell className="text-center tabular-nums">{r.cdfDpmoScore}</TableCell>
                  <TableCell className="text-center">
                    <span className={r.negativeFeedbackCount > 0 ? "text-red-500 font-bold" : "text-muted-foreground"}>{r.negativeFeedbackCount}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Smile className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No CDF data available for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
