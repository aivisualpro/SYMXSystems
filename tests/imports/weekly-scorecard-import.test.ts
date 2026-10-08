import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}), { virtual: true });
import mongoose from "mongoose";
import AmazonReportImport from "@/lib/models/AmazonReportImport";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { importWeeklyScorecard, normalizeWeeklyScorecard } from "@/lib/imports/weekly-scorecard";
import { processScorecard } from "@/lib/imports/scorecard";

const siteId = "507f1f77bcf86cd799439011";
const hash = "a".repeat(64);
const row = { Week: "2026-W38", "Delivery Associate": "Test Driver", "Transporter ID": " t1 ", "Overall Score": "98.5", "Delivery Completion DPMO": "725.6", "Delivery Completion DPMO Tier": "Great", "Delivery Completion DPMO Score": "92.74", "Delivery Completion DPMO Weight Applied": "0.2", POD: "99.1%", PSB: "0", "Speeding Event Rate (per trip)": "0" };

afterEach(() => vi.restoreAllMocks());

describe("Weekly Driver Scorecard import", () => {
  it("declares site-scoped uniqueness and removes the global unique identity", () => {
    const unique = SymxDeliveryExcellence.schema.indexes().filter(([, options]) => options.unique);
    expect(unique).toContainEqual([{ siteId: 1, week: 1, transporterId: 1 }, expect.objectContaining({ unique: true })]);
    expect(unique).not.toContainEqual([{ week: 1, transporterId: 1 }, expect.objectContaining({ unique: true })]);
  });

  it("normalizes current headers, preserves zero, and maps Delivery Completion separately from DCR", () => {
    const result = normalizeWeeklyScorecard([row]);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ week: "2026-W38", transporterId: "T1", overallScore: 98.5, dcDpmo: 725.6, dcDpmoTier: "Great", dcDpmoScore: 92.74, dcDpmoWeightApplied: 0.2, pod: 99.1, psb: 0, speedingEventRate: 0 });
    expect(result.rows[0]).not.toHaveProperty("dcr");
  });

  it("keeps the existing Scorecard delivery-excellence processor on the shared normalization path", async () => {
    vi.spyOn(SymxEmployee, "find").mockReturnValue({ lean: async () => [{ _id: siteId, transporterId: "T1" }] } as any);
    const write = vi.spyOn(SymxDeliveryExcellence, "bulkWrite").mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 } as any);
    const response = await processScorecard("delivery-excellence", [row], "2026-W38", siteId);
    expect(response?.status).toBe(200);
    expect((write.mock.calls[0][0][0] as any).updateOne).toMatchObject({
      filter: { siteId, week: "2026-W38", transporterId: "T1" },
      update: { $set: { dcDpmo: 725.6, overallScore: 98.5 } },
      upsert: true,
    });
  });

  it("rejects duplicate canonical rows before writes", () => {
    const result = normalizeWeeklyScorecard([row, { ...row, "Delivery Associate": "Duplicate" }]);
    expect(result.errors).toContain("Row 3: duplicate Transporter ID for 2026-W38.");
  });

  it("returns UNCHANGED for an already successful identical file without opening a transaction", async () => {
    vi.spyOn(SymxEmployee, "find").mockReturnValue({ lean: async () => [{ _id: siteId, transporterId: "T1" }] } as any);
    vi.spyOn(SymxDeliveryExcellence, "find").mockReturnValue({ lean: async () => [{ transporterId: "T1" }] } as any);
    vi.spyOn(AmazonReportImport, "findOne").mockReturnValue({ lean: async () => ({ _id: siteId }) } as any);
    const start = vi.spyOn(mongoose, "startSession");
    const result = await importWeeklyScorecard({ siteId, rows: [row], fileName: "weekly.csv", fileHash: hash, importedBy: "manager" });
    expect(result.outcome).toBe("UNCHANGED");
    expect(start).not.toHaveBeenCalled();
  });

  it("keeps ledger and scorecard writes inside the same transaction", async () => {
    vi.spyOn(SymxEmployee, "find").mockReturnValue({ lean: async () => [{ _id: siteId, transporterId: "T1" }] } as any);
    vi.spyOn(SymxDeliveryExcellence, "find").mockReturnValue({ session: () => ({ lean: async () => [] }), lean: async () => [] } as any);
    vi.spyOn(AmazonReportImport, "findOne").mockReturnValue({ lean: async () => null } as any);
    const bulk = vi.spyOn(SymxDeliveryExcellence, "bulkWrite").mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 } as any);
    const ledger = vi.spyOn(AmazonReportImport, "create").mockResolvedValue([] as any);
    const mongoSession = { withTransaction: vi.fn(async callback => callback()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(mongoSession as any);
    const result = await importWeeklyScorecard({ siteId, rows: [row], fileName: "weekly.csv", fileHash: hash, importedBy: "manager" });
    expect(result.outcome).toBe("NEW");
    expect(bulk.mock.calls[0][1]).toMatchObject({ session: mongoSession });
    expect(ledger.mock.calls[0][1]).toMatchObject({ session: mongoSession });
    expect((bulk.mock.calls[0][0][0] as any).updateOne.update.$addToSet.sourceImportIds).toEqual(expect.anything());
  });

  it("does not create a success ledger when scorecard persistence fails", async () => {
    vi.spyOn(SymxEmployee, "find").mockReturnValue({ lean: async () => [{ _id: siteId, transporterId: "T1" }] } as any);
    vi.spyOn(SymxDeliveryExcellence, "find").mockReturnValue({ session: () => ({ lean: async () => [] }), lean: async () => [] } as any);
    vi.spyOn(AmazonReportImport, "findOne").mockReturnValue({ lean: async () => null } as any);
    vi.spyOn(SymxDeliveryExcellence, "bulkWrite").mockRejectedValue(new Error("simulated persistence failure"));
    const ledger = vi.spyOn(AmazonReportImport, "create");
    const mongoSession = { withTransaction: vi.fn(async callback => callback()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(mongoSession as any);
    await expect(importWeeklyScorecard({ siteId, rows: [row], fileName: "weekly.csv", fileHash: hash, importedBy: "manager" }))
      .rejects.toThrow("simulated persistence failure");
    expect(ledger).not.toHaveBeenCalled();
    expect(mongoSession.endSession).toHaveBeenCalled();
  });
});
