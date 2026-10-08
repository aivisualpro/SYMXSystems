import { describe, expect, it } from "vitest";
import { adjustBaseForExposure, calculateDriverScore, exposureConfidence, packagePercentile, packagesPerDeliveryDay, rankDrivers, RECOMMENDED_CONFIG, RECOMMENDED_EXPOSURE, RECOMMENDED_MODIFIERS, RECOMMENDED_WEIGHTS, RECOMMENDED_WORKLOAD, validateRankingConfig, weightTotal, type RankingConfig } from "@/lib/driver-ranking/driver-ranking-score";
import type { DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";

const metric = (score: number | null, value: number | null = 0) => ({ score, value, tier: null });
function driver(changes: Partial<DriverRankingRow> = {}): DriverRankingRow { return { driverId: "1", transporterId: "DA-1", name: "Alpha", profileImage: null, siteId: "site", period: { startDate: "", endDate: "", yearWeek: "2026-W38" }, amazonWeekly: { overallScore: 1, overallStanding: "Bronze", packagesDelivered: 1, safety: { fico: metric(0), speeding: metric(100), seatbelt: metric(100), distractions: metric(100), signSignal: metric(100), followingDistance: metric(100) }, quality: { cdf: metric(100), ced: metric(50, 0), deliveryCompletion: metric(100), dsb: metric(100), pod: metric(100), psb: metric(100) }, sourceWeights: {} as any }, efficiency: { average: 100, routeCount: 1 }, deliveryDays: 4, routes: { count: 1, trainingCount: 0, rescueOnlyCount: 0 }, production: { stops: 1, symxPackages: 1 }, attendance: { callOutCount: 0, callOutDates: [] }, writeUps: { count: 0, records: [] }, ...changes }; }

describe("driver ranking score defaults", () => {
  it("matches the active baseline and totals exactly 100", () => { expect(RECOMMENDED_WEIGHTS.speeding + RECOMMENDED_WEIGHTS.seatbelt + RECOMMENDED_WEIGHTS.distractions + RECOMMENDED_WEIGHTS.signSignal + RECOMMENDED_WEIGHTS.followingDistance).toBe(42); expect(RECOMMENDED_WEIGHTS.cdf + RECOMMENDED_WEIGHTS.dsb + RECOMMENDED_WEIGHTS.psb + RECOMMENDED_WEIGHTS.deliveryCompletion + RECOMMENDED_WEIGHTS.pod).toBeCloseTo(33); expect(RECOMMENDED_WEIGHTS.efficiency).toBe(20); expect(RECOMMENDED_WEIGHTS.workload).toBe(5); expect(RECOMMENDED_EXPOSURE).toEqual({ day1Confidence: 0.35, day2Confidence: 0.55, day3Confidence: 0.70, day4Confidence: 0.82, day5PlusConfidence: 1 }); expect(weightTotal(RECOMMENDED_WEIGHTS)).toBe(100); });
  it("validates exact totals, decimals, modifiers, exposure, and effective week", () => { expect(validateRankingConfig(RECOMMENDED_WEIGHTS, RECOMMENDED_MODIFIERS, RECOMMENDED_EXPOSURE, "2026-W38")).toEqual([]); expect(validateRankingConfig({ ...RECOMMENDED_WEIGHTS, pod: 0 }, RECOMMENDED_MODIFIERS, RECOMMENDED_EXPOSURE, "2026-W38")).not.toEqual([]); expect(validateRankingConfig({ ...RECOMMENDED_WEIGHTS, pod: 2 }, RECOMMENDED_MODIFIERS, RECOMMENDED_EXPOSURE, "2026-W38")).not.toEqual([]); expect(validateRankingConfig({ ...RECOMMENDED_WEIGHTS, cdf: RECOMMENDED_WEIGHTS.cdf + 0.5, pod: RECOMMENDED_WEIGHTS.pod - 0.5 }, RECOMMENDED_MODIFIERS, RECOMMENDED_EXPOSURE, "2026-W38")).toEqual([]); expect(validateRankingConfig(RECOMMENDED_WEIGHTS, RECOMMENDED_MODIFIERS, { fullConfidenceDeliveryDays: 8 }, "2026-W38")).not.toEqual([]); });
});

describe("driver ranking exposure fairness", () => {
  it("uses the explicit curve without interpolation or a separate day bonus", () => { expect([0, 1, 2, 3, 4, 5, 6].map(days => exposureConfidence(days, RECOMMENDED_EXPOSURE))).toEqual([0, 0.35, 0.55, 0.7, 0.82, 1, 1]); expect(exposureConfidence(5, RECOMMENDED_EXPOSURE) - exposureConfidence(4, RECOMMENDED_EXPOSURE)).toBeCloseTo(0.18); });
  it("preserves historical linear configurations", () => { expect([1, 2, 3, 4, 5].map(days => exposureConfidence(days, { fullConfidenceDeliveryDays: 4 }))).toEqual([0.25, 0.5, 0.75, 1, 1]); });
  it("pulls low-exposure scores toward the team average in both directions", () => { expect(adjustBaseForExposure(100, 85, 0.25)).toBe(88.75); expect(adjustBaseForExposure(60, 85, 0.25)).toBe(78.75); expect(adjustBaseForExposure(100, 85, 1)).toBe(100); });
  it("applies exposure before full penalties and the CED cap", () => { const input = driver({ deliveryDays: 1, attendance: { callOutCount: 1, callOutDates: [] }, writeUps: { count: 1, records: [] } }); input.amazonWeekly!.quality.ced.value = 1; const score = calculateDriverScore(input, RECOMMENDED_CONFIG, 84); expect(score).toMatchObject({ baseScore: 100, exposureAdjustedBase: 89.6, callOutPenalty: 10, writeUpPenalty: 10, scoreBeforeCap: 69.6, finalScore: 50 }); });
  it("allows a better four-day raw base to outrank a five-day driver", () => { expect(adjustBaseForExposure(100, 80, 0.82)).toBeGreaterThan(adjustBaseForExposure(94, 80, 1)); });
  it("excludes zero-day drivers and preserves activity-based eligibility", () => { const zero = driver({ name: "Operations", deliveryDays: 0 }); const active = driver({ name: "Delivery", deliveryDays: 1 }); expect(rankDrivers([zero, active], RECOMMENDED_CONFIG).map(row => row.name)).toEqual(["Delivery"]); });
});

describe("driver ranking score engine", () => {
  it("uses individual score fields, clamps efficiency, and ignores overall score, standing, and volume", () => { const first = calculateDriverScore(driver({ efficiency: { average: 118, routeCount: 1 } }), RECOMMENDED_CONFIG); const second = calculateDriverScore(driver({ amazonWeekly: { ...driver().amazonWeekly!, overallScore: 100, overallStanding: "Platinum" }, routes: { count: 99, trainingCount: 0, rescueOnlyCount: 0 }, production: { stops: 999, symxPackages: 999 } }), RECOMMENDED_CONFIG); expect(first.baseScore).toBe(100); expect(second.baseScore).toBe(100); });
  it("renormalizes available weights instead of scoring missing metrics as zero", () => { const input = driver(); input.amazonWeekly!.quality.psb.score = null; const score = calculateDriverScore(input, RECOMMENDED_CONFIG); expect(score.availableWeight).toBeCloseTo(87.67); expect(score.baseScore).toBe(100); expect(score.missingMetrics).toContain("psb"); });
  it("applies configurable call-out/write-up deductions with a zero floor", () => { const input = driver({ attendance: { callOutCount: 2, callOutDates: [] }, writeUps: { count: 1, records: [] } }); const score = calculateDriverScore(input, RECOMMENDED_CONFIG); expect(score).toMatchObject({ callOutPenalty: 20, writeUpPenalty: 10, finalScore: 70 }); const custom: RankingConfig = { ...RECOMMENDED_CONFIG, modifiers: { callOutDeduction: 60, writeUpDeduction: 60, cedCap: 50 } }; expect(calculateDriverScore(input, custom).finalScore).toBe(0); });
  it("uses raw CED only as a cap and never raises a lower score", () => { const high = driver(); high.amazonWeekly!.quality.ced.value = 1; expect(calculateDriverScore(high, RECOMMENDED_CONFIG).finalScore).toBe(50); const low = driver({ attendance: { callOutCount: 6, callOutDates: [] } }); low.amazonWeekly!.quality.ced.value = 1; expect(calculateDriverScore(low, RECOMMENDED_CONFIG).finalScore).toBe(40); });
  it("ranks by final score, safety, CDF, efficiency, then name deterministically", () => { const lowSafety = driver({ driverId: "1", name: "Zulu" }); lowSafety.amazonWeekly!.safety.speeding.score = 90; const highSafety = driver({ driverId: "2", name: "Alpha" }); const ranked = rankDrivers([lowSafety, highSafety], RECOMMENDED_CONFIG); expect(ranked.map(row => [row.name, row.score?.rank])).toEqual([["Alpha", 1], ["Zulu", 2]]); });
});

describe("workload scoring", () => {
  const withPackages = (days: number, packages: number | null) => driver({ deliveryDays: days, workload: { qualifyingDeliveryPackages: packages } as DriverRankingRow["workload"] });
  it("keeps category ratios proportional and validates workload subweights", () => {
    expect(weightTotal(RECOMMENDED_WEIGHTS)).toBeCloseTo(100);
    expect(RECOMMENDED_WEIGHTS.speeding / RECOMMENDED_WEIGHTS.seatbelt).toBeCloseTo(10 / 9);
    expect(RECOMMENDED_WEIGHTS.cdf / RECOMMENDED_WEIGHTS.dsb).toBeCloseTo(12 / 10);
    expect(RECOMMENDED_WORKLOAD).toEqual({ deliveryDaysWeight: 60, packagesPerDayWeight: 40 });
    expect(validateRankingConfig(RECOMMENDED_WEIGHTS, RECOMMENDED_MODIFIERS, RECOMMENDED_EXPOSURE, "2026-W38", { deliveryDaysWeight: 70, packagesPerDayWeight: 40 })).not.toEqual([]);
  });
  it("uses qualifying packages per delivery day, not total Operations packages", () => {
    const input = withPackages(5, 1750);
    input.production.symxPackages = 9999;
    expect(packagesPerDeliveryDay(input)).toBe(350);
    expect(packagesPerDeliveryDay(withPackages(4, null))).toBeNull();
  });
  it("uses tie-aware midrank percentiles without outlier distortion", () => {
    expect(packagePercentile(100, [100, 200, 200, 300])).toBe(0);
    expect(packagePercentile(200, [100, 200, 200, 300])).toBe(50);
    expect(packagePercentile(300, [100, 200, 200, 300])).toBe(100);
    expect(packagePercentile(300, [300, 300, 300])).toBe(50);
    expect(packagePercentile(300, [300])).toBe(50);
  });
  it("gives a fifth day 0.54 more raw points at the same packages/day percentile", () => {
    const five = calculateDriverScore(withPackages(5, 1750), RECOMMENDED_CONFIG, 90, 80);
    const four = calculateDriverScore(withPackages(4, 1400), RECOMMENDED_CONFIG, 90, 80);
    expect(five).toMatchObject({ deliveryDaysScore: 100, packagesPerDeliveryDay: 350, workloadScore: 92, workloadContribution: 4.6, baseScore: 99.6 });
    expect(four).toMatchObject({ deliveryDaysScore: 82, packagesPerDeliveryDay: 350, workloadScore: 81.2, workloadContribution: 4.06, baseScore: 99.06 });
    expect(five.baseScore - four.baseScore).toBeCloseTo(0.54);
  });
  it("keeps missing packages N/A rather than zero and preserves old config behavior", () => {
    const input = withPackages(4, null);
    const score = calculateDriverScore(input, RECOMMENDED_CONFIG, 90);
    expect(score.packagesPerDeliveryDay).toBeNull();
    expect(score.packagesPerDayPercentileScore).toBeNull();
    expect(score.workloadScore).toBeNull();
    expect(score.missingMetrics).toContain("workload");
    const legacy: RankingConfig = { ...RECOMMENDED_CONFIG, weights: { speeding: 10, seatbelt: 9, distractions: 9, signSignal: 9, followingDistance: 7, cdf: 12, dsb: 10, psb: 8, deliveryCompletion: 5, pod: 1, efficiency: 20 }, workload: undefined, exposure: { fullConfidenceDeliveryDays: 5 } };
    expect(calculateDriverScore(withPackages(4, 1400), legacy, 90, 80).workloadContribution).toBe(0);
  });
  it("caps Workload at five raw points even when performance metrics are missing", () => {
    const input = withPackages(5, 1750);
    input.amazonWeekly!.safety.speeding.score = null;
    input.amazonWeekly!.quality.cdf.score = null;
    const score = calculateDriverScore(input, RECOMMENDED_CONFIG, 90, 100);
    expect(score.workloadScore).toBe(100);
    expect(score.workloadContribution).toBe(5);
    expect(score.baseScore).toBe(100);
  });
  it("does not let high workload erase weak Safety or Quality", () => {
    const strong = withPackages(4, 1000);
    const weak = withPackages(5, 2000);
    for (const metric of ["speeding", "seatbelt", "distractions", "signSignal", "followingDistance"] as const) weak.amazonWeekly!.safety[metric].score = 0;
    weak.amazonWeekly!.quality.cdf.score = 0;
    expect(calculateDriverScore(strong, RECOMMENDED_CONFIG, 80, 0).finalScore).toBeGreaterThan(calculateDriverScore(weak, RECOMMENDED_CONFIG, 80, 100).finalScore);
  });
  it("applies deductions after workload and CED last", () => {
    const input = withPackages(5, 1750);
    input.attendance.callOutCount = 1;
    input.writeUps.count = 1;
    input.amazonWeekly!.quality.ced.value = 1;
    const score = calculateDriverScore(input, RECOMMENDED_CONFIG, 90, 80);
    expect(score).toMatchObject({ baseScore: 99.6, callOutPenalty: 10, writeUpPenalty: 10, scoreBeforeCap: 79.6, finalScore: 50 });
  });
  it("ranks deterministically with equal packages/day values", () => {
    const alpha = withPackages(4, 1400), beta = withPackages(4, 1400);
    alpha.driverId = "alpha"; alpha.name = "Alpha";
    beta.driverId = "beta"; beta.name = "Beta";
    const rows = rankDrivers([beta, alpha], RECOMMENDED_CONFIG);
    expect(rows.map(row => row.name)).toEqual(["Alpha", "Beta"]);
    expect(rows[0].score?.packagesPerDayPercentileScore).toBe(50);
  });
});
