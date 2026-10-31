import { z } from "zod";
import { hasCompleteTimeline, measurePace } from "./pace";

export const STATIONS = ["DFO2", "DXC8", "DFO3"] as const;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
      new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const count = z.number().int().min(0).max(100000);
const time = z.number().int().positive().nullable().default(null);
export const routeSchema = z.object({
  routeCode: z.string().trim().min(1).max(100),
  routeId: z.string().max(150).default(""),
  driverId: z.string().max(150).default(""),
  driverName: z.string().max(150).default("Unassigned"),
  totalStops: count.nullable().default(null),
  completedStops: count.nullable().default(null),
  totalPackages: count.nullable().default(null),
  completedPackages: count.nullable().default(null),
  plannedDeparture: time,
  actualDeparture: time,
  plannedReturn: time,
  actualReturn: time,
  firstDelivery: time,
  lastDelivery: time,
  inboundMinutes: z.number().min(0).max(240).nullable().default(null),
  firstStopCompleted: time.optional(),
  lastStopCompleted: time.optional(),
  timingEvidence: z.object({
    inboundSource: z.enum(["explicit_stem", "planned_return_gap", "missing"]),
    inboundField: z.enum(["absent", "invalid", "valid"]),
    plannedRtsPresent: z.boolean(),
    completePlan: z.boolean(),
    deliveryStops: count,
    deliveredTasks: count,
    timestampedTasks: count,
    timestampedStops: count,
    rejectedTimestamps: count,
  }).optional(),
  deliveryEvents: z.array(z.object({
    completedAt: z.number().int().min(946684800000).max(4102444800000),
    plannedAt: time,
  })).max(1000).optional(),
  detail: z.boolean().default(false),
});
export type CortexRoute = z.infer<typeof routeSchema>;
export const captureSchema = z
  .object({
    captureId: z.string().uuid(),
    serviceAreaId: z.string().trim().min(1).max(150),
    date: dateSchema,
    observedAt: z.string().datetime(),
    kind: z.enum(["overview", "detail"]),
    routes: z.array(routeSchema).min(1).max(500),
  })
  .superRefine((v, ctx) => {
    const observed = Date.parse(v.observedAt);
    for (const [i, r] of v.routes.entries()) {
      if (r.deliveryEvents && (r.deliveryEvents.some((e, n) =>
        e.completedAt > observed + 120000 || e.completedAt < observed - 36 * 3600000 ||
        (n > 0 && e.completedAt < r.deliveryEvents![n - 1].completedAt)) ||
        (r.timingEvidence && r.deliveryEvents.length !== r.timingEvidence.timestampedStops)))
        ctx.addIssue({ code: "custom", message: "Invalid completion timeline", path: ["routes", i, "deliveryEvents"] });
    }

    if (
      new Set(v.routes.map((r) => `${r.routeCode}|${r.driverId}`)).size !==
      v.routes.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate route/driver in capture",
        path: ["routes"],
      });
    if (
      v.routes.some(
        (r) =>
          r.completedStops != null &&
          r.totalStops != null &&
          r.completedStops > r.totalStops,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Completed stops exceed total",
        path: ["routes"],
      });
  });
