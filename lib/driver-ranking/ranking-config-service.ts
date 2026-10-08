import "server-only";
import DriverPerformanceScoreConfig from "@/lib/models/DriverPerformanceScoreConfig";
import Site from "@/lib/models/Site";
import { inactiveScoreConfig } from "@/lib/scorecard/performance-score-config";
import { RECOMMENDED_CONFIG, RECOMMENDED_EXPOSURE, RECOMMENDED_WORKLOAD, validateRankingConfig, type RankingConfig, type RankingExposure, type RankingModifiers, type RankingWeights, type RankingWorkload } from "./driver-ranking-score";

const leanConfig = (row: any): RankingConfig => ({ weights: row.weights, modifiers: row.modifiers, exposure: row.exposure || RECOMMENDED_EXPOSURE, workload: row.workload || ((row.weights?.workload ?? 0) > 0 ? RECOMMENDED_WORKLOAD : undefined), version: row.version, effectiveFromWeek: row.effectiveFromWeek, source: "saved" });

export async function loadEffectiveRankingConfig(siteId: string, week: string): Promise<RankingConfig> {
  const row = await DriverPerformanceScoreConfig.findOne({ siteId, scopeType: "SITE", active: true, effectiveFromWeek: { $lte: week }, weights: { $ne: null } }).sort({ effectiveFromWeek: -1, version: -1 }).lean();
  return row ? leanConfig(row) : RECOMMENDED_CONFIG;
}

export async function rankingConfigHistory(siteId: string) {
  return DriverPerformanceScoreConfig.find({ siteId, scopeType: "SITE", weights: { $ne: null } }).sort({ effectiveFromWeek: -1, version: -1 }).lean();
}

export async function saveRankingConfig(siteId: string, weights: RankingWeights, modifiers: RankingModifiers, exposure: RankingExposure, effectiveFromWeek: string, actor: string, workload: RankingWorkload = RECOMMENDED_WORKLOAD) {
  const errors = validateRankingConfig(weights, modifiers, exposure, effectiveFromWeek, workload);
  if (errors.length) throw new Error(errors.join(" "));
  const site = await Site.findById(siteId, { organizationId: 1 }).lean<any>();
  if (!site) throw new Error("Site not found.");
  const latest = await DriverPerformanceScoreConfig.findOne({ siteId, scopeType: "SITE" }).sort({ version: -1 }).lean<any>();
  const version = (latest?.version || 0) + 1;
  const foundation = inactiveScoreConfig(String(site.organizationId), version);
  const created = await DriverPerformanceScoreConfig.create({ ...foundation, organizationId: site.organizationId, scopeType: "SITE", siteId, version, active: true, effectiveDate: new Date(), effectiveFromWeek, weights, modifiers, exposure, workload, previousVersion: latest?.version || null, createdBy: actor, updatedBy: actor });
  return leanConfig(created.toObject());
}
