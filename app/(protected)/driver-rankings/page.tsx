"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Copy, Download, Link, Loader2, Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyScorecardImport } from "@/components/driver-ranking/weekly-scorecard-import";
import { QualityDetailImport } from "@/components/driver-ranking/quality-detail-import";
import { RankingSettingsDialog } from "@/components/driver-ranking/ranking-settings-dialog";
import { TeamPerformanceDashboard } from "@/components/driver-ranking/team-performance-dashboard";
import { DriverHistoryReviewPanel } from "@/components/driver-ranking/driver-history-review-panel";
import type { AmazonMetric, DriverRankingResult, DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";
import { amazonWeeklyMetrics } from "@/lib/driver-ranking/amazon-weekly-summary";
import { efficiencyDistribution, getEfficiencyPerformanceState, getOperationalPerformanceState, performanceValueClass, type EfficiencyDistribution, type PerformanceState } from "@/lib/driver-ranking/performance-colors";
import { defaultDirection, sortDrivers, type DriverSortKey, type SortDirection } from "@/lib/driver-ranking/driver-ranking-sort";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";

type DriverRankingsPageData = DriverRankingResult & {
  publicDriverPerformanceEnabled?: boolean;
};

const PublicDriverLinkContext = createContext(false);

const shown = (value: number | null | undefined, suffix = "") => value === null || value === undefined ? "N/A" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
const duration = (minutes: number | null | undefined) => minutes === null || minutes === undefined ? "N/A" : `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;
const sorts: Array<[DriverSortKey, string]> = [["rank", "Rank"], ["name", "Name"], ["efficiency", "Efficiency"], ["averageRoute", "Avg Route"], ["days", "Days"], ["routes", "Routes"], ["stops", "Stops"], ["packages", "Packages"], ["callouts", "Call Outs"], ["writeups", "Write-Ups"]];
function PerformanceValue({ value, state }: { value: string; state: PerformanceState }) { return state === "neutral" ? <span className="text-sm font-medium tabular-nums">{value}</span> : <span className={cn("inline-flex max-w-full rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums", performanceValueClass[state])}>{value}</span>; }
function MetricDetail({ label, metric, suffix = "" }: { label: string; metric: AmazonMetric; suffix?: string }) { return <div className="grid gap-2 border-b py-2 last:border-0 sm:grid-cols-[minmax(9rem,1fr)_repeat(3,minmax(5rem,auto))] sm:items-end"><span className="text-sm font-medium">{label}</span><span><span className="block text-[10px] uppercase text-muted-foreground">Value</span><span className="text-sm tabular-nums">{shown(metric.value, suffix)}</span></span><span><span className="block text-[10px] uppercase text-muted-foreground">Tier</span><span className="text-sm">{metric.tier?.trim() || "N/A"}</span></span><span><span className="block text-[10px] uppercase text-muted-foreground">Score</span><span className="text-sm tabular-nums">{shown(metric.score)}</span></span></div>; }
function ScoreBreakdown({ driver }: { driver: DriverRankingRow }) {
  const score = driver.score;
  if (!score) return null;
  const groups: Array<[string, Array<[string, string]>]> = [
    ["Performance", [["Safety Score", shown(score.safetyScore)], ["Quality Score", shown(score.qualityScore)], ["Efficiency Score", shown(score.efficiencyScore)]]],
    ["Workload", [["Delivery Days", shown(score.deliveryDays)], ["Delivery Days Score", shown(score.deliveryDaysScore)], ["Total Qualifying Packages", shown(score.qualifyingDeliveryPackages)], ["Packages / Delivery Day", shown(score.packagesPerDeliveryDay)], ["Packages/Day Percentile Score", shown(score.packagesPerDayPercentileScore)], ["Workload Score", shown(score.workloadScore)], ["Workload Contribution", shown(score.workloadContribution)]]],
    ["Exposure", [["Exposure Confidence", shown(score.exposureConfidence * 100, "%")], ["Team Average Base", shown(score.teamAverageBaseScore)], ["Raw Base", shown(score.baseScore)], ["Exposure Adjusted Base", shown(score.exposureAdjustedBase)]]],
    ["Modifiers", [["Call Outs", `-${shown(score.callOutPenalty)}`], ["Write-Ups", `-${shown(score.writeUpPenalty)}`], ["CED", score.cedApplied ? "Cap applied" : "No cap"]]],
    ["Final", [["Final Score", shown(score.finalScore)], ["Rank", `#${score.rank}`]]],
  ];
  return <section className="space-y-3"><h3 className="text-xs font-semibold uppercase text-muted-foreground">Score Breakdown</h3>{groups.map(([heading, values]) => <div key={heading}><h4 className="text-xs font-medium">{heading}</h4><dl className="mt-1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">{values.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}</dl></div>)}<p className="text-xs text-muted-foreground">Available weight: {shown(score.availableWeight, "%")}{score.missingMetrics.length ? ` · Missing: ${score.missingMetrics.join(", ")}` : ""}</p><details className="border-t pt-2"><summary className="cursor-pointer text-sm font-medium">Metric contributions</summary><div className="mt-2 space-y-1">{score.contributions.map(item => <p key={item.metric} className="grid grid-cols-[1fr_auto] gap-3 text-xs"><span>{item.metric}: score {shown(item.normalizedScore)} · weight {shown(item.configuredWeight, "%")} · effective {shown(item.effectiveWeight, "%")}</span><strong>{shown(item.contribution)}</strong></p>)}</div></details></section>;
}
function DriverLinkAction({ driverId }: { driverId: string }) {
  const enabled = useContext(PublicDriverLinkContext);
  const [path, setPath] = useState(""), [loading, setLoading] = useState(false);
  if (!enabled) return null;
  async function copyLink() {
    setLoading(true);
    try {
      let linkPath = path;
      if (!linkPath) {
        const response = await fetch("/api/driver-rankings/driver-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driverId }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not create driver link.");
        linkPath = body.path; setPath(linkPath);
      }
      await navigator.clipboard.writeText(`${window.location.origin}${linkPath}`);
      notify.success("Driver link copied");
    } catch (error: any) { notify.error(error.message || "Could not copy driver link."); }
    finally { setLoading(false); }
  }
  return <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void copyLink()}>{path ? <Copy className="size-4"/> : <Link className="size-4"/>}{loading ? "Preparing..." : path ? "Copy Driver Link" : "Driver Link"}</Button>;
}
function DriverDetails({ driver, availableWeeks, open, onOpenChange }: { driver: DriverRankingRow | null; availableWeeks: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [modalWeek, setModalWeek] = useState(driver?.period.yearWeek || ""), [activeDriver, setActiveDriver] = useState<DriverRankingRow | null>(driver);
  useEffect(() => { if (open && driver) { setModalWeek(driver.period.yearWeek || ""); setActiveDriver(driver); } }, [open, driver]);
  useEffect(() => {
    if (!driver || !modalWeek) return;
    if (modalWeek === driver.period.yearWeek) { setActiveDriver(driver); return; }
    const controller = new AbortController();
    setActiveDriver(null);
    fetch(`/api/driver-rankings?week=${encodeURIComponent(modalWeek)}`, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body as DriverRankingResult; })
      .then(body => setActiveDriver(body.drivers.find(row => row.transporterId === driver.transporterId) || null))
      .catch(reason => { if (reason.name !== "AbortError") setActiveDriver(null); });
    return () => controller.abort();
  }, [driver, modalWeek]);
  const amazon = activeDriver?.amazonWeekly;
  const operations = activeDriver ? [["Efficiency", shown(activeDriver.efficiency.average, "%")], ["Delivery Days", shown(activeDriver.deliveryDays)], ["Routes", shown(activeDriver.routes.count)], ["Total Planned Route", duration(activeDriver.workload.totalPlannedRouteMinutes)], ["Avg Planned Route", duration(activeDriver.workload.averagePlannedRouteMinutes)], ...(activeDriver.workload.missingPlannedDurationRouteCount > 0 ? [["Duration Coverage", `${activeDriver.workload.plannedDurationRouteCount} of ${activeDriver.routes.count} routes`]] : []), ["Stops", shown(activeDriver.production.stops)], ["Avg Stops / Route", shown(activeDriver.workload.averageStopsPerRoute)], ["Packages", shown(activeDriver.production.symxPackages)], ["Avg Packages / Route", shown(activeDriver.workload.averagePackagesPerRoute)], ["Call Outs", shown(activeDriver.attendance.callOutCount)], ["Write-Ups", shown(activeDriver.writeUps.count)]] : [];
  const weights = amazon ? [["FICO", amazon.sourceWeights.fico], ["Speeding", amazon.sourceWeights.speeding], ["Seatbelt", amazon.sourceWeights.seatbelt], ["Distractions", amazon.sourceWeights.distractions], ["Sign / Signal", amazon.sourceWeights.signSignal], ["Following Distance", amazon.sourceWeights.followingDistance], ["CDF", amazon.sourceWeights.cdf], ["CED", amazon.sourceWeights.ced], ["Delivery Completion", amazon.sourceWeights.deliveryCompletion], ["DSB", amazon.sourceWeights.dsb], ["POD", amazon.sourceWeights.pod], ["PSB", amazon.sourceWeights.psb]] as const : [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{driver?.name}</DialogTitle><DialogDescription className="sr-only">Weekly driver details</DialogDescription></DialogHeader><div className="flex flex-wrap items-end justify-between gap-2"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Weekly source data</span><Select value={modalWeek} onValueChange={setModalWeek}><SelectTrigger className="h-8 w-36"><SelectValue placeholder="Week"/></SelectTrigger><SelectContent>{availableWeeks.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>{activeDriver ? <DriverLinkAction driverId={activeDriver.driverId}/> : null}</div>{activeDriver ? <div className="space-y-5"><DriverHistoryReviewPanel transporterId={activeDriver.transporterId} week={modalWeek}/><details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">View Detailed Scoring</summary><div className="mt-4 space-y-5"><ScoreBreakdown driver={activeDriver}/><section><h3 className="text-xs font-semibold uppercase text-muted-foreground">Workload</h3><dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">{operations.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium tabular-nums">{value}</dd></div>)}</dl></section><section><h3 className="text-xs font-semibold uppercase text-muted-foreground">Amazon Safety</h3><div className="mt-1">{amazon ? <><MetricDetail label="FICO" metric={amazon.safety.fico}/><MetricDetail label="Speeding" metric={amazon.safety.speeding}/><MetricDetail label="Seatbelt" metric={amazon.safety.seatbelt}/><MetricDetail label="Distractions" metric={amazon.safety.distractions}/><MetricDetail label="Sign / Signal" metric={amazon.safety.signSignal}/><MetricDetail label="Following Distance" metric={amazon.safety.followingDistance}/></> : null}</div></section><section><h3 className="text-xs font-semibold uppercase text-muted-foreground">Amazon Quality</h3><div className="mt-1">{amazon ? <><MetricDetail label="CDF" metric={amazon.quality.cdf} suffix=" DPMO"/><MetricDetail label="CED" metric={amazon.quality.ced}/><MetricDetail label="Delivery Completion" metric={amazon.quality.deliveryCompletion} suffix=" DPMO"/><MetricDetail label="DSB" metric={amazon.quality.dsb}/><MetricDetail label="POD" metric={amazon.quality.pod} suffix="%"/><MetricDetail label="PSB" metric={amazon.quality.psb}/></> : null}</div></section><section><h3 className="text-xs font-semibold uppercase text-muted-foreground">Amazon Weekly Source</h3><dl className="mt-2"><div className="flex justify-between gap-3 text-sm"><dt>Packages Delivered</dt><dd className="font-medium tabular-nums">{shown(amazon?.packagesDelivered ?? null)}</dd></div></dl></section><details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Amazon Source Weights</summary><p className="mt-1 text-xs text-muted-foreground">Amazon source values only. These are not SYMX ranking weights.</p><dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">{weights.map(([label, value]) => <div key={label} className="flex justify-between gap-2 text-sm"><dt>{label}</dt><dd className="tabular-nums">{shown(value)}</dd></div>)}</dl></details></div></details></div> : <p className="py-8 text-sm text-muted-foreground">No ranked driver data for this week.</p>}</DialogContent></Dialog>;
}
function DriverRow({ driver, onOpen, distribution }: { driver: DriverRankingRow; onOpen: () => void; distribution: EfficiencyDistribution }) {
  const initials = driver.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const metrics: Array<[string, string, PerformanceState]> = [["Efficiency", shown(driver.efficiency.average === null ? null : Math.round(driver.efficiency.average), "%"), getEfficiencyPerformanceState(driver.efficiency.average, distribution)], ["Days", shown(driver.deliveryDays), "neutral"], ["Routes", shown(driver.routes.count), "neutral"], ["Avg Route", duration(driver.workload.averagePlannedRouteMinutes), "neutral"], ["Stops", shown(driver.production.stops), "neutral"], ["Packages", shown(driver.production.symxPackages), "neutral"], ["Call Outs", shown(driver.attendance.callOutCount), getOperationalPerformanceState(driver.attendance.callOutCount)], ["Write-Ups", shown(driver.writeUps.count), getOperationalPerformanceState(driver.writeUps.count)]];
  const weeklyMetrics = amazonWeeklyMetrics(driver.amazonWeekly);
  return <button type="button" onClick={onOpen} className="block w-full min-w-0 border-b py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0"><div className="flex min-w-0 items-center gap-3 px-1">{driver.profileImage ? <img src={driver.profileImage} alt="" className="size-11 shrink-0 rounded-full object-cover"/> : <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials || <User className="size-4"/>}</div>}<span className="shrink-0 text-xs font-semibold text-muted-foreground">#{driver.score?.rank ?? "–"}</span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{driver.name}</h2></div><span className="shrink-0 text-sm font-semibold tabular-nums">{shown(driver.score?.finalScore)}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground"/></div><section className="mt-3 min-w-0 px-1"><h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Operations</h3><dl className="mt-1 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">{metrics.map(([label, value, state]) => <div key={label} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-0.5 min-w-0 truncate"><PerformanceValue value={value} state={state}/></dd></div>)}</dl></section><section className="mt-3 min-w-0 border-t px-1 pt-3"><h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Weekly Metrics</h3><dl className="mt-1 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">{weeklyMetrics.map(metric => <div key={metric.label} className="min-w-0"><dt className="truncate text-[11px] text-muted-foreground" title={metric.label}>{metric.label}</dt><dd className="mt-0.5 min-w-0 truncate"><PerformanceValue value={metric.value} state={metric.state}/></dd></div>)}</dl></section></button>;
}
export default function DriverRankingsPage() {
  const [data, setData] = useState<DriverRankingsPageData | null>(null), [week, setWeek] = useState(""), [search, setSearch] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<DriverSortKey>("rank"), [direction, setDirection] = useState<SortDirection>("desc"), [selected, setSelected] = useState<DriverRankingRow | null>(null), [refresh, setRefresh] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(""); fetch("/api/driver-rankings" + (week ? `?week=${encodeURIComponent(week)}` : ""), { signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not load drivers."); return body; }).then(body => { if (!controller.signal.aborted) { setData(body); setWeek(current => current || body.period.yearWeek || ""); } }).catch(cause => { if (cause.name !== "AbortError") setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [week, refresh]);
  const efficiencyBands = useMemo(() => efficiencyDistribution((data?.drivers || []).map(driver => driver.efficiency.average)), [data?.drivers]);
  const drivers = useMemo(() => { const term = search.trim().toLowerCase(); return sortDrivers((data?.drivers || []).filter(driver => !term || driver.name.toLowerCase().includes(term)), sortKey, direction); }, [data?.drivers, search, sortKey, direction]);
  function chooseSort(key: DriverSortKey) { if (key === sortKey) setDirection(current => current === "asc" ? "desc" : "asc"); else { setSortKey(key); setDirection(defaultDirection(key)); } }
  const noScorecard = !loading && !error && !data?.scorecardImported;
  return <PublicDriverLinkContext.Provider value={!!data?.publicDriverPerformanceEnabled}><main className="mx-auto min-w-0 w-full max-w-6xl space-y-5 px-1 pb-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold">Driver Rankings</h1><p className="text-sm text-muted-foreground">Weekly Performance Data</p></div>
      <div className="flex flex-wrap gap-2">
        {data?.canEdit ? <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}><Settings className="size-4"/>Ranking Settings</Button> : null}
        <WeeklyScorecardImport enabled={Boolean(data?.canEdit)} onImported={importedWeek => { setWeek(importedWeek); setRefresh(value => value + 1); }}/>
        <QualityDetailImport enabled={Boolean(data?.canEdit)} week={week} onImported={() => setRefresh(value => value + 1)}/>
        <Button size="sm" variant="outline" asChild><a href={`/api/driver-rankings/export?week=${encodeURIComponent(week)}`} download><Download className="size-4"/>Export</a></Button>
      </div>
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
      <Select value={week} onValueChange={setWeek}><SelectTrigger className="min-h-10 bg-card"><SelectValue placeholder="Reporting week"/></SelectTrigger><SelectContent>{data?.availableWeeks.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      <div className="hidden sm:block"/>
      <p className={cn("self-center text-xs", data?.scorecardImported ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{data?.scorecardImported ? "Scorecard Imported ✓" : "No Weekly Scorecard"}</p>
    </div>
    <Tabs defaultValue="team" className="min-w-0">
      <TabsList className="h-auto max-w-full bg-muted/60 p-0.5">
        <TabsTrigger value="team" className="min-h-8 px-3 text-xs">Team Overview</TabsTrigger>
        <TabsTrigger value="drivers" className="min-h-8 px-3 text-xs">All Drivers</TabsTrigger>
      </TabsList>
      {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm"><Loader2 className="size-4 animate-spin"/>Loading weekly performance data...</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : noScorecard ? <section className="border-y py-10 text-center"><p className="font-medium">No Weekly Scorecard Imported</p><p className="mt-2 text-sm text-muted-foreground">Use Import Weekly Scorecard above to add this reporting week.</p></section> : <>
        <TabsContent value="team" forceMount className="min-w-0 data-[state=inactive]:hidden">
          {week ? <TeamPerformanceDashboard week={week} drivers={data?.drivers || []}/> : null}
        </TabsContent>
        <TabsContent value="drivers" className="min-w-0 space-y-3">
          <div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search driver" className="min-h-10 pl-9"/></div>
          <div className="flex min-w-0 gap-1 overflow-x-auto pb-1" aria-label="Sort drivers">{sorts.map(([key, label]) => <Button key={key} type="button" size="sm" variant={sortKey === key ? "secondary" : "ghost"} className="shrink-0" onClick={() => chooseSort(key)}>{label}{sortKey === key ? direction === "desc" ? <ArrowDown className="size-3.5"/> : <ArrowUp className="size-3.5"/> : null}</Button>)}</div>
          <section className="min-w-0 overflow-hidden border-y">{drivers.length ? drivers.map(driver => <DriverRow key={driver.driverId} driver={driver} distribution={efficiencyBands} onOpen={() => setSelected(driver)}/>) : <p className="py-8 text-sm text-muted-foreground">No drivers with a valid Weekly Score match.</p>}</section>
        </TabsContent>
      </>}
    </Tabs>
    <DriverDetails driver={selected} availableWeeks={data?.availableWeeks || []} open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}/>
    <RankingSettingsDialog open={settingsOpen} week={week} onOpenChange={setSettingsOpen} onSaved={() => setRefresh(value => value + 1)}/>
  </main></PublicDriverLinkContext.Provider>;
}