export type Capture = z.infer<typeof captureSchema>;
export type Observation = CortexRoute & {
  station: string;
  date: string;
  observedAt: string;
  receivedAt?: string;
  recordedSignals?: string[];
  assignmentChanged?: boolean;
  identityUncertain?: boolean;
  historicalPace?: { stops: number; hours: number; rate: number };
  signalSamples?: { observedAt: string; codes: string[]; routeId?: string }[];
  detailObservedAt?: string;
  fieldObservedAt?: Partial<Record<keyof CortexRoute, string>>;
};
export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function assessRoute(route: Observation, now = Date.now()) {
  const ageMinutes = Math.max(0, (now - Date.parse(route.observedAt)) / 60000);
  const stale = ageMinutes > 20;
  const detailAt = route.detailObservedAt || (route.detail ? route.observedAt : undefined);
  const detailStale = !detailAt || now - Date.parse(detailAt) > 20 * 60000;
  const remaining = route.totalStops == null || route.completedStops == null
    ? null : Math.max(0, route.totalStops - route.completedStops);
  const evidence = route.timingEvidence;
  const observed = Date.parse(route.observedAt);
  const elapsedHours = route.firstDelivery ? (observed - route.firstDelivery) / 3600000 : 0;
  const stopHours = route.firstStopCompleted && route.lastStopCompleted
    ? (route.lastStopCompleted - route.firstStopCompleted) / 3600000 : 0;
  const measured = measurePace(route.deliveryEvents);
  const pace = route.deliveryEvents ? measured.recent?.rate || measured.overall?.rate || null : evidence
    ? evidence.timestampedStops >= 5 && stopHours >= 0.5
      ? (evidence.timestampedStops - 1) / stopHours : null
    : route.completedStops != null && route.completedStops >= 5 && elapsedHours >= 0.5
      ? route.completedStops / elapsedHours : null;
  const eventAgeMinutes = route.lastDelivery ? (now - route.lastDelivery) / 60000 : null;
  const missingForecastInputs: string[] = [];
  if (stale) missingForecastInputs.push("route observation stale");
  if (detailStale) missingForecastInputs.push("recent itinerary detail");
  if (route.firstDelivery == null) missingForecastInputs.push("first delivery timestamp");
  if (eventAgeMinutes == null) missingForecastInputs.push("last delivery timestamp");
  else if (eventAgeMinutes < -2) missingForecastInputs.push("valid delivery timestamps");
  else if (eventAgeMinutes > 20 && remaining !== 0) missingForecastInputs.push("recent delivery event");
  if (route.deliveryEvents?.length && (route.firstDelivery == null || route.firstDelivery > route.deliveryEvents[0].completedAt ||
    route.lastDelivery == null || route.lastDelivery < route.deliveryEvents.at(-1)!.completedAt))
    missingForecastInputs.push("consistent delivery and stop timestamps");
  if (route.deliveryEvents && !hasCompleteTimeline(route))
    missingForecastInputs.push("complete and consistent stop timeline");
  if (route.deliveryEvents && route.deliveryEvents.length !== route.completedStops)
    missingForecastInputs.push("matching completed-stop count and timestamps");
  if (route.deliveryEvents && !measured.overall)
    missingForecastInputs.push("distinct stop timestamps spanning 30 minutes");
  if (evidence) {
    if (evidence.timestampedTasks < evidence.deliveredTasks || evidence.rejectedTimestamps > 0)
      missingForecastInputs.push("complete delivered-task timestamps");
    if (route.totalStops != null && evidence.deliveryStops < route.totalStops)
      missingForecastInputs.push("complete delivery stop list");
    if (evidence.timestampedStops < 5) missingForecastInputs.push("five timestamped completed stops");
    if (stopHours < 0.5) missingForecastInputs.push("30 minutes between completed stops");
  } else {
    if (elapsedHours < 0.5) missingForecastInputs.push("at least 30 minutes of delivery history");
    if (route.completedStops == null || route.completedStops < 5) missingForecastInputs.push("at least five completed stops");
  }
  if (remaining == null) missingForecastInputs.push("remaining stop count");
  if (route.inboundMinutes == null) missingForecastInputs.push("inbound travel estimate");
  const staleFields = ["firstDelivery", "lastDelivery", "inboundMinutes", "totalStops", "completedStops"] as const;
  if (staleFields.some(field => route.fieldObservedAt?.[field] &&
    now - Date.parse(route.fieldObservedAt[field]!) > 20 * 60000))
    missingForecastInputs.push("fresh forecast inputs");
  const forecastBase = remaining === 0 ? (route.lastStopCompleted || route.lastDelivery || observed) : observed;
  const candidateForecast = !route.actualReturn && !missingForecastInputs.length && pace && remaining != null
    ? forecastBase + remaining / pace * 3600000 + route.inboundMinutes! * 60000 : null;
  if (candidateForecast != null && candidateForecast <= now)
    missingForecastInputs.push("return confirmation or refreshed travel estimate");
  const forecast = missingForecastInputs.length ? null : candidateForecast;
  const delayMinutes =
    forecast && route.plannedReturn
      ? Math.max(0, (forecast - route.plannedReturn) / 60000)
      : null;
  const lateDeparture =
    route.plannedDeparture &&
    (route.actualDeparture || Date.parse(route.observedAt)) >
      route.plannedDeparture + 15 * 60000 &&
    !route.actualReturn &&
    remaining !== 0;
  const risk = stale
    ? "stale"
    : route.actualReturn
      ? "returned"
      : remaining === 0
        ? "complete"
        : delayMinutes != null && delayMinutes >= 30
          ? "delay"
          : lateDeparture
            ? "late departure"
            : !route.actualDeparture
              ? "planned"
              : "on road";
  return {
    ageMinutes,
    eventAgeMinutes,
    detailStale,
    stale,
    remaining,
    pace,
    forecast,
    missingForecastInputs,
    delayMinutes,
    risk,
    paceWindows: measured,
    forecastDeltaMinutes: forecast && route.plannedReturn ? (forecast - route.plannedReturn) / 60000 : null,
    forecastRange: forecast && remaining != null && remaining > 0 && measured.recent && measured.earlier
      ? [Math.min(measured.recent.rate, measured.earlier.rate), Math.max(measured.recent.rate, measured.earlier.rate)]
        .reverse().map(rate => forecastBase + remaining / rate * 3600000 + route.inboundMinutes! * 60000)
      : null,
    confidence: forecast
      ? evidence?.inboundSource === "planned_return_gap"
        ? "low · pace + planned return allowance"
        : "low · pace extrapolation"
      : "insufficient current data",
  };
}
export function latestRoutes(rows: Observation[]) {
  // A route can move from unassigned → assigned and overview/detail responses arrive independently.
  // Render one current row per route, retaining source history as separate observations.
  const groups = new Map<string, Observation[]>();
  for (const row of rows) {
    const key = `${row.station}|${row.date}|${row.routeCode}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.values()]
    .map((group) => {
      group.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
      const latest = { ...group[0] };
      latest.assignmentChanged = group.some(r => r.assignmentChanged) || new Set(group.map(r => r.driverId).filter(Boolean)).size > 1;
      latest.identityUncertain = !group[0].driverId;
      const identity = group.find((r) => r.driverId);
      if (!latest.driverId && latest.detail && identity) {
        latest.driverId = identity.driverId;
        latest.driverName = identity.driverName;
      }
      const compatible = group.filter(
        (r) => !r.driverId || r.driverId === latest.driverId,
      );
      const detail = compatible.find((r) => r.detail && r.driverId === latest.driverId);
      latest.fieldObservedAt = {};
      // Event evidence is one coherent detail sample. A new detail missing data
      // must not silently inherit an older sample or its diagnostic counts.
      for (const field of ["firstDelivery", "lastDelivery", "firstStopCompleted", "lastStopCompleted", "inboundMinutes"] as const) {
        latest[field] = detail?.[field] ?? null;
        if (detail) latest.fieldObservedAt[field] = detail.observedAt;
      }
      latest.timingEvidence = detail?.timingEvidence;
      latest.deliveryEvents = detail?.deliveryEvents;
      latest.signalSamples = detail?.signalSamples;
      latest.recordedSignals = [...new Set(compatible.filter(r => r.driverId === latest.driverId)
        .flatMap(r => r.recordedSignals || []))];
      for (const field of [
        "plannedDeparture",
        "actualDeparture",
        "plannedReturn",
        "actualReturn",
        "totalStops",
        "completedStops",
        "totalPackages",
        "completedPackages",
      ] as const) {
        const source = compatible.find((r) => r[field] != null);
        latest[field] = source?.[field] ?? null;
        if (source) latest.fieldObservedAt[field] = source.observedAt;
      }
      if (
        (!latest.driverName || latest.driverName === "Unassigned") &&
        identity &&
        latest.driverId === identity.driverId
      )
        latest.driverName = identity.driverName;
      latest.detail = !!detail;
      latest.detailObservedAt = detail?.observedAt;
      return latest;
    })
    .sort((a, b) => a.routeCode.localeCompare(b.routeCode));
}

/** Coverage denominator is observed routes, never an inferred station roster. */
export function summarizeCoverage(rows: Observation[], now = Date.now()) {
  return {
    routes: rows.length,
    freshDetails: rows.filter(r => !assessRoute(r, now).detailStale).length,
    withDeliveryEvents: rows.filter(r => r.firstDelivery != null && r.lastDelivery != null).length,
    explicitInbound: rows.filter(r => r.inboundMinutes != null && r.timingEvidence?.inboundSource === "explicit_stem").length,
    plannedAllowance: rows.filter(r => r.inboundMinutes != null && r.timingEvidence?.inboundSource === "planned_return_gap").length,
    forecasts: rows.filter(r => assessRoute(r, now).forecast != null).length,
  };
}
