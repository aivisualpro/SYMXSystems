"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Shield, Truck, Users, AlertTriangle, Lightbulb,
  ChevronRight, Eye, Activity, MessageSquare, Camera,
  ShieldAlert, ClipboardCheck, Package, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTier } from "../constants";
import { TierBadge, ScoreBar, OverallStandingBar, MetricRow, SectionHeader } from "../shared-components";
import type { DspMetrics } from "../types";

interface SYMXTabProps {
  dspMetrics: DspMetrics | null;
  selectedWeek: string;
  totalDrivers: number;
  totalDelivered: number;
  driversWithIssues: number;
  currentTips: string[];
}

export function SYMXTab({
  dspMetrics, selectedWeek, totalDrivers, totalDelivered, driversWithIssues, currentTips,
}: SYMXTabProps) {
  const sm = dspMetrics;

  return (
    <div className="space-y-4 mt-4">
      {sm && <>
        {/* ── Hero Banner ───────────────────────────────────────────── */}
        <Card className="overflow-hidden border-0 shadow-lg py-0">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-2xl font-black tracking-tight">DSP Core Analysis</h2>
                <p className="text-slate-400 text-sm mt-0.5">SYMX at DFO2 — {selectedWeek} — All Collections</p>
              </div>
              <div className="flex gap-6 text-center">
                <div><p className="text-3xl font-black">{totalDrivers}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Drivers</p></div>
                <div><p className="text-3xl font-black">{totalDelivered.toLocaleString()}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">Delivered</p></div>
                <div><p className="text-3xl font-black text-amber-400">{driversWithIssues}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider">W/ Issues</p></div>
              </div>
            </div>
            <Separator className="my-4 bg-white/10" />
            <OverallStandingBar score={sm.overallScore} tier={sm.overallTier} />
          </div>
        </Card>

        {/* ── Row 1: Safety & Delivery Quality ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden py-0">
            <SectionHeader icon={Shield} title="Safety and Compliance" tier={sm.safety.tier} />
            <CardContent className="p-0 divide-y divide-border/50">
              <div className="p-4 space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />On-Road Safety Score</span>
                  {sm.safety.avgFico > 0 ? <TierBadge tier={sm.safety.ficoTier} /> : <span className="text-xs text-muted-foreground italic">Coming Soon</span>}
                </div>
                <MetricRow label="Seatbelt-Off Rate" value={sm.safety.seatbeltOffRate} tier={sm.safety.seatbeltOffRateTier} suffix=" events per 100 trips" />
                <MetricRow label="Speeding Event Rate" value={sm.safety.speedingEventRate} tier={sm.safety.speedingEventRateTier} suffix=" events per 100 trips" />
                <MetricRow label="Sign/Signal Violations" value={sm.safety.signSignalViolationsRate} tier={sm.safety.signSignalViolationsRateTier} suffix=" events per 100 trips" />
                <MetricRow label="Distractions Rate" value={sm.safety.distractionsRate} tier={sm.safety.distractionsRateTier} suffix=" events per 100 trips" />
                <MetricRow label="Following Distance" value={sm.safety.followingDistanceRate} tier={sm.safety.followingDistanceRateTier} suffix=" events per 100 trips" />
              </div>
              {sm.safety.avgFico > 0 && (
                <div className="p-4">
                  <ScoreBar score={sm.safety.avgFico} maxScore={850} tier={sm.safety.ficoTier} label="Avg FICO Score" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <SectionHeader icon={Truck} title="Delivery Quality" tier={sm.deliveryQuality.tier} />
            <CardContent className="p-0 divide-y divide-border/50">
              <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-1">
                <div className="col-span-2 mb-1"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Delivery Experience</span></div>
                <MetricRow label="CED DPMO" value={sm.deliveryQuality.totalCed} tier={sm.deliveryQuality.cedTier} />
              </div>
              <div className="p-4 space-y-1">
                <MetricRow label="Delivery Completion Rate" value={`${sm.deliveryQuality.dcr}%`} tier={sm.deliveryQuality.dcrTier} />
                <MetricRow label="Delivery Success Behaviors" value={sm.deliveryQuality.totalDsb} tier={sm.deliveryQuality.dsbTier} />
                <MetricRow label="Photo-On-Delivery Rate" value={`${sm.deliveryQuality.podAcceptanceRate}%`} tier={sm.deliveryQuality.podTier} />
              </div>
              <div className="p-4">
                <ScoreBar score={sm.deliveryQuality.dcr} maxScore={100} tier={sm.deliveryQuality.dcrTier} label="Completion Rate" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tier Distribution ─────────────────────────────────────── */}
        <Card className="overflow-hidden py-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4" />Driver Tier Distribution</h3>
              <span className="text-xs text-muted-foreground">{totalDrivers} total</span>
            </div>
            <div className="flex gap-2">
              {["Fantastic Plus", "Fantastic", "Great", "Fair", "Poor"].map(t => {
                const count = sm.tierDistribution[t] || 0;
                const cfg = getTier(t);
                const pct = totalDrivers > 0 ? Math.round((count / totalDrivers) * 100) : 0;
                return (
                  <div key={t} className={cn("flex-1 rounded-lg p-3 text-center border transition-all", cfg.bg, cfg.border, count > 0 ? "" : "opacity-40")}>
                    <p className={cn("text-2xl font-black", cfg.color)}>{count}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{t}</p>
                    <p className={cn("text-[10px] font-bold mt-0.5", cfg.color)}>{pct}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 2: Safety Events + CDF Negative ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Safety Event Breakdown */}
          <Card className="overflow-hidden py-0">
            <div className="bg-red-500/5 border-b border-red-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10"><ShieldAlert className="h-5 w-5 text-red-500" /></div>
                <div>
                  <h3 className="text-base font-bold">Safety Event Breakdown</h3>
                  <p className="text-xs text-muted-foreground">ScoreCard_safetyDashboard</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-red-500">{sm.safetyAggregate?.totalEvents ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">total events</p>
              </div>
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{sm.safetyAggregate?.driversWithEvents ?? 0} drivers affected</span>
              </div>
              {sm.safetyAggregate?.byMetricSubtype && Object.entries(sm.safetyAggregate.byMetricSubtype as Record<string, number>)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([label, count]) => {
                  const vals = Object.values((sm.safetyAggregate?.byMetricSubtype ?? {}) as Record<string, number>);
                  const maxVal = Math.max(...vals);
                  const pct = maxVal > 0 ? (count / maxVal) * 100 : 0;
                  return (
                    <div key={label} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs truncate max-w-[200px]">{label}</span>
                        <span className="text-xs font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              {sm.safetyAggregate?.byProgramImpact && Object.keys(sm.safetyAggregate.byProgramImpact as Record<string, number>).length > 0 && (
                <div className="pt-3 border-t mt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">By Program Impact</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(sm.safetyAggregate.byProgramImpact as Record<string, number>).map(([label, count]) => (
                      <span key={label} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted/50 border">
                        <span>{label}</span>
                        <span className="font-semibold text-red-500">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CDF Negative Breakdown */}
          <Card className="overflow-hidden py-0">
            <div className="bg-amber-500/5 border-b border-amber-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10"><MessageSquare className="h-5 w-5 text-amber-500" /></div>
                <div>
                  <h3 className="text-base font-bold">Customer Complaints</h3>
                  <p className="text-xs text-muted-foreground">ScoreCard_CDF_Negative</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-amber-500">{sm.cdfNegativeAggregate?.total ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">total complaints</p>
              </div>
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{sm.cdfNegativeAggregate?.driversAffected ?? 0} drivers affected</span>
              </div>
              {(() => {
                const cdfItems = [
                  { label: "Mishandled Package", value: sm.cdfNegativeAggregate?.mishandled ?? 0, color: "from-amber-500 to-orange-400" },
                  { label: "Unprofessional", value: sm.cdfNegativeAggregate?.unprofessional ?? 0, color: "from-red-500 to-pink-400" },
                  { label: "Didn't Follow Instructions", value: sm.cdfNegativeAggregate?.didNotFollow ?? 0, color: "from-orange-500 to-amber-400" },
                  { label: "Wrong Address", value: sm.cdfNegativeAggregate?.wrongAddress ?? 0, color: "from-purple-500 to-violet-400" },
                  { label: "Never Received", value: sm.cdfNegativeAggregate?.neverReceived ?? 0, color: "from-rose-500 to-red-400" },
                  { label: "Wrong Item", value: sm.cdfNegativeAggregate?.wrongItem ?? 0, color: "from-pink-500 to-fuchsia-400" },
                ];
                const maxCdf = Math.max(...cdfItems.map(i => i.value), 1);
                return cdfItems.map(item => (
                  <div key={item.label} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{item.label}</span>
                      <span className="text-xs font-semibold tabular-nums">{item.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", item.color)} style={{ width: `${(item.value / maxCdf) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3: DVIC + DCR ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* DVIC Summary */}
          <Card className="overflow-hidden py-0">
            <div className="bg-sky-500/5 border-b border-sky-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10"><ClipboardCheck className="h-5 w-5 text-sky-500" /></div>
                <div>
                  <h3 className="text-base font-bold">Vehicle Inspections</h3>
                  <p className="text-xs text-muted-foreground">ScoreCard_DVICVehicleInspection</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-sky-500">{sm.dvicSummary?.totalInspections ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">total inspections</p>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black text-sky-500">{sm.dvicSummary?.driversWithInspections ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Drivers</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black text-emerald-500">{(sm.dvicSummary?.totalInspections ?? 0) - (sm.dvicSummary?.rushedCount ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Compliant</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black text-amber-500">{sm.dvicSummary?.rushedCount ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Rushed (&lt;90s)</p>
                </div>
              </div>
              {(sm.dvicSummary?.totalInspections ?? 0) > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Compliance Rate</span>
                    <span className="font-semibold">{Math.round((((sm.dvicSummary?.totalInspections ?? 0) - (sm.dvicSummary?.rushedCount ?? 0)) / (sm.dvicSummary?.totalInspections || 1)) * 100)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-amber-500/20 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${(((sm.dvicSummary?.totalInspections ?? 0) - (sm.dvicSummary?.rushedCount ?? 0)) / (sm.dvicSummary?.totalInspections || 1)) * 100}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DCR Return-to-Station */}
          <Card className="overflow-hidden py-0">
            <div className="bg-violet-500/5 border-b border-violet-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10"><Package className="h-5 w-5 text-violet-500" /></div>
                <div>
                  <h3 className="text-base font-bold">DCR — Return to Station</h3>
                  <p className="text-xs text-muted-foreground">ScoreCard_DCR</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-violet-500">{sm.dcrAggregate?.avgDcr ?? 0}%</p>
                <p className="text-[10px] text-muted-foreground">avg DCR</p>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black">{(sm.dcrAggregate?.totalDispatched ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Dispatched</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black text-emerald-500">{(sm.dcrAggregate?.totalDelivered ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Delivered</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black text-red-500">{sm.dcrAggregate?.totalRts ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Returned</p>
                </div>
              </div>
              {(sm.dcrAggregate?.totalRts ?? 0) > 0 && (() => {
                const rtsItems = [
                  { label: "Business Closed", value: sm.dcrAggregate?.rtsBizClosed ?? 0 },
                  { label: "Customer Unavailable", value: sm.dcrAggregate?.rtsCustUnavail ?? 0 },
                  { label: "No Secure Location", value: sm.dcrAggregate?.rtsNoSecure ?? 0 },
                  { label: "Unable to Access", value: sm.dcrAggregate?.rtsAccess ?? 0 },
                  { label: "Unable to Locate", value: sm.dcrAggregate?.rtsLocate ?? 0 },
                  { label: "Other", value: sm.dcrAggregate?.rtsOther ?? 0 },
                ].filter(i => i.value > 0);
                const maxRts = Math.max(...rtsItems.map(i => i.value), 1);
                return (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RTS Reasons</p>
                    {rtsItems.map(item => (
                      <div key={item.label} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{item.label}</span>
                          <span className="text-xs font-semibold tabular-nums">{item.value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-500" style={{ width: `${(item.value / maxRts) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 4: DSB + POD ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* DSB Quality Metrics */}
          <Card className="overflow-hidden py-0">
            <div className="bg-rose-500/5 border-b border-rose-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10"><ShieldAlert className="h-5 w-5 text-rose-500" /></div>
                <div>
                  <h3 className="text-base font-bold">Delivery Success Behaviors</h3>
                  <p className="text-xs text-muted-foreground">ScoreCard_QualityDSBDNR</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-rose-500">{sm.dsbAggregate?.avgDsbDpmo ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">avg DPMO</p>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black">{(sm.dsbAggregate?.totalAttended ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Attended</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-lg font-black">{(sm.dsbAggregate?.totalUnattended ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Unattended</p>
                </div>
              </div>
              {(() => {
                const dsbItems = [
                  { label: "Simultaneous Deliveries", value: sm.dsbAggregate?.totalSimultaneous ?? 0 },
                  { label: "Delivered >50m from Address", value: sm.dsbAggregate?.totalOver50m ?? 0 },
                  { label: "Incorrect Scan (Attended)", value: sm.dsbAggregate?.totalIncorrectAttended ?? 0 },
                  { label: "Incorrect Scan (Unattended)", value: sm.dsbAggregate?.totalIncorrectUnattended ?? 0 },
                  { label: "No POD on Delivery", value: sm.dsbAggregate?.totalNoPod ?? 0 },
                  { label: "Scanned Not Delivered", value: sm.dsbAggregate?.totalSNDNR ?? 0 },
                ];
                const maxDsb = Math.max(...dsbItems.map(i => i.value), 1);
                return dsbItems.map(item => (
                  <div key={item.label} className="space-y-0.5 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{item.label}</span>
                      <span className="text-xs font-semibold tabular-nums">{item.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400 transition-all duration-500" style={{ width: `${(item.value / maxDsb) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          {/* POD Rejection Analysis */}
          <Card className="overflow-hidden py-0">
            <div className="bg-teal-500/5 border-b border-teal-500/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10"><Camera className="h-5 w-5 text-teal-500" /></div>
                <div>
                  <h3 className="text-base font-bold">Photo-On-Delivery Analysis</h3>
                  <p className="text-xs text-muted-foreground">ScoreCard_PhotoOnDelivery</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-teal-500">{sm.deliveryQuality.podAcceptanceRate}%</p>
                <p className="text-[10px] text-muted-foreground">acceptance</p>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <p className="text-base font-black">{(sm.deliveryQuality.totalPodOpps ?? 0).toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">Opportunities</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <p className="text-base font-black text-emerald-500">{(sm.deliveryQuality.totalPodSuccess ?? 0).toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">Success</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <p className="text-base font-black text-amber-500">{sm.deliveryQuality.totalPodBypass ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground">Bypass</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <p className="text-base font-black text-red-500">{sm.deliveryQuality.totalPodRejects ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground">Rejects</p>
                </div>
              </div>
              {(sm.deliveryQuality.totalPodOpps ?? 0) > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Success Rate</span>
                    <span className="font-semibold">{sm.deliveryQuality.podAcceptanceRate}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-red-500/20 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500" style={{ width: `${sm.deliveryQuality.podAcceptanceRate}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Collection Health ──────────────────────────────────────── */}
        <Card className="overflow-hidden py-0">
          <div className="bg-slate-500/5 border-b border-slate-500/20 p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10"><Activity className="h-5 w-5 text-slate-500" /></div>
            <div>
              <h3 className="text-base font-bold">Collection Health — {selectedWeek}</h3>
              <p className="text-xs text-muted-foreground">Record counts per data source</p>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "Delivery Excellence", count: sm.collectionCounts?.deliveryExcellence ?? 0, icon: "🏆", color: "text-emerald-500" },
                { name: "Photo on Delivery", count: sm.collectionCounts?.photoOnDelivery ?? 0, icon: "📸", color: "text-teal-500" },
                { name: "DVIC Inspection", count: sm.collectionCounts?.dvicVehicleInspection ?? 0, icon: "📋", color: "text-sky-500" },
                { name: "Safety Dashboard", count: sm.collectionCounts?.safetyDashboardDFO2 ?? 0, icon: "🛡️", color: "text-red-500" },
                { name: "CDF Negative", count: sm.collectionCounts?.cdfNegative ?? 0, icon: "⚠️", color: "text-amber-500" },
                { name: "Quality DSB/DNR", count: sm.collectionCounts?.qualityDSBDNR ?? 0, icon: "📊", color: "text-rose-500" },
                { name: "DCR", count: sm.collectionCounts?.dcr ?? 0, icon: "📦", color: "text-violet-500" },
              ].map(col => (
                <div key={col.name} className="rounded-lg bg-muted/30 border p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                  <span className="text-xl">{col.icon}</span>
                  <div>
                    <p className={cn("text-lg font-black tabular-nums", col.color)}>{col.count}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{col.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Focus Areas + Tips ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sm.focusAreas.length > 0 && (
            <Card className="overflow-hidden border-amber-500/20 py-0">
              <div className="bg-amber-500/5 border-b border-amber-500/20 p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
                <h3 className="text-base font-bold">Recommended Focus Areas</h3>
              </div>
              <CardContent className="p-4 space-y-3">
                {sm.focusAreas.map((fa: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <div><p className="text-sm font-semibold">{fa.area}</p><p className="text-xs text-muted-foreground mt-0.5">{fa.reason}</p></div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground italic mt-2">Improving these areas would improve your Overall Standing.</p>
              </CardContent>
            </Card>
          )}
          <Card className="overflow-hidden border-blue-500/20 py-0">
            <div className="bg-blue-500/5 border-b border-blue-500/20 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Lightbulb className="h-5 w-5 text-blue-500" /></div>
              <h3 className="text-base font-bold">Current Week Tips</h3>
            </div>
            <CardContent className="p-4 space-y-3">
              {currentTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/80">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </>}
      {!sm && (
        <Card className="py-12"><CardContent className="flex flex-col items-center justify-center text-center">
          <Target className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No SYMX scorecard data for this week</p>
        </CardContent></Card>
      )}
    </div>
  );
}
