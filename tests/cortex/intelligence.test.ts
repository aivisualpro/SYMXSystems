import { describe, expect, it } from "vitest";
import { analyzeDriver, attentionQueue, driverHistory } from "@/lib/cortex/intelligence";
import { intelligenceFixture } from "@/lib/cortex/intelligence-fixtures";
import { measurePace } from "@/lib/cortex/pace";
import { assessRoute, captureSchema, latestRoutes } from "@/lib/cortex/domain";
const now = Date.parse("2026-10-30T23:00:00Z");
const row = () => intelligenceFixture("slowdown", now);
describe("driver pace evidence", () => {
  it("compares non-overlapping intervals and detects a sustained within-route drop", () => {
    const a = analyzeDriver(row(), now);
    expect(a.paceWindows.recent?.rate).toBeCloseTo(10);
    expect(a.paceWindows.earlier!.rate).toBeGreaterThan(15);
    expect(a.candidates.map(s => s.code)).toContain("pace_drop");
    expect(a.priority).toBe("check-in");
  });
  it("does not blame a driver when slower planned stop spacing explains the pace change", () => {
    const a = analyzeDriver(intelligenceFixture("plan_aligned", now), now);
    expect(a.planAligned).toBe(true);
    expect(a.candidates.map(s => s.code)).not.toContain("pace_drop");
    expect(a.observationNote).toContain("planned stop spacing");
  });
  it("still exposes uncertainty when planned spacing and break data are unavailable", () => {
    const r = row(); r.deliveryEvents = r.deliveryEvents!.map(e => ({ ...e, plannedAt: null }));
    const a = analyzeDriver(r, now);
    expect(a.candidates.map(s => s.code)).toContain("pace_drop");
    expect(a.limitations.join(" ")).toContain("route difficulty is unknown");
    expect(a.limitations.join(" ")).toContain("Breaks and live traffic are not verified");
  });
  it("requires repeated captures and clears confirmation after a recovery sample", () => {
    const r = row(); r.signalSamples = [];
    expect(analyzeDriver(r, now).priority).toBe("watch");
    r.signalSamples = [{ observedAt: new Date(now - 6 * 60000).toISOString(), codes: ["pace_drop", "rts_delay"] },
      { observedAt: new Date(now - 2 * 60000).toISOString(), codes: [] }];
    expect(analyzeDriver(r, now).priority).toBe("watch");
  });
  it("does not use future, old or different-route samples for confirmation", () => {
    const r = row();
    for (const sample of [
      { observedAt: new Date(now + 60000).toISOString(), codes: ["pace_drop", "rts_delay"] },
      { observedAt: new Date(now - 21 * 60000).toISOString(), codes: ["pace_drop", "rts_delay"] },
      { observedAt: new Date(now - 6 * 60000).toISOString(), codes: ["pace_drop", "rts_delay"], routeId: "another-route" },
    ]) expect(analyzeDriver({ ...r, signalSamples: [sample] }, now).priority).toBe("watch");
  });
  it("measures gaps only to the last detail capture, not an advancing dashboard clock", () => {
    const r = intelligenceFixture("gap", now);
    expect(analyzeDriver(r, now).gapMinutes).toBe(35);
    expect(analyzeDriver(r, now + 10 * 60000).gapMinutes).toBe(35);
    expect(analyzeDriver(r, now).candidates.map(s => s.code)).toContain("delivery_gap");
    expect(analyzeDriver(r, now + 21 * 60000).candidates).toEqual([]);
  });
  it("scales gap review to observed intervals on slower routes", () => {
    const r = intelligenceFixture("gap", now);
    r.deliveryEvents = r.deliveryEvents!.map((e, i, a) => ({ ...e, completedAt: now - (35 + (a.length - 1 - i) * 12) * 60000 }));
    r.firstDelivery = r.deliveryEvents[0].completedAt;
    const a = analyzeDriver(r, now);
    expect(a.problems).toEqual([]);
    expect(a.gapThresholdMinutes).toBe(48);
    expect(a.candidates.map(s => s.code)).not.toContain("delivery_gap");
  });
  it.each(["stale", "identity", "incomplete", "legacy", "assignment", "other_station"])("withholds driver alerts for %s evidence", mode => {
    const r = row();
    if (mode === "stale") r.observedAt = new Date(now - 21 * 60000).toISOString();
    if (mode === "identity") r.driverId = "";
    if (mode === "incomplete") r.timingEvidence!.timestampedTasks--;
    if (mode === "legacy") r.deliveryEvents = undefined;
    if (mode === "assignment") r.assignmentChanged = true;
    if (mode === "other_station") r.station = "DXC8";
    expect(analyzeDriver(r, now).candidates).toEqual([]);
    expect(analyzeDriver(r, now).problems.length).toBeGreaterThan(0);
  });
  it("does not turn batch-identical timestamps or a short span into a pace", () => {
    expect(measurePace(Array.from({ length: 10 }, () => ({ completedAt: now, plannedAt: null }))).overall).toBeNull();
    expect(measurePace(Array.from({ length: 10 }, (_, i) => ({ completedAt: now + i * 60000, plannedAt: null }))).overall).toBeNull();
  });
  it("deduplicates driver cards across routes and keeps station identity separate", () => {
    expect(attentionQueue([row(), { ...row(), routeCode: "CX102" }], now)).toHaveLength(1);
    expect(attentionQueue([row(), { ...row(), station: "DXC8" }], now)[0].routes).toEqual(["CX101"]);
  });
  it("detects reassignment and never inherits an older driver's event series", () => {
    const r = row(); const next = { ...r, driverId: "rescue-driver", observedAt: new Date(now + 60000).toISOString() };
    const merged = latestRoutes([r, next])[0];
    expect(merged.assignmentChanged).toBe(true);
    expect(analyzeDriver(merged, now + 60000).candidates).toEqual([]);
    const overview = { ...next, detail: false, deliveryEvents: undefined };
    expect(latestRoutes([r, overview])[0].deliveryEvents).toBeUndefined();
  });
});
describe("RTS and history", () => {
  it("uses recent actual pace, known inbound and both observed pace scenarios", () => {
    const r = row(); const a = assessRoute(r, now);
    expect(a.forecast).toBeCloseTo(now + (49 / 10 * 60 + 20) * 60000);
    expect(a.forecastRange![0]).toBeLessThan(a.forecastRange![1]);
    expect(a.forecastDeltaMinutes).toBeCloseTo(74);
    expect(a.confidence).toContain("low");
  });
  it("never fills in missing inbound or stale inputs", () => {
    expect(assessRoute({ ...row(), inboundMinutes: null }, now).forecast).toBeNull();
    expect(assessRoute({ ...row(), detailObservedAt: new Date(now - 21 * 60000).toISOString() }, now).forecast).toBeNull();
    expect(assessRoute({ ...row(), completedStops: 60 }, now).forecast).toBeNull();
  });
  it("deduplicates workdays and separates captured experience from tenure", () => {
    const r = row();
    const history = [1, 2, 3].map(n => ({ ...r, date: `2026-10-${30 - n}` }));
    const h = driverHistory(r, [...history, { ...history[0], routeCode: "CX999" }, { ...history[0], station: "DXC8" }]);
    expect(h.capturedWorkdays).toBe(3);
    expect(h.recurring.find(s => s.code === "pace_drop")?.days).toBe(3);
    expect(h.coaching).toContain("tenure is unknown");
    expect(driverHistory({ ...r, driverId: "" }, history).capturedWorkdays).toBe(0);
  });
  it("retains earlier recorded signals even when the final route sample recovers", () => {
    const r = row();
    const h = driverHistory(r, [{ ...intelligenceFixture("steady", now), date: "2026-10-29", recordedSignals: ["pace_drop"] }]);
    expect(h.days[0].signals).toContain("pace_drop");
  });
  it("does not attribute shared/reassigned route history to one driver", () => {
    const r = row(); const h = driverHistory(r, [{ ...r, date: "2026-10-29", assignmentChanged: true }]);
    expect(h.days[0].pace).toBeNull();
    expect(h.days[0].signals).toEqual([]);
  });
  it("changes coaching after more captured days without inferring employment experience", () => {
    const r = row(); const h = driverHistory(r, Array.from({ length: 6 }, (_, n) => ({ ...r, date: `2026-10-${29 - n}` })));
    expect(h.coaching).toContain("what changed");
    expect(h.trendPercent).toBeCloseTo(0);
  });
  it("rejects unordered, oversized, future and inconsistent event samples", () => {
    const r = row();
    const capture = { captureId: "c831a23c-dc34-4c0d-a790-f9bba42b9c29", serviceAreaId: "demo", date: r.date, observedAt: r.observedAt, kind: "detail", routes: [r] };
    expect(captureSchema.safeParse(capture).success).toBe(true);
    for (const events of [r.deliveryEvents!.toReversed(), [...r.deliveryEvents!, { completedAt: now + 3600000, plannedAt: null }], r.deliveryEvents!.slice(1), Array(1001).fill(r.deliveryEvents![0])])
      expect(captureSchema.safeParse({ ...capture, routes: [{ ...r, deliveryEvents: events }] }).success).toBe(false);
  });
});
