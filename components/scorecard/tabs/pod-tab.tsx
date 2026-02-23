"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Camera } from "lucide-react";
import { SortableTableHead } from "../shared-components";
import { useSort } from "../hooks/use-sort";
import type { PodRow } from "../types";

interface PodTabProps {
  podRows: PodRow[];
}

export function PodTab({ podRows }: PodTabProps) {
  const { sortedItems, requestSort, sortConfig } = useSort(podRows, 'transporterId', 'asc');

  return (
    <div className="mt-4">
      {podRows.length > 0 ? (
        <Card className="py-0"><CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
              <TableHead className="w-8">#</TableHead>
              <SortableTableHead label="Transporter ID" sortKey="transporterId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableTableHead label="Opps" sortKey="opportunities" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Success" sortKey="success" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Bypass" sortKey="bypass" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Rejects" sortKey="rejects" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Blurry" sortKey="blurryPhoto" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Human" sortKey="humanInThePicture" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="No Pkg" sortKey="noPackageDetected" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="In Car" sortKey="packageInCar" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="In Hand" sortKey="packageInHand" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Not Visible" sortKey="packageNotClearlyVisible" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Too Close" sortKey="packageTooClose" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Too Dark" sortKey="photoTooDark" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
              <SortableTableHead label="Other" sortKey="other" currentSort={sortConfig} requestSort={requestSort} className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {sortedItems.map((r, i) => (
                <TableRow key={r.transporterId} className={r.rejects > 0 ? "bg-red-500/5" : ""}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium font-mono">{r.transporterId}</TableCell>
                  <TableCell className="text-right">{r.opportunities}</TableCell>
                  <TableCell className="text-right">{r.success}</TableCell>
                  <TableCell className="text-right">{r.bypass}</TableCell>
                  <TableCell className="text-right"><span className={r.rejects > 0 ? "text-red-500 font-bold" : ""}>{r.rejects}</span></TableCell>
                  <TableCell className="text-right">{r.blurryPhoto || "—"}</TableCell>
                  <TableCell className="text-right">{r.humanInThePicture || "—"}</TableCell>
                  <TableCell className="text-right">{r.noPackageDetected || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageInCar || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageInHand || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageNotClearlyVisible || "—"}</TableCell>
                  <TableCell className="text-right">{r.packageTooClose || "—"}</TableCell>
                  <TableCell className="text-right">{r.photoTooDark || "—"}</TableCell>
                  <TableCell className="text-right">{r.other || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
        </CardContent></Card>
      ) : (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Camera className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No POD data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
