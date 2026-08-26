import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { siteOwned } from "@/lib/models/plugins/site-owned";
import {
  hasSiteScope,
  getGuardViolations,
  clearGuardViolations,
  setModuleGuardMode,
} from "@/lib/models/plugins/site-guard";
import { connectTestDb, disconnectTestDb } from "../helpers/db";

// A throwaway model so the guard is exercised end-to-end through real
// mongoose middleware rather than by calling the hook directly. Testing the
// hook in isolation would prove the function works while leaving the actual
// question — does mongoose invoke it for this operation? — unanswered.
const GuardedSchema = new mongoose.Schema({ name: String, employeeId: String });
GuardedSchema.plugin(siteOwned, { modelName: "GuardTestModel" });
const Guarded =
  (mongoose.models.GuardTestModel as mongoose.Model<any>) ||
  mongoose.model("GuardTestModel", GuardedSchema);

const SITE_A = new mongoose.Types.ObjectId();

beforeEach(async () => {
  await connectTestDb();
  clearGuardViolations();
  setModuleGuardMode("GuardTestModel", "log");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  setModuleGuardMode("GuardTestModel", "log");
  await disconnectTestDb();
});

describe("hasSiteScope", () => {
  it("accepts a direct siteId filter", () => {
    expect(hasSiteScope({ siteId: SITE_A })).toBe(true);
    expect(hasSiteScope({ siteId: { $in: [SITE_A] } })).toBe(true);
  });

  it("accepts the migration-window $or shape from siteFilter()", () => {
    expect(
      hasSiteScope({
        $or: [{ siteId: { $in: [SITE_A] } }, { siteId: { $exists: false } }, { siteId: null }],
      })
    ).toBe(true);
  });

  it("accepts the deliberate match-nothing filter", () => {
    // siteFilter() returns this for a user with no station. It is the most
    // restrictive filter there is, so treating it as unscoped would flag
    // exactly the code that is behaving correctly.
    expect(hasSiteScope({ _id: { $in: [] } })).toBe(true);
  });

  it("rejects an $or where only SOME branches are scoped", () => {
    // This is the subtle one. A single unscoped branch widens the whole
    // query back out to every station, so "contains a siteId somewhere"
    // is the wrong test — every branch has to be scoped.
    expect(
      hasSiteScope({ $or: [{ siteId: SITE_A }, { status: "open" }] })
    ).toBe(false);
  });

  it("accepts $and when any single branch is scoped", () => {
    // $and is conjunctive — one scoped branch restricts the whole query.
    // Requiring all of them would make the guard throw on correct code
    // once enforce mode is on.
    expect(hasSiteScope({ $and: [{ siteId: SITE_A }, { status: "open" }] })).toBe(true);
  });

  it("does NOT treat $nor as scoping", () => {
    // A siteId inside $nor excludes that station rather than restricting
    // to it — "everything except DFO2" is the opposite of scoped, and is
    // exactly the query that must not be waved through.
    expect(hasSiteScope({ $nor: [{ siteId: SITE_A }] })).toBe(false);
  });

  it("rejects an empty filter", () => {
    expect(hasSiteScope({})).toBe(false);
    expect(hasSiteScope(null)).toBe(false);
  });
});

