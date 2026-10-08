import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}), { virtual: true });
import DriverPerformanceLink from "@/lib/models/DriverPerformanceLink";
import { createDriverPerformanceToken } from "@/lib/driver-ranking/driver-performance-link";
import {
  configuredPublicDriverPerformanceSites,
  publicDriverPerformanceEnabled,
  publicDriverPerformanceSiteCodeAllowed,
} from "@/lib/driver-ranking/driver-performance-public-config";
import { buildDriverWeeklyQualityDetails, toDriverSafeQualityDetails } from "@/lib/driver-ranking/driver-weekly-quality-events";

describe("private driver performance links", () => {
  const previousEnabled = process.env.DRIVER_PERFORMANCE_PUBLIC_ENABLED;
  const previousSites = process.env.DRIVER_PERFORMANCE_PUBLIC_SITES;
  afterEach(() => {
    if (previousEnabled === undefined) delete process.env.DRIVER_PERFORMANCE_PUBLIC_ENABLED;
    else process.env.DRIVER_PERFORMANCE_PUBLIC_ENABLED = previousEnabled;
    if (previousSites === undefined) delete process.env.DRIVER_PERFORMANCE_PUBLIC_SITES;
    else process.env.DRIVER_PERFORMANCE_PUBLIC_SITES = previousSites;
  });

  it("fails closed and supports a case-insensitive site rollout allowlist", () => {
    delete process.env.DRIVER_PERFORMANCE_PUBLIC_ENABLED;
    delete process.env.DRIVER_PERFORMANCE_PUBLIC_SITES;
    expect(publicDriverPerformanceEnabled()).toBe(false);
    expect(publicDriverPerformanceSiteCodeAllowed("DFO2")).toBe(false);

    process.env.DRIVER_PERFORMANCE_PUBLIC_ENABLED = "true";
    process.env.DRIVER_PERFORMANCE_PUBLIC_SITES = " dfo2, DXC8,DFO2 ";
    expect(configuredPublicDriverPerformanceSites()).toEqual(["DFO2", "DXC8"]);
    expect(publicDriverPerformanceSiteCodeAllowed("DFO2")).toBe(true);
    expect(publicDriverPerformanceSiteCodeAllowed("dxc8")).toBe(true);
    expect(publicDriverPerformanceSiteCodeAllowed("DFO3")).toBe(false);

    delete process.env.DRIVER_PERFORMANCE_PUBLIC_SITES;
    expect(publicDriverPerformanceSiteCodeAllowed("DFO3")).toBe(true);
  });

  it("creates long opaque non-sequential tokens", () => {
    const first = createDriverPerformanceToken(), second = createDriverPerformanceToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("keeps one site-scoped permanent mapping and supports revocation", () => {
    expect(DriverPerformanceLink.schema.path("active")).toBeTruthy();
    expect(DriverPerformanceLink.schema.path("token").options.select).toBe(false);
    expect(DriverPerformanceLink.schema.indexes()).toEqual(expect.arrayContaining([
      [{ siteId: 1, employeeId: 1 }, expect.objectContaining({ unique: true })],
    ]));
  });

  it("removes every manager-only quality field from the driver DTO", () => {
    const internal = buildDriverWeeklyQualityDetails([{
      _id: "canonical-secret", sourceImportIds: ["import-secret"], impactsScorecard: "Y", trackingId: "TBA-secret",
      deliveryDate: "2026-09-18", deliveredToWrongAddress: "1", disputeStatus: "Open", feedbackDetails: "private raw detail",
    }], [{
      _id: "dsb-secret", sourceImportIds: ["import-secret"], impactsScorecard: "Y", trackingId: "TBA-secret-2",
      deliveryDate: "2026-09-19", concessionDate: "2026-09-20", noPodOnDelivery: true, disputeStatus: "Denied",
    }], "2026-W38");
    const safe = toDriverSafeQualityDetails(internal);
    expect(safe.cdf[0]).toEqual({ metricFamily: "CDF", friendlyLabel: "Wrong Address", count: 1, deliveryDates: ["2026-09-18"], explanation: "Verify the address and group stop before completing the delivery." });
    expect(safe.dsb[0].friendlyLabel).toBe("No Photo on Delivery");
    const serialized = JSON.stringify(safe);
    for (const forbidden of ["trackingId", "TBA-secret", "sourceImport", "canonical", "dispute", "private raw detail"]) expect(serialized).not.toContain(forbidden);
  });

  it("keeps the public page and API free of manager endpoints and identifiers", () => {
    const page = readFileSync("app/driver-performance/[token]/page.tsx", "utf8");
    const client = readFileSync("components/driver-ranking/public-driver-performance.tsx", "utf8");
    const route = readFileSync("app/api/public/driver-performance/[token]/route.ts", "utf8");
    expect(client).toContain("/api/public/driver-performance/");
    expect(`${page}\n${client}`).not.toMatch(/transporterId|employeeId|trackingId|sourceImportId|writeUps|callOut/);
    expect(page).toContain("if (!data) notFound()");
    expect(route).toContain("loadPublicDriverPerformance");
    expect(route).toContain("invalid or inactive");
    expect(route).not.toContain("loadDriverRankingData");
  });

  it("keeps the manager action authenticated and the public response read-only", () => {
    const managerRoute = readFileSync("app/api/driver-rankings/driver-link/route.ts", "utf8");
    const publicRoute = readFileSync("app/api/public/driver-performance/[token]/route.ts", "utf8");
    expect(managerRoute).toContain('requirePermission("Driver Dashboard", "edit")');
    expect(managerRoute).toContain("primarySiteId: siteId");
    expect(publicRoute).toContain("export async function GET");
    expect(publicRoute).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it("enforces rollout gates at manager generation and public read boundaries", () => {
    const managerRoute = readFileSync("app/api/driver-rankings/driver-link/route.ts", "utf8");
    const managerDataRoute = readFileSync("app/api/driver-rankings/route.ts", "utf8");
    const publicRoute = readFileSync("app/api/public/driver-performance/[token]/route.ts", "utf8");
    const publicService = readFileSync("lib/driver-ranking/driver-performance-public.ts", "utf8");
    const linkService = readFileSync("lib/driver-ranking/driver-performance-link.ts", "utf8");
    expect(managerRoute).toContain("publicDriverPerformanceSiteEnabled(siteId)");
    expect(managerDataRoute).toContain("publicDriverPerformanceEnabled");
    expect(linkService).toContain("publicDriverPerformanceSiteEnabled(siteId)");
    expect(publicRoute).toContain("publicDriverPerformanceEnabled()");
    expect(publicService).toContain("publicDriverPerformanceSiteEnabled(siteId)");
    expect(publicService).toContain("token, active: true");
    expect(publicService).toContain("_id: link.employeeId, primarySiteId: link.siteId");
  });

  it("keeps historical summaries and quality details bounded to the selected week", () => {
    const service = readFileSync("lib/driver-ranking/driver-performance-public.ts", "utf8");
    expect(service).toContain("availableWeeks.filter(week => week <= selectedWeek)");
    expect(service).toContain("summarizeDriverHistory(history, windowWeeks)");
    expect(service).toContain("loadDriverWeeklyQualityDetails(siteId, selectedWeek, transporterId)");
    expect(service).not.toContain("filter(week => week >= selectedWeek)");
  });

  it("keeps missing quality detail honest and the mobile view collapsed by default", () => {
    const page = readFileSync("components/driver-ranking/public-driver-performance.tsx", "utf8");
    expect(page).toContain("Detailed quality information is not available for this week.");
    expect(page).toContain("<details");
    expect(page).not.toContain("<details open");
    expect(page).toContain("overflow-x-hidden");
    expect(page).toContain("min-h-10");
  });

  it("keeps the public scorecard scrollable when a Radix scroll lock is present", () => {
    const layout = readFileSync("app/driver-performance/layout.tsx", "utf8");
    const styles = readFileSync("app/driver-performance/driver-performance.css", "utf8");
    expect(layout).toContain("data-public-driver-performance-root");
    expect(styles).toContain("html body:has([data-public-driver-performance-root])");
    expect(styles).toContain("overflow-y: auto !important");
    expect(styles).toContain("overflow-x: hidden !important");
    expect(styles).toContain("height: auto !important");
    expect(styles).toContain("touch-action: pan-y");
  });
});
