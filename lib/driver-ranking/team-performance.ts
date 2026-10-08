import type { DriverRankingResult, DriverRankingRow } from "./driver-ranking-data";

export type TeamMetricKey = "finalScore" | "efficiency" | "averageRoute" | "cdf" | "dsb" | "deliveryCompletion" | "pod" | "psb" | "safety" | "quality" | "speeding" | "seatbelt" | "distractions" | "signSignal" | "followingDistance";
export type TrendTone = "positive" | "negative" | "neutral";
export type TeamOutlier = { metric: string; direction: "high" | "low"; contextOnly: boolean; drivers: { driverId: string; name: string; value: number }[] };
export type TeamFocusItem = { metric: string; change: number; tone: Exclude<TrendTone, "neutral">; direction: "increased" | "decreased" };
export const PERFORMANCE_BANDS = ["Elite", "Top", "Strong", "Solid", "Needs Attention"] as const;
export type PerformanceBand = typeof PERFORMANCE_BANDS[number];
export function performanceBand(finalScore: number): PerformanceBand {
  if (finalScore >= 98) return "Elite";
  if (finalScore >= 96) return "Top";
  if (finalScore >= 94) return "Strong";
  if (finalScore >= 90) return "Solid";
  return "Needs Attention";
}
export function performanceMix(drivers: DriverRankingRow[]) {
  const bands = PERFORMANCE_BANDS.map(name => ({ name, drivers: drivers.filter(driver => driver.score && performanceBand(driver.score.finalScore) === name) }));
  const scored = drivers.map(driver => driver.score?.finalScore).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  return { total: scored.length, average: round(mean(scored)), bands: bands.map(band => ({ ...band, count: band.drivers.length, percent: scored.length ? Math.round(band.drivers.length / scored.length * 100) : 0 })) };
}
export function relativePercentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous * 100;
}
const mean = (values: Array<number | null | undefined>) => { const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; };
const round = (value: number | null) => value === null ? null : Math.round(value * 100) / 100;
const quantile = (sorted: number[], percentile: number) => { const position = (sorted.length - 1) * percentile, lower = Math.floor(position), fraction = position - lower; return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]); };
export const teamMetricValue = (driver: DriverRankingRow, metric: TeamMetricKey): number | null => ({ finalScore: driver.score?.finalScore ?? null, efficiency: driver.efficiency.average, averageRoute: driver.workload.averagePlannedRouteMinutes, cdf: driver.amazonWeekly?.quality.cdf.value ?? null, dsb: driver.amazonWeekly?.quality.dsb.value ?? null, deliveryCompletion: driver.amazonWeekly?.quality.deliveryCompletion.value ?? null, pod: driver.amazonWeekly?.quality.pod.value ?? null, psb: driver.amazonWeekly?.quality.psb.value ?? null, safety: driver.score?.safetyScore ?? null, quality: driver.score?.qualityScore ?? null, speeding: driver.amazonWeekly?.safety.speeding?.value ?? null, seatbelt: driver.amazonWeekly?.safety.seatbelt?.value ?? null, distractions: driver.amazonWeekly?.safety.distractions?.value ?? null, signSignal: driver.amazonWeekly?.safety.signSignal?.value ?? null, followingDistance: driver.amazonWeekly?.safety.followingDistance?.value ?? null })[metric];
export function teamTrendTone(metric: TeamMetricKey | "deliveryDays" | "stops" | "packages", change: number): TrendTone { if (change === 0 || ["averageRoute", "deliveryDays", "stops", "packages"].includes(metric)) return "neutral"; const higherIsBetter = ["finalScore", "efficiency", "pod", "safety", "quality"].includes(metric); return higherIsBetter === change > 0 ? "positive" : "negative"; }

export function detectTeamOutliers(drivers: DriverRankingRow[]): TeamOutlier[] {
  const metrics: Array<[string, boolean, (driver: DriverRankingRow) => number | null]> = [["Final Score", false, driver => driver.score?.finalScore ?? null], ["Efficiency", false, driver => driver.efficiency.average], ["Safety", false, driver => driver.score?.safetySubtotal ?? null], ["Quality", false, driver => driver.score?.qualitySubtotal ?? null], ["Avg Route", true, driver => driver.workload.averagePlannedRouteMinutes]];
  return metrics.flatMap(([metric, contextOnly, read]) => {
    const rows = drivers.map(driver => ({ driver, value: read(driver) })).filter((row): row is { driver: DriverRankingRow; value: number } => row.value !== null && Number.isFinite(row.value));
    if (rows.length < 4) return [];
    const sorted = rows.map(row => row.value).sort((a, b) => a - b), q1 = quantile(sorted, .25), q3 = quantile(sorted, .75), iqr = q3 - q1;
    if (iqr === 0) return [];
    const low = rows.filter(row => row.value < q1 - 1.5 * iqr), high = rows.filter(row => row.value > q3 + 1.5 * iqr);
    const flagged: TeamOutlier[] = [];
    if (low.length) flagged.push({ metric, direction: "low", contextOnly, drivers: low.map(row => ({ driverId: row.driver.driverId, name: row.driver.name, value: row.value })) });
    if (high.length) flagged.push({ metric, direction: "high", contextOnly, drivers: high.map(row => ({ driverId: row.driver.driverId, name: row.driver.name, value: row.value })) });
    return flagged;
  });
}

