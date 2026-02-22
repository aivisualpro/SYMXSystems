"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SignaturePad from "@/components/ui/signature-pad";
import {
  Shield, Target, TrendingUp, Info, CheckCircle2, Activity,
  ClipboardCheck, ShieldAlert, MessageSquareWarning, Smile, Pen, Save,
  Loader2, Lightbulb, AlertTriangle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getTier, METRIC_INFO } from "./constants";
import { TierBadge, DebouncedTextarea } from "./shared-components";
import type { DriverData } from "./types";

interface DriverDetailDialogProps {
  selectedDriver: DriverData | null;
  drivers: DriverData[];
  selectedWeek: string;
  loggedInUserName: string;
  driverRemarks: string;
  setDriverRemarks: (v: string) => void;
  managerRemarks: string;
  setManagerRemarks: (v: string) => void;
  driverSignature: string;
  setDriverSignature: (v: string) => void;
  managerSignature: string;
  setManagerSignature: (v: string) => void;
  driverSigTimestamp: string | null;
  managerSigTimestamp: string | null;
  savingRemarks: boolean;
  saveRemarks: () => void;
  onClose: () => void;
}

export function DriverDetailDialog({
  selectedDriver, drivers, selectedWeek, loggedInUserName,
  driverRemarks, setDriverRemarks, managerRemarks, setManagerRemarks,
  driverSignature, setDriverSignature, managerSignature, setManagerSignature,
  driverSigTimestamp, managerSigTimestamp, savingRemarks, saveRemarks, onClose,
}: DriverDetailDialogProps) {
  const [infoModal, setInfoModal] = useState<{ key: string; score: string } | null>(null);

  return (
    <>
    <Dialog open={!!selectedDriver} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] p-0 gap-0 overflow-hidden border border-white/10 shadow-2xl rounded-2xl backdrop-blur-xl bg-background/85">
        <DialogHeader className="sr-only"><DialogTitle>Driver Scorecard</DialogTitle><DialogDescription>Detailed performance breakdown</DialogDescription></DialogHeader>
        {selectedDriver && (() => {
          const d = selectedDriver;
          const rank = [...drivers].sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0)).findIndex(x => x.transporterId === d.transporterId) + 1;
          const podRate = d.podOpportunities > 0 ? Math.round((d.podSuccess / d.podOpportunities) * 10000) / 100 : 0;

          const focusAreas: { title: string; tip: string }[] = [];
          if (d.dsb > 0) focusAreas.push({ title: 'Delivery Success Behaviors', tip: 'Focus on following the correct sequence at every stop — scan, photo, confirm. Skipping steps or rushing through can trigger DSB flags.' });
          if (d.podRejects > 0) focusAreas.push({ title: 'Photo-On-Delivery Quality', tip: 'Make sure your photos clearly show the package at the delivery location. Avoid blurry images, photos that are too close, or images that include people.' });
          if (d.speedingEventRate > 0.5) focusAreas.push({ title: 'Speeding Events', tip: 'Keep an eye on your speed, especially in residential areas and school zones. Reducing your speed will directly improve your FICO score.' });
          if (d.distractionsRate > 0.5) focusAreas.push({ title: 'Distraction Events', tip: 'Avoid using your phone while driving. Place it in a mount and use voice commands when needed. Every distraction event impacts your safety score.' });
          if (focusAreas.length === 0) focusAreas.push({ title: 'Great Work!', tip: 'You\'re performing well across all categories. Keep it up and maintain your focus on safety and delivery quality.' });

          return (
            <div className="overflow-y-auto max-h-[88vh] scorecard-scroll">
              {/* ── HEADER ── */}
              <div className="px-6 pt-7 pb-5">
                <div className="flex items-center gap-4 mb-5">
                  {d.profileImage ? (
                    <div className="h-[60px] w-[60px] rounded-full bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-[2px] shrink-0 shadow-md">
                      <Image src={d.profileImage} alt={d.name} width={56} height={56} className="h-full w-full rounded-full object-cover" />
                    </div>
                  ) : (
                    <div className={cn("h-[60px] w-[60px] rounded-full flex items-center justify-center text-lg font-black text-white shrink-0 shadow-md", "bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a]")}>
                      {d.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight truncate">{d.name}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{d.transporterId}</p>
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="text-2xl font-black tracking-tight text-[#1a6a7a]">{selectedWeek}</h3>
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mt-3" />
                  <div className="flex justify-center -mt-2"><div className="w-3 h-3 rotate-45 bg-[hsl(var(--background))] border-b border-r border-border" /></div>
                </div>
                <p className="text-center text-muted-foreground text-sm">Deliveries: <span className="font-black text-lg text-foreground tabular-nums">{d.packagesDelivered.toLocaleString()}</span></p>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-xl bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-5 text-center text-white shadow-md">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-80" />
                    <p className="text-xl font-black">{d.overallStanding}</p>
                    <p className="text-[11px] text-white/60 mt-1">Overall Tier</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-[#1a7a8a] to-[#1a5f6a] p-5 text-center text-white shadow-md">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-80" />
                    <p className="text-xl font-black">{rank}<span className="text-sm font-medium text-white/50"> / {drivers.length}</span></p>
                    <p className="text-[11px] text-white/60 mt-1">Rank</p>
                  </div>
                </div>
              </div>

              {/* ── DRIVING SAFETY ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white">Driving Safety</h3>
                  <Shield className="h-5 w-5 text-white/70" />
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'on-road-safety-score', score: d.ficoTier || 'N/A' })}>
                    <span className="text-sm font-bold">On-Road Safety Score</span>
                    <div className="flex items-center gap-1.5"><span className="text-sm font-black">{d.ficoTier || 'N/A'}</span><Info className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'fico-score', score: `${d.ficoMetric ?? '—'}/850` })} style={{ background: `linear-gradient(270deg, ${(d.ficoMetric ?? 0) >= 800 ? 'rgba(16,185,129,0.15)' : (d.ficoMetric ?? 0) >= 700 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'} 0%, transparent 60%)` }}>
                    <span className="text-sm font-bold">FICO Score</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black tabular-nums">
                        <span className={(d.ficoMetric ?? 0) >= 800 ? 'text-emerald-600' : (d.ficoMetric ?? 0) >= 700 ? 'text-amber-500' : 'text-red-500'}>{d.ficoMetric ?? '—'}</span>
                        <span className="text-muted-foreground font-normal">/850</span>
                      </span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'proper-park-sequence', score: 'Coming Soon' })} style={{ background: 'linear-gradient(270deg, rgba(245,158,11,0.12) 0%, transparent 60%)' }}>
                    <span className="text-sm font-bold">Proper-Park-Sequence Compliance</span>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span><Info className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2 pl-7 border-b border-border/10"><span className="text-sm text-muted-foreground">Did Not Apply Parking Brake</span><span className="text-sm font-black tabular-nums text-muted-foreground/50">—</span></div>
                  <div className="flex justify-between items-center px-4 py-2 pl-7 border-b border-border/10"><span className="text-sm text-muted-foreground">Did Not Shift Gear to Park</span><span className="text-sm font-black tabular-nums text-muted-foreground/50">—</span></div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'paw-print-contact', score: 'Coming Soon' })} style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 50%, transparent 100%)' }}>
                    <span className="text-sm font-bold">Paw Print Contact Compliance</span>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span><Info className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
                  </div>
                  <div className="px-4 pt-3.5 pb-2 border-b border-border/15"><span className="text-sm font-black">Events</span><span className="text-xs text-muted-foreground ml-1">(Per 100 Deliveries)</span></div>
                  {(() => {
                    const events = [
                      { label: 'Distractions', value: d.distractionsRate, infoKey: 'distractions' },
                      { label: 'Speeding', value: d.speedingEventRate, infoKey: 'speeding' },
                      { label: 'Seatbelt Off', value: d.seatbeltOffRate, infoKey: 'seatbelt-off' },
                      { label: 'Follow Distance', value: d.followingDistanceRate, infoKey: 'follow-distance' },
                      { label: 'Sign/Signal Violations', value: d.signSignalViolationsRate, infoKey: 'sign-signal-violations' },
                    ];
                    const getEventColor = (v: number) => {
                      if (v === 0) return { text: 'text-emerald-500', bg: 'transparent' };
                      if (v <= 0.3) return { text: 'text-emerald-500', bg: 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, transparent 60%)' };
                      if (v <= 0.8) return { text: 'text-amber-500', bg: 'linear-gradient(270deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' };
                      if (v <= 1.5) return { text: 'text-orange-500', bg: 'linear-gradient(270deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.05) 50%, transparent 100%)' };
                      return { text: 'text-red-500', bg: 'linear-gradient(270deg, rgba(239,68,68,0.20) 0%, rgba(239,68,68,0.06) 50%, transparent 100%)' };
                    };
                    return events.map((m, idx) => {
                      const colors = getEventColor(m.value);
                      return (
                        <div key={m.label} className={cn("flex justify-between items-center px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors", idx < events.length - 1 && "border-b border-border/10")} style={{ background: colors.bg }} onClick={() => setInfoModal({ key: m.infoKey, score: String(m.value) })}>
                          <span className="text-sm font-bold">{m.label}</span>
                          <div className="flex items-center gap-1.5"><span className={cn("text-sm font-black tabular-nums", colors.text)}>{m.value}</span><Info className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* ── DELIVERY QUALITY ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a8a5a] to-[#1a6a4a] mx-4 rounded-t-xl"><h3 className="font-black text-sm text-white">Delivery Quality</h3><CheckCircle2 className="h-5 w-5 text-white/70" /></div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 60%, transparent 100%)' }}><span className="text-sm font-bold">Overall Quality Score</span><span className="text-sm font-black text-emerald-600">{d.dcrTier || 'N/A'}</span></div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'completion-rate', score: `${d.dcr}` })}><span className="text-sm font-bold">Completion Rate</span><span className="text-sm font-black tabular-nums">{d.dcr}</span></div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'delivered-not-received', score: `${d.ced}/${d.packagesDelivered}` })} style={{ background: d.ced > 0 ? 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' : undefined }}><span className="text-sm font-bold">Delivered, Not Received</span><span className={cn("text-sm font-black tabular-nums", d.ced > 0 && "text-amber-500")}>{d.ced}<span className="text-muted-foreground font-normal">/{d.packagesDelivered}</span></span></div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'pod-acceptance', score: `${podRate}%` })} style={{ background: 'linear-gradient(270deg, rgba(16,185,129,0.10) 0%, transparent 60%)' }}><span className="text-sm font-bold">Photo-On-Delivery Acceptance</span><span className="text-sm font-black tabular-nums">{podRate}%</span></div>
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setInfoModal({ key: 'pod-rejects', score: `${d.podRejects}/${d.podOpportunities || '—'}` })}><span className="text-sm font-bold">Photo-On-Delivery Rejects</span><span className={cn("text-sm font-black tabular-nums", d.podRejects > 0 && "text-amber-500")}>{d.podRejects}<span className="text-muted-foreground font-normal">/{d.podOpportunities || '—'}</span></span></div>
                  {d.podRejects > 0 && Object.entries(d.podRejectBreakdown).length > 0 && (
                    <>{Object.entries(d.podRejectBreakdown).sort(([,a],[,b]) => (b as number) - (a as number)).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between items-center px-4 py-2 pl-7 border-b border-border/10"><span className="text-sm text-muted-foreground">{reason}</span><span className={cn("text-sm font-black tabular-nums", (count as number) > 0 && "text-red-500")}>{count as number}</span></div>
                    ))}</>
                  )}
                  <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: d.dsb > 0 ? 'linear-gradient(270deg, rgba(245,158,11,0.18) 0%, rgba(239,68,68,0.08) 50%, transparent 100%)' : 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, transparent 60%)' }}><span className="text-sm font-bold">Delivery Success Behaviors</span><span className={cn("text-sm font-black tabular-nums", d.dsb > 0 ? "text-amber-500" : "text-emerald-500")}>{d.dsb}</span></div>
                  <div className="flex justify-between items-center px-4 py-2.5" style={{ background: 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' }}><span className="text-sm font-bold">Pickup Success Behaviors</span><span className="text-[10px] font-semibold text-muted-foreground italic">Coming Soon</span></div>
                </div>
              </div>

              {/* ── DVIC ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl"><h3 className="font-black text-sm text-white">Vehicle Inspection Times (DVIC)</h3><ClipboardCheck className="h-5 w-5 text-white/70" /></div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-3 mb-4">
                  {d.dvicTotalInspections > 0 ? (() => {
                    const parseDurSec = (dur: string | number | undefined): number => { if (dur == null || dur === "") return 0; if (!isNaN(Number(dur))) return Number(dur); const s = String(dur); const minM = s.match(/(\d+(?:\.\d+)?)\s*min/i); if (minM) return parseFloat(minM[1]) * 60; const parts = s.split(":"); if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]); if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]); return 0; };
                    const fmtMMSS = (sec: number): string => { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };
                    const fmtDay = (dateStr: string): string => { if (!dateStr) return '—'; try { const dt = new Date(dateStr + 'T00:00:00'); const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return `${days[dt.getDay()]} ${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getDate().toString().padStart(2,'0')}`; } catch { return dateStr; } };
                    const inspections = d.dvicInspections.map((insp, idx) => { const sec = parseDurSec(insp.duration); return { ...insp, sec, isRushed: sec > 0 && sec < 90, idx }; });
                    inspections.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
                    return (<>
                      <div className="flex items-center justify-between py-2 mb-2 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg px-1 -mx-1" onClick={() => setInfoModal({ key: 'dvic-rushed', score: `${d.dvicRushedCount}/${d.dvicTotalInspections}` })}>
                        <div className="flex items-center gap-1.5"><span className="text-sm font-black">Rushed Inspections</span><Info className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
                        <span className={cn("text-sm font-black tabular-nums", d.dvicRushedCount > 0 ? "text-amber-500" : "text-emerald-500")}>{d.dvicRushedCount}/{d.dvicTotalInspections}</span>
                      </div>
                      <div className="space-y-1.5">
                        {inspections.map((insp) => {
                          const isRed = insp.sec > 0 && insp.sec < 80;
                          const isOrange = insp.sec >= 80 && insp.sec < 90;
                          const statusLower = (insp.inspectionStatus || '').toLowerCase();
                          const statusColor = statusLower === 'complete' || statusLower === 'passed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : statusLower === 'incomplete' || statusLower === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-muted text-muted-foreground border-border/30';
                          const statusDot = statusLower === 'complete' || statusLower === 'passed' ? 'bg-emerald-500' : statusLower === 'incomplete' || statusLower === 'failed' ? 'bg-red-500' : 'bg-muted-foreground';
                          const gradientBg = isRed ? 'linear-gradient(270deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.12) 40%, transparent 100%)' : isOrange ? 'linear-gradient(270deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.10) 40%, transparent 100%)' : '';
                          const durationColor = isRed ? 'text-red-500' : isOrange ? 'text-amber-500' : 'text-foreground';
                          return (
                            <div key={insp.idx} className={cn("relative rounded-lg overflow-hidden transition-colors", insp.isRushed ? "" : "hover:bg-muted/20")}>
                              {insp.isRushed && <div className="absolute inset-0 rounded-lg" style={{ background: gradientBg }} />}
                              <div className="relative flex items-center px-3 py-2 gap-0">
                                {insp.isRushed && <AlertTriangle className={cn("h-3 w-3 flex-shrink-0 mr-1.5", isRed ? "text-red-500" : "text-amber-500")} />}
                                <span className={cn("text-xs font-semibold whitespace-nowrap", insp.isRushed ? "text-foreground" : "text-foreground/80")}>{fmtDay(insp.startDate)}</span>
                                <span className="mx-2 text-border/60 select-none">|</span>
                                <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap" title={insp.vin}>{insp.vin ? `VIN …${insp.vin.slice(-6)}` : '—'}</span>
                                {insp.fleetType && <><span className="mx-2 text-border/60 select-none">|</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20 font-medium whitespace-nowrap">{insp.fleetType}</span></>}
                                {insp.inspectionStatus && <><span className="mx-2 text-border/60 select-none">|</span><span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap", statusColor)}><span className={cn("w-1 h-1 rounded-full", statusDot)} />{insp.inspectionStatus}</span></>}
                                <span className="mx-2 text-border/60 select-none">|</span>
                                <span className={cn("text-sm font-black font-mono tabular-nums whitespace-nowrap ml-auto", durationColor)}>{insp.sec > 0 ? fmtMMSS(insp.sec) : (insp.duration || '—')}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>);
                  })() : (<div className="py-6 text-center"><ClipboardCheck className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" /><p className="text-xs text-muted-foreground">No inspections recorded this week</p></div>)}
                </div>
              </div>

              {/* ── SAFETY DASHBOARD DFO2 ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-600 to-amber-600 mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-white/70" />Safety Dashboard</h3>
                  <span className="text-sm font-black tabular-nums text-white">{d.safetyEventCount} Event{d.safetyEventCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4">
                  {d.safetyEvents.length > 0 ? (
                    <div className="space-y-1.5">
                      {d.safetyEvents.map((evt, idx) => {
                        const impactLower = (evt.programImpact || '').toLowerCase();
                        const impactColor = impactLower.includes('tier 1') || impactLower.includes('high') ? 'bg-red-500/10 text-red-500 border-red-500/20' : impactLower.includes('tier 2') || impactLower.includes('medium') ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                        return (
                          <div key={idx} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                            <span className="text-sm font-bold whitespace-nowrap">{evt.metricType || '—'}</span>
                            {evt.metricSubtype && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">{evt.metricSubtype}</span>}
                            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{evt.date || evt.dateTime || '—'}</span>
                            {evt.programImpact && <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap", impactColor)}>{evt.programImpact}</span>}
                            {evt.source && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{evt.source}</span>}
                            {evt.videoLink && <a href={evt.videoLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-500 hover:underline ml-auto whitespace-nowrap">View Video</a>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (<div className="py-6 text-center"><ShieldAlert className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" /><p className="text-xs text-muted-foreground">No safety events recorded this week</p></div>)}
                </div>
              </div>

              {/* ── CDF NEGATIVE FEEDBACK ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2"><MessageSquareWarning className="h-5 w-5 text-white/70" />CDF Negative Feedback</h3>
                  <span className="text-sm font-black tabular-nums text-white">{d.cdfNegativeCount} Record{d.cdfNegativeCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4">
                  {d.cdfNegativeRecords && d.cdfNegativeRecords.length > 0 ? (
                    <div className="space-y-2">
                      {d.cdfNegativeRecords.map((rec, idx) => {
                        const flags: string[] = [];
                        if (rec.daMishandledPackage?.toLowerCase() === 'true') flags.push('Mishandled Package');
                        if (rec.daWasUnprofessional?.toLowerCase() === 'true') flags.push('Unprofessional');
                        if (rec.daDidNotFollowInstructions?.toLowerCase() === 'true') flags.push('Did Not Follow Instructions');
                        if (rec.deliveredToWrongAddress?.toLowerCase() === 'true') flags.push('Wrong Address');
                        if (rec.neverReceivedDelivery?.toLowerCase() === 'true') flags.push('Never Received');
                        if (rec.receivedWrongItem?.toLowerCase() === 'true') flags.push('Wrong Item');
                        return (
                          <div key={idx} className="rounded-lg border border-border/30 overflow-hidden hover:border-border/50 transition-colors">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
                              <div className="flex items-center gap-2 flex-wrap">{flags.length > 0 ? flags.map((f, fi) => <span key={fi} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-semibold">{f}</span>) : <span className="text-[10px] text-muted-foreground italic">No categories flagged</span>}</div>
                              <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">{rec.deliveryDate || '—'}</span>
                            </div>
                            {rec.feedbackDetails && <div className="px-3 py-2"><p className="text-xs text-muted-foreground leading-relaxed">{rec.feedbackDetails}</p></div>}
                            <div className="flex items-center gap-2 px-3 pb-2">{rec.trackingId && <span className="text-[10px] font-mono text-muted-foreground">TID: {rec.trackingId}</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (<div className="py-6 text-center"><MessageSquareWarning className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" /><p className="text-xs text-muted-foreground">No negative feedback records this week</p></div>)}
                </div>
              </div>

              {/* ── QUALITY DSB / DNR ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 mx-4 rounded-t-xl">
                  <h3 className="font-black text-sm text-white flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-white/70" />Quality DSB / DNR</h3>
                  {d.qualityDsbDnr && <span className="text-sm font-black tabular-nums text-white">{d.qualityDsbDnr.dsbCount} DSB</span>}
                </div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-0 py-0 mb-4 overflow-hidden">
                  {d.qualityDsbDnr ? (() => {
                    const q = d.qualityDsbDnr;
                    const dsbColor = q.dsbCount === 0 ? 'text-emerald-500' : q.dsbCount <= 3 ? 'text-amber-500' : 'text-red-500';
                    const getRowGradient = (val: number) => val > 0 ? 'linear-gradient(270deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, transparent 100%)' : undefined;
                    return (<>
                      <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15" style={{ background: q.dsbCount > 0 ? 'linear-gradient(270deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 50%, transparent 100%)' : 'linear-gradient(270deg, rgba(16,185,129,0.12) 0%, transparent 60%)' }}><span className="text-sm font-bold">DSB Count</span><span className={cn("text-sm font-black tabular-nums", dsbColor)}>{q.dsbCount}</span></div>
                      <div className="flex justify-between items-center px-4 py-2.5 border-b border-border/15"><span className="text-sm font-bold">DSB DPMO</span><span className="text-sm font-black tabular-nums">{q.dsbDpmo.toLocaleString()}</span></div>
                      <div className="px-4 pt-3 pb-1.5 border-b border-border/15"><span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Breakdown</span></div>
                      {([
                        { label: 'Attended Deliveries', value: q.attendedDeliveryCount },
                        { label: 'Unattended Deliveries', value: q.unattendedDeliveryCount },
                        { label: 'Simultaneous Deliveries', value: q.simultaneousDeliveries },
                        { label: 'Delivered > 50m', value: q.deliveredOver50m },
                        { label: 'Incorrect Scan (Attended)', value: q.incorrectScanUsageAttended },
                        { label: 'Incorrect Scan (Unattended)', value: q.incorrectScanUsageUnattended },
                        { label: 'No POD on Delivery', value: q.noPodOnDelivery },
                        { label: 'Scanned Not Delivered/Returned', value: q.scannedNotDeliveredNotReturned },
                      ] as const).map((row, idx, arr) => (
                        <div key={row.label} className={cn("flex justify-between items-center px-4 py-2 pl-7", idx < arr.length - 1 && "border-b border-border/10")} style={{ background: getRowGradient(row.value) }}>
                          <span className="text-sm text-muted-foreground">{row.label}</span>
                          <span className={cn("text-sm font-black tabular-nums", row.value > 0 ? "text-amber-500" : "text-muted-foreground/50")}>{row.value || '—'}</span>
                        </div>
                      ))}
                    </>);
                  })() : (<div className="py-6 text-center"><ClipboardCheck className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" /><p className="text-xs text-muted-foreground">No DSB/DNR data this week</p></div>)}
                </div>
              </div>

              {/* ── FOCUS AREA & GUIDANCE ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl"><h3 className="font-black text-sm text-white">Focus Area & Guidance</h3><Activity className="h-5 w-5 text-white/70" /></div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-5 py-4 mb-4 space-y-3">
                  {focusAreas.map((fa, idx) => (
                    <div key={idx} className={cn(idx > 0 && "pt-3 border-t border-border/30")}><p className="text-sm leading-relaxed"><span className="font-black">{fa.title}:</span>{' '}<span className="text-muted-foreground">{fa.tip}</span></p></div>
                  ))}
                </div>
              </div>

              {/* ── REMARKS & SIGNATURES ── */}
              <div>
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] mx-4 rounded-t-xl"><h3 className="font-black text-sm text-white">Remarks & Signatures</h3><Pen className="h-5 w-5 text-white/70" /></div>
                <div className="mx-4 border border-t-0 border-border/40 rounded-b-xl bg-card/60 px-4 py-4 mb-4 space-y-3">
                  <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/40"><p className="text-[10px] uppercase tracking-widest font-black text-foreground/70 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-[#1a7a8a]"></span>Driver</p></div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div><p className="text-xs font-bold text-foreground mb-1">{d.name}</p><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label><DebouncedTextarea placeholder="Enter driver remarks..." className="min-h-[100px] text-xs resize-none border-2 border-border/40 focus:border-[#1a7a8a]/50 transition-colors bg-transparent" value={driverRemarks} onChange={setDriverRemarks} /></div>
                      <div><p className="text-xs font-bold text-foreground mb-1">{d.name}</p><SignaturePad value={driverSignature} onChange={setDriverSignature} height={100} label="Signature" timestamp={driverSigTimestamp ? format(new Date(driverSigTimestamp), 'MMM d, yyyy h:mm a') : null} /></div>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/40"><p className="text-[10px] uppercase tracking-widest font-black text-foreground/70 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-[#1a5f6a]"></span>Manager</p></div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div><p className="text-xs font-bold text-foreground mb-1">{loggedInUserName || 'Manager'}</p><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label><DebouncedTextarea placeholder="Enter manager remarks..." className="min-h-[100px] text-xs resize-none bg-transparent border-2 border-border/40 focus:border-[#1a7a8a]/50 transition-colors" value={managerRemarks} onChange={setManagerRemarks} /></div>
                      <div><p className="text-xs font-bold text-foreground mb-1">{loggedInUserName || 'Manager'}</p><SignaturePad value={managerSignature} onChange={setManagerSignature} height={100} label="Signature" timestamp={managerSigTimestamp ? format(new Date(managerSigTimestamp), 'MMM d, yyyy h:mm a') : null} /></div>
                    </div>
                  </div>
                  <Button className="w-full gap-2 bg-gradient-to-r from-[#1a7a8a] to-[#1a5f6a] hover:from-[#1a6a7a] hover:to-[#1a4f5a] text-white" onClick={saveRemarks} disabled={savingRemarks}>
                    {savingRemarks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingRemarks ? 'Saving...' : 'Save Remarks & Signatures'}
                  </Button>
                </div>
              </div>

              {/* ── FOOTER TIP ── */}
              <div className="mx-4 mb-4 rounded-xl border border-[#1a7a8a]/20 bg-[#1a7a8a]/5 px-4 py-3">
                <div className="flex gap-3 items-center"><Lightbulb className="h-5 w-5 text-[#1a7a8a] shrink-0" /><p className="text-[11px] text-muted-foreground leading-relaxed">Tap on any metric to see more information about what it measures and how it&apos;s calculated.</p></div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* ── METRIC INFO MODAL ── */}
    <Dialog open={!!infoModal} onOpenChange={() => setInfoModal(null)}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border border-border/60 shadow-2xl rounded-2xl">
        <DialogHeader className="sr-only"><DialogTitle>Metric Information</DialogTitle><DialogDescription>Details about this metric</DialogDescription></DialogHeader>
        {infoModal && METRIC_INFO[infoModal.key] && (() => {
          const info = METRIC_INFO[infoModal.key];
          return (
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4"><h3 className="text-lg font-black tracking-tight leading-tight">{info.title}</h3><button onClick={() => setInfoModal(null)} className="shrink-0 p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button></div>
              <div className="space-y-3">{info.description.split('\n\n').map((paragraph, idx) => <p key={idx} className="text-sm text-muted-foreground leading-relaxed">{paragraph}</p>)}</div>
              {info.howMeasured && <div className="space-y-2 pt-1"><h4 className="text-sm font-black uppercase tracking-wide">How It&apos;s Measured</h4><p className="text-sm text-muted-foreground leading-relaxed">{info.howMeasured}</p></div>}
              {infoModal.score && <div className="pt-2 border-t border-border/30 space-y-1.5"><h4 className="text-sm font-black uppercase tracking-wide">Your Score</h4><p className="text-2xl font-black tabular-nums tracking-tight">{infoModal.score}</p></div>}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
    </>
  );
}
