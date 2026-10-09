import "server-only";
import { Types } from "mongoose";
import Employees from "@/lib/models/SymxEmployee";
import Routes from "@/lib/models/SYMXRoute";
import RouteTypes from "@/lib/models/RouteType";
import Writeups from "@/lib/models/Writeup";
import WeeklyOverview from "@/lib/models/SymxDeliveryExcellence";
import AmazonReportImport from "@/lib/models/AmazonReportImport";
import { datesForPerformanceWeek, weekFromDate } from "./reporting-week";
import { effectiveDriverEfficiency } from "@/lib/dispatching/driver-efficiency";
import { loadEffectiveRankingConfig } from "./ranking-config-service";
import { rankDrivers, type DriverRankingScore, type RankingConfig } from "./driver-ranking-score";

export type AmazonMetric = { value: number | null; tier: string | null; score: number | null };
export type AmazonWeeklyData = {
  overallScore: number | null; overallStanding: string | null; packagesDelivered: number | null;
  safety: { fico: AmazonMetric; speeding: AmazonMetric; seatbelt: AmazonMetric; distractions: AmazonMetric; signSignal: AmazonMetric; followingDistance: AmazonMetric };
  quality: { cdf: AmazonMetric; ced: AmazonMetric; deliveryCompletion: AmazonMetric; dsb: AmazonMetric; pod: AmazonMetric; psb: AmazonMetric };
  sourceWeights: { fico: number | null; speeding: number | null; seatbelt: number | null; distractions: number | null; signSignal: number | null; followingDistance: number | null; cdf: number | null; ced: number | null; deliveryCompletion: number | null; dsb: number | null; pod: number | null; psb: number | null };
};
export type DriverRankingRow = {
  driverId: string; transporterId: string; name: string; profileImage: string | null; siteId: string;
  period: { startDate: string; endDate: string; yearWeek: string | null };
  amazonWeekly: AmazonWeeklyData | null;
  efficiency: { average: number | null; routeCount: number };
  deliveryDays: number;
  routes: { count: number; trainingCount: number; rescueOnlyCount: number };
  workload: { totalPlannedRouteMinutes: number | null; averagePlannedRouteMinutes: number | null; plannedDurationRouteCount: number; missingPlannedDurationRouteCount: number; averageStopsPerRoute: number | null; stopsRouteCount: number; missingStopsRouteCount: number; averagePackagesPerRoute: number | null; packagesRouteCount: number; missingPackagesRouteCount: number; qualifyingDeliveryPackages: number | null };
  production: { stops: number | null; symxPackages: number | null };
  attendance: { callOutCount: number; callOutDates: string[] };
  writeUps: { count: number; records: { date: string; category: string; status: string }[] };
  score?: DriverRankingScore;
};
export type DriverRankingResult = { period: DriverRankingRow["period"]; availableWeeks: string[]; scorecardImported: boolean; config: RankingConfig; canEdit?: boolean; aiWeeklyReviewEnabled?: boolean; drivers: DriverRankingRow[] };

const dateKey = (value: unknown) => { const date = new Date(String(value)); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ""; };
const days = (rows: any[]) => new Set(rows.map(row => dateKey(row.date)).filter(Boolean)).size;
const tid = (value: unknown) => String(value || "").trim().toUpperCase();
const finite = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.trim().replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
export const isQualifyingDeliveryRoute = (row: { routeNumber?: unknown }, routeType: string) => Boolean(String(row.routeNumber || "").trim()) && !["off", "call out", "standby", "office", "operations"].includes(routeType);
export function parseRouteDurationMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]), seconds = Number(match[3] || 0);
  if (minutes > 59 || seconds > 59) return null;
  return Math.round((hours * 60 + minutes + seconds / 60) * 100) / 100;
}
const measurements = (rows: any[], field: "stopCount" | "packageCount") => {
  const values = rows.map(row => row[field]).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  return { total: values.length ? values.reduce((sum, value) => sum + value, 0) : null, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, valid: values.length, missing: rows.length - values.length };
};
const metric = (row: any, value: string, tier: string, score: string): AmazonMetric => ({ value: finite(row?.[value]), tier: row?.[tier] || null, score: finite(row?.[score]) });

export function currentAmazonWeek(now = new Date()): string {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return weekFromDate(localDate) || "";
}
export function rankingPeriod(input: { week?: string; startDate?: string; endDate?: string }) {
  if (input.startDate || input.endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate || "") || input.startDate! > input.endDate!) throw new Error("Choose a valid date range.");
    return { startDate: input.startDate!, endDate: input.endDate!, yearWeek: null };
  }
  const week = /^\d{4}-W\d{2}$/.test(input.week || "") ? input.week! : currentAmazonWeek();
  const dates = datesForPerformanceWeek(week); if (!dates.length) throw new Error("Choose a valid reporting week.");
  return { startDate: dates[0], endDate: dates.at(-1)!, yearWeek: week };
}

