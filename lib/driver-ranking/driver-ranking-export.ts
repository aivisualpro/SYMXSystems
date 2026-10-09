import type { DriverRankingResult, DriverRankingRow } from "./driver-ranking-data";
import { RANKING_METRICS, type RankingMetric } from "./driver-ranking-score";

const HEADERS = [
  "Rank", "Driver Name", "Week", "Site", "Delivery Days", "Routes", "Total Planned Route Minutes", "Average Planned Route Minutes", "Planned Duration Route Count", "Missing Planned Duration Route Count", "Stops", "Average Stops Per Route", "Stops Route Count", "Missing Stops Route Count", "SYMX Packages", "Average Packages Per Route", "Packages Route Count", "Missing Packages Route Count", "Efficiency",
  "CDF DPMO Raw", "CDF Amazon Score", "DSB Raw", "DSB Amazon Score", "Delivery Completion DPMO Raw", "Delivery Completion Amazon Score", "POD Raw", "POD Amazon Score", "PSB Raw", "PSB Amazon Score",
  "Speeding Raw", "Speeding Amazon Score", "Seatbelt Raw", "Seatbelt Amazon Score", "Distractions Raw", "Distractions Amazon Score", "Sign Signal Raw", "Sign Signal Amazon Score", "Following Distance Raw", "Following Distance Amazon Score", "CED Raw",
  "Speeding Weight", "Seatbelt Weight", "Distractions Weight", "Sign Signal Weight", "Following Distance Weight", "CDF Weight", "DSB Weight", "PSB Weight", "Delivery Completion Weight", "POD Weight", "Efficiency Weight",
  "Speeding Contribution", "Seatbelt Contribution", "Distractions Contribution", "Sign Signal Contribution", "Following Distance Contribution", "CDF Contribution", "DSB Contribution", "PSB Contribution", "Delivery Completion Contribution", "POD Contribution", "Efficiency Contribution",
  "Delivery Days Score", "Qualifying Delivery Packages", "Packages Per Delivery Day", "Packages Per Day Percentile Score", "Workload Score", "Workload Contribution", "Workload Weight", "Workload Days Subweight", "Workload Packages Subweight",
  "Raw Base Score", "Available Weight", "Missing Weighted Metrics", "Team Average Base Score", "Exposure Confidence", "Exposure Adjustment", "Exposure Adjusted Base Score",
  "Call Outs", "Call Out Deduction", "Write-Ups", "Write-Up Deduction", "CED Triggered", "CED Cap", "CED Cap Applied", "Score Before CED Cap", "Final Score",
  "Config Version", "Config Effective Week", "Call Out Deduction Setting", "Write-Up Deduction Setting", "CED Cap Setting", "Full Confidence Delivery Days", "Exposure Curve",
] as const;

const cell = (value: unknown) => value === null || value === undefined ? "" : String(value);
const escape = (value: unknown) => { const raw = cell(value); const text = typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const contribution = (driver: DriverRankingRow, metric: RankingMetric) => driver.score?.contributions.find(item => item.metric === metric)?.contribution ?? null;

export function driverRankingExportRows(result: DriverRankingResult, siteCode: string) {
  return result.drivers.map(driver => {
    const weekly = driver.amazonWeekly!, score = driver.score!, weights = result.config.weights;
    const values: unknown[] = [
      score.rank, driver.name, driver.period.yearWeek, siteCode, driver.deliveryDays, driver.routes.count, driver.workload.totalPlannedRouteMinutes, driver.workload.averagePlannedRouteMinutes, driver.workload.plannedDurationRouteCount, driver.workload.missingPlannedDurationRouteCount, driver.production.stops, driver.workload.averageStopsPerRoute, driver.workload.stopsRouteCount, driver.workload.missingStopsRouteCount, driver.production.symxPackages, driver.workload.averagePackagesPerRoute, driver.workload.packagesRouteCount, driver.workload.missingPackagesRouteCount, driver.efficiency.average,
      weekly.quality.cdf.value, weekly.quality.cdf.score, weekly.quality.dsb.value, weekly.quality.dsb.score, weekly.quality.deliveryCompletion.value, weekly.quality.deliveryCompletion.score, weekly.quality.pod.value, weekly.quality.pod.score, weekly.quality.psb.value, weekly.quality.psb.score,
      weekly.safety.speeding.value, weekly.safety.speeding.score, weekly.safety.seatbelt.value, weekly.safety.seatbelt.score, weekly.safety.distractions.value, weekly.safety.distractions.score, weekly.safety.signSignal.value, weekly.safety.signSignal.score, weekly.safety.followingDistance.value, weekly.safety.followingDistance.score, weekly.quality.ced.value,
      weights.speeding, weights.seatbelt, weights.distractions, weights.signSignal, weights.followingDistance, weights.cdf, weights.dsb, weights.psb, weights.deliveryCompletion, weights.pod, weights.efficiency,
      ...RANKING_METRICS.map(metric => contribution(driver, metric)),
      score.deliveryDaysScore, score.qualifyingDeliveryPackages, score.packagesPerDeliveryDay, score.packagesPerDayPercentileScore, score.workloadScore, score.workloadContribution, weights.workload ?? 0, result.config.workload?.deliveryDaysWeight ?? null, result.config.workload?.packagesPerDayWeight ?? null,
      score.baseScore, score.availableWeight, score.missingMetrics.join("; "), score.teamAverageBaseScore, score.exposureConfidence, score.exposureAdjustment, score.exposureAdjustedBase,
      driver.attendance.callOutCount, score.callOutPenalty, driver.writeUps.count, score.writeUpPenalty, score.cedApplied, result.config.modifiers.cedCap, score.cedApplied ? result.config.modifiers.cedCap : null, score.scoreBeforeCap, score.finalScore,
      result.config.version, result.config.effectiveFromWeek, result.config.modifiers.callOutDeduction, result.config.modifiers.writeUpDeduction, result.config.modifiers.cedCap, "fullConfidenceDeliveryDays" in result.config.exposure ? result.config.exposure.fullConfidenceDeliveryDays : null, "fullConfidenceDeliveryDays" in result.config.exposure ? null : [result.config.exposure.day1Confidence, result.config.exposure.day2Confidence, result.config.exposure.day3Confidence, result.config.exposure.day4Confidence, result.config.exposure.day5PlusConfidence].join("/"),
    ];
    return Object.fromEntries(HEADERS.map((header, index) => [header, values[index]]));
  });
}

export function driverRankingCsv(result: DriverRankingResult, siteCode: string) {
  const rows = driverRankingExportRows(result, siteCode);
  return [HEADERS.join(","), ...rows.map(row => HEADERS.map(header => escape(row[header])).join(","))].join("\r\n");
}

export const driverRankingFilename = (siteCode: string, week: string) => `SYMX_Driver_Rankings_${siteCode.replace(/[^A-Za-z0-9_-]/g, "")}_${week}.csv`;
export { HEADERS as DRIVER_RANKING_EXPORT_HEADERS };
