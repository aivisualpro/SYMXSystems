import type { DriverRankingRow } from "./driver-ranking-data";

export type DriverSortKey = "rank" | "name" | "amazon" | "efficiency" | "averageRoute" | "days" | "routes" | "stops" | "packages" | "callouts" | "writeups";
export type SortDirection = "asc" | "desc";
export const defaultDirection = (key: DriverSortKey): SortDirection => key === "rank" ? "desc" : key === "name" || ["callouts", "writeups"].includes(key) ? "asc" : "desc";
export const sortValue = (driver: DriverRankingRow, key: Exclude<DriverSortKey, "name">): number | null => ({ rank: driver.score?.rank ?? null, amazon: driver.amazonWeekly?.overallScore ?? null, efficiency: driver.efficiency.average, averageRoute: driver.workload.averagePlannedRouteMinutes, days: driver.deliveryDays, routes: driver.routes.count, stops: driver.production.stops, packages: driver.production.symxPackages, callouts: driver.attendance.callOutCount, writeups: driver.writeUps.count })[key];
export function sortDrivers(drivers: DriverRankingRow[], key: DriverSortKey, direction: SortDirection) {
  return [...drivers].sort((a, b) => {
    const nameOrder = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (key === "name") return nameOrder * (direction === "asc" ? 1 : -1);
    const av = sortValue(a, key), bv = sortValue(b, key);
    if (av === null) return bv === null ? nameOrder : 1;
    if (bv === null) return -1;
    const multiplier = key === "rank" ? direction === "desc" ? 1 : -1 : direction === "asc" ? 1 : -1;
    return (av - bv) * multiplier || nameOrder;
  });
}
