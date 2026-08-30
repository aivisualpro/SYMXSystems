import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { siteOwned } from "@/lib/models/plugins/site-owned";
import {
  getGuardViolations,
  clearGuardViolations,
  setModuleGuardMode,
} from "@/lib/models/plugins/site-guard";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

// ── bulkWrite / insertMany coverage ───────────────────────────────────
//
// These two operations do not pass through mongoose query middleware, so
// every hook the guard registers is blind to them. That gap hid unscoped
// write paths on site-owned models while the guard AND the static audit
// both reported clean — the failure mode being that a check which cannot
// observe an operation reports zero for it forever.
//
// The guard closes it by wrapping the compiled model. Wrapping is invasive
// (it replaces a method on every site-owned model at import time), so these
// tests assert BOTH halves: that violations are seen, and that the writes
// themselves still work. A guard that silently swallowed documents would be
// far worse than the hole it was added to close.

const BulkSchema = new mongoose.Schema({ name: String, rowIndex: Number });
BulkSchema.plugin(siteOwned, { modelName: "BulkGuardTestModel" });
const Bulk =
  (mongoose.models.BulkGuardTestModel as mongoose.Model<any>) ||
  mongoose.model("BulkGuardTestModel", BulkSchema);

const SITE_A = new mongoose.Types.ObjectId();

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await disconnectTestDb(); });

beforeEach(async () => {
  await clearTestDb();
  clearGuardViolations();
  setModuleGuardMode("BulkGuardTestModel", "log");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setModuleGuardMode("BulkGuardTestModel", "log");
});

/** Violations recorded for this model, whatever shape the store uses. */
function violationsFor(model: string) {
  const all: any = getGuardViolations();
  const list = Array.isArray(all) ? all : Object.values(all ?? {}).flat();
  return (list as any[]).filter((v) => v?.model === model || v?.modelName === model);
}

describe("bulkWrite", () => {
  it("flags an upsert whose filter carries no station", async () => {
    // The exact shape that let two stations share one row: the filter is
    // the identity of the document, so "row 3 on this date" without a
    // station means the same record everywhere.
    await Bulk.bulkWrite([
      {
        updateOne: {
          filter: { rowIndex: 3 },
          update: { $set: { name: "unscoped" } },
          upsert: true,
        },
      },
    ]);

    const v = violationsFor("BulkGuardTestModel");
    expect(v.length).toBeGreaterThan(0);
    expect(JSON.stringify(v)).toContain("bulkWrite");
  });

  it("stays quiet when the filter names a station", async () => {
    await Bulk.bulkWrite([
      {
        updateOne: {
          filter: { rowIndex: 3, siteId: SITE_A },
          update: { $set: { name: "scoped" } },
          upsert: true,
        },
      },
    ]);

    expect(violationsFor("BulkGuardTestModel")).toHaveLength(0);
  });

  it("flags an insertOne whose document has no station", async () => {
    await Bulk.bulkWrite([
      { insertOne: { document: { name: "orphan", rowIndex: 9 } } },
    ]);

    expect(violationsFor("BulkGuardTestModel").length).toBeGreaterThan(0);
  });

  it("still performs the write it is guarding", async () => {
    // The whole point of wrapping rather than replacing. If the guard ate
    // the operation, every import in the app would silently do nothing.
    await Bulk.bulkWrite([
      {
        updateOne: {
          filter: { rowIndex: 1, siteId: SITE_A },
          update: { $set: { name: "written" } },
          upsert: true,
        },
      },
    ]);

    const doc = await Bulk.findOne({ rowIndex: 1 }).lean();
    expect(doc).toBeTruthy();
    expect((doc as any).name).toBe("written");
  });
});

describe("insertMany", () => {
  it("flags documents with no station", async () => {
    await Bulk.insertMany([
      { name: "a", rowIndex: 1 },
      { name: "b", rowIndex: 2 },
    ]);

    expect(violationsFor("BulkGuardTestModel").length).toBeGreaterThan(0);
  });

  it("stays quiet when every document carries one", async () => {
    await Bulk.insertMany([
      { name: "a", rowIndex: 1, siteId: SITE_A },
      { name: "b", rowIndex: 2, siteId: SITE_A },
    ]);

    expect(violationsFor("BulkGuardTestModel")).toHaveLength(0);
  });

  it("still inserts the documents", async () => {
    await Bulk.insertMany([
      { name: "a", rowIndex: 1, siteId: SITE_A },
      { name: "b", rowIndex: 2, siteId: SITE_A },
    ]);

    expect(await Bulk.countDocuments({})).toBe(2);
  });

  it("reports once per call, not once per document", async () => {
    // A 5,000-row import that logged per document would bury every other
    // message in the process.
    await Bulk.insertMany(
      Array.from({ length: 25 }, (_, i) => ({ name: `x${i}`, rowIndex: i }))
    );

    expect(violationsFor("BulkGuardTestModel")).toHaveLength(1);
  });
});
