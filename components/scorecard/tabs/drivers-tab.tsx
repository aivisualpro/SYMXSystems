"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Truck, Shield, Users, ShieldCheck, Play, UserCheck,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriverData } from "../types";

interface DriversTabProps {
  drivers: DriverData[];
  driverSearch: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  setSortKey: (key: string) => void;
  setSortDir: (dir: 'asc' | 'desc') => void;
  signatureMap: Record<string, { driverSigned: boolean; managerSigned: boolean }>;
  onSelectDriver: (driver: DriverData) => void;
  onPlayVideo: (url: string) => void;
}

export function DriversTab({
  drivers, driverSearch, sortKey, sortDir, setSortKey, setSortDir,
  signatureMap, onSelectDriver, onPlayVideo,
}: DriversTabProps) {
  return (
    <div className="space-y-4 mt-4">
      {drivers.length > 0 ? (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-200px)]">
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    {[
                      { key: 'name', label: 'Driver', className: 'min-w-[180px] text-left' },
                      { key: 'signed', label: 'Signed', className: 'text-center w-[70px]' },
                      { key: 'deliveries', label: 'Deliveries', className: 'text-center' },
                      { key: 'dvic', label: 'DVIC', className: 'text-center' },
                      { key: 'dsbDpmo', label: 'DSB DPMO', className: 'text-center' },
                      { key: 'dcr', label: 'DCR', className: 'text-center' },
                      { key: 'overallScore', label: 'Overall Score', className: 'text-center' },
                      { key: 'safety', label: 'Safety', className: 'text-center' },
                      { key: 'cdfNegative', label: 'CDF', className: 'text-center' },
                    ].map(col => (
                      <TableHead
                        key={col.key}
                        className={cn(col.className, "cursor-pointer select-none hover:bg-muted/50 transition-colors")}
                        onClick={() => {
                          if (sortKey === col.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else { setSortKey(col.key); setSortDir('desc'); }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key
                            ? (sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)
                            : <ArrowUpDown className="h-3 w-3 opacity-30" />
                          }
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...drivers]
                    .filter(d => !driverSearch || d.name.toLowerCase().includes(driverSearch.toLowerCase()))
                    .sort((a, b) => {
                      const getValue = (d: DriverData): number => {
                        switch (sortKey) {
                          case 'name': return 0;
                          case 'signed': return (signatureMap[d.transporterId]?.driverSigned ? 1 : 0) + (signatureMap[d.transporterId]?.managerSigned ? 1 : 0);
                          case 'deliveries': return d.packagesDelivered;
                          case 'safety': return d.safetyEvents.filter(e => (e.reviewDetails || '').toLowerCase() !== 'none').length;
                          case 'cdfNegative': return d.cdfNegativeCount;
                          case 'dvic': return d.dvicRushedCount;
                          case 'dsbDpmo': return d.qualityDsbDnr?.dsbDpmo ?? -1;
                          case 'dcr': return d.dcrFromCollection ?? -1;
                          case 'overallScore': return d.overallScore ?? -1;
                          default: return 0;
                        }
                      };
                      if (sortKey === 'name') {
                        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                      }
                      const av = getValue(a), bv = getValue(b);
                      return sortDir === 'asc' ? av - bv : bv - av;
                    })
                    .map((d, i) => (
                      <TableRow
                        key={d.transporterId}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onSelectDriver(d)}
                      >
                        <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {d.profileImage ? (
                              <Image src={d.profileImage} alt={d.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {d.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium leading-none">{d.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2.5">
                            <div title={signatureMap[d.transporterId]?.driverSigned ? 'Driver signed' : 'Driver not signed'}>
                              {signatureMap[d.transporterId]?.driverSigned
                                ? <UserCheck className="h-[22px] w-[22px] text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                : <Users className="h-[22px] w-[22px] text-muted-foreground/20" />
                              }
                            </div>
                            <div className="w-px h-5 bg-border/30" />
                            <div title={signatureMap[d.transporterId]?.managerSigned ? 'Manager signed' : 'Manager not signed'}>
                              {signatureMap[d.transporterId]?.managerSigned
                                ? <ShieldCheck className="h-[22px] w-[22px] text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                : <Shield className="h-[22px] w-[22px] text-muted-foreground/20" />
                              }
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm tabular-nums">{d.packagesDelivered.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {d.dvicTotalInspections > 0 ? (
                            <span className="text-sm tabular-nums">
                              <span className={d.dvicRushedCount > 0 ? "text-amber-500" : "text-emerald-500"}>{d.dvicRushedCount}</span>
                              <span className="text-muted-foreground font-normal">/</span>
                              <span>{d.dvicTotalInspections}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm tabular-nums">{d.qualityDsbDnr?.dsbDpmo ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm tabular-nums">{d.dcrFromCollection != null ? `${d.dcrFromCollection}%` : '—'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm tabular-nums">{d.overallScore ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const filtered = d.safetyEvents.filter(e => (e.reviewDetails || '').toLowerCase() !== 'none');
                            const count = filtered.length;
                            if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <div className="relative group inline-block">
                                <span className={cn("text-sm font-bold tabular-nums cursor-default", count > 0 && "text-amber-500")}>{count}</span>
                                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover:block z-[100] w-max max-w-[340px]">
                                  <div className="bg-popover border border-border rounded-lg shadow-2xl p-3 space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Safety Events</p>
                                    {filtered.map((evt, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs">
                                        <span className="font-semibold">{evt.metricType}</span>
                                        {evt.metricSubtype && <span className="text-amber-500 font-medium">{evt.metricSubtype}</span>}
                                        <span className="text-muted-foreground">{evt.date || evt.dateTime || ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const count = d.cdfNegativeCount;
                            if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <div className="relative group/cdf inline-block">
                                <span className={cn("text-sm font-bold tabular-nums cursor-default", "text-amber-500")}>{count}</span>
                                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover/cdf:block z-[100] w-max max-w-[380px]">
                                  <div className="bg-popover border border-border rounded-lg shadow-2xl p-3 space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">CDF Negative Feedback</p>
                                    {d.cdfNegativeRecords.map((rec, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs">
                                        <span className="font-semibold text-amber-500 tabular-nums whitespace-nowrap">{rec.deliveryDate || '—'}</span>
                                        <span className="text-muted-foreground">{rec.feedbackDetails || 'No details'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="py-16 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No driver data</p>
            <p className="text-sm text-muted-foreground mt-1">Import data or select a week with available records.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
