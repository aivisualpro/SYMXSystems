"use client";

import { Dispatch, SetStateAction } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Shield } from "lucide-react";

interface SafetyTabProps {
  safetyRows: any[];
  onPlayVideo: Dispatch<SetStateAction<string | null>>;
}

export function SafetyTab({ safetyRows, onPlayVideo }: SafetyTabProps) {
  return (
    <div className="mt-4">
      {safetyRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0"><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[140px]">Driver</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subtype</TableHead>
              <TableHead>Impact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead className="min-w-[200px]">Review Details</TableHead>
              <TableHead>Video</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {safetyRows.map((r: any, i: number) => (
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
        </div></CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Shield className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Safety events for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
