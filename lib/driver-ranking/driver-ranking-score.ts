import type { DriverRankingRow } from "./driver-ranking-data";

export const RANKING_METRICS = ["speeding", "seatbelt", "distractions", "signSignal", "followingDistance", "cdf", "dsb", "psb", "deliveryCompletion", "pod", "efficiency"] as const;
export type RankingMetric = typeof RANKING_METRICS[number];
export type RankingWeights = Record<RankingMetric, number> & { workload?: number };
export type RankingModifiers = { callOutDeduction: number; writeUpDeduction: number; cedCap: number };
export type RankingExposure = { fullConfidenceDeliveryDays: number } | { day1Confidence: number; day2Confidence: number; day3Confidence: number; day4Confidence: number; day5PlusConfidence: number };
export type RankingWorkload = { deliveryDaysWeight: number; packagesPerDayWeight: number };
export type RankingConfig = { weights: RankingWeights; modifiers: RankingModifiers; exposure: RankingExposure; workload?: RankingWorkload; version: number; effectiveFromWeek: string; source: "recommended" | "saved" };

export const RECOMMENDED_WEIGHTS: RankingWeights = { speeding: 9.55, seatbelt: 8.59, distractions: 8.59, signSignal: 8.59, followingDistance: 6.68, cdf: 11, dsb: 9.17, psb: 7.33, deliveryCompletion: 4.58, pod: 0.92, efficiency: 20, workload: 5 };
export const RECOMMENDED_MODIFIERS: RankingModifiers = { callOutDeduction: 10, writeUpDeduction: 10, cedCap: 50 };
export const RECOMMENDED_EXPOSURE: RankingExposure = { day1Confidence: 0.35, day2Confidence: 0.55, day3Confidence: 0.70, day4Confidence: 0.82, day5PlusConfidence: 1 };
export const RECOMMENDED_WORKLOAD: RankingWorkload = { deliveryDaysWeight: 60, packagesPerDayWeight: 40 };
export const RECOMMENDED_CONFIG: RankingConfig = { weights: RECOMMENDED_WEIGHTS, modifiers: RECOMMENDED_MODIFIERS, exposure: RECOMMENDED_EXPOSURE, workload: RECOMMENDED_WORKLOAD, version: 0, effectiveFromWeek: "default", source: "recommended" };
export const weightTotal = (weights: RankingWeights) => RANKING_METRICS.reduce((sum, metric) => sum + weights[metric], weights.workload ?? 0);
export function validateRankingConfig(weights: RankingWeights, modifiers: RankingModifiers, exposure: RankingExposure, week: string, workload: RankingWorkload = RECOMMENDED_WORKLOAD): string[] {
  const errors: string[] = [];
  if (Math.abs(weightTotal(weights) - 100) > 0.000001) errors.push("Base metric weights must total exactly 100%.");
  for (const metric of RANKING_METRICS) if (!Number.isFinite(weights[metric]) || weights[metric] < 0 || weights[metric] > 100) errors.push(`${metric} weight must be between 0 and 100.`);
  if (!Number.isFinite(weights.workload ?? 0) || (weights.workload ?? 0) < 0 || (weights.workload ?? 0) > 100) errors.push("Workload weight must be between 0 and 100.");
  if (!workload || !Number.isFinite(workload.deliveryDaysWeight) || !Number.isFinite(workload.packagesPerDayWeight) || workload.deliveryDaysWeight < 0 || workload.packagesPerDayWeight < 0 || Math.abs(workload.deliveryDaysWeight + workload.packagesPerDayWeight - 100) > 0.000001) errors.push("Workload subweights must total exactly 100%.");
  for (const [key, value] of Object.entries(modifiers)) if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${key} must be between 0 and 100.`);
  if ("fullConfidenceDeliveryDays" in exposure) {
    if (!Number.isInteger(exposure.fullConfidenceDeliveryDays) || exposure.fullConfidenceDeliveryDays < 1 || exposure.fullConfidenceDeliveryDays > 7) errors.push("Full-confidence delivery days must be a whole number between 1 and 7.");
  } else {
    const values = [exposure.day1Confidence, exposure.day2Confidence, exposure.day3Confidence, exposure.day4Confidence, exposure.day5PlusConfidence];
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1) || values.some((value, index) => index > 0 && value < values[index - 1]) || exposure.day5PlusConfidence !== 1) errors.push("Exposure confidence must increase from day 1 through 100% at day 5.");
  }
  if (!/^\d{4}-W\d{2}$/.test(week)) errors.push("Effective week must use YYYY-Www format.");
  return errors;
}

export type ScoreContribution = { metric: RankingMetric; normalizedScore: number | null; configuredWeight: number; effectiveWeight: number; contribution: number };
export type DriverRankingScore = { baseScore: number; exposureAdjustedBase: number; deliveryDays: number; deliveryDaysScore: number; qualifyingDeliveryPackages: number | null; packagesPerDeliveryDay: number | null; packagesPerDayPercentileScore: number | null; workloadScore: number | null; workloadContribution: number; exposureConfidence: number; teamAverageBaseScore: number; exposureAdjustment: number; safetyScore: number | null; safetySubtotal: number; safetyWeight: number; qualityScore: number | null; qualitySubtotal: number; qualityWeight: number; efficiencyScore: number | null; efficiencySubtotal: number; efficiencyWeight: number; availableWeight: number; missingMetrics: (RankingMetric | "workload")[]; contributions: ScoreContribution[]; callOutPenalty: number; writeUpPenalty: number; cedApplied: boolean; scoreBeforeCap: number; finalScore: number; rank: number };
const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number) => Math.min(100, Math.max(0, value));

export const exposureConfidence = (deliveryDays: number, exposure: RankingExposure) => {
  if ("fullConfidenceDeliveryDays" in exposure) return Math.min(Math.max(deliveryDays, 0) / exposure.fullConfidenceDeliveryDays, 1);
  if (deliveryDays < 1) return 0;
  if (deliveryDays >= 5) return exposure.day5PlusConfidence;
  return [exposure.day1Confidence, exposure.day2Confidence, exposure.day3Confidence, exposure.day4Confidence][Math.floor(deliveryDays) - 1];
};
export const adjustBaseForExposure = (rawBaseScore: number, teamAverageBaseScore: number, confidence: number) => round(teamAverageBaseScore + confidence * (rawBaseScore - teamAverageBaseScore));
export const deliveryDaysScore = (days: number) => exposureConfidence(days, RECOMMENDED_EXPOSURE) * 100;
export const packagesPerDeliveryDay = (driver: DriverRankingRow): number | null => driver.deliveryDays > 0 && typeof driver.workload?.qualifyingDeliveryPackages === "number" && Number.isFinite(driver.workload.qualifyingDeliveryPackages) ? driver.workload.qualifyingDeliveryPackages / driver.deliveryDays : null;

// Midrank percentile: tied values share the midpoint of their occupied ranks; a sole/all-tied population is neutral at 50.
export function packagePercentile(value: number, population: number[]): number {
  if (population.length < 2) return 50;
  const below = population.filter(item => item < value).length;
  const tied = population.filter(item => item === value).length;
  return round(100 * (below + (tied - 1) / 2) / (population.length - 1));
}

export function calculateDriverScore(driver: DriverRankingRow, config: RankingConfig, teamAverageBaseScore?: number, packagePercentileScore: number | null = null): Omit<DriverRankingScore, "rank"> {
  const weekly = driver.amazonWeekly;
  const scores: Record<RankingMetric, number | null> = {
    speeding: weekly?.safety.speeding.score ?? null, seatbelt: weekly?.safety.seatbelt.score ?? null,
    distractions: weekly?.safety.distractions.score ?? null, signSignal: weekly?.safety.signSignal.score ?? null,
    followingDistance: weekly?.safety.followingDistance.score ?? null, cdf: weekly?.quality.cdf.score ?? null,
    dsb: weekly?.quality.dsb.score ?? null, psb: weekly?.quality.psb.score ?? null,
    deliveryCompletion: weekly?.quality.deliveryCompletion.score ?? null, pod: weekly?.quality.pod.score ?? null,
    efficiency: driver.efficiency.average === null ? null : clamp(driver.efficiency.average),
  };
  for (const metric of RANKING_METRICS) if (scores[metric] !== null) scores[metric] = clamp(scores[metric]!);
  const qualifyingDeliveryPackages = driver.workload?.qualifyingDeliveryPackages ?? null;
  const packagesPerDay = packagesPerDeliveryDay(driver);
  const daysScore = deliveryDaysScore(driver.deliveryDays);
  const workloadScore = packagePercentileScore === null || packagesPerDay === null || !config.workload ? null : round((daysScore * config.workload.deliveryDaysWeight + packagePercentileScore * config.workload.packagesPerDayWeight) / 100);
  const performanceWeight = RANKING_METRICS.reduce((sum, metric) => scores[metric] === null ? sum : sum + config.weights[metric], 0);
  const workloadWeight = workloadScore === null ? 0 : config.weights.workload ?? 0;
  const availableWeight = performanceWeight + workloadWeight;
  const performanceBudget = workloadWeight > 0 ? 100 - workloadWeight : 100;
  const rawContribution = (metric: RankingMetric) => scores[metric] === null || performanceWeight === 0 ? 0 : scores[metric]! * config.weights[metric] / performanceWeight * performanceBudget / 100;
  const contributions = RANKING_METRICS.map(metric => {
    const normalizedScore = scores[metric], configuredWeight = config.weights[metric];
    const effectiveWeight = normalizedScore === null || performanceWeight === 0 ? 0 : configuredWeight * performanceBudget / performanceWeight;
    return { metric, normalizedScore, configuredWeight, effectiveWeight: round(effectiveWeight), contribution: round(rawContribution(metric)) };
  });
  const subtotal = (metrics: RankingMetric[]) => round(metrics.reduce((sum, metric) => sum + rawContribution(metric), 0));
  const categoryScore = (metrics: RankingMetric[]) => { const weight = metrics.reduce((sum, metric) => scores[metric] === null ? sum : sum + config.weights[metric], 0); return weight ? round(metrics.reduce((sum, metric) => sum + (scores[metric] ?? 0) * config.weights[metric], 0) / weight) : null; };
  const workloadContribution = workloadScore === null ? 0 : round(workloadScore * workloadWeight / 100);
  const baseScore = round(RANKING_METRICS.reduce((sum, metric) => sum + rawContribution(metric), workloadScore === null ? 0 : workloadScore * workloadWeight / 100));
  const confidence = exposureConfidence(driver.deliveryDays, config.exposure);
  const teamAverage = teamAverageBaseScore ?? baseScore;
  const exposureAdjustedBase = adjustBaseForExposure(baseScore, teamAverage, confidence);
  const callOutPenalty = round(driver.attendance.callOutCount * config.modifiers.callOutDeduction);
  const writeUpPenalty = round(driver.writeUps.count * config.modifiers.writeUpDeduction);
  const scoreBeforeCap = round(Math.max(0, exposureAdjustedBase - callOutPenalty - writeUpPenalty));
  const cedApplied = (weekly?.quality.ced.value ?? 0) > 0;
  return { baseScore, exposureAdjustedBase, deliveryDays: driver.deliveryDays, deliveryDaysScore: daysScore, qualifyingDeliveryPackages, packagesPerDeliveryDay: packagesPerDay, packagesPerDayPercentileScore: packagePercentileScore, workloadScore, workloadContribution, exposureConfidence: round(confidence), teamAverageBaseScore: round(teamAverage), exposureAdjustment: round(exposureAdjustedBase - baseScore), safetyScore: categoryScore(["speeding", "seatbelt", "distractions", "signSignal", "followingDistance"]), safetySubtotal: subtotal(["speeding", "seatbelt", "distractions", "signSignal", "followingDistance"]), safetyWeight: config.weights.speeding + config.weights.seatbelt + config.weights.distractions + config.weights.signSignal + config.weights.followingDistance, qualityScore: categoryScore(["cdf", "dsb", "psb", "deliveryCompletion", "pod"]), qualitySubtotal: subtotal(["cdf", "dsb", "psb", "deliveryCompletion", "pod"]), qualityWeight: config.weights.cdf + config.weights.dsb + config.weights.psb + config.weights.deliveryCompletion + config.weights.pod, efficiencyScore: categoryScore(["efficiency"]), efficiencySubtotal: subtotal(["efficiency"]), efficiencyWeight: config.weights.efficiency, availableWeight: round(availableWeight), missingMetrics: [...RANKING_METRICS.filter(metric => scores[metric] === null), ...(config.weights.workload && workloadScore === null ? ["workload" as const] : [])], contributions, callOutPenalty, writeUpPenalty, cedApplied, scoreBeforeCap, finalScore: round(cedApplied ? Math.min(scoreBeforeCap, config.modifiers.cedCap) : scoreBeforeCap) };
}

export function rankDrivers(drivers: DriverRankingRow[], config: RankingConfig): DriverRankingRow[] {
  const eligible = drivers.filter(driver => driver.deliveryDays > 0 && calculateDriverScore(driver, config).availableWeight > 0);
  const packagePopulation = eligible.map(packagesPerDeliveryDay).filter((value): value is number => value !== null);
  const percentile = (driver: DriverRankingRow) => { const value = packagesPerDeliveryDay(driver); return value === null ? null : packagePercentile(value, packagePopulation); };
  const rawScores = eligible.map(driver => calculateDriverScore(driver, config, undefined, percentile(driver)));
  const calculable = rawScores.filter(score => score.availableWeight > 0);
  const teamAverage = calculable.length ? calculable.reduce((sum, score) => sum + score.baseScore, 0) / calculable.length : 0;
  return eligible.map(driver => ({ ...driver, score: { ...calculateDriverScore(driver, config, teamAverage, percentile(driver)), rank: 0 } })).filter(driver => driver.score!.availableWeight > 0).sort((a, b) => b.score!.finalScore - a.score!.finalScore || b.score!.safetySubtotal - a.score!.safetySubtotal || (b.amazonWeekly?.quality.cdf.score ?? -1) - (a.amazonWeekly?.quality.cdf.score ?? -1) || (b.efficiency.average ?? -1) - (a.efficiency.average ?? -1) || a.name.localeCompare(b.name)).map((driver, index) => ({ ...driver, score: { ...driver.score!, rank: index + 1 } }));
}
