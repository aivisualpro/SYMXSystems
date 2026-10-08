import { describe, expect, it } from "vitest";
import { detectTeamOutliers, performanceBand, performanceMix, relativePercentChange, selectTeamFocus, teamMetricValue, teamSummary, teamTrendTone } from "@/lib/driver-ranking/team-performance";
import { RECOMMENDED_CONFIG } from "@/lib/driver-ranking/driver-ranking-score";
import type { DriverRankingResult, DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";

const driver = (name: string, finalScore: number, efficiency: number): DriverRankingRow => ({ driverId: name, transporterId: name, name, profileImage: null, siteId: "site", period: { startDate: "", endDate: "", yearWeek: "2026-W37" }, amazonWeekly: { overallScore: 100, overallStanding: null, packagesDelivered: null, safety: {} as any, quality: { cdf: { value: 0 }, dsb: { value: 0 }, deliveryCompletion: { value: 0 }, pod: { value: 100 }, psb: { value: 0 } } as any, sourceWeights: {} as any }, efficiency: { average: efficiency, routeCount: 1 }, deliveryDays: 4, routes: { count: 4, trainingCount: 0, rescueOnlyCount: 0 }, workload: { averagePlannedRouteMinutes: 480, averageStopsPerRoute: 160, averagePackagesPerRoute: 280 } as any, production: { stops: 640, symxPackages: 1120 }, attendance: { callOutCount: 0, callOutDates: [] }, writeUps: { count: 0, records: [] }, score: { rank: 1, finalScore, baseScore: finalScore, exposureAdjustedBase: finalScore, safetyScore: 96, qualityScore: 98, safetySubtotal: 40, qualitySubtotal: 34, efficiencySubtotal: 18, callOutPenalty: 0, writeUpPenalty: 0, cedApplied: false, contributions: [] } as any });
const result = (drivers: DriverRankingRow[]): DriverRankingResult => ({ period: drivers[0]?.period || { startDate: "", endDate: "", yearWeek: "2026-W37" }, availableWeeks: [], scorecardImported: true, config: RECOMMENDED_CONFIG, drivers });

describe("team performance analytics", () => {
  it("computes relative movement without changing raw metric values", () => {
    expect(relativePercentChange(100, 80)).toBe(25);
    expect(relativePercentChange(75, 100)).toBe(-25);
    expect(Math.round(Math.abs(relativePercentChange(99.35, 99.78)!))).toBe(0);
    expect(relativePercentChange(0, 0)).toBe(0);
    expect(relativePercentChange(5, 0)).toBeNull();
    expect(relativePercentChange(null, 10)).toBeNull();
  });
  it("uses normalized category scores for the numeric summary and trend", () => { const row = driver("A", 90, 103.6); expect(teamMetricValue(row, "safety")).toBe(96); expect(teamMetricValue(row, "quality")).toBe(98); expect(teamSummary(result([row])).averages).toMatchObject({ safetyScore: 96, qualityScore: 98, efficiency: 103.6 }); expect(row.score?.safetySubtotal).toBe(40); });
  it("includes every ranked driver and total qualifying routes", () => { const summary = teamSummary(result([driver("A", 100, 110), driver("B", 80, 90), driver("C", 60, 70)])); expect(summary).toMatchObject({ driversRanked: 3, totalRoutes: 12, averages: { finalScore: 80, efficiency: 90 } }); });
  it("assigns exact band boundaries and includes each ranked driver once", () => {
    const examples = [[98, "Elite"], [97.99, "Top"], [96, "Top"], [95.99, "Strong"], [94, "Strong"], [93.99, "Solid"], [90, "Solid"], [89.99, "Needs Attention"]] as const;
    for (const [score, band] of examples) expect(performanceBand(score)).toBe(band);
    const drivers = examples.map(([score], index) => driver(`Driver ${index}`, score, 100));
    const mix = performanceMix(drivers);
    expect(mix.total).toBe(drivers.length);
    expect(mix.bands.map(band => band.count)).toEqual([1, 2, 2, 2, 1]);
    expect(mix.bands.flatMap(band => band.drivers.map(row => row.driverId)).sort()).toEqual(drivers.map(row => row.driverId).sort());
    expect(mix.bands.reduce((sum, band) => sum + band.count, 0)).toBe(drivers.length);
    expect(performanceMix([]).average).toBeNull();
  });
  it("flags IQR outliers with driver drilldown without removing them", () => { const drivers = [80, 81, 82, 83, 84, 20].map((score, index) => driver(`Driver ${index + 1}`, score, 90)); const outliers = detectTeamOutliers(drivers); expect(outliers).toContainEqual(expect.objectContaining({ metric: "Final Score", direction: "low", drivers: [expect.objectContaining({ name: "Driver 6", value: 20 })] })); expect(teamSummary(result(drivers)).driversRanked).toBe(6); });
  it("applies higher/lower/context trend semantics", () => { expect(teamTrendTone("finalScore", 2)).toBe("positive"); expect(teamTrendTone("efficiency", -2)).toBe("negative"); expect(teamTrendTone("cdf", -2)).toBe("positive"); expect(teamTrendTone("deliveryCompletion", 2)).toBe("negative"); expect(teamTrendTone("averageRoute", 20)).toBe("neutral"); });
  it("detects Safety and Quality outliers but never Stops or Packages", () => { const drivers = [38, 39, 40, 41, 42, 5].map((safety, index) => { const row = driver(`Driver ${index + 1}`, 80 + index, 90); row.score!.safetySubtotal = safety; row.score!.qualitySubtotal = safety === 5 ? 8 : safety - 6; row.workload.averageStopsPerRoute = index === 5 ? 10 : 160; row.workload.averagePackagesPerRoute = index === 5 ? 20 : 280; return row; }); const outliers = detectTeamOutliers(drivers); expect(outliers.map(item => item.metric)).toEqual(expect.arrayContaining(["Safety", "Quality"])); expect(outliers.map(item => item.metric)).not.toEqual(expect.arrayContaining(["Stops", "Packages"])); });
  it("treats Avg Route outliers as context only", () => { const drivers = [480, 481, 482, 483, 484, 900].map((minutes, index) => { const row = driver(`Driver ${index + 1}`, 80, 90); row.workload.averagePlannedRouteMinutes = minutes; return row; }); expect(detectTeamOutliers(drivers)).toContainEqual(expect.objectContaining({ metric: "Avg Route", direction: "high", contextOnly: true })); });
  it("selects only meaningful Safety, Quality, and Efficiency focus changes", () => { const focus = selectTeamFocus({ speeding: 3, cdf: 120, efficiency: 88 } as any, { speeding: 1, cdf: 100, efficiency: 92 } as any); expect(focus.map(item => item.metric)).toEqual(["Speeding", "CDF", "Efficiency"]); expect(focus.every(item => item.tone === "negative")).toBe(true); expect(selectTeamFocus({ efficiency: 90.1 } as any, { efficiency: 90 } as any)).toEqual([]); });
});
