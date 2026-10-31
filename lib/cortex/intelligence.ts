import { assessRoute, type Observation } from "./domain";
import { hasCompleteTimeline, measurePace } from "./pace";

export type SignalCode = "pace_drop" | "delivery_gap" | "rts_delay";
export type DriverSignal = { code: SignalCode; title: string; evidence: string; confirmed: boolean; questions: string[] };
const minute = 60000;
const sampleRouteChanged = (sample: string | undefined, current: string) => sample != null && sample !== current;
const rounded = (n: number) => Math.round(n);
export function analyzeDriver(route: Observation, now = Date.now()) {
  const assessment = assessRoute(route, now);
  const pace = measurePace(route.deliveryEvents);
  const capturedAt = Date.parse(route.detailObservedAt || route.observedAt);
  const gapMinutes = route.lastDelivery == null ? null : Math.max(0, (capturedAt - route.lastDelivery) / minute);
  const gapThresholdMinutes = Math.max(20, (pace.medianInterval || 5) * 4);
  const limitations = ["Breaks and live traffic are not verified.", "Pace includes travel, service time, and pauses; it is not a driver rating."];
  if (pace.planAdjustedChange == null) limitations.push("Comparable planned stop spacing is unavailable; route difficulty is unknown.");
  const problems: string[] = [];
  if (route.station !== "DFO2") problems.push("Driver intelligence is in the DFO2 pilot.");
  if (route.assignmentChanged) problems.push("Assignment changed; route timestamps cannot be attributed to one driver.");
  if (!route.driverId || route.identityUncertain) problems.push("Driver identity is missing.");
  if (assessment.stale || assessment.detailStale) problems.push("Refresh stale route/detail observations before assessing the driver.");
  if (!route.deliveryEvents) problems.push("Recollect detail with collector 0.2.0 for stop-level pace.");
  if (!pace.overall) problems.push("Need at least five distinct completed-stop times spanning 30 minutes.");
  if (route.deliveryEvents && !hasCompleteTimeline(route)) problems.push("Stop counts or delivery timestamps are incomplete.");
  const candidates: DriverSignal[] = [];
  const add = (code: SignalCode, title: string, detail: string, questions: string[]) => {
    const samples = [...(route.signalSamples || [])].filter(s => {
      const age = capturedAt - Date.parse(s.observedAt);
      return age >= 0 && age <= 20 * minute && (!sampleRouteChanged(s.routeId, route.routeId));
    }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    let prior = false;
    for (const sample of samples) {
      if (!sample.codes.includes(code)) break;
      if (capturedAt - Date.parse(sample.observedAt) >= 5 * minute) { prior = true; break; }
    }
    candidates.push({ code, title, evidence: detail, confirmed: !!prior, questions });
  };
  const planAligned = pace.changePercent != null && pace.changePercent <= -30 &&
    pace.planAdjustedChange != null && pace.planAdjustedChange > -20;
  if (!problems.length && !route.actualReturn && assessment.remaining !== 0) {
    if (pace.changePercent != null && pace.changePercent <= -30 && !planAligned) {
      add("pace_drop", "Recent pace has slowed", `${pace.recent!.rate.toFixed(1)} stops/h recently versus ${pace.earlier!.rate.toFixed(1)} earlier (${rounded(-pace.changePercent)}% lower), using separate timestamp windows.`,
        ["Are you on a break or a longer travel leg?", "Has the route changed to apartments, businesses, access issues, or unfamiliar stops?", "Would navigation, package organization, or dispatcher support help?"]);
    }
    if (gapMinutes != null && gapMinutes >= gapThresholdMinutes) {
      add("delivery_gap", "Prolonged gap in recorded deliveries", `${rounded(gapMinutes)} minutes without a recorded delivery as of the detail capture; review threshold ${rounded(gapThresholdMinutes)} minutes based on this route's typical intervals.`,
        ["When safely stopped, can you confirm your status and whether a break is in progress?", "Is this travel, a difficult stop, a device/sync issue, or something dispatch can resolve?"]);
    }
    if (assessment.delayMinutes != null && assessment.delayMinutes >= 30) {
      add("rts_delay", "Projected return is past plan", `Projected RTS is ${rounded(assessment.delayMinutes)} minutes past Amazon's planned RTS. This remains a low-confidence pace estimate.`,
        ["Are the remaining stops and return travel inputs still accurate?", "Are there remaining breaks, access issues, rescues, or route changes that affect the return plan?"]);
    }
  }
  const confirmed = candidates.some(s => s.confirmed);
  const priority = !candidates.length ? problems.length ? "data" : "clear"
    : confirmed ? "check-in" : "watch";
  return { ...assessment, paceWindows: pace, capturedAt, gapMinutes, gapThresholdMinutes,
    candidates, priority, problems, limitations, planAligned,
    observationNote: planAligned ? "Recent planned stop spacing is also slower; the pace change alone does not trigger an alert." : null };
}

/** One card per identified driver, even when the driver has multiple routes. */
export function attentionQueue(rows: Observation[], now = Date.now()) {
  const drivers = new Map<string, { route: Observation; analysis: ReturnType<typeof analyzeDriver>; routes: string[] }>();
  for (const route of rows) {
    const analysis = analyzeDriver(route, now);
    if (!analysis.candidates.length || !route.driverId) continue;
    const key = `${route.station}|${route.date}|${route.driverId}`;
    const current = drivers.get(key);
    const score = (a: typeof analysis) => (a.priority === "check-in" ? 1000 : 0) + a.candidates.length * 100 + Math.min(99, a.delayMinutes || a.gapMinutes || 0);
    if (!current) drivers.set(key, { route, analysis, routes: [route.routeCode] });
    else {
      current.routes.push(route.routeCode);
      if (score(analysis) > score(current.analysis)) { current.route = route; current.analysis = analysis; }
    }
  }
  return [...drivers.values()].sort((a, b) =>
    Number(b.analysis.priority === "check-in") - Number(a.analysis.priority === "check-in") ||
    b.analysis.candidates.length - a.analysis.candidates.length || a.route.routeCode.localeCompare(b.route.routeCode));
}

export function driverHistory(route: Observation, history: Observation[]) {
  const rows = route.driverId ? history.filter(h => h.driverId === route.driverId && h.station === route.station && h.date < route.date) : [];
  const byDay = new Map<string, Observation[]>();
  for (const row of rows) byDay.set(row.date, [...(byDay.get(row.date) || []), row]);
  const days = [...byDay].map(([date, entries]) => {
    const windows = entries.filter(h => !h.assignmentChanged).map(h => h.historicalPace || (hasCompleteTimeline(h) ? measurePace(h.deliveryEvents).overall : null)).filter(w => w != null);
    const hours = windows.reduce((n, w) => n + w.hours, 0);
    return { date, routes: entries.map(h => h.routeCode),
      pace: hours ? windows.reduce((n, w) => n + w.stops, 0) / hours : null,
      signals: [...new Set(entries.filter(h => !h.assignmentChanged).flatMap(h => h.recordedSignals || []))],
      assignmentChanged: entries.some(h => h.assignmentChanged),
      returnDelay: entries.flatMap(h => h.actualReturn && h.plannedReturn ? [(h.actualReturn - h.plannedReturn) / minute] : []),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const recurring = (["pace_drop", "delivery_gap", "rts_delay"] as SignalCode[])
    .map(code => ({ code, days: days.filter(d => d.signals.includes(code)).length })).filter(s => s.days >= 3);
  const valid = days.filter(d => d.pace != null);
  const average = (v: typeof valid) => v.reduce((n, d) => n + d.pace!, 0) / v.length;
  const trendPercent = valid.length >= 6 ? (average(valid.slice(0, 3)) / average(valid.slice(3, 6)) - 1) * 100 : null;
  return { days, recurring, trendPercent, capturedWorkdays: days.length,
    coaching: days.length < 5
      ? "Captured experience is limited; tenure is unknown. Ask whether the driver wants help with navigation, package organization, or this delivery area."
      : "Start with what changed on today's route and any recurring obstacles. Ask what support would help before repeating basic coaching.",
  };
}
