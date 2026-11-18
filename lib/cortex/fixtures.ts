import { routeSchema, businessDate, type Observation } from "./domain";
/** Synthetic operational data only. Never imported by the live ingest path. */
export function demoData(now = Date.now()) {
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
  const history = routes.flatMap((r) =>
    [1, 2, 3].map((days) => {
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - days);
      return {
        ...r,
        date: d.toISOString().slice(0, 10),
        completedStops: r.totalStops,
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
