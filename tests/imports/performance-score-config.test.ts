import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import DriverPerformanceScoreConfig from "@/lib/models/DriverPerformanceScoreConfig";
import {
  SCORE_CATEGORIES,
  coverageState,
  inactiveScoreConfig,
  performanceScoreFoundation,
  selectEffectiveConfig,
  type PerformanceScoreConfig,
} from "@/lib/scorecard/performance-score-config";

const section = (values: Record<string, unknown>) => ({ values });
const foundation = (overrides: Record<string, unknown> = {}) => performanceScoreFoundation({
  amazonPerformance: section({ overallScore: null, overallStanding: null }),
  safety: section({ ficoMetric: null, seatbeltOffRate: null, speedingEventRate: null, distractionsRate: null, followingDistanceRate: null, signSignalViolationsRate: null }),
  efficiency: section({ averageEfficiency: null, averageStopsPerHour: null }),
  attendance: section({ scheduledDays: null, workedDays: null, absentDaysRecorded: null, callouts: null }),
  ...overrides,
});

describe("inactive performance score configuration", () => {
  it("defines only the four candidate categories with no active weights or thresholds", () => {
    const config = inactiveScoreConfig("organization", 1);
    expect(config).toMatchObject({ scopeType: "COMPANY", siteId: null, version: 1, effectiveDate: null, active: false });
    expect(config.categories.map(row => row.category)).toEqual(SCORE_CATEGORIES);
    expect(config.categories.every(row => !row.enabled && row.weight === null && row.minimumDataCoverage === null)).toBe(true);
    expect(config.categories.map(row => row.category)).not.toContain("ROUTE_VOLUME");
    expect(config.categories.map(row => row.category)).not.toContain("DAILY_DRIVER_ISSUES");
  });

  it("never produces a score or rank while configuration is inactive", () => {
    const result = foundation({ amazonPerformance: section({ overallScore: 100, overallStanding: "Fantastic" }) });
    expect(result).toMatchObject({ active: false, configured: false, score: null, rank: null });
    expect(Object.values(result.categories).every(row => row.enabled === false)).toBe(true);
  });

  it("keeps missing, partial and available coverage distinct without converting missing values to zero", () => {
    expect(coverageState([null, undefined, ""])).toBe("missing");
    expect(coverageState([0, 0])).toBe("available");
    expect(coverageState([0, null])).toBe("partial");
    const result = foundation({
      safety: section({ ficoMetric: null, seatbeltOffRate: 0, speedingEventRate: null, distractionsRate: null, followingDistanceRate: null, signSignalViolationsRate: null }),
      efficiency: section({ averageEfficiency: 0, averageStopsPerHour: 0 }),
    });
    expect(result.categories.SAFETY.coverage).toBe("partial");
    expect(result.categories.EFFICIENCY.coverage).toBe("available");
    expect(result.categories.ATTENDANCE.coverage).toBe("missing");
  });

  it("does not accept issues, disputes, conversations or route volume as score inputs", () => {
    const baseline = foundation();
    const withManagementContext = foundation({
      managementHistory: section({ dailyDriverIssues: 9, disputes: 4, conversations: 2 }),
      volume: section({ packages: 999, routes: 7 }),
    });
    expect(withManagementContext).toEqual(baseline);
  });
});

describe("version and scope foundation", () => {
  const company = (changes: Partial<PerformanceScoreConfig> = {}): PerformanceScoreConfig => ({
    ...inactiveScoreConfig("org", 1), active: true, effectiveDate: "2026-01-01T00:00:00.000Z", ...changes,
  });

  it("keeps versions side by side and chooses an eligible site override without cross-site leakage", () => {
    const configs = [
      company({ version: 1, effectiveDate: "2026-01-01T00:00:00.000Z" }),
      company({ version: 2, effectiveDate: "2026-06-01T00:00:00.000Z" }),
      company({ scopeType: "SITE", siteId: "site-a", version: 1, effectiveDate: "2026-07-01T00:00:00.000Z" }),
    ];
    expect(selectEffectiveConfig(configs, "org", "site-a", new Date("2026-09-01"))?.siteId).toBe("site-a");
    expect(selectEffectiveConfig(configs, "org", "site-b", new Date("2026-09-01"))?.version).toBe(2);
    expect(selectEffectiveConfig(configs, "other-org", "site-a", new Date("2026-09-01"))).toBeNull();
  });

  it("validates company/default and site scope while permitting separate version documents", async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const siteId = new mongoose.Types.ObjectId();
    const categories = inactiveScoreConfig(String(organizationId)).categories;
    const first = new DriverPerformanceScoreConfig({ organizationId, scopeType: "COMPANY", version: 1, categories, createdBy: "test" });
    const second = new DriverPerformanceScoreConfig({ organizationId, scopeType: "COMPANY", version: 2, categories, createdBy: "test" });
    await expect(first.validate()).resolves.toBeUndefined();
    await expect(second.validate()).resolves.toBeUndefined();
    await expect(new DriverPerformanceScoreConfig({ organizationId, scopeType: "COMPANY", siteId, version: 3, categories, createdBy: "test" }).validate()).rejects.toThrow("company scope");
    await expect(new DriverPerformanceScoreConfig({ organizationId, scopeType: "SITE", version: 1, categories, createdBy: "test" }).validate()).rejects.toThrow("Site scope");
    await expect(new DriverPerformanceScoreConfig({ organizationId, scopeType: "SITE", siteId, version: 1, categories, createdBy: "test" }).validate()).resolves.toBeUndefined();
  });

  it("defines immutable snapshots and does not auto-create a collection or indexes", () => {
    const schema = DriverPerformanceScoreConfig.schema;
    expect(schema.get("autoCreate")).toBe(false);
    expect(schema.get("autoIndex")).toBe(false);
    for (const path of ["organizationId", "scopeType", "siteId", "version", "effectiveDate", "active", "categories", "weights", "modifiers", "exposure", "createdBy"]) {
      expect(schema.path(path)?.options.immutable).toBe(true);
    }
    expect(schema.indexes()).toContainEqual([{ organizationId: 1, scopeType: 1, siteId: 1, version: 1 }, { unique: true }]);
  });
});