describe("site guard — detection through real mongoose middleware", () => {
  it("stays silent when the query is scoped", async () => {
    await Guarded.find({ siteId: SITE_A });
    expect(getGuardViolations()).toHaveLength(0);
  });

  it("flags an unscoped find as broad", async () => {
    await Guarded.find({ name: "anything" });
    const v = getGuardViolations();
    expect(v).toHaveLength(1);
    expect(v[0].kind).toBe("broad");
    expect(v[0].model).toBe("GuardTestModel");
    expect(v[0].operation).toBe("find");
  });

  it("classifies an _id-only lookup as byId, not broad", async () => {
    await Guarded.findById(new mongoose.Types.ObjectId());
    const v = getGuardViolations();
    expect(v).toHaveLength(1);
    expect(v[0].kind).toBe("byId");
  });

  it("catches unscoped writes and deletes, not just reads", async () => {
    // The leak that matters most isn't reading another station's data —
    // it's updating or deleting it. These paths are easy to forget because
    // they usually already filter by _id and look specific enough.
    await Guarded.updateMany({ name: "x" }, { $set: { name: "y" } });
    await Guarded.deleteMany({ name: "y" });
    const ops = getGuardViolations().map((v) => v.operation).sort();
    expect(ops).toEqual(["deleteMany", "updateMany"]);
  });

  it("catches an aggregate with no station filter", async () => {
    // Aggregations bypass query middleware entirely, so a guard that only
    // hooked find/update would pass this while the pipeline read every
    // station's rows.
    await Guarded.aggregate([{ $group: { _id: "$name", n: { $sum: 1 } } }]);
    const v = getGuardViolations();
    expect(v).toHaveLength(1);
    expect(v[0].operation).toBe("aggregate");
  });

  it("accepts an aggregate whose first $match is scoped", async () => {
    await Guarded.aggregate([
      { $match: { siteId: SITE_A } },
      { $group: { _id: "$name", n: { $sum: 1 } } },
    ]);
    expect(getGuardViolations()).toHaveLength(0);
  });

  it("counts repeat offenders instead of listing them twice", async () => {
    await Guarded.find({ name: "a" });
    await Guarded.find({ name: "b" });
    const v = getGuardViolations();
    expect(v).toHaveLength(1);
    expect(v[0].count).toBe(2);
  });
});

describe("site guard — enforce mode", () => {
  it("throws on a broad query", async () => {
    setModuleGuardMode("GuardTestModel", "enforce");
    await expect(Guarded.find({ name: "x" })).rejects.toThrow(/site-guard/);
  });

  it("still allows a scoped query", async () => {
    setModuleGuardMode("GuardTestModel", "enforce");
    await expect(Guarded.find({ siteId: SITE_A })).resolves.toEqual([]);
  });

  it("does NOT throw on an _id lookup", async () => {
    // findById-then-check-ownership is a legitimate pattern the guard can
    // only see half of. Throwing here would break correct code, so byId is
    // reported for review and never enforced.
    setModuleGuardMode("GuardTestModel", "enforce");
    await expect(Guarded.findById(new mongoose.Types.ObjectId())).resolves.toBeNull();
    expect(getGuardViolations()[0].kind).toBe("byId");
  });

  it("honours an explicit orgWide opt-out", async () => {
    setModuleGuardMode("GuardTestModel", "enforce");
    const q = Guarded.find({ employeeId: "abc" }).setOptions({
      orgWide: "discipline history follows the employee across stations",
    });
    await expect(q).resolves.toEqual([]);
    expect(getGuardViolations()).toHaveLength(0);
  });

  it("can be off for one model while enforcing on another", async () => {
    // Modules get scoped one at a time, so the guard has to be flippable
    // per model — otherwise it's all-or-nothing and stays at nothing.
    setModuleGuardMode("GuardTestModel", "off");
    await expect(Guarded.find({ name: "x" })).resolves.toEqual([]);
    expect(getGuardViolations()).toHaveLength(0);
  });
});

describe("orgWide() helper", () => {
  it("refuses a missing or throwaway reason", async () => {
    const { orgWide } = await import("@/lib/scoped-query");
    expect(() => orgWide(Guarded.find({}), "")).toThrow(/reason/i);
    expect(() => orgWide(Guarded.find({}), "why")).toThrow(/reason/i);
  });

  it("exempts the query when given a real reason", async () => {
    const { orgWide } = await import("@/lib/scoped-query");
    setModuleGuardMode("GuardTestModel", "enforce");
    await expect(
      orgWide(Guarded.find({ employeeId: "abc" }), "global transporterId uniqueness check")
    ).resolves.toEqual([]);
  });
});
