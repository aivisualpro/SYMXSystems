import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Driver Rankings imports", () => {
  it("keeps Weekly Overview separate and exposes only CDF and DSB detail imports", () => {
    const page = readFileSync("app/(protected)/driver-rankings/page.tsx", "utf8");
    const component = readFileSync("components/driver-ranking/quality-detail-import.tsx", "utf8");
    const route = readFileSync("app/api/driver-rankings/quality-detail-import/route.ts", "utf8");
    expect(page).toContain("WeeklyScorecardImport");
    expect(page).toContain("QualityDetailImport");
    expect(component).toContain('type ReportType = "cdf-negative" | "daily-dsb-concessions"');
    expect(route).toContain('z.enum(["cdf-negative", "daily-dsb-concessions"])');
    expect(component).not.toContain('"rts"');
    expect(component).not.toContain('"quality-dcr"');
  });

  it("preserves event identity instead of rejecting duplicate transporter IDs", () => {
    const route = readFileSync("app/api/driver-rankings/quality-detail-import/route.ts", "utf8");
    expect(route).toContain("{ siteId, week: input.week, transporterId, trackingId }");
    expect(route).toContain("{ siteId, transporterId, trackingId, concessionDate }");
    expect(route).not.toContain("duplicateTransporterIds");
  });

  it("routes the single Scorecard navigation entry to Driver Rankings", () => {
    const sidebar = readFileSync("components/app-sidebar.tsx", "utf8");
    const modules = readFileSync("app/api/admin/modules/route.ts", "utf8");
    expect(sidebar).toContain('name: "Scorecard",\n      url: "/driver-rankings"');
    expect(sidebar).not.toContain('name: "Driver Rankings"');
    expect(modules).toContain('{ name: "Scorecard", url: "/driver-rankings"');
  });

  it("protects both weekly and quality-detail imports with manager edit permission", () => {
    const weekly = readFileSync("app/api/driver-rankings/weekly-scorecard-import/route.ts", "utf8");
    const quality = readFileSync("app/api/driver-rankings/quality-detail-import/route.ts", "utf8");
    expect(weekly).toContain('requirePermission("Driver Dashboard", "edit")');
    expect(quality).toContain('requirePermission("Driver Dashboard", "edit")');
  });

  it("requires explicit Weekly Scorecard station and replacement decisions", () => {
    const component = readFileSync("components/driver-ranking/weekly-scorecard-import.tsx", "utf8");
    const route = readFileSync("app/api/driver-rankings/weekly-scorecard-import/route.ts", "utf8");
    expect(component).toContain("Wrong Station Detected");
    expect(component).toContain("Duplicate File");
    expect(component).toContain("Updated Scorecard Detected");
    expect(component).toContain("confirmWeekUpdate");
    expect(route).toContain("resolveWriteSiteId(scope, targetSiteId)");
    expect(route).toContain("detectedSite.id !== writeSiteId");
  });
});
