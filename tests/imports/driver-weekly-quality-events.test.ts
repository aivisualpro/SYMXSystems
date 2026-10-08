import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDriverWeeklyQualityDetails, loadDriverWeeklyQualityDetails } from "@/lib/driver-ranking/driver-weekly-quality-events";
import AmazonReportImport from "@/lib/models/AmazonReportImport";
import ScoreCardCDFNegative from "@/lib/models/ScoreCardCDFNegative";
import ScoreCardDSBConcession from "@/lib/models/ScoreCardDSBConcession";

const base = { _id: "event-1", sourceImportIds: ["import-1"], impactsScorecard: "Y", trackingId: "TBA1", deliveryDate: "2026-09-18" };

describe("driver weekly CDF and DSB quality details", () => {
  afterEach(() => vi.restoreAllMocks());
  it("expands single and multiple CDF reasons without duplicating the canonical miss", () => {
    const details = buildDriverWeeklyQualityDetails([
      { ...base, deliveredToWrongAddress: "1" },
      { ...base, _id: "event-2", trackingId: "TBA2", daMishandledPackage: "Y", receivedWrongItem: "true" },
    ], [], "2026-W38");
    expect(details.cdf.totalMisses).toBe(2);
    expect(details.cdf.subMetrics.map(metric => [metric.friendlyLabel, metric.count])).toEqual([
      ["Mishandled Package", 1], ["Wrong Address", 1], ["Wrong Item", 1],
    ]);
    expect(details.cdf.subMetrics.every(metric => metric.week === "2026-W38" && metric.sourcePeriod === "Weekly")).toBe(true);
  });

  it("keeps non-impacting DSB out and expands an impacting multi-reason row", () => {
    const details = buildDriverWeeklyQualityDetails([], [
      { ...base, concessionDate: "2026-09-19", simultaneousDeliveries: true, noPodOnDelivery: true },
      { ...base, _id: "event-2", impactsScorecard: "No", incorrectScanUsageAttended: true },
    ], "2026-W38");
    expect(details.dsb.totalMisses).toBe(1);
    expect(details.dsb.subMetrics.map(metric => metric.friendlyLabel)).toEqual(["Simultaneous Deliveries", "No Photo on Delivery"]);
    expect(details.dsb.subMetrics.every(metric => metric.events[0].canonicalRecordId === "event-1")).toBe(true);
  });

  it.each([
    [[], [], 0, 0],
    [[{ ...base, daWasUnprofessional: "1" }], [], 1, 0],
    [[], [{ ...base, incorrectScanUsageUnattended: true }], 0, 1],
    [[{ ...base, neverReceivedDelivery: "1" }], [{ ...base, incorrectScanUsageAttended: true }], 1, 1],
  ])("supports CDF-only, DSB-only, both, and neither", (cdf, dsb, cdfCount, dsbCount) => {
    const details = buildDriverWeeklyQualityDetails(cdf, dsb, "2026-W37");
    expect(details.cdf.totalMisses).toBe(cdfCount);
    expect(details.dsb.totalMisses).toBe(dsbCount);
  });

  it.each(["1", "Yes", "Y", "True", "Impacting"])("accepts impacting value %s", value => {
    const details = buildDriverWeeklyQualityDetails([{ ...base, impactsScorecard: value, daDidNotFollowInstructions: "1" }], [], "2026-W38");
    expect(details.cdf.totalMisses).toBe(1);
  });

  it("isolates reads to the selected site, historical week, transporter, and successful weekly provenance", async () => {
    vi.spyOn(AmazonReportImport, "find").mockReturnValue({ lean: async () => [
      { _id: "cdf-import", reportType: "cdf-negative" },
      { _id: "dsb-import", reportType: "daily-dsb-concessions" },
    ] } as any);
    const cdfFind = vi.spyOn(ScoreCardCDFNegative, "find").mockReturnValue({ lean: async () => [{ ...base, daMishandledPackage: "1" }] } as any);
    const dsbFind = vi.spyOn(ScoreCardDSBConcession, "find").mockReturnValue({ lean: async () => [{ ...base, noPodOnDelivery: true }] } as any);
    const details = await loadDriverWeeklyQualityDetails("site-a", "2026-W37", " t1 ");
    expect(AmazonReportImport.find).toHaveBeenCalledWith(expect.objectContaining({ siteId: "site-a", week: "2026-W37", periodType: "Weekly", status: "success" }), expect.anything());
    expect(cdfFind).toHaveBeenCalledWith({ siteId: "site-a", week: "2026-W37", transporterId: "T1", sourceImportIds: { $in: ["cdf-import"] } });
    expect(dsbFind).toHaveBeenCalledWith({ siteId: "site-a", transporterId: "T1", sourceImportIds: { $in: ["dsb-import"] } });
    expect(details.cdf.totalMisses).toBe(1);
    expect(details.dsb.totalMisses).toBe(1);
  });

});
