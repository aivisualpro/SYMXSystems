"use client";
import { useState } from "react";
import { analyzeDriver, attentionQueue, driverHistory } from "@/lib/cortex/intelligence";
import type { Observation } from "@/lib/cortex/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const signalLabel: Record<string, string> = { pace_drop: "pace slowdown", delivery_gap: "delivery gap", rts_delay: "projected late RTS" };
const clock = (t: number) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(t);

export function AttentionPanel({ queue, onOpen }: { queue: ReturnType<typeof attentionQueue>; onOpen: (r: Observation) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <section aria-label="DFO2 driver attention" className="rounded-xl border p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="font-semibold">DFO2 · dispatcher attention</h2>
      <span className="text-xs text-muted-foreground">One card per driver · dashboard only</span>
    </div>
    <p className="text-sm text-muted-foreground">Watch = first signal. Check-in = repeated across captures at least 5 minutes apart. Verify breaks, travel, and route conditions before interpreting pace.</p>
    {!queue.length && <p className="text-sm">No current driver signals in this selection. Missing or stale data can prevent detection.</p>}
    <div className="grid gap-3 lg:grid-cols-3">
      {(expanded ? queue : queue.slice(0, 3)).map(({ route, analysis, routes }) => <article key={`${route.station}:${route.driverId}`} className="rounded-lg border bg-muted/20 p-4 space-y-2">
        <div className="flex justify-between gap-2"><strong className="text-sm">{route.driverName === "Unassigned" ? route.routeCode : route.driverName}</strong><Badge variant="outline">{analysis.priority === "check-in" ? "Check-in" : "Watch"}</Badge></div>
        <p className="text-xs text-muted-foreground">{routes.slice(0, 3).join(" · ")}{routes.length > 3 ? ` · +${routes.length - 3} routes` : ""}</p>
        <p className="text-sm">{analysis.candidates.map(s => s.title).join(" · ")}</p>
        <p className="text-xs text-muted-foreground">{analysis.candidates[0].evidence}</p>
        <Button variant="outline" size="sm" onClick={() => onOpen(route)} aria-label={`Review driver ${route.routeCode}`}>Review evidence</Button>
      </article>)}
    </div>
    {queue.length > 3 && <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)}>{expanded ? "Show fewer" : `Show all ${queue.length} drivers`}</Button>}
  </section>;
}

export function DriverEvidence({ route, history, now }: { route: Observation; history: Observation[]; now: number }) {
  const a = analyzeDriver(route, now);
  const h = driverHistory(route, history);
  return <section aria-label="Driver intelligence details" className="space-y-4 mb-6">
    <h3 className="font-semibold">Driver pace & early warning</h3>
    {(route.assignmentChanged || route.identityUncertain || !route.driverId) && <p className="text-sm">Route-level intervals only; driver attribution is withheld.</p>}
    <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
      {[["Recent", a.paceWindows.recent], ["Earlier", a.paceWindows.earlier], ["Route overall", a.paceWindows.overall]].map(([label, value]) => {
        const w = typeof value === "object" ? value : null;
        return <div key={String(label)}><span className="text-xs text-muted-foreground">{String(label)}</span><strong className="block">{w ? `${w.rate.toFixed(1)} /h` : "—"}</strong><span className="text-xs text-muted-foreground">{w ? `${w.stops} intervals · ${Math.round(w.hours * 60)} min` : "Insufficient sample"}</span></div>;
      })}
    </div>
    <p className="text-xs text-muted-foreground">Stops per hour from actual stop completions. Recent and earlier windows cover approximately 45 minutes each, ending at the last recorded completion.</p>
    {a.gapMinutes != null && <p className="text-sm">Delivery gap: {Math.floor(a.gapMinutes)} min as of {clock(a.capturedAt)} · review threshold {Math.round(a.gapThresholdMinutes)} min.</p>}
    {a.observationNote && <p className="text-sm">{a.observationNote}</p>}
    {a.problems.length > 0 && <p className="text-sm text-muted-foreground">Evidence limits: {a.problems.join(" ")}</p>}
    {a.candidates.map(s => <div key={s.code} className="rounded-lg border p-3 space-y-2 text-sm">
      <strong>{s.title} · {s.confirmed ? "repeated observation" : "awaiting repeat capture"}</strong>
      <p><span className="font-medium">Observed evidence:</span> {s.evidence}</p>
      <p className="font-medium">Questions for dispatch</p>
      <ul className="list-disc pl-5 space-y-1">{s.questions.map(q => <li key={q}>{q}</li>)}</ul>
    </div>)}
    <p className="text-xs text-muted-foreground">Possible explanations to verify—not established causes: breaks, travel, access, workload, device sync, or route changes. {a.limitations.join(" ")}</p>
    {a.forecastRange && <p className="text-sm">RTS pace scenarios: {clock(a.forecastRange[0])}–{clock(a.forecastRange[1])}. Uses earlier versus recent pace with the same known inbound input; this is not a statistical confidence interval.</p>}
    <div className="border-t pt-4 space-y-3">
      <h3 className="font-semibold">Captured driver history</h3>
      <p className="text-sm">{h.capturedWorkdays} prior observed workdays at {route.station} in the last 14 days. Captured days are not employment tenure.</p>
      <p className="text-sm">{h.coaching}</p>
      {h.trendPercent != null && <p className="text-sm">Mean observed daily pace: {Math.abs(h.trendPercent).toFixed(0)}% {h.trendPercent < 0 ? "lower" : "higher"} in the latest 3 usable days versus the previous 3. Routes and workloads may differ.</p>}
      {h.recurring.map(s => <p key={s.code} className="text-sm">Recurring observation: {signalLabel[s.code]} on {s.days} captured days. Investigate context; no cause or performance rating is inferred.</p>)}
      {h.days.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Daily driver pace history"><thead><tr className="border-b"><th className="py-2">Day</th><th>Pace</th><th>Recorded signals</th><th>Actual RTS vs plan</th></tr></thead><tbody>{h.days.map(d => <tr key={d.date} className="border-b"><td className="py-2">{d.date}</td><td className="whitespace-nowrap pr-3">{d.pace == null ? "Unknown" : `${d.pace.toFixed(1)} /h`}</td><td>{d.assignmentChanged ? "Assignment changed; attribution withheld" : d.signals.map(s => signalLabel[s] || s).join(", ") || "None recorded"}</td><td className="pl-3">{d.returnDelay.length ? d.returnDelay.map(m => `${Math.abs(Math.round(m))} min ${m < 0 ? "earlier" : "later"}`).join(", ") : "Unknown"}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
