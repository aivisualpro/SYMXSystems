import { routeSchema, businessDate, type Observation } from "./domain";
import { analyzeDriver } from "./intelligence";

/** Synthetic data only. Never used by the ingest adapter. */
export function intelligenceFixture(kind: "slowdown" | "gap" | "steady" | "plan_aligned" = "slowdown", now = Date.now()): Observation {
  const times = kind === "slowdown" || kind === "plan_aligned"
    ? [...Array.from({ length: 41 }, (_, i) => now - (182 - i * 3) * 60000),
      ...Array.from({ length: 10 }, (_, i) => now - (56 - i * 6) * 60000)]
    : Array.from({ length: 31 }, (_, i) => now - ((kind === "gap" ? 35 : 3) + (30 - i) * 5) * 60000);
  const events = times.map((completedAt, i) => ({ completedAt,
    plannedAt: kind === "plan_aligned" ? completedAt - 10 * 60000 : times[0] + i * (kind === "slowdown" ? 3 : 5) * 60000 }));
  const route: Observation = { ...routeSchema.parse({
    routeCode: "CX101", driverId: "synthetic-driver", driverName: "Sample Driver", routeId: "synthetic-route",
    totalStops: 100, completedStops: events.length, detail: true,
    firstDelivery: times[0], lastDelivery: times.at(-1), firstStopCompleted: times[0], lastStopCompleted: times.at(-1),
    plannedDeparture: times[0] - 30 * 60000, actualDeparture: times[0] - 30 * 60000,
    plannedReturn: now + 4 * 3600000, inboundMinutes: 20, deliveryEvents: events,
    timingEvidence: { inboundSource: "explicit_stem", inboundField: "valid", plannedRtsPresent: true,
      completePlan: true, deliveryStops: 100, deliveredTasks: events.length, timestampedTasks: events.length,
      timestampedStops: events.length, rejectedTimestamps: 0 },
  }), station: "DFO2", date: businessDate(new Date(now)), observedAt: new Date(now).toISOString() };
  const codes = analyzeDriver(route, now).candidates.map(s => s.code);
  route.signalSamples = [0, 6].map(m => ({ observedAt: new Date(now - m * 60000).toISOString(), codes }));
  route.recordedSignals = codes;
  return route;
}
