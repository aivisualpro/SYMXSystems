"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PublicDriverPerformance } from "@/lib/driver-ranking/driver-performance-public";
import { performanceValueClass, type PerformanceState } from "@/lib/driver-ranking/performance-colors";

type DriverMetric = PublicDriverPerformance["metrics"][number];
type Highlight = { label: string; value: string; detail?: string };

const unavailable = "N/A";
const qualityLabels = ["CDF", "DSB", "Delivery Completion", "POD", "PSB"];

function isUnavailable(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === "n/a" || normalized === "--" || normalized === "—";
}

function shortStreak(value: string) {
  const weeks = value.match(/(\d+)\s*w(?:ee)?ks?/i)?.[1];
  return weeks && Number(weeks) > 0 ? `${weeks} wk streak` : undefined;
}

function detailStreak(value: string) {
  const weeks = value.match(/(\d+)\s*w(?:ee)?ks?/i)?.[1];
  if (!weeks || Number(weeks) < 1) return undefined;
  return `${weeks} ${Number(weeks) === 1 ? "wk" : "wks"}`;
}

function trendLabel(value: string) {
  if (value.startsWith("↑")) return "Trending Up";
  if (value.startsWith("↓")) return "Trending Down";
  return "Stable";
}

function SummaryCard({ label, value, state }: { label: string; value: string; state: PerformanceState }) {
  return <div className="rounded-md border bg-card px-3 py-2.5">
    <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
    <p className={`mt-1 truncate text-lg font-semibold leading-tight ${performanceValueClass[state]}`}>{value}</p>
  </div>;
}

