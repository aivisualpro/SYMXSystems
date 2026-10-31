import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { assessRoute, latestRoutes, routeSchema, summarizeCoverage } from "@/lib/cortex/domain";
const context: any = {};
vm.createContext(context);
vm.runInContext(readFileSync("symx-cortex-extension/adapter.js", "utf8"), context);
const adapter = context.CortexAdapter;
const now = Date.parse("2026-10-30T21:00:00Z");
function payload() {
  return {
    itineraryDetails: {
      routes: [{ routeCode: "CX100", routeDeliveryProgress: { totalStops: 6, completedStops: 5 } }],
      transporterTimeAttributes: { plannedRtsTime: (now + 60 * 60000) / 1000 } as any,
      scheduleEndTime: now + 4 * 3600000,
    },
    stops: Array.from({ length: 6 }, (_, i) => ({
      sequenceNumber: i + 2, expectedStartTime: now + i * 6 * 60000,
      address: "PRIVATE ADDRESS", trackingId: "PRIVATE TRACKING", phone: "PRIVATE PHONE",
      tasks: [0, 1].map(j => ({ taskType: "DROP_OFF", taskState: i < 5 ? "DELIVERED" : "PENDING",
        actualExecutionTime: i < 5 ? now - (50 - i * 10) * 60000 + j * 1000 : null })),
    })),
  };
}
function normalize(p = payload()) { return adapter.normalize(p, "detail", new Date(now).toISOString())[0]; }
function observation(p = payload()) {
  return { ...routeSchema.parse(normalize(p)), station: "DFO2", date: "2026-10-30", observedAt: new Date(now).toISOString() };
}
describe("timing contracts and privacy", () => {
  it.each([false, true, {}, [], " ", "0", 900000, "2026-10-30", "12:30"])("rejects non-epoch actual time %j", value => {
    expect(adapter.epoch(value)).toBeNull();
  });
  it.each([[900000, 15], ["900000", 15], ["0:25", 25], ["PT1H2M30S", 62.5], [0, 0]])("reads explicit duration %j", (value, minutes) => {
    expect(adapter.duration(value)).toBe(minutes);
  });
  it.each([false, " ", {}, "15 minutes", "9:90", "2026-10-30T20:00:00Z", -1, 15 * 3600000])("rejects invalid duration %j", value => {
    expect(adapter.duration(value)).toBeNull();
  });
  it("derives a labeled allowance only from a complete route plan and planned RTS", () => {
    const row = normalize();
    expect(row.inboundMinutes).toBe(30);
    expect(row.timingEvidence.inboundSource).toBe("planned_return_gap");
    expect(row.plannedReturn).toBe(now + 60 * 60000);
    expect(JSON.stringify(row)).not.toMatch(/PRIVATE|address|trackingId|phone/);
  });
  it("never substitutes schedule end for planned return or infers travel from a partial list", () => {
    const partial = payload(); partial.stops.pop();
    expect(normalize(partial).inboundMinutes).toBeNull();
    const noRts = payload(); delete noRts.itineraryDetails.transporterTimeAttributes.plannedRtsTime;
    expect(normalize(noRts).plannedReturn).toBeNull();
    expect(normalize(noRts).inboundMinutes).toBeNull();
  });
  it("prefers explicit inbound evidence and makes missing versus malformed visible", () => {
    const p = payload(); p.itineraryDetails.transporterTimeAttributes.plannedInboundStemTime = "0:18";
    expect(normalize(p).inboundMinutes).toBe(18);
    expect(normalize(p).timingEvidence.inboundSource).toBe("explicit_stem");
    p.itineraryDetails.transporterTimeAttributes.plannedInboundStemTime = "bad";
    expect(normalize(p).timingEvidence.inboundField).toBe("invalid");
    expect(normalize().timingEvidence.inboundField).toBe("absent");
  });
  it("counts completed stops once even with multiple packages and rejects future actuals", () => {
    const p = payload();
    expect(normalize(p).timingEvidence.timestampedStops).toBe(5);
    expect(normalize(p).timingEvidence.timestampedTasks).toBe(10);
    p.stops[4].tasks[1].actualExecutionTime = now + 3600000;
    const row = normalize(p);
    expect(row.timingEvidence.timestampedStops).toBe(4);
    expect(row.timingEvidence.rejectedTimestamps).toBe(1);
    expect(row.lastDelivery).toBeLessThan(now);
  });
  it("does not count partial or missing task timestamps as completed stop evidence", () => {
    const p = payload(); p.stops[2].tasks[0].actualExecutionTime = null;
    p.stops[3].tasks[0].taskState = "ATTEMPTED";
    expect(normalize(p).timingEvidence.timestampedStops).toBe(3);
  });
});
describe("evidence-backed forecasts", () => {
  it("uses intervals between completed stops, not a package count", () => {
    const route = observation(); const a = assessRoute(route, now);
    expect(a.pace).toBeCloseTo(6); // Four intervals over forty minutes.
    expect(a.forecast).toBeCloseTo(now + 40 * 60000);
    expect(a.confidence).toContain("planned return allowance");
  });
  it("suppresses forecasts with incomplete event evidence or no recent event", () => {
    const route = observation();
    expect(assessRoute({ ...route, lastDelivery: now - 21 * 60000 }, now).forecast).toBeNull();
    expect(assessRoute({ ...route, timingEvidence: { ...route.timingEvidence!, timestampedStops: 4 } }, now).forecast).toBeNull();
    expect(assessRoute({ ...route, detail: false }, now).forecast).toBeNull();
  });
  it("does not revive missing detail evidence using older captures", () => {
    const old = observation(); old.observedAt = new Date(now - 5 * 60000).toISOString();
    const fresh = { ...observation(), inboundMinutes: null, firstDelivery: null, lastDelivery: null, timingEvidence: undefined };
    const merged = latestRoutes([old, fresh])[0];
    expect(merged.inboundMinutes).toBeNull();
    expect(merged.firstDelivery).toBeNull();
    expect(assessRoute(merged, now).forecast).toBeNull();
  });
  it("preserves field freshness when current detail lacks counters", () => {
    const old = { ...observation(), observedAt: new Date(now - 25 * 60000).toISOString() };
    const fresh = { ...observation(), totalStops: null, completedStops: null };
    const merged = latestRoutes([old, fresh])[0];
    expect(merged.completedStops).toBe(5);
    expect(assessRoute(merged, now).missingForecastInputs).toContain("fresh forecast inputs");
    expect(assessRoute(merged, now).forecast).toBeNull();
  });
  it("does not borrow timing across driver reassignment", () => {
    const old = { ...observation(), driverId: "original", observedAt: new Date(now - 60000).toISOString() };
    const fresh = { ...observation(), driverId: "rescuer", detail: false, firstDelivery: null, lastDelivery: null, inboundMinutes: null };
    expect(latestRoutes([old, fresh])[0].inboundMinutes).toBeNull();
  });
  it("does not continually move the return forecast forward after deliveries finish", () => {
    const route = { ...observation(), totalStops: 5, completedStops: 5, inboundMinutes: 20 };
    route.timingEvidence!.deliveryStops = 5;
    const estimate = assessRoute(route, now).forecast;
    expect(estimate).toBe(route.lastStopCompleted! + 20 * 60000);
    expect(assessRoute({ ...route, observedAt: new Date(now + 60000).toISOString() }, now + 60000).forecast).toBe(estimate);
    expect(assessRoute({ ...route, inboundMinutes: 5 }, now).forecast).toBeNull();
  });
  it("does not attribute itinerary-wide inbound travel to each route in a shared itinerary", () => {
    const p = payload(); p.itineraryDetails.routes.push({ routeCode: "CX200", routeDeliveryProgress: { totalStops: 6, completedStops: 5 } });
    p.itineraryDetails.transporterTimeAttributes.plannedInboundStemTime = 900000;
    expect(normalize(p).inboundMinutes).toBeNull();
  });
  it("does not inherit unidentified delivery events for a newly assigned driver", () => {
    const old = { ...observation(), driverId: "", observedAt: new Date(now - 60000).toISOString() };
    const fresh = { ...observation(), driverId: "rescuer", detail: false };
    expect(latestRoutes([old, fresh])[0].firstDelivery).toBeNull();
  });
  it("reports observed-route coverage without implying all station routes are known", () => {
    const summary = summarizeCoverage([observation(), { ...observation(), detail: false }], now);
    expect(summary).toMatchObject({ routes: 2, freshDetails: 1, plannedAllowance: 2, forecasts: 1 });
  });
});
