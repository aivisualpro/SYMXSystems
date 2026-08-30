/**
 * Station ↔ Quo number resolution.
 *
 * Written after a live bug: the compose panel showed "DFO2" in the station
 * switcher while "Send From" was set to DXC8's number. Messages would have
 * gone out from the wrong station with nothing on screen to contradict it.
 *
 * The cause was that the picker was populated from the ENTITLEMENT set
 * (every station the user may reach) rather than the ACTIVE set (the
 * station on screen). Both sets are legitimate — they answer different
 * questions — so the distinction is worth pinning down in tests rather
 * than left to whichever one a call site happens to reach for.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, clearTestDb, disconnectTestDb, ensureIndexes } from "../helpers/db";
import { seedMultiSiteOrg, type MultiSiteFixture } from "../helpers/fixtures";
import {
  getSendableNumbers,
  resolveSendingNumber,
  resolveStationByNumber,
} from "@/lib/messaging/station-numbers";
import Site from "@/lib/models/Site";
import Organization from "@/lib/models/Organization";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";

let fx: MultiSiteFixture;

beforeAll(async () => {
  await connectTestDb();
  await ensureIndexes(Site, Organization, UserSiteAssignment);
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await clearTestDb();
  await ensureIndexes(Site, Organization, UserSiteAssignment);
  fx = await seedMultiSiteOrg();

  // Site A has a number; site B has one too; site C deliberately has none,
  // standing in for the real situation where a station exists but nobody
  // has filled in its number yet.
  await Site.updateOne(
    { _id: fx.sites.a._id },
    { $set: { messaging: { quoPhoneNumberId: "PN_A", quoPhoneNumber: "+15550000001" } } }
  );
  await Site.updateOne(
    { _id: fx.sites.b._id },
    { $set: { messaging: { quoPhoneNumberId: "PN_B", quoPhoneNumber: "+15550000002" } } }
  );
});

/** Minimal scope stub — these helpers only read the id lists. */
const scopeOf = (allowed: any[], active: any[]) => ({
  allowedSiteIds: allowed.map((s) => String(s._id)),
  activeSiteIds: active.map((s) => String(s._id)),
  defaultSiteId: String(allowed[0]?._id || ""),
  isEmpty: allowed.length === 0,
  isOrgAdmin: false,
}) as any;

describe("getSendableNumbers", () => {
  it("activeOnly returns just the station in view, not everything allowed", async () => {
    const scope = scopeOf([fx.sites.a, fx.sites.b], [fx.sites.a]);
    const nums = await getSendableNumbers(scope, { activeOnly: true });
    expect(nums.map((n) => n.phoneNumberId)).toEqual(["PN_A"]);
  });

  it("without activeOnly returns the full entitlement set", async () => {
    const scope = scopeOf([fx.sites.a, fx.sites.b], [fx.sites.a]);
    const nums = await getSendableNumbers(scope);
    expect(nums.map((n) => n.phoneNumberId).sort()).toEqual(["PN_A", "PN_B"]);
  });

  it("returns nothing — NOT another station's number — when the active station has none", async () => {
    // This is the exact shape of the bug. Site C has no number configured;
    // the correct answer is an empty list, so the UI can say which station
    // needs configuring. Falling back to site A's number here would put
    // the wrong sender on the message.
    const scope = scopeOf([fx.sites.a, fx.sites.c], [fx.sites.c]);
    const nums = await getSendableNumbers(scope, { activeOnly: true });
    expect(nums).toEqual([]);
  });

  it("never offers a number from a station the user cannot reach", async () => {
    const scope = scopeOf([fx.sites.a], [fx.sites.a]);
    const nums = await getSendableNumbers(scope);
    expect(nums.map((n) => n.phoneNumberId)).not.toContain("PN_B");
  });

  it("is empty for an empty scope rather than falling open", async () => {
    expect(await getSendableNumbers(scopeOf([], []))).toEqual([]);
  });
});

describe("resolveSendingNumber", () => {
  it("accepts a number the caller is entitled to", async () => {
    const scope = scopeOf([fx.sites.a, fx.sites.b], [fx.sites.a]);
    const n = await resolveSendingNumber(scope, "PN_B");
    expect(n?.phoneNumberId).toBe("PN_B");
  });

  it("refuses a number belonging to a station outside the scope", async () => {
    const scope = scopeOf([fx.sites.a], [fx.sites.a]);
    expect(await resolveSendingNumber(scope, "PN_B")).toBeNull();
  });

  it("picks the single active station's number when none is specified", async () => {
    const scope = scopeOf([fx.sites.a, fx.sites.b], [fx.sites.a]);
    const n = await resolveSendingNumber(scope, null);
    expect(n?.phoneNumberId).toBe("PN_A");
  });

  it("refuses to guess when several stations are in view", async () => {
    // Two stations on screen and no explicit choice: any pick would
    // attribute the message to a station the sender did not select.
    const scope = scopeOf([fx.sites.a, fx.sites.b], [fx.sites.a, fx.sites.b]);
    expect(await resolveSendingNumber(scope, null)).toBeNull();
  });
});

describe("resolveStationByNumber", () => {
  it("matches on the provider id", async () => {
    expect((await resolveStationByNumber("PN_A"))?.siteId).toBe(String(fx.sites.a._id));
  });

  it("matches on the E.164 number", async () => {
    expect((await resolveStationByNumber("+15550000002"))?.siteId).toBe(String(fx.sites.b._id));
  });

  it("returns null for an unknown number instead of defaulting", async () => {
    // An inbound reply filed under the wrong station is worse than one
    // flagged as unattributed, because nothing later reveals the error.
    expect(await resolveStationByNumber("+15559999999")).toBeNull();
    expect(await resolveStationByNumber(null)).toBeNull();
  });
});
