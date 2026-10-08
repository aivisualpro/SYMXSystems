"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DriverHistoryReview, DriverHistoryWeek, DriverMetricRanks, MetricRank } from "@/lib/driver-ranking/driver-history-review";
import type { DriverWeeklyQualityDetails, DriverWeeklyQualitySubMetric } from "@/lib/driver-ranking/driver-weekly-quality-events";

const shown = (value: number | null | undefined, suffix = "") => value === null || value === undefined ? "N/A" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
const rank = (value: MetricRank | undefined) => !value || value.rank === null ? "N/A" : `#${value.rank}${value.tied ? "T" : ""}`;
const weeks = (value: number) => `${value >= 6 ? "6+" : value} wk${value === 1 ? "" : "s"}`;
const shortStreak = (value: number, prefix = "") => value === 0 ? "Start" : `${prefix}${prefix ? " · " : ""}${weeks(value)}`;

function Movement({ value }: { value: number | null }) {
  if (value === null) return <span>—</span>;
  const Arrow = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  return <span className="inline-flex items-center gap-1"><Arrow className="size-3.5" />{Math.abs(value)}</span>;
}

export function DriverHistoryReviewPanel({ transporterId, week }: { transporterId: string; week: string }) {
  const [data, setData] = useState<{ history: DriverHistoryWeek[]; review: DriverHistoryReview; metricRanks: DriverMetricRanks | null; qualityDetails: DriverWeeklyQualityDetails } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    fetch(`/api/driver-rankings/history?week=${encodeURIComponent(week)}&transporterId=${encodeURIComponent(transporterId)}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [transporterId, week]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!data) return <p className="text-xs text-muted-foreground">Loading six-week review...</p>;

  const { history, review, metricRanks: ranks, qualityDetails } = data;
  const current = history.at(-1);
  const streaks = review.streaks;
  const trendArrow = review.trend === "Improving" ? "↑" : review.trend === "Declining" ? "↓" : review.trend === "Stable" ? "→" : "";
  const managerStatus = review.managerStatus === "Strong" ? "Top Performer" : review.trend === "Improving" ? "Building Momentum" : review.managerStatus === "Watch" ? "On Track" : "Focus Area";
  const weeklyQualityImpact = [ranks?.cdf.value, ranks?.dsb.value].some(value => typeof value === "number" && value > 0);
  const rows = [
    ["Final", shown(ranks?.finalScore.value, "%"), rank(ranks?.finalScore), shortStreak(streaks.top5, "Top 5"), "Consecutive weeks ranked in the team Top 5"],
    ["Safety", shown(ranks?.safety.value, "%"), rank(ranks?.safety), shortStreak(streaks.safety), "Consecutive weeks without a Safety event"],
    ["Quality", shown(ranks?.quality.value, "%"), rank(ranks?.quality), shortStreak(streaks.quality95), "Consecutive weeks with a 95%+ Quality score"],
    ["Efficiency", shown(ranks?.efficiency.value, "%"), rank(ranks?.efficiency), shortStreak(streaks.efficiency100), "Consecutive weeks at 100%+ Efficiency"],
    ["Workload", shown(ranks?.workload.value), rank(ranks?.workload), "—", ""],
    ["Packages/Day", shown(ranks?.packagesPerDay.value), rank(ranks?.packagesPerDay), shortStreak(streaks.packagesAboveAverage), "Consecutive weeks at or above the team average packages per day"],
    ["Delivery Days", shown(current?.deliveryDays), "—", shortStreak(streaks.fiveDays), "Consecutive weeks with five or more delivery days"],
    ["CDF", shown(ranks?.cdf.value), rank(ranks?.cdf), shortStreak(streaks.cdf), "Consecutive weeks with zero CDF"],
    ["DSB", shown(ranks?.dsb.value), rank(ranks?.dsb), shortStreak(streaks.dsb), "Consecutive weeks with zero DSB"],
    ["DC", shown(ranks?.deliveryCompletion.value), rank(ranks?.deliveryCompletion), shortStreak(streaks.deliveryCompletion), "Consecutive weeks with zero Delivery Completion misses"],
    ["POD", shown(ranks?.pod.value, "%"), rank(ranks?.pod), shortStreak(streaks.pod), "Consecutive weeks at 99.5%+ POD"],
    ["PSB", shown(ranks?.psb.value), rank(ranks?.psb), shortStreak(streaks.psb), "Consecutive weeks with zero PSB"],
  ];

  return <div className="space-y-4">
    <section>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Snapshot</h3>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-5">
        <div><p className="text-[10px] uppercase text-muted-foreground">Final</p><p className="font-semibold tabular-nums">{shown(ranks?.finalScore.value, "%")} <span className="text-muted-foreground">{rank(ranks?.finalScore)}</span></p></div>
        <div><p className="text-[10px] uppercase text-muted-foreground">Trend</p><p className="font-semibold">{trendArrow} {review.trend}</p></div>
        <div><p className="text-[10px] uppercase text-muted-foreground">Rank Move</p><p className="font-semibold"><Movement value={review.rankMovement} /></p></div>
        <div><p className="text-[10px] uppercase text-muted-foreground">Status</p><p className="font-semibold">{managerStatus}</p></div>
        <div><p className="text-[10px] uppercase text-muted-foreground">Main Focus</p><p className="font-semibold">{review.mainFocus}</p></div>
      </div>
    </section>

    <section className="border-t pt-3">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">6-Week Trend</h3>
      <div className="mt-2 h-36 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={history} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={value => String(value).replace(/^\d{4}-/, "")} />
            <YAxis width={42} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={value => `${value}%`} domain={["auto", "auto"]} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border border-white/15 bg-[#111] px-2.5 py-2 text-xs text-white shadow-md"><div>{String(label).replace(/^\d{4}-/, "")}</div><strong>{shown(typeof payload[0].value === "number" ? payload[0].value : null, "%")}</strong></div> : null} />
            <Line dataKey="finalScore" type="linear" connectNulls={false} stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Six-week score and rank history">
        {history.map(point => <div key={point.week} className={`min-w-20 rounded border px-2 py-1.5 text-center text-[11px] ${point.week === week ? "border-primary bg-primary/10" : "border-border"}`}><p className="text-muted-foreground">{point.week.replace(/^\d{4}-/, "")}</p><p className="font-semibold tabular-nums">{shown(point.finalScore, "%")}</p><p className="text-muted-foreground">#{point.rank}</p></div>)}
      </div>
    </section>

    <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
      <section><h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Momentum</h3><p className="text-sm">{review.improvingAreas.length ? review.improvingAreas.join(" · ") : "None"}</p></section>
      <section><h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Next Focus</h3><p className="text-sm">{review.recurringIssues.length ? review.recurringIssues.map(issue => issue.label).join(" · ") : "None"}</p></section>
    </div>

    <section>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Metric Rankings &amp; Streaks</h3>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="text-left text-muted-foreground"><tr><th className="py-1">Metric</th><th>Current</th><th>Rank</th><th>Streak</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row[0]} className="border-t"><td className="py-1.5">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><span title={row[4]}>{row[3]}</span></td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="border-t pt-3">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Quality Details</h3>
      {qualityDetails.cdf.subMetrics.length || qualityDetails.dsb.subMetrics.length ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {qualityDetails.cdf.subMetrics.length ? <QualityFamily title="CDF" metrics={qualityDetails.cdf.subMetrics} /> : null}
          {qualityDetails.dsb.subMetrics.length ? <QualityFamily title="DSB" metrics={qualityDetails.dsb.subMetrics} /> : null}
        </div>
      ) : <p className="mt-1 text-sm text-muted-foreground">{weeklyQualityImpact ? "Detailed quality data unavailable" : "No quality details this week"}</p>}
    </section>
    <div className="border-t" />
  </div>;
}

function QualityFamily({ title, metrics }: { title: string; metrics: DriverWeeklyQualitySubMetric[] }) {
  return <div>
    <p className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</p>
    <div className="mt-1 divide-y divide-border">
      {metrics.map(metric => <details key={metric.subMetric} className="group py-1.5 text-xs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium marker:hidden">
          <span>{metric.friendlyLabel}</span><span className="tabular-nums text-muted-foreground">{metric.count}</span>
        </summary>
        <div className="mt-1.5 space-y-1.5 border-l pl-2 text-[11px] text-muted-foreground">
          {metric.events.map(event => <div key={`${event.canonicalRecordId}-${metric.subMetric}`}>
            <p>{event.deliveryDate || event.eventDate || "Date unavailable"}{event.trackingId ? ` · ${event.trackingId}` : ""}</p>
            {event.disputeStatus ? <p>Dispute: {event.disputeStatus}</p> : null}
          </div>)}
        </div>
      </details>)}
    </div>
  </div>;
}
