"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { performanceMix, relativePercentChange, selectTeamFocus } from "@/lib/driver-ranking/team-performance";
import type { PerformanceBand, TeamMetricKey } from "@/lib/driver-ranking/team-performance";
import type { DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";
import type { RecognitionWinner } from "@/lib/driver-ranking/team-recognition";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const trendMetrics: Array<[TeamMetricKey, string]> = [
  ["finalScore", "Final Score"], ["efficiency", "Efficiency"], ["averageRoute", "Avg Route"],
  ["cdf", "CDF"], ["dsb", "DSB"], ["deliveryCompletion", "Delivery Completion"],
  ["pod", "POD"], ["psb", "PSB"], ["safety", "Safety"], ["quality", "Quality"],
];
const percentMetrics = new Set<TeamMetricKey>(["finalScore", "efficiency", "pod", "safety", "quality"]);
const focusMetricKeys: Record<string, TeamMetricKey> = {
  Safety: "safety", Speeding: "speeding", Seatbelt: "seatbelt", Distractions: "distractions",
  "Sign / Signal": "signSignal", "Following Distance": "followingDistance", Quality: "quality",
  CDF: "cdf", DSB: "dsb", "Delivery Completion": "deliveryCompletion", POD: "pod",
  PSB: "psb", Efficiency: "efficiency",
};
const formatTrendValue = (value: number | null | undefined, metric: TeamMetricKey) => {
  if (value === null || value === undefined) return "N/A";
  if (metric === "averageRoute") return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
  const formatted = number(value);
  return percentMetrics.has(metric) ? `${formatted}%` : formatted;
};

const number = (value: number | null | undefined) =>
  value === null || value === undefined ? "N/A" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
function Movement({ current, previous }: { current: number | null | undefined; previous: number | null | undefined }) {
  const change = relativePercentChange(current, previous);
  if (change === null) return <span className="text-xs text-muted-foreground">{previous === 0 && current !== null && current !== undefined ? "NEW" : "--"}</span>;
  const Arrow = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus;
  return <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground"><Arrow className="size-3.5" aria-hidden="true"/><span className="sr-only">{change > 0 ? "Up" : change < 0 ? "Down" : "Unchanged"}</span>{Math.round(Math.abs(change))}%</span>;
}

function RankMovement({ movement }: { movement: number | null }) {
  if (movement === null) return <span>—</span>;
  if (movement > 0) return <span className="inline-flex items-center gap-0.5"><ArrowUp className="size-3" aria-label="Up"/>{movement}</span>;
  if (movement < 0) return <span className="inline-flex items-center gap-0.5"><ArrowDown className="size-3" aria-label="Down"/>{Math.abs(movement)}</span>;
  return <span className="inline-flex items-center gap-0.5"><Minus className="size-3" aria-label="No change"/>0</span>;
}

function PotentialRecognition({ title, candidates }: { title: string; candidates: RecognitionWinner[] }) {
  return <div className="min-w-0 py-2 first:pt-0">
    <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
    {candidates.length ? <>
      <div className="mt-1 hidden grid-cols-[1rem_minmax(0,1fr)_3.7rem_2.5rem_2.5rem_1.5rem] gap-x-1.5 border-b border-border/50 pb-1 text-[10px] text-muted-foreground sm:grid"><span>#</span><span>Driver</span><span className="text-right">Avg</span><span className="text-right">Rank</span><span className="text-right">Move</span><span className="text-right">Wks</span></div>
      <ol className="divide-y divide-border/40">{candidates.map((candidate, index) => <li key={candidate.driverId} className="min-w-0 py-1.5 text-xs">
        <div className="flex min-w-0 items-center gap-1.5 sm:grid sm:grid-cols-[1rem_minmax(0,1fr)_3.7rem_2.5rem_2.5rem_1.5rem]"><span className="w-4 shrink-0 tabular-nums text-muted-foreground">{index + 1}</span><span className="min-w-0 truncate font-semibold" title={candidate.name}>{candidate.name}</span><strong className="hidden text-right tabular-nums sm:block">{number(candidate.averageScore)}%</strong><span className="hidden text-right tabular-nums sm:block">{candidate.currentRank === null ? "—" : `#${candidate.currentRank}`}</span><span className="hidden justify-end tabular-nums text-muted-foreground sm:flex"><RankMovement movement={candidate.rankMovement}/></span><span className="hidden text-right tabular-nums text-muted-foreground sm:block">{candidate.eligibleWeeks}</span></div>
        <div className="ml-[1.375rem] mt-0.5 flex gap-3 text-[11px] tabular-nums sm:hidden"><strong>{number(candidate.averageScore)}%</strong><span>{candidate.currentRank === null ? "—" : `#${candidate.currentRank}`}</span><span className="text-muted-foreground"><RankMovement movement={candidate.rankMovement}/></span><span className="text-muted-foreground">{candidate.eligibleWeeks} wks</span></div>
      </li>)}</ol>
    </> : <p className="mt-1 text-xs text-muted-foreground">Not enough data</p>}
  </div>;
}

function LastRecognition({ title, winner }: { title: string; winner: RecognitionWinner | null }) {
  return <div className="min-w-0 py-2">
    <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
    {winner ? <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_3.7rem_3rem] items-baseline gap-x-2 text-xs"><span className="min-w-0 truncate font-semibold" title={winner.name}>{winner.name}</span><strong className="text-right tabular-nums">{number(winner.averageScore)}%</strong><span className="text-right tabular-nums text-muted-foreground">{winner.eligibleWeeks} wks</span></div> : <p className="mt-1 text-xs text-muted-foreground">Not enough data</p>}
  </div>;
}

export function TeamPerformanceDashboard({ week, drivers }: { week: string; drivers: DriverRankingRow[] }) {
  const [data, setData] = useState<any>(null), [error, setError] = useState("");
  const [selectedTrendMetric, setSelectedTrendMetric] = useState<TeamMetricKey>("finalScore");
  const [selectedBand, setSelectedBand] = useState<PerformanceBand | null>(null);
  const mix = useMemo(() => performanceMix(drivers), [drivers]);
  useEffect(() => setSelectedBand(null), [week, drivers]);
  useEffect(() => {
    if (!week) return;
    const controller = new AbortController();
    setError("");
    fetch(`/api/driver-rankings/team?week=${encodeURIComponent(week)}`, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; })
      .then(setData)
      .catch(cause => { if (cause.name !== "AbortError") setError(cause.message); });
    return () => controller.abort();
  }, [week, drivers]);

  const current = data?.current, previous = data?.previous;
  const focus = useMemo(() => {
    const trend = data?.trend || [];
    return trend.length >= 2 ? selectTeamFocus(trend.at(-1), trend.at(-2)) : [];
  }, [data?.trend]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!current) return <p className="text-sm text-muted-foreground">Loading team performance...</p>;

  const performance = [
    ["Safety", current.averages.safetyScore, previous?.averages.safetyScore],
    ["Quality", current.averages.qualityScore, previous?.averages.qualityScore],
    ["Efficiency", current.averages.efficiency, previous?.averages.efficiency],
  ] as const;
  const trend = (data.trend || []).map((row: any) => ({ ...row, [selectedTrendMetric]: row[selectedTrendMetric] ?? null }));
  const latest = trend.at(-1)?.[selectedTrendMetric] as number | null | undefined;
  const mixItems = [
    { name: "Elite", value: mix.bands[0].count, color: "#047857" },
    { name: "Top", value: mix.bands[1].count, color: "#16a34a" },
    { name: "Strong", value: mix.bands[2].count, color: "#0ea5e9" },
    { name: "Solid", value: mix.bands[3].count, color: "#64748b" },
    { name: "Needs Attention", value: mix.bands[4].count, color: "#d97706" },
  ];
  const selected = mix.bands.find(band => band.name === selectedBand);
  const bottomFive = [...drivers].filter(driver => driver.score && Number.isFinite(driver.score.rank))
    .sort((a, b) => b.score!.rank - a.score!.rank).slice(0, 5);

  return <section className="border-y py-4">
    <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold">Team Performance</h2>
        <div className="mt-2 divide-y">
          {performance.map(([label, value, prior]) => <div key={label} className="flex min-h-12 items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="flex items-baseline gap-3"><strong className="text-xl font-semibold tabular-nums">{number(value)}{value === null || value === undefined ? "" : "%"}</strong><Movement current={value} previous={prior}/></span>
          </div>)}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Team Areas to Work On</h2>
        <div className="mt-2 divide-y">
          {focus.map(item => <div key={item.metric} className="flex min-h-12 items-center justify-between gap-3 py-1.5">
            <span className="text-sm">{item.metric}</span><Movement current={data.trend.at(-1)?.[focusMetricKeys[item.metric]]} previous={data.trend.at(-2)?.[focusMetricKeys[item.metric]]}/>
          </div>)}
        </div>
      </div>
    </div>
    <div className="mt-5 border-t pt-4">
      <h2 className="text-sm font-semibold">Team Snapshot</h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-5">
        {[
          ["Drivers Ranked", number(current.driversRanked)],
          ["Total Routes", number(current.totalRoutes)],
          ["Avg Final Score", current.averages.finalScore === null ? "N/A" : `${number(current.averages.finalScore)}%`],
          ["Avg Delivery Days", number(current.averages.deliveryDays)],
          ["CED Triggered", number(current.cedTriggeredCount)],
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
    </div>
    <div className="mt-5 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-sm font-semibold">Six-Week Trend</h2><p className="text-sm tabular-nums text-muted-foreground">{formatTrendValue(latest, selectedTrendMetric)}</p></div>
        <Select value={selectedTrendMetric} onValueChange={value => setSelectedTrendMetric(value as TeamMetricKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{trendMetrics.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="mt-3 h-[200px] min-w-0" role="img" aria-label={`Six-week ${trendMetrics.find(([key]) => key === selectedTrendMetric)?.[1]} trend`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={value => String(value).replace(/^\d{4}-/, "")} />
            <YAxis width={58} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={value => formatTrendValue(Number(value), selectedTrendMetric)} domain={["auto", "auto"]} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border border-white/15 bg-[#111] px-2.5 py-2 text-xs text-white shadow-md"><div className="font-medium">{trendMetrics.find(([key]) => key === selectedTrendMetric)?.[1]}</div><div className="mt-0.5 text-white/65">{String(label).replace(/^\d{4}-/, "")}</div><div className="mt-0.5 font-semibold tabular-nums">{formatTrendValue(typeof payload[0].value === "number" ? payload[0].value : null, selectedTrendMetric)}</div></div> : null} />
            <Line type="linear" dataKey={selectedTrendMetric} connectNulls={false} stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="mt-3 grid min-w-0 gap-5 border-t pt-3 xl:grid-cols-[minmax(0,712px)_minmax(0,1fr)] xl:gap-6">
      <div className="min-w-0">
      <h2 className="text-sm font-semibold">Performance Mix</h2>
      <div className="mt-2 grid w-full max-w-[712px] min-w-0 justify-items-start gap-3 lg:grid-cols-[220px_460px] lg:items-center lg:gap-8">
        <div className="relative h-[220px] w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <PieChart><Pie data={mixItems} dataKey="value" nameKey="name" innerRadius={75} outerRadius={105} stroke="none" isAnimationActive={false}>{mixItems.map(item => <Cell key={item.name} fill={item.color} className="cursor-pointer" onClick={() => setSelectedBand(item.name as PerformanceBand)} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[10px] text-muted-foreground">Team Avg</span><strong className="text-sm tabular-nums">{mix.average === null ? "N/A" : `${number(mix.average)}%`}</strong></div>
        </div>
        <div className="w-full max-w-[460px] min-w-0 divide-y divide-border/50 text-xs">{mixItems.map(item => { const band = mix.bands.find(value => value.name === item.name)!; return <button key={item.name} type="button" onClick={() => setSelectedBand(item.name as PerformanceBand)} aria-pressed={selectedBand === item.name} className="grid w-full min-w-0 grid-cols-[20px_minmax(0,1fr)_40px_50px] items-center gap-x-3 py-1 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 truncate">{item.name}</span><span className="text-right tabular-nums">{band.count}</span><span className="text-right tabular-nums text-muted-foreground">{band.percent}%</span></button>; })}</div>
      </div>
      {selected ? <div className="mt-2 max-w-[712px] border-t pt-2"><h3 className="text-xs font-semibold">{selected.name} · {selected.count}</h3><div className="mt-1 max-h-56 overflow-y-auto">{selected.drivers.length ? selected.drivers.map(driver => <div key={driver.driverId} className="border-b py-1.5 text-xs last:border-0"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-muted-foreground">#{driver.score?.rank}</span><span className="min-w-0 flex-1 truncate font-medium">{driver.name}</span><span className="shrink-0 tabular-nums">{number(driver.score?.finalScore)}%</span></div><div className="mt-0.5 flex flex-wrap gap-x-3 pl-7 text-muted-foreground"><span>{driver.deliveryDays} days</span><span>{number(driver.production.symxPackages)} packages</span><span>{number(driver.efficiency.average)}{driver.efficiency.average === null ? "" : "%"} efficiency</span></div></div>) : <p className="py-2 text-xs text-muted-foreground">No drivers in this band.</p>}</div></div> : null}
      </div>
      <div className="min-w-0 divide-y divide-border/50 xl:pt-0">
        {data.selectedWeek === week ? <>
          <PotentialRecognition title="Month — Top 5" candidates={data.recognition?.currentMonth ?? []}/>
          <LastRecognition title="Last Employee of the Month" winner={data.recognition?.lastMonth ?? null}/>
          <PotentialRecognition title="Quarter — Top 5" candidates={data.recognition?.currentQuarter ?? []}/>
          <LastRecognition title="Last Employee of the Quarter" winner={data.recognition?.lastQuarter ?? null}/>
        </> : <p className="text-xs text-muted-foreground">Loading recognition...</p>}
      </div>
    </div>
    <details className="mt-3 border-t pt-2">
      <summary className="w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-2">View Outliers</summary>
      <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
        {current.outliers.map((item: any) => <details key={`${item.metric}-${item.direction}`} className="min-w-0 py-0.5">
          <summary className="w-fit cursor-pointer text-xs focus-visible:rounded-sm focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-2">{item.metric}: {item.drivers.length} {item.direction}{item.contextOnly ? " (context)" : ""}</summary>
          <ul className="ml-4 mt-1 space-y-0.5 text-xs text-muted-foreground">{item.drivers.map((driver: any) => <li key={driver.driverId}>{driver.name}: {number(driver.value)}</li>)}</ul>
        </details>)}
      </div>
    </details>
    <div className="mt-3 border-t pt-2">
      <h3 className="text-xs font-semibold">Bottom 5 Performers</h3>
      <div className="mt-1 max-w-xl divide-y divide-border/50">
        {bottomFive.map(driver => <div key={driver.driverId} className="flex min-w-0 items-center gap-3 py-1 text-xs"><span className="w-8 shrink-0 tabular-nums text-muted-foreground">#{driver.score!.rank}</span><span className="min-w-0 flex-1 truncate">{driver.name}</span><span className="shrink-0 tabular-nums">{number(driver.score!.finalScore)}%</span></div>)}
      </div>
    </div>
  </section>;
}