function HighlightRow({ item, tone }: { item: Highlight; tone: "top" | "attention" }) {
  return <div className="py-2.5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold">{item.label}</p>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${performanceValueClass[tone]}`}>{item.value}</p>
    </div>
    {item.detail ? <p className="mt-1 text-sm leading-snug text-muted-foreground">{item.detail}</p> : null}
  </div>;
}

function DetailRow({ metric }: { metric: DriverMetric }) {
  const missing = isUnavailable(metric.current);
  const streak = missing ? undefined : detailStreak(metric.streak);
  const rank = missing || isUnavailable(metric.teamRank) ? undefined : metric.teamRank;
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5">
    <div className="min-w-0"><p className="text-sm font-medium">{metric.label}</p>{streak ? <p className="text-xs text-muted-foreground">{streak}</p> : null}</div>
    <div className="text-right"><p className={`text-sm font-semibold tabular-nums ${missing ? performanceValueClass.missing : ""}`}>{missing ? unavailable : metric.current}</p>{rank ? <p className="text-xs text-muted-foreground">{rank}</p> : null}</div>
  </div>;
}

export function PublicDriverPerformancePage({ token, initialData }: { token: string; initialData: PublicDriverPerformance }) {
  const [data, setData] = useState<PublicDriverPerformance | null>(initialData);
  const [week, setWeek] = useState(initialData.selectedWeek);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const body = document.body;
    const previous = {
      height: body.style.height,
      minHeight: body.style.minHeight,
      overflowX: body.style.overflowX,
      overflowY: body.style.overflowY,
      overscrollBehaviorY: body.style.overscrollBehaviorY,
    };
    body.style.height = "auto";
    body.style.minHeight = "100vh";
    body.style.overflowX = "hidden";
    body.style.overflowY = "auto";
    body.style.overscrollBehaviorY = "auto";
    return () => {
      Object.assign(body.style, previous);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/public/driver-performance/${encodeURIComponent(token)}${week ? `?week=${encodeURIComponent(week)}` : ""}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(body => {
        setData(body);
        setWeek(current => current || body.selectedWeek);
      })
      .catch(reason => {
        if (reason.name !== "AbortError") setError(reason.message || "Performance data is unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, week]);

  const metrics = useMemo(() => new Map(data?.metrics.map(metric => [metric.label, metric]) ?? []), [data]);

  if (loading && !data) return <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading performance...</main>;
  if (error && !data) return <main className="mx-auto min-h-screen max-w-2xl px-4 py-10"><h1 className="text-xl font-semibold">SYMX Performance</h1><p className="mt-4 text-sm text-destructive">{error}</p></main>;
  if (!data) return null;

  const cdfEvents = data.qualityDetails.cdf.reduce((total, item) => total + item.count, 0);
  const dsbEvents = data.qualityDetails.dsb.reduce((total, item) => total + item.count, 0);
  const focusLabels = [...data.nextFocus, data.summary.mainFocus].filter(Boolean);
  const isFocus = (label: string) => focusLabels.some(item => item.toLowerCase().includes(label.toLowerCase()));
  const scoreState: PerformanceState = data.summary.status === "Top Performer" ? "top" : data.summary.status === "Focus Area" ? "attention" : data.summary.status === "Building Momentum" ? "good" : "neutral";
  const trendState: PerformanceState = data.summary.trend.startsWith("↑") ? "top" : data.summary.trend.startsWith("↓") ? "attention" : "neutral";

  const detailedIssues: Highlight[] = [...data.qualityDetails.cdf, ...data.qualityDetails.dsb].map(item => ({
    label: item.friendlyLabel,
    value: `${item.count} event${item.count === 1 ? "" : "s"}`,
    detail: item.explanation,
  }));
  const focusMetrics: Highlight[] = focusLabels.map(label => {
    const metric = metrics.get(label);
    return { label, value: metric?.current ?? "Review", detail: undefined };
  }).filter(item => !isUnavailable(item.value));
  const fixThisWeek = [...detailedIssues, ...focusMetrics]
    .filter((item, index, items) => items.findIndex(candidate => candidate.label === item.label) === index)
    .slice(0, 3);

  const positiveCandidates = ["Safety", "DSB", "Packages / Day", "Efficiency", "POD"]
    .map(label => metrics.get(label))
    .filter((metric): metric is DriverMetric => Boolean(metric) && !isUnavailable(metric!.current) && !isFocus(metric!.label))
    .map(metric => ({
      label: metric.label,
      value: isUnavailable(metric.teamRank) ? metric.current : `${metric.current} · ${metric.teamRank}`,
      detail: shortStreak(metric.streak),
    }));
  const doingWell = positiveCandidates.slice(0, 3);

  const safety = metrics.get("Safety");
  const safetyAvailable = Boolean(safety) && !isUnavailable(safety?.current);
  const safetyScore = Number.parseFloat(safetyAvailable ? safety!.current : "");
  const safetyHasAttention = isFocus("Safety");
  const quality = metrics.get("Quality");
  const qualityAvailable = Boolean(quality) && !isUnavailable(quality?.current);
  const qualityAttention = qualityLabels
    .filter(label => isFocus(label) || (label === "CDF" && cdfEvents > 0) || (label === "DSB" && dsbEvents > 0))
    .map(label => metrics.get(label))
    .filter((metric): metric is DriverMetric => Boolean(metric) && !isUnavailable(metric!.current))
    .slice(0, 2);

  return <main className="mx-auto min-h-screen w-full max-w-2xl space-y-4 overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6">
    <header className="flex items-end justify-between gap-3 border-b pb-3">
      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase text-muted-foreground">SYMX Weekly Performance</p><h1 className="mt-0.5 truncate text-xl font-semibold">{data.driverName}</h1></div>
      <label className="shrink-0 text-[11px] text-muted-foreground">Week<select value={data.selectedWeek} onChange={event => setWeek(event.target.value)} className="mt-1 block min-h-10 w-24 rounded-md border bg-background px-2 text-sm text-foreground">{data.availableWeeks.map(value => <option key={value} value={value}>{value.replace(/^\d{4}-/, "")}</option>)}</select></label>
    </header>

    <section aria-labelledby="summary-heading"><h2 id="summary-heading" className="text-xs font-semibold uppercase text-muted-foreground">Weekly Summary</h2><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryCard label="Score" value={data.summary.finalScore} state={scoreState} />
      <SummaryCard label="Rank" value={data.summary.overallRank} state={scoreState} />
      <SummaryCard label="Trend" value={trendLabel(data.summary.trend)} state={trendState} />
      <SummaryCard label="Focus" value={data.summary.mainFocus || "Stay steady"} state={fixThisWeek.length ? "attention" : "top"} />
    </div></section>

    <section className="border-t pt-3" aria-labelledby="fix-heading"><h2 id="fix-heading" className={`text-xs font-semibold uppercase ${performanceValueClass.attention}`}>Fix This Week</h2>
      {fixThisWeek.length ? <div className="mt-1 divide-y">{fixThisWeek.map(item => <HighlightRow key={item.label} item={item} tone="attention" />)}</div> : <p className="mt-2 text-sm text-muted-foreground">No major issues highlighted this week.</p>}
    </section>

    <section className="border-t pt-3" aria-labelledby="good-heading"><h2 id="good-heading" className={`text-xs font-semibold uppercase ${performanceValueClass.top}`}>Doing Well</h2>
      {doingWell.length ? <div className="mt-1 divide-y">{doingWell.map(item => <HighlightRow key={item.label} item={item} tone="top" />)}</div> : <p className="mt-2 text-sm text-muted-foreground">Keep building consistency.</p>}
    </section>

    <section className="grid grid-cols-1 gap-2 border-t pt-3 min-[360px]:grid-cols-2" aria-label="Safety and quality">
      <div className="rounded-md border bg-card p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Safety</p>
        <div className="mt-1 flex items-baseline justify-between gap-2"><p className={`text-xl font-semibold ${performanceValueClass[safetyAvailable ? safetyHasAttention ? "attention" : "top" : "missing"]}`}>{safetyAvailable ? safety!.current : unavailable}</p>{safetyAvailable && !isUnavailable(safety?.teamRank) ? <p className="text-xs text-muted-foreground">{safety?.teamRank}</p> : null}</div>
        <p className="mt-2 text-sm text-muted-foreground">{!safetyAvailable ? "Data unavailable" : safetyHasAttention ? "Safety event reported" : safetyScore >= 100 ? "0 Safety Events" : "No reported safety events"}</p>
      </div>
      <div className="rounded-md border bg-card p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Quality</p>
        <div className="mt-1 flex items-baseline justify-between gap-2"><p className={`text-xl font-semibold ${performanceValueClass[qualityAvailable ? qualityAttention.length ? "attention" : "top" : "missing"]}`}>{qualityAvailable ? quality!.current : unavailable}</p>{qualityAvailable && !isUnavailable(quality?.teamRank) ? <p className="text-xs text-muted-foreground">{quality?.teamRank}</p> : null}</div>
        {data.qualityDetailState === "unavailable" ? <p className="mt-2 text-sm text-muted-foreground">Detailed quality information is not available for this week.</p> : qualityAvailable && qualityAttention.length ? <div className="mt-2 space-y-1">{qualityAttention.map(metric => <div key={metric.label} className="flex justify-between gap-2 text-sm"><span>{metric.label}</span><span className={`font-medium tabular-nums ${performanceValueClass.attention}`}>{metric.current}</span></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">{qualityAvailable ? "No major issues" : "Data unavailable"}</p>}
      </div>
    </section>

    {data.qualityDetails.cdf.length ? <section className="border-t pt-3" aria-labelledby="feedback-heading"><h2 id="feedback-heading" className="text-xs font-semibold uppercase text-muted-foreground">Customer Feedback</h2><div className="mt-1 divide-y">{data.qualityDetails.cdf.map(item => <div key={item.friendlyLabel} className="flex justify-between gap-3 py-2.5"><p className="text-sm font-semibold">{item.friendlyLabel}</p><p className={`text-sm font-semibold ${performanceValueClass.attention}`}>{item.count} event{item.count === 1 ? "" : "s"}</p></div>)}</div></section> : null}

    <section className="border-t pt-3" aria-labelledby="trend-heading"><h2 id="trend-heading" className="text-xs font-semibold uppercase text-muted-foreground">6-Week Trend</h2><div className="mt-1 h-40"><ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}><LineChart data={data.history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.15}/><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={value => String(value).replace(/^\d{4}-/, "")}/><YAxis width={40} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={value => `${value}%`} domain={["auto", "auto"]}/><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-xs text-white shadow-md"><p>{String(label).replace(/^\d{4}-/, "")}</p><strong>{Number(payload[0].value).toFixed(2)}%</strong></div> : null}/><Line dataKey="finalScore" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}/></LineChart></ResponsiveContainer></div><div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">{data.history.map(point => <div key={point.week} className="shrink-0 rounded border px-2 py-1 text-center text-xs"><span className="text-muted-foreground">{point.week.replace(/^\d{4}-/, "")}</span> <span className="font-semibold">{point.finalScore.toFixed(0)}%</span></div>)}</div></section>

    <details className="border-t pt-3">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">View More Details</summary>
      <div className="divide-y border-t">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5"><div><p className="text-sm font-medium">Packages Delivered</p><p className="text-xs text-muted-foreground">Weekly total</p></div><p className="text-sm font-semibold text-muted-foreground">{unavailable}</p></div>
        {data.metrics.map(metric => <DetailRow key={metric.label} metric={metric} />)}
        {[...data.qualityDetails.cdf, ...data.qualityDetails.dsb].map(item => <div key={`${item.metricFamily}-${item.friendlyLabel}`} className="py-2.5"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.friendlyLabel}</p><p className="text-sm font-semibold">{item.count} event{item.count === 1 ? "" : "s"}</p></div><p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p></div>)}
      </div>
    </details>
  </main>;
}
