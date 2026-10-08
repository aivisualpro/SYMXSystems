export const SCORE_CATEGORIES = ["AMAZON_WEEKLY", "SAFETY", "EFFICIENCY", "ATTENDANCE"] as const;
export type ScoreCategory = typeof SCORE_CATEGORIES[number];
export type CoverageState = "available" | "partial" | "missing";
export type ScoreCategoryConfig = {
  category: ScoreCategory; enabled: boolean; weight: number | null; minimumDataCoverage: number | null;
};
export type PerformanceScoreConfig = {
  organizationId: string; scopeType: "COMPANY" | "SITE"; siteId: string | null;
  version: number; effectiveDate: string | null; active: boolean; categories: ScoreCategoryConfig[];
};
export type ScoreFoundation = {
  active: false; configured: false; score: null; rank: null;
  categories: Record<ScoreCategory, { enabled: false; coverage: CoverageState }>;
};

export function inactiveScoreConfig(organizationId: string, version = 1): PerformanceScoreConfig {
  return {
    organizationId, scopeType: "COMPANY", siteId: null, version, effectiveDate: null, active: false,
    categories: SCORE_CATEGORIES.map(category => ({ category, enabled: false, weight: null, minimumDataCoverage: null })),
  };
}
export function coverageState(values: unknown[]): CoverageState {
  const present = values.filter(value => value !== null && value !== undefined && value !== "").length;
  return present === 0 ? "missing" : present === values.length ? "available" : "partial";
}
export function performanceScoreFoundation(profile: {
  amazonPerformance: { values: Record<string, unknown> }; safety: { values: Record<string, unknown> };
  efficiency: { values: Record<string, unknown> }; attendance: { values: Record<string, unknown> };
}): ScoreFoundation {
  const coverage: Record<ScoreCategory, CoverageState> = {
    AMAZON_WEEKLY: coverageState([profile.amazonPerformance.values.overallScore, profile.amazonPerformance.values.overallStanding]),
    SAFETY: coverageState(["ficoMetric", "seatbeltOffRate", "speedingEventRate", "distractionsRate", "followingDistanceRate", "signSignalViolationsRate"].map(key => profile.safety.values[key])),
    EFFICIENCY: coverageState([profile.efficiency.values.averageEfficiency, profile.efficiency.values.averageStopsPerHour]),
    ATTENDANCE: coverageState([profile.attendance.values.scheduledDays, profile.attendance.values.workedDays, profile.attendance.values.absentDaysRecorded, profile.attendance.values.callouts]),
  };
  return {
    active: false, configured: false, score: null, rank: null,
    categories: Object.fromEntries(SCORE_CATEGORIES.map(category => [category, { enabled: false, coverage: coverage[category] }])) as ScoreFoundation["categories"],
  };
}

export function selectEffectiveConfig(configs: PerformanceScoreConfig[], organizationId: string, siteId: string | null, at: Date) {
  const eligible = configs.filter(config => config.organizationId === organizationId && config.active &&
    (config.scopeType === "COMPANY" && config.siteId === null || config.scopeType === "SITE" && config.siteId === siteId) &&
    config.effectiveDate !== null && Date.parse(config.effectiveDate) <= at.getTime());
  return eligible.sort((a, b) => Number(b.scopeType === "SITE") - Number(a.scopeType === "SITE") ||
    Date.parse(b.effectiveDate!) - Date.parse(a.effectiveDate!) || b.version - a.version)[0] || null;
}