const FOCUS: Array<{ key: TeamMetricKey; label: string; group: "safety" | "quality" | "efficiency" }> = [
  { key: "safety", label: "Safety", group: "safety" }, { key: "speeding", label: "Speeding", group: "safety" }, { key: "seatbelt", label: "Seatbelt", group: "safety" }, { key: "distractions", label: "Distractions", group: "safety" }, { key: "signSignal", label: "Sign / Signal", group: "safety" }, { key: "followingDistance", label: "Following Distance", group: "safety" },
  { key: "quality", label: "Quality", group: "quality" }, { key: "cdf", label: "CDF", group: "quality" }, { key: "dsb", label: "DSB", group: "quality" }, { key: "deliveryCompletion", label: "Delivery Completion", group: "quality" }, { key: "pod", label: "POD", group: "quality" }, { key: "psb", label: "PSB", group: "quality" }, { key: "efficiency", label: "Efficiency", group: "efficiency" },
];
export function selectTeamFocus(current: Partial<Record<TeamMetricKey, number | null>>, previous: Partial<Record<TeamMetricKey, number | null>>): TeamFocusItem[] {
  return FOCUS.flatMap(({ key, label, group }) => {
    const now = current[key], prior = previous[key]; if (now === null || now === undefined || prior === null || prior === undefined) return [];
    const change = Math.round((now - prior) * 100) / 100;
    const material = Math.abs(change) >= Math.max(.5, Math.abs(prior) * .02); if (!material) return [];
    const tone = teamTrendTone(key, change); if (tone === "neutral") return [];
    const worseningPriority = tone === "negative" ? group === "safety" ? 0 : group === "quality" ? 1 : 2 : 3;
    return [{ metric: label, change, tone, direction: change > 0 ? "increased" as const : "decreased" as const, priority: worseningPriority }];
  }).sort((a, b) => a.priority - b.priority || Math.abs(b.change) - Math.abs(a.change)).slice(0, 3).map(({ priority: _priority, ...item }) => item);
}

export function teamSummary(result: DriverRankingResult) {
  const drivers = result.drivers;
  const contribution = (metric: string) => mean(drivers.map(driver => driver.score?.contributions.find(item => item.metric === metric)?.contribution));
  const finalScores = drivers.map(driver => driver.score?.finalScore ?? null);
  return {
    driversRanked: drivers.length,
    totalRoutes: drivers.reduce((sum, driver) => sum + driver.routes.count, 0),
    averages: { finalScore: round(mean(finalScores)), rawBaseScore: round(mean(drivers.map(driver => driver.score?.baseScore))), exposureAdjustedBase: round(mean(drivers.map(driver => driver.score?.exposureAdjustedBase))), safetyScore: round(mean(drivers.map(driver => driver.score?.safetyScore))), qualityScore: round(mean(drivers.map(driver => driver.score?.qualityScore))), safetySubtotal: round(mean(drivers.map(driver => driver.score?.safetySubtotal))), qualitySubtotal: round(mean(drivers.map(driver => driver.score?.qualitySubtotal))), efficiencyContribution: round(mean(drivers.map(driver => driver.score?.efficiencySubtotal))), callOutDeduction: round(mean(drivers.map(driver => driver.score?.callOutPenalty))), writeUpDeduction: round(mean(drivers.map(driver => driver.score?.writeUpPenalty))), efficiency: round(mean(drivers.map(driver => driver.efficiency.average))), deliveryDays: round(mean(drivers.map(driver => driver.deliveryDays))), averageRoute: round(mean(drivers.map(driver => driver.workload.averagePlannedRouteMinutes))), stops: round(mean(drivers.map(driver => driver.workload.averageStopsPerRoute))), packages: round(mean(drivers.map(driver => driver.workload.averagePackagesPerRoute))) },
    cedTriggeredCount: drivers.filter(driver => driver.score?.cedApplied).length,
    contributionAverages: Object.fromEntries(["speeding", "seatbelt", "distractions", "signSignal", "followingDistance", "cdf", "dsb", "psb", "deliveryCompletion", "pod", "efficiency"].map(metric => [metric, round(contribution(metric))])),
    outliers: detectTeamOutliers(drivers),
    mix: { top: finalScores.filter(value => value !== null && value >= 90).length, good: finalScores.filter(value => value !== null && value >= 75 && value < 90).length, attention: finalScores.filter(value => value !== null && value < 75).length, limited: finalScores.filter(value => value === null).length, provisional: true },
  };
}
