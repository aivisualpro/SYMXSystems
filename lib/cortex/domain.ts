import { z } from "zod";

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
  detailObservedAt?: string;
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
  const detailStale =
    !!route.detailObservedAt &&
    now - Date.parse(route.detailObservedAt) > 20 * 60000;
  const remaining =
    route.totalStops == null || route.completedStops == null
      ? null
      : Math.max(0, route.totalStops - route.completedStops);
  // No false precision: require five completed stops and 30 minutes of actual work.
  const elapsedHours = route.firstDelivery
    ? (Date.parse(route.observedAt) - route.firstDelivery) / 3600000
    : 0;
  const pace =
    route.completedStops != null &&
    route.completedStops >= 5 &&
    elapsedHours >= 0.5
      ? route.completedStops / elapsedHours
      : null;
  const forecast =
    !stale &&
    !detailStale &&
    !route.actualReturn &&
    pace &&
    remaining != null &&
    route.inboundMinutes != null
      ? Date.parse(route.observedAt) +
        (remaining / pace) * 3600000 +
        route.inboundMinutes * 60000
      : null;
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
  const missingForecastInputs: string[] = [];
  if (stale) missingForecastInputs.push("route observation stale");
  if (!route.detailObservedAt || detailStale)
    missingForecastInputs.push("recent itinerary detail");
  if (route.firstDelivery == null)
    missingForecastInputs.push("first delivery timestamp");
  else if (elapsedHours < 0.5)
    missingForecastInputs.push("at least 30 minutes of delivery history");
  if (route.completedStops == null || route.completedStops < 5)
    missingForecastInputs.push("at least five completed stops");
  if (remaining == null)
    missingForecastInputs.push("remaining stop count");
  if (route.inboundMinutes == null)
    missingForecastInputs.push("inbound travel estimate");
  return {
    ageMinutes,
    stale,
    remaining,
    pace,
    forecast,
    missingForecastInputs,
    delayMinutes,
    risk,
    confidence: forecast
      ? "low · pace extrapolation"
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
      const identity = group.find((r) => r.driverId);
      if (!latest.driverId && latest.detail && identity) {
        latest.driverId = identity.driverId;
        latest.driverName = identity.driverName;
      }
      const compatible = group.filter(
        (r) => !r.driverId || r.driverId === latest.driverId,
      );
      const detail = compatible.find((r) => r.detail);
      for (const field of [
        "plannedDeparture",
        "actualDeparture",
        "plannedReturn",
        "actualReturn",
        "firstDelivery",
        "lastDelivery",
        "inboundMinutes",
        "totalStops",
        "completedStops",
        "totalPackages",
        "completedPackages",
      ] as const) {
        if (latest[field] == null)
          latest[field] =
            compatible.find((r) => r[field] != null)?.[field] ?? null;
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
