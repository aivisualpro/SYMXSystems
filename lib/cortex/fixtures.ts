import { completedHistoryFixture, intelligenceFixture } from "./intelligence-fixtures";
import { routeSchema, businessDate, type Observation } from "./domain";
/** Synthetic operational data only. Never imported by the live ingest path. */
export function demoData(now = Date.now(), withIntelligence = false) {
  const date = businessDate(new Date(now));
  const routes: Observation[] = ["DFO2", "DXC8", "DFO3"].flatMap(
    (station, stationIndex) =>
      Array.from({ length: 5 }, (_, i) => {
        const stale = i === 4;
        return {
          ...routeSchema.parse({
            routeCode: `CX${100 + stationIndex * 10 + i}`,
            routeId: `demo-route-${station}-${i}`,
            driverId: `demo-driver-${station}-${i}`,
            driverName: `Demo Driver ${stationIndex * 5 + i + 1}`,
            totalStops: 150 + i * 9,
            completedStops: i === 0 ? 0 : 58 + i * 8,
            totalPackages: 240 + i * 15,
            completedPackages: i === 0 ? 0 : 98 + i * 10,
            plannedDeparture: now - 5 * 3600000,
            actualDeparture: i === 0 ? null : now - (i === 2 ? 3 : 5) * 3600000,
            plannedReturn: now + (i === 3 ? 0.5 : 4) * 3600000,
            firstDelivery: i === 0 ? null : now - 4 * 3600000,
            lastDelivery: i === 0 ? null : now - 7 * 60000,
            inboundMinutes: 25,
            detail: i !== 0,
          }),
          station,
          date,
          observedAt: new Date(now - (stale ? 45 : 3) * 60000).toISOString(),
        };
      }),
  );
  if (withIntelligence) routes.forEach((r, i) => {
    if (i % 5 === 0 || r.station !== "DFO2") return;
    const shape = intelligenceFixture(i % 5 === 1 ? "slowdown" : i % 5 === 2 ? "gap" : "steady", now - (i % 5 === 4 ? 45 : 0) * 60000);
    const identity = { routeCode: r.routeCode, routeId: r.routeId, driverId: r.driverId, driverName: r.driverName, station: r.station };
    Object.assign(r, shape, identity);
  });
  const history = routes.flatMap((r) =>
    [1, 2, 3].map((days) => {
      if (withIntelligence && r.station === "DFO2" && r.deliveryEvents?.length) return completedHistoryFixture(r, days);
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - days);
      return {
        ...r,
        firstDelivery: r.firstDelivery == null ? null : r.firstDelivery - days * 86400000,
        lastDelivery: r.lastDelivery == null ? null : r.lastDelivery - days * 86400000,
        firstStopCompleted: r.firstStopCompleted == null ? null : r.firstStopCompleted - days * 86400000,
        lastStopCompleted: r.lastStopCompleted == null ? null : r.lastStopCompleted - days * 86400000,
        deliveryEvents: r.deliveryEvents?.map(e => ({ completedAt: e.completedAt - days * 86400000, plannedAt: e.plannedAt == null ? null : e.plannedAt - days * 86400000 })),
        plannedReturn: r.plannedReturn == null ? null : r.plannedReturn - days * 86400000,
        date: d.toISOString().slice(0, 10),
        completedStops: withIntelligence ? r.completedStops : r.totalStops,
        completedPackages: r.totalPackages,
        observedAt: new Date(now - days * 86400000).toISOString(),
        actualReturn: now - days * 86400000,
      };
    }),
  );
  return {
    date,
    routes,
    history,
    generatedAt: new Date(now).toISOString(),
    demo: true,
  };
}
