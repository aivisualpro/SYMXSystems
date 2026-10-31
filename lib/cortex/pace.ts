/** Numeric stop completions only. No addresses, stop IDs, or customer data. */
export type DeliveryEvent = { completedAt: number; plannedAt: number | null };
export type PaceWindow = { stops: number; hours: number; rate: number; plannedRate: number | null };
export function hasCompleteTimeline(route: {
  deliveryEvents?: DeliveryEvent[]; completedStops: number | null; totalStops: number | null;
  firstDelivery: number | null; lastDelivery: number | null;
  timingEvidence?: { rejectedTimestamps: number; timestampedTasks: number; deliveredTasks: number; deliveryStops: number; timestampedStops: number };
}) {
  const events = route.deliveryEvents, e = route.timingEvidence;
  return !!events?.length && !!e && events.length === route.completedStops && events.length === e.timestampedStops &&
    e.rejectedTimestamps === 0 && e.timestampedTasks === e.deliveredTasks && e.deliveryStops === route.totalStops &&
    route.firstDelivery != null && route.firstDelivery <= events[0].completedAt &&
    route.lastDelivery != null && route.lastDelivery >= events.at(-1)!.completedAt;
}
const MINUTE = 60000;
function windowPace(events: DeliveryEvent[]): PaceWindow | null {
  if (events.length < 5 || new Set(events.map(e => e.completedAt)).size < 5) return null;
  const hours = (events.at(-1)!.completedAt - events[0].completedAt) / 3600000;
  if (hours < 0.5 || hours > 18) return null;
  const planned = events.map(e => e.plannedAt);
  const plannedHours = planned.every((v, i) => v != null && Math.abs(v - events[i].completedAt) <= 36 * 3600000 && (!i || v > planned[i - 1]!))
    ? (planned.at(-1)! - planned[0]!) / 3600000 : 0;
  return { stops: events.length - 1, hours, rate: (events.length - 1) / hours,
    plannedRate: plannedHours >= 0.25 && plannedHours <= 18 ? (events.length - 1) / plannedHours : null };
}
function anchor(events: DeliveryEvent[], cutoff: number) {
  const i = events.findIndex(e => e.completedAt > cutoff);
  return i < 0 ? events.length - 1 : Math.max(0, i - 1);
}
export function measurePace(events: DeliveryEvent[] | undefined) {
  const ordered = [...(events || [])].sort((a, b) => a.completedAt - b.completedAt);
  const end = ordered.at(-1)?.completedAt || 0;
  const start = anchor(ordered, end - 45 * MINUTE);
  const earlierStart = anchor(ordered, (ordered[start]?.completedAt || end) - 45 * MINUTE);
  const recent = windowPace(ordered.slice(start));
  const earlier = windowPace(ordered.slice(earlierStart, start + 1));
  const overall = windowPace(ordered);
  const intervals = ordered.slice(-21).slice(1).map((e, i) =>
    (e.completedAt - ordered.slice(-21)[i].completedAt) / MINUTE).filter(v => v > 0).sort((a, b) => a - b);
  const medianInterval = intervals.length >= 4
    ? (intervals[Math.floor((intervals.length - 1) / 2)] + intervals[Math.floor(intervals.length / 2)]) / 2 : null;
  const changePercent = recent && earlier ? (recent.rate / earlier.rate - 1) * 100 : null;
  // Planned start spacing is context, not observed travel or a difficulty score.
  const planAdjustedChange = recent?.plannedRate && earlier?.plannedRate
    ? ((recent.rate / recent.plannedRate) / (earlier.rate / earlier.plannedRate) - 1) * 100 : null;
  return { overall, recent, earlier, medianInterval, changePercent, planAdjustedChange };
}
