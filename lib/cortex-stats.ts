/**
 * Per-driver/day performance stats derived from one Cortex itinerary
 * (stops + tasks + breaks). Pure function — no DB.
 */
export interface AreaStat { zip: string; city: string; stops: number; packages: number; deltaSum: number }
export interface DayStats {
  stops: number; packages: number;
  firstActual: number; lastActual: number;           // epoch seconds
  stopsPerHour: number; avgGapMin: number; medianGapMin: number;
  avgDeltaMin: number; endDeltaMin: number; worstDeltaMin: number; onTimePct: number;
  shiftHours: number;
  mealStartMin: number | null; mealMinutes: number | null; mealAfterStop: number | null; mealFlag: "ok" | "late" | "short" | "missing" | "n/a";
  restCount: number; restExpected: number; restFlag: "ok" | "missing" | "n/a";
  deliveredBy: Record<string, number>; notDelivered: number; pickupFailed: number;
  areas: AreaStat[];
}

const sec = (v: any): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1e14 ? n / 1e6 : n >= 1e11 ? n / 1e3 : n;   // µs / ms / s -> s
};
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function computeDayStats(
  itin: any,
  stopList: any[],
  addresses: Record<string, { z?: string; c?: string }> = {}
): DayStats | null {
  const realStops = (Array.isArray(stopList) ? stopList : [])
    .filter((s: any) => s && s.routeCode != null && typeof s.sequenceNumber === "number" && s.sequenceNumber > 1)
    .filter((s: any) => (Array.isArray(s.tasks) ? s.tasks : []).some((t: any) => t?.taskType === "DROP_OFF"))
    .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);
  if (realStops.length === 0) return null;

  const breaks: any[] = Array.isArray(itin?.breaks) ? itin.breaks : [];
  const brk = breaks
    .filter((b) => b?.state === "OFF" && b.timeStampOn && b.timeStampOff)
    .map((b) => ({ type: b.type, on: sec(b.timeStampOn), off: sec(b.timeStampOff), seq: b.sequenceNumber }));

  const deliveredBy: Record<string, number> = {};
  let notDelivered = 0, packages = 0;
  const pts: { actual: number; planned: number; zip: string; city: string; pk: number }[] = [];

  for (const s of realStops) {
    const drops = (s.tasks || []).filter((t: any) => t?.taskType === "DROP_OFF");
    let actual = Infinity, pk = 0;
    for (const t of drops) {
      if (t.taskState === "DELIVERED") {
        pk++;
        const ctx = String(t.taskStateContext || "OTHER").replace(/^DELIVERED_TO_/, "");
        deliveredBy[ctx] = (deliveredBy[ctx] || 0) + 1;
      } else notDelivered++;
      const a = sec(t.actualExecutionTime);
      if (a) actual = Math.min(actual, a);
    }
    packages += pk;
    if (actual === Infinity) continue;
    const addr = addresses[String(s.addressId)] || {};
    pts.push({ actual, planned: sec(s.expectedStartTime), zip: String(addr.z || "").slice(0, 5), city: addr.c || "", pk });
  }
  if (pts.length === 0) return null;
  pts.sort((a, b) => a.actual - b.actual);

  // ── Pace vs plan ──
  const deltas = pts.filter((p) => p.planned > 0).map((p) => (p.actual - p.planned) / 60);
  const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const last = pts[pts.length - 1];
  const endDelta = last.planned > 0 ? (last.actual - last.planned) / 60 : 0;
  const worst = deltas.length ? Math.max(...deltas) : 0;
  const onTime = deltas.length ? (deltas.filter((d) => d <= 5).length / deltas.length) * 100 : 0;

  const overlap = (a0: number, a1: number) =>
    brk.reduce((acc, b) => acc + Math.max(0, Math.min(a1, b.off) - Math.max(a0, b.on)), 0);
  const gaps: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const g = pts[i].actual - pts[i - 1].actual - overlap(pts[i - 1].actual, pts[i].actual);
    if (g >= 0) gaps.push(g / 60);
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const first = pts[0];
  const activeSec = last.actual - first.actual - overlap(first.actual, last.actual);
  const stopsPerHour = activeSec > 600 ? (pts.length - 1) / (activeSec / 3600) : 0;

  // ── Breaks ──
  const signIn = sec(itin?.itineraryStartTime);
  const end = sec(itin?.sessionEndTime) || last.actual;
  const shiftHours = signIn && end > signIn ? (end - signIn) / 3600 : 0;
  const meal = brk.find((b) => b.type === "MEAL");
  const rests = brk.filter((b) => b.type === "REST");
  let mealFlag: DayStats["mealFlag"] = "n/a";
  let mealStartMin: number | null = null, mealMinutes: number | null = null, mealAfterStop: number | null = null;
  if (meal) {
    mealStartMin = signIn ? round((meal.on - signIn) / 60, 0) : null;
    mealMinutes = round((meal.off - meal.on) / 60, 0);
    mealAfterStop = meal.seq ?? null;
    mealFlag = mealStartMin !== null && mealStartMin > 300 ? "late" : mealMinutes < 29 ? "short" : "ok";
  } else if (shiftHours > 5) mealFlag = "missing";
  const restExpected = Math.floor(shiftHours / 4);
  const restFlag: DayStats["restFlag"] = shiftHours === 0 ? "n/a" : rests.length < restExpected ? "missing" : "ok";

  // ── Areas ──
  const byZip = new Map<string, AreaStat>();
  for (const p of pts) {
    if (!p.zip || p.planned <= 0) continue;
    const a = byZip.get(p.zip) || { zip: p.zip, city: p.city, stops: 0, packages: 0, deltaSum: 0 };
    a.stops++; a.packages += p.pk; a.deltaSum += (p.actual - p.planned) / 60;
    byZip.set(p.zip, a);
  }

  const pickupFailed = (Array.isArray(itin?.inactiveTasks) ? itin.inactiveTasks : []).filter((t: any) => t?.taskState === "PICKUP_FAILED").length;

  return {
    stops: pts.length, packages,
    firstActual: first.actual, lastActual: last.actual,
    stopsPerHour: round(stopsPerHour), avgGapMin: round(avgGap), medianGapMin: round(median),
    avgDeltaMin: round(avgDelta), endDeltaMin: round(endDelta), worstDeltaMin: round(worst), onTimePct: round(onTime, 0),
    shiftHours: round(shiftHours, 2),
    mealStartMin, mealMinutes, mealAfterStop, mealFlag,
    restCount: rests.length, restExpected, restFlag,
    deliveredBy, notDelivered, pickupFailed,
    areas: [...byZip.values()].map((a) => ({ ...a, deltaSum: round(a.deltaSum, 1) })),
  };
}
