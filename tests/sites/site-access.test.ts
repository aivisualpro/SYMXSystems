/**
 * Site access resolution — the foundation every later isolation guarantee
 * rests on. If resolveUserSiteAccess() is wrong, every downstream scope
 * check inherits the bug.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, clearTestDb, disconnectTestDb, ensureIndexes } from "../helpers/db";
import { seedMultiSiteOrg, type MultiSiteFixture } from "../helpers/fixtures";
import { resolveUserSiteAccess, canAccessSite, getActiveSites, getDefaultSite } from "@/lib/sites";
import Site from "@/lib/models/Site";
import Organization from "@/lib/models/Organization";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";

let fx: MultiSiteFixture;

beforeAll(async () => {
  await connectTestDb();
  await ensureIndexes(Site, Organization, UserSiteAssignment);
});
afterAll(async () => { await disconnectTestDb(); });
beforeEach(async () => {
  await clearTestDb();
  await ensureIndexes(Site, Organization, UserSiteAssignment);
  fx = await seedMultiSiteOrg();
});

const sessionFor = (u: { _id: any; roleName: string }) => ({ id: String(u._id), role: u.roleName });

describe("resolveUserSiteAccess", () => {
  it("gives a single-site user exactly one site", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteAOnly));
    expect(access.allowedSiteIds).toEqual([String(fx.sites.a._id)]);
    expect(access.isOrgAdmin).toBe(false);
    expect(access.primarySiteId).toBe(String(fx.sites.a._id));
  });

  it("does NOT leak site B or C to a site-A user", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteAOnly));
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.b._id));
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.c._id));
  });

  it("isolation is bidirectional — a site-B user cannot reach A", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteBOnly));
    expect(access.allowedSiteIds).toEqual([String(fx.sites.b._id)]);
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.a._id));
  });

  it("gives a multi-site user exactly their assigned sites and no more", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteAandB));
    expect(access.allowedSiteIds).toHaveLength(2);
    expect(access.allowedSiteIds).toContain(String(fx.sites.a._id));
    expect(access.allowedSiteIds).toContain(String(fx.sites.b._id));
    // The third site is the point of the three-site fixture: partial
    // multi-site access must not collapse into "sees everything".
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.c._id));
  });

  it("expands an org-wide grant to every active site", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.orgAdmin));
    expect(access.isOrgAdmin).toBe(true);
    expect(access.isReadOnly).toBe(false);
    expect(access.allowedSiteIds).toHaveLength(3);
  });

  it("marks a read-only auditor grant as org-wide but read-only", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.auditor));
    expect(access.isOrgAdmin).toBe(true);
    expect(access.isReadOnly).toBe(true);
    expect(access.allowedSiteIds).toHaveLength(3);
  });

  it("falls back to the default station for a never-assigned user", async () => {
    // A user nobody got round to assigning shouldn't be locked out. They
    // get the default station (DFO2) — one station, not everything.
    const access = await resolveUserSiteAccess(sessionFor(fx.users.unassigned));
    expect(access.allowedSiteIds).toEqual([String(fx.sites.a._id)]);
    expect(access.primarySiteId).toBe(String(fx.sites.a._id));
    expect(access.usingDefaultFallback).toBe(true);
    expect(access.isOrgAdmin).toBe(false);
  });

  it("the fallback grants ONE station, never all of them", async () => {
    // The whole point: a missing assignment must not become company-wide
    // access by accident.
    const access = await resolveUserSiteAccess(sessionFor(fx.users.unassigned));
    expect(access.allowedSiteIds).toHaveLength(1);
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.b._id));
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.c._id));
  });

  it("does NOT fall back for a user whose access was revoked", async () => {
    // The security-critical half of the fallback rule. This user HAD an
    // assignment that was deliberately end-dated. Falling back to the
    // default station would silently reinstate access an administrator
    // intentionally removed.
    await UserSiteAssignment.updateMany(
      { userId: fx.users.siteBOnly._id },
      { $set: { endDate: new Date(Date.now() - 86400000) } }
    );
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteBOnly));
    expect(access.allowedSiteIds).toEqual([]);
    expect(access.usingDefaultFallback).toBe(false);
    expect(access.primarySiteId).toBeNull();
  });

  it("distinguishes 'never assigned' from 'revoked' by assignment history", async () => {
    // Same end state (no active assignment), opposite outcomes — driven
    // purely by whether any assignment row has ever existed.
    const neverAssigned = await resolveUserSiteAccess(sessionFor(fx.users.unassigned));

    await UserSiteAssignment.updateMany(
      { userId: fx.users.siteAOnly._id },
      { $set: { endDate: new Date(Date.now() - 86400000) } }
    );
    const revoked = await resolveUserSiteAccess(sessionFor(fx.users.siteAOnly));

    expect(neverAssigned.allowedSiteIds).toHaveLength(1);
    expect(revoked.allowedSiteIds).toHaveLength(0);
  });

  it("marks a real assignment as NOT using the fallback", async () => {
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteAOnly));
    expect(access.usingDefaultFallback).toBe(false);
  });

  it("denies an absent session", async () => {
    expect((await resolveUserSiteAccess(null)).allowedSiteIds).toEqual([]);
    expect((await resolveUserSiteAccess(undefined)).allowedSiteIds).toEqual([]);
    expect((await resolveUserSiteAccess({})).allowedSiteIds).toEqual([]);
  });

  it("grants the super admin every site", async () => {
    const access = await resolveUserSiteAccess({ id: "super-admin", role: "Super Admin" });
    expect(access.isOrgAdmin).toBe(true);
    expect(access.allowedSiteIds).toHaveLength(3);
  });

  it("an org grant automatically covers a site created later", async () => {
    // The reason org-wide access is a grant rather than three assignments:
    // adding a fourth site must not silently exclude executives.
    await Site.create({
      organizationId: fx.org._id, name: "Site D", slug: "site-d",
      code: "SD", status: "active", isDefault: false,
    });
    const access = await resolveUserSiteAccess(sessionFor(fx.users.orgAdmin));
    expect(access.allowedSiteIds).toHaveLength(4);

    // …while an individually-assigned user is unaffected.
    const single = await resolveUserSiteAccess(sessionFor(fx.users.siteAOnly));
    expect(single.allowedSiteIds).toHaveLength(1);
  });

  it("ignores end-dated assignments (revoked access)", async () => {
    await UserSiteAssignment.updateMany(
      { userId: fx.users.siteAOnly._id },
      { $set: { endDate: new Date(Date.now() - 86400000) } }
    );
    const access = await resolveUserSiteAccess(sessionFor(fx.users.siteAOnly));
    expect(access.allowedSiteIds).toEqual([]);
  });

  it("excludes inactive sites from an org-wide grant", async () => {
    await Site.updateOne({ _id: fx.sites.c._id }, { $set: { status: "inactive" } });
    const access = await resolveUserSiteAccess(sessionFor(fx.users.orgAdmin));
    expect(access.allowedSiteIds).toHaveLength(2);
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.c._id));
  });
});

describe("canAccessSite", () => {
  it("allows the user's own site and refuses the others", async () => {
    const s = sessionFor(fx.users.siteAOnly);
    expect(await canAccessSite(s, String(fx.sites.a._id))).toBe(true);
    expect(await canAccessSite(s, String(fx.sites.b._id))).toBe(false);
    expect(await canAccessSite(s, String(fx.sites.c._id))).toBe(false);
  });

  it("refuses a site id that does not exist", async () => {
    const s = sessionFor(fx.users.siteAOnly);
    expect(await canAccessSite(s, "507f1f77bcf86cd799439011")).toBe(false);
  });
});

describe("site lookups", () => {
  it("returns only active sites, default first", async () => {
    const sites = await getActiveSites();
    expect(sites).toHaveLength(3);
    expect((sites[0] as any).isDefault).toBe(true);
  });

  it("resolves the default site", async () => {
    const def = await getDefaultSite();
    expect(String((def as any)._id)).toBe(String(fx.sites.a._id));
  });
});

describe("seasonal sites", () => {
  // DFO3 is a real seasonal (peak-season) station. Closing it must not
  // destroy anything — records keep their ownership and stay queryable —
  // and reopening it must restore access without re-granting anything.
  it("closing a seasonal site removes it from org-wide access", async () => {
    await Site.updateOne({ _id: fx.sites.c._id }, { $set: { status: "inactive" } });
    const access = await resolveUserSiteAccess(sessionFor(fx.users.orgAdmin));
    expect(access.allowedSiteIds).not.toContain(String(fx.sites.c._id));
    expect(access.allowedSiteIds).toHaveLength(2);
  });

  it("reopening a seasonal site restores access with no re-granting", async () => {
    await Site.updateOne({ _id: fx.sites.c._id }, { $set: { status: "inactive" } });
    await Site.updateOne({ _id: fx.sites.c._id }, { $set: { status: "active" } });
    const access = await resolveUserSiteAccess(sessionFor(fx.users.orgAdmin));
    expect(access.allowedSiteIds).toContain(String(fx.sites.c._id));
    expect(access.allowedSiteIds).toHaveLength(3);
  });

  it("a closed site is deactivated, never deleted — history stays intact", async () => {
    await Site.updateOne({ _id: fx.sites.c._id }, { $set: { status: "inactive" } });
    const stillThere = await Site.findById(fx.sites.c._id).lean();
    expect(stillThere).toBeTruthy();
    expect((stillThere as any).status).toBe("inactive");
    expect((stillThere as any).siteType).toBe("seasonal");
  });

  it("records the site's nature separately from whether it is open", async () => {
    const seasonal = await Site.findById(fx.sites.c._id).lean();
    const permanent = await Site.findById(fx.sites.a._id).lean();
    expect((seasonal as any).siteType).toBe("seasonal");
    expect((permanent as any).siteType).toBe("permanent");
    // Both are open right now — siteType and status are independent axes.
    expect((seasonal as any).status).toBe("active");
    expect((permanent as any).status).toBe("active");
  });

  it("a user assigned only to a closed seasonal site keeps the assignment on record", async () => {
    // Someone who worked peak season at DFO3: the site closes, but their
    // assignment history must survive for audit purposes.
    await UserSiteAssignment.create({
      userId: fx.users.unassigned._id, siteId: fx.sites.c._id,
      roleName: "Dispatcher", isPrimary: true, startDate: new Date(), endDate: null,
    });
    await Site.updateOne({ _id: fx.sites.c._id }, { $set: { status: "inactive" } });

    const stillOnRecord = await UserSiteAssignment.findOne({
      userId: fx.users.unassigned._id, siteId: fx.sites.c._id,
    }).lean();
    expect(stillOnRecord).toBeTruthy();
  });
});

describe("data model constraints", () => {
  it("prevents duplicate active assignments to the same site", async () => {
    await expect(
      UserSiteAssignment.create({
        userId: fx.users.siteAOnly._id, siteId: fx.sites.a._id,
        roleName: "Dispatcher", startDate: new Date(), endDate: null,
      })
    ).rejects.toThrow();
  });

  it("allows re-assignment to a site the user previously left", async () => {
    await UserSiteAssignment.updateMany(
      { userId: fx.users.siteAOnly._id, siteId: fx.sites.a._id },
      { $set: { endDate: new Date(Date.now() - 86400000) } }
    );
    // The partial unique index only covers open assignments, so a
    // returning employee is not blocked by their own history.
    await expect(
      UserSiteAssignment.create({
        userId: fx.users.siteAOnly._id, siteId: fx.sites.a._id,
        roleName: "Dispatcher", startDate: new Date(), endDate: null,
      })
    ).resolves.toBeTruthy();
  });

  it("enforces unique site slug within an organization", async () => {
    // Derive the slug from the fixture rather than hard-coding it — an
    // earlier version of this test hard-coded "site-a", which silently
    // stopped being a duplicate when the fixtures moved to real station
    // codes, so the test passed by creating a site that collided with
    // nothing.
    await expect(
      Site.create({
        organizationId: fx.org._id, name: "Duplicate", slug: fx.sites.a.slug,
        code: "DUP", status: "active",
      })
    ).rejects.toThrow();
  });

  it("allows the same slug under a different organization", async () => {
    // Slug uniqueness is scoped to the org, not global — the org boundary is
    // the real namespace even though there is only one org today.
    const otherOrg = await Organization.create({
      name: "Other Org", slug: "other-org", timezone: "America/Los_Angeles",
    });
    await expect(
      Site.create({
        organizationId: otherOrg._id, name: "DFO2 elsewhere", slug: fx.sites.a.slug,
        code: "DFO2", status: "active",
      })
    ).resolves.toBeTruthy();
  });
});
