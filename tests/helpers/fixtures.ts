/**
 * Shared test fixtures for multi-site scenarios.
 *
 * seedMultiSiteOrg() builds the canonical arrangement every isolation test
 * asserts against: one organization, THREE sites, and users with varying
 * access — single-site, multi-site, org-wide, and read-only auditor.
 *
 * Three sites (not two) is deliberate. A two-site fixture can pass a leak
 * test by accident — "returned Site A data" and "returned everything except
 * B" look identical when there is no C. A third site catches scoping bugs
 * that treat "not mine" as a single bucket.
 *
 * Mirrors the real roster (DFO2 default / DXC8 permanent / DFO3 seasonal)
 * so tests exercise the same shape as production — in particular a seasonal
 * site that can be closed mid-life. The site codes appear ONLY in fixtures
 * and the seed script; no application code branches on them.
 */
import mongoose from "mongoose";
import Organization from "@/lib/models/Organization";
import Site from "@/lib/models/Site";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";
import OrgRoleGrant from "@/lib/models/OrgRoleGrant";
import SymxUser from "@/lib/models/SymxUser";
import SymxAppRole from "@/lib/models/SymxAppRole";

export interface SeededSite {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  /** Amazon station code (DFO2, DXC8, DFO3). Exposed because assertions
   *  about which station a lookup resolved to read far better against a
   *  code than an ObjectId. */
  code: string;
}

export interface SeededUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  roleName: string;
}

export interface MultiSiteFixture {
  org: { _id: mongoose.Types.ObjectId; name: string };
  sites: { a: SeededSite; b: SeededSite; c: SeededSite };
  roles: { dispatcher: mongoose.Types.ObjectId; manager: mongoose.Types.ObjectId; auditor: mongoose.Types.ObjectId };
  users: {
    /** Assigned to site A only — the primary subject of leak tests. */
    siteAOnly: SeededUser;
    /** Assigned to site B only — proves isolation is bidirectional. */
    siteBOnly: SeededUser;
    /** Assigned to A and B, but NOT C — proves partial multi-site scoping. */
    siteAandB: SeededUser;
    /** Org-wide grant — should see all three. */
    orgAdmin: SeededUser;
    /** Read-only org-wide — sees all three, writes nothing. */
    auditor: SeededUser;
    /** No assignments at all — must be denied everywhere. */
    unassigned: SeededUser;
  };
}

const FULL_ACTIONS = {
  view: true, create: true, edit: true, delete: true,
  approve: true, download: true, pay: false,
};

const READ_ONLY_ACTIONS = {
  view: true, create: false, edit: false, delete: false,
  approve: false, download: true, pay: false,
};

const MODULES = ["Dispatching", "Fleet", "Write-Ups", "HR", "Scheduling", "Incidents"];

async function makeRole(name: string, actions: Record<string, boolean>) {
  const role = await SymxAppRole.create({
    name,
    permissions: MODULES.map((m) => ({ module: m, actions })),
  });
  return role._id as mongoose.Types.ObjectId;
}

async function makeUser(name: string, email: string, roleName: string) {
  const user = await SymxUser.create({
    name,
    email,
    // Tests never exercise the password path; login is covered separately.
    password: "$2b$10$testtesttesttesttesttesttesttesttesttesttesttesttestte",
    AppRole: roleName,
    isActive: true,
  });
  return { _id: user._id as mongoose.Types.ObjectId, email, roleName };
}

async function assign(
  userId: mongoose.Types.ObjectId,
  siteId: mongoose.Types.ObjectId,
  roleId: mongoose.Types.ObjectId,
  roleName: string,
  isPrimary = false
) {
  await UserSiteAssignment.create({
    userId, siteId, roleId, roleName, isPrimary,
    startDate: new Date(), endDate: null, grantedBy: "test-fixture",
  });
}

export async function seedMultiSiteOrg(): Promise<MultiSiteFixture> {
  const org = await Organization.create({
    name: "SYMX Test Org",
    slug: "symx-test",
    timezone: "America/Los_Angeles",
  });
  const orgId = org._id as mongoose.Types.ObjectId;

  const [siteA, siteB, siteC] = await Promise.all([
    // a = DFO2: the default/backfill target, mirrors today's single site
    Site.create({ organizationId: orgId, name: "DFO2", slug: "dfo2", code: "DFO2", siteType: "permanent", status: "active", isDefault: true }),
    // b = DXC8: second permanent station
    Site.create({ organizationId: orgId, name: "DXC8", slug: "dxc8", code: "DXC8", siteType: "permanent", status: "active", isDefault: false }),
    // c = DFO3: seasonal — the site tests close and reopen
    Site.create({ organizationId: orgId, name: "DFO3", slug: "dfo3", code: "DFO3", siteType: "seasonal", status: "active", isDefault: false }),
  ]);

  const dispatcherRole = await makeRole("Dispatcher", FULL_ACTIONS);
  const managerRole = await makeRole("Manager", FULL_ACTIONS);
  const auditorRole = await makeRole("Auditor", READ_ONLY_ACTIONS);

  const siteAOnly = await makeUser("Site A User", "a-only@test.local", "Dispatcher");
  const siteBOnly = await makeUser("Site B User", "b-only@test.local", "Dispatcher");
  const siteAandB = await makeUser("Regional Manager", "a-and-b@test.local", "Manager");
  const orgAdmin = await makeUser("Org Admin", "org-admin@test.local", "Manager");
  const auditor = await makeUser("Auditor", "auditor@test.local", "Auditor");
  const unassigned = await makeUser("Unassigned User", "unassigned@test.local", "Dispatcher");

  const aId = siteA._id as mongoose.Types.ObjectId;
  const bId = siteB._id as mongoose.Types.ObjectId;

  await assign(siteAOnly._id, aId, dispatcherRole, "Dispatcher", true);
  await assign(siteBOnly._id, bId, dispatcherRole, "Dispatcher", true);
  await assign(siteAandB._id, aId, managerRole, "Manager", true);
  await assign(siteAandB._id, bId, managerRole, "Manager", false);

  // Org-wide users get a grant, NOT one assignment per site — so they
  // automatically cover any site added later.
  await OrgRoleGrant.create({
    userId: orgAdmin._id, organizationId: orgId, roleId: managerRole,
    roleName: "Manager", scope: "all_sites",
    grantedBy: "test-fixture", reason: "Executive oversight",
  });
  await OrgRoleGrant.create({
    userId: auditor._id, organizationId: orgId, roleId: auditorRole,
    roleName: "Auditor", scope: "read_only_all_sites",
    grantedBy: "test-fixture", reason: "Compliance audit",
  });

  return {
    org: { _id: orgId, name: org.name },
    sites: {
      a: { _id: aId, name: siteA.name, slug: siteA.slug, code: siteA.code },
      b: { _id: bId, name: siteB.name, slug: siteB.slug, code: siteB.code },
      c: { _id: siteC._id as mongoose.Types.ObjectId, name: siteC.name, slug: siteC.slug, code: siteC.code },
    },
    roles: { dispatcher: dispatcherRole, manager: managerRole, auditor: auditorRole },
    users: { siteAOnly, siteBOnly, siteAandB, orgAdmin, auditor, unassigned },
  };
}