export async function loadDriverRankingData(siteId: string, input: { week?: string; startDate?: string; endDate?: string } = {}): Promise<DriverRankingResult> {
  if (!Types.ObjectId.isValid(siteId)) throw new Error("Select one site.");
  const site = new Types.ObjectId(siteId), period = rankingPeriod(input);
  const start = new Date(`${period.startDate}T00:00:00.000Z`), end = new Date(`${period.endDate}T23:59:59.999Z`), week = period.yearWeek;
  const [routes, routeTypes, writeups, overviewRows, successfulImports, routeWeeks, overviewWeeks] = await Promise.all([
    Routes.find({ siteId: site, date: { $gte: start, $lte: end } }, { transporterId: 1, date: 1, typeId: 1, routeNumber: 1, routeDuration: 1, driverEfficiency: 1, stopCount: 1, packageCount: 1, stopsRescued: 1, plannedFirstStop: 1, plannedLastStop: 1, actualFirstStop: 1, actualLastStop: 1 }).lean<any[]>(),
    RouteTypes.find({}, { name: 1 }).lean<any[]>(),
    Writeups.find({ siteId: site, incidentDate: { $gte: start, $lte: end } }, { employeeId: 1, transporterId: 1, incidentDate: 1, categoryLabel: 1, status: 1 }).lean<any[]>(),
    week ? WeeklyOverview.find({ siteId: site, week }).lean<any[]>() : Promise.resolve([]),
    week ? AmazonReportImport.find({ siteId: site, week, periodType: "Weekly", reportType: "delivery-excellence", status: "success" }, { _id: 1 }).lean<any[]>() : Promise.resolve([]),
    Routes.distinct("yearWeek", { siteId: site }), WeeklyOverview.distinct("week", { siteId: site }),
  ]);
  const selectedSiteTransporterIds = [...new Set([
    ...routes.map(row => tid(row.transporterId)),
    ...overviewRows.map(row => tid(row.transporterId)),
  ].filter(Boolean))];
  const employees = selectedSiteTransporterIds.length
    ? await Employees.find(
      { transporterId: { $in: selectedSiteTransporterIds } },
      { firstName: 1, lastName: 1, transporterId: 1, profileImage: 1, primarySiteId: 1, status: 1 },
    ).lean<any[]>()
    : [];
  const successfulIds = new Set(successfulImports.map(row => String(row._id)));
  const finalizedOverview = overviewRows.filter(row => Array.isArray(row.sourceImportIds) && row.sourceImportIds.some((id: unknown) => successfulIds.has(String(id))));
  const overviewByDriver = new Map(finalizedOverview.map(row => [tid(row.transporterId), row]));
  const types = new Map(routeTypes.map(row => [String(row._id), String(row.name || "").trim().toLowerCase()]));
  const callOutTypeKnown = routeTypes.some(row => String(row.name || "").trim().toLowerCase() === "call out");
  const grouped = <T extends { transporterId?: string }>(rows: T[]) => rows.reduce<Map<string, T[]>>((map, row) => { const key = tid(row.transporterId); if (key) map.set(key, [...(map.get(key) || []), row]); return map; }, new Map());
  const routesByDriver = grouped(routes), employeeById = new Map(employees.map(row => [String(row._id), tid(row.transporterId)]));
  const writeupsByDriver = writeups.reduce<Map<string, any[]>>((map, row) => { const key = tid(row.transporterId) || employeeById.get(String(row.employeeId)) || ""; if (key) map.set(key, [...(map.get(key) || []), row]); return map; }, new Map());
  const historicalWeek = !!week && week !== currentAmazonWeek();
  const drivers = employees.map(employee => {
    const transporterId = tid(employee.transporterId), driverRoutes = routesByDriver.get(transporterId) || [], overview = overviewByDriver.get(transporterId);
    const typeName = (row: any) => types.get(String(row.typeId)) || "";
    const assigned = driverRoutes.filter(row => String(row.routeNumber || "").trim() && !["off", "call out"].includes(typeName(row)));
    const deliveryRoutes = driverRoutes.filter(row => isQualifyingDeliveryRoute(row, typeName(row)));
    const efficiencies = assigned.map(effectiveDriverEfficiency).filter((value): value is number => value !== null && value > 0);
    const durations = assigned.map(row => parseRouteDurationMinutes(row.routeDuration)).filter((value): value is number => value !== null);
    const durationTotal = durations.length ? durations.reduce((sum, value) => sum + value, 0) : null;
    const stops = measurements(assigned, "stopCount"), packages = measurements(assigned, "packageCount"), deliveryPackages = measurements(deliveryRoutes, "packageCount");
    const callouts = driverRoutes.filter(row => typeName(row) === "call out"), records = writeupsByDriver.get(transporterId) || [];
    const amazonWeekly: AmazonWeeklyData | null = overview ? {
      overallScore: finite(overview.overallScore), overallStanding: overview.overallStanding || null, packagesDelivered: finite(overview.packagesDelivered),
      safety: { fico: metric(overview, "ficoMetric", "ficoTier", "ficoScore"), speeding: metric(overview, "speedingEventRate", "speedingEventRateTier", "speedingEventRateScore"), seatbelt: metric(overview, "seatbeltOffRate", "seatbeltOffRateTier", "seatbeltOffRateScore"), distractions: metric(overview, "distractionsRate", "distractionsRateTier", "distractionsRateScore"), signSignal: metric(overview, "signSignalViolationsRate", "signSignalViolationsRateTier", "signSignalViolationsRateScore"), followingDistance: metric(overview, "followingDistanceRate", "followingDistanceRateTier", "followingDistanceRateScore") },
      quality: { cdf: metric(overview, "cdfDpmo", "cdfDpmoTier", "cdfDpmoScore"), ced: metric(overview, "ced", "cedTier", "cedScore"), deliveryCompletion: metric(overview, "dcDpmo", "dcDpmoTier", "dcDpmoScore"), dsb: metric(overview, "dsb", "dsbDpmoTier", "dsbDpmoScore"), pod: metric(overview, "pod", "podTier", "podScore"), psb: metric(overview, "psb", "psbTier", "psbScore") },
      sourceWeights: { fico: finite(overview.ficoMetricWeightApplied), speeding: finite(overview.speedingEventRateWeightApplied), seatbelt: finite(overview.seatbeltOffRateWeightApplied), distractions: finite(overview.distractionsRateWeightApplied), signSignal: finite(overview.signSignalViolationsRateWeightApplied), followingDistance: finite(overview.followingDistanceRateWeightApplied), cdf: finite(overview.cdfDpmoWeightApplied), ced: finite(overview.cedWeightApplied), deliveryCompletion: finite(overview.dcDpmoWeightApplied), dsb: finite(overview.dsbDpmoWeightApplied), pod: finite(overview.podWeightApplied), psb: finite(overview.psbWeightApplied) },
    } : null;
    const belongsToSelectedPopulation = (employee.status === "Active" && String(employee.primarySiteId) === String(site)) || (historicalWeek && driverRoutes.length > 0);
    if (!belongsToSelectedPopulation) return null;
    return {
      driverId: String(employee._id), transporterId, name: `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || transporterId, profileImage: employee.profileImage || null, siteId,
      period, amazonWeekly, efficiency: { average: mean(efficiencies), routeCount: efficiencies.length }, deliveryDays: days(deliveryRoutes),
      routes: { count: assigned.length, trainingCount: assigned.filter(row => typeName(row).includes("training")).length, rescueOnlyCount: driverRoutes.filter(row => !String(row.routeNumber || "").trim() && typeName(row).includes("rescue")).length },
      workload: { totalPlannedRouteMinutes: durationTotal, averagePlannedRouteMinutes: durationTotal === null ? null : durationTotal / durations.length, plannedDurationRouteCount: durations.length, missingPlannedDurationRouteCount: assigned.length - durations.length, averageStopsPerRoute: stops.average, stopsRouteCount: stops.valid, missingStopsRouteCount: stops.missing, averagePackagesPerRoute: packages.average, packagesRouteCount: packages.valid, missingPackagesRouteCount: packages.missing, qualifyingDeliveryPackages: deliveryPackages.missing === 0 ? deliveryPackages.total : null },
      production: { stops: stops.total, symxPackages: packages.total },
      attendance: { callOutCount: callOutTypeKnown ? days(callouts) : 0, callOutDates: [...new Set(callouts.map(row => dateKey(row.date)).filter(Boolean))] },
      writeUps: { count: records.length, records: records.map(row => ({ date: dateKey(row.incidentDate), category: row.categoryLabel || "", status: row.status || "" })) },
    } satisfies DriverRankingRow;
  }).filter((driver): driver is DriverRankingRow => driver !== null && driver.amazonWeekly !== null && driver.amazonWeekly.overallScore !== null).sort((a, b) => a.name.localeCompare(b.name));
  const availableWeeks = [...new Set([...routeWeeks, ...overviewWeeks].filter(value => /^\d{4}-W\d{2}$/.test(String(value))).map(String))].sort().reverse();
  if (week && !availableWeeks.includes(week)) availableWeeks.unshift(week);
  const config = await loadEffectiveRankingConfig(siteId, week || currentAmazonWeek());
  return { period, availableWeeks, scorecardImported: finalizedOverview.length > 0, config, drivers: rankDrivers(drivers, config) };
}
