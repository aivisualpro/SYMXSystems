import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import Organization from "@/lib/models/Organization";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";
import OrgRoleGrant from "@/lib/models/OrgRoleGrant";
import { isSuperAdmin } from "@/lib/auth/require-permission";

// ── Multi-site: site resolution helpers ───────────────────────────────
// Read-only lookups used to answer "which sites exist" and "which sites
// may this user reach". Phase 1 only — nothing here ENFORCES anything
// yet; enforcement arrives with the query guard in Phase 3.
//
// Hard rule, applies from here forward: a user's site access is ALWAYS
// resolved from the database on the current request. It is never read
// from the JWT. The session token already carries a stale role name
// (see lib/auth.ts) and that mistake must not be repeated with site
// access, where the blast radius is cross-site data exposure rather
// than a stale label.

export interface UserSiteAccess {
  userId: string;
  /** True for the env-var super admin, or anyone holding an org-wide grant. */
  isOrgAdmin: boolean;
  /** Org-wide but read-only (auditor). Implies isOrgAdmin. */
  isReadOnly: boolean;
  /** Every site this user may reach, expanded from assignments + grants. */
  allowedSiteIds: string[];
  /** Their landing site when they haven't picked one. */
  primarySiteId: string | null;
  /** Role name per site — a user may hold different roles at different sites. */
  roleBySite: Record<string, string>;
}

/** All active sites, ordered for display. Never hard-codes a site count. */
export async function getActiveSites() {
  await connectToDatabase();
  return Site.find({ status: "active" }).sort({ isDefault: -1, name: 1 }).lean();
}

export async function getAllSites() {
  await connectToDatabase();
  return Site.find({}).sort({ isDefault: -1, name: 1 }).lean();
}

/**
 * The site every pre-existing record is backfilled to, and the fallback
 * for any legacy code path that has no site context while the
 * compatibility shim is in place. Falls back to the oldest site if no
 * explicit default is flagged, so this can never return null on a
 * seeded system.
 */
export async function getDefaultSite() {
  await connectToDatabase();
  return (
    (await Site.findOne({ isDefault: true }).lean()) ||
    (await Site.findOne({ status: "active" }).sort({ createdAt: 1 }).lean())
  );
}

export async function getOrganization() {
  await connectToDatabase();
  return Organization.findOne().sort({ createdAt: 1 }).lean();
}

/**
 * Resolves everything a request needs to know about a user's site reach.
 *
 * Precedence:
 *   1. Super admin (env-var account) — every site, full access.
 *   2. Org-wide grant — every active site. Read-only if the grant says so.
 *   3. Per-site assignments — only the sites explicitly assigned.
 *   4. Nothing — no access. An unassigned user is denied, not defaulted.
 *
 * Note that org-wide access EXPANDS to the live site list rather than
 * being stored as a list of ids, so a site added tomorrow is covered
 * without re-granting anything.
 */
export async function resolveUserSiteAccess(
  session: { id?: string; role?: string } | null | undefined
): Promise<UserSiteAccess> {
  const empty: UserSiteAccess = {
    userId: session?.id || "",
    isOrgAdmin: false,
    isReadOnly: false,
    allowedSiteIds: [],
    primarySiteId: null,
    roleBySite: {},
  };
  if (!session?.id) return empty;

  await connectToDatabase();

  // 1. Super admin — the one hardcoded superuser, sees everything.
  if (isSuperAdmin(session)) {
    const sites = await getActiveSites();
    const ids = sites.map((s: any) => String(s._id));
    return {
      userId: session.id,
      isOrgAdmin: true,
      isReadOnly: false,
      allowedSiteIds: ids,
      primarySiteId: ids[0] || null,
      roleBySite: Object.fromEntries(ids.map((id) => [id, "Super Admin"])),
    };
  }

  const now = new Date();
  const activeWindow = {
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gt: now } }],
  };

  // 2. Org-wide grant.
  const grant = await OrgRoleGrant.findOne({ userId: session.id, ...activeWindow }).lean();
  if (grant) {
    const sites = await getActiveSites();
    const ids = sites.map((s: any) => String(s._id));
    const roleName = (grant as any).roleName || session.role || "";
    return {
      userId: session.id,
      isOrgAdmin: true,
      isReadOnly: (grant as any).scope === "read_only_all_sites",
      allowedSiteIds: ids,
      primarySiteId: ids[0] || null,
      roleBySite: Object.fromEntries(ids.map((id) => [id, roleName])),
    };
  }

  // 3. Per-site assignments.
  const assignments = await UserSiteAssignment.find({ userId: session.id, ...activeWindow }).lean();
  if (assignments.length === 0) return empty;

  const allowedSiteIds = assignments.map((a: any) => String(a.siteId));
  const roleBySite: Record<string, string> = {};
  for (const a of assignments as any[]) {
    roleBySite[String(a.siteId)] = a.roleName || session.role || "";
  }
  const primary = (assignments as any[]).find((a) => a.isPrimary);

  return {
    userId: session.id,
    isOrgAdmin: false,
    isReadOnly: false,
    allowedSiteIds,
    primarySiteId: primary ? String(primary.siteId) : allowedSiteIds[0] || null,
    roleBySite,
  };
}

/** Convenience guard — does this user reach this specific site? */
export async function canAccessSite(
  session: { id?: string; role?: string } | null | undefined,
  siteId: string
): Promise<boolean> {
  const access = await resolveUserSiteAccess(session);
  return access.allowedSiteIds.includes(String(siteId));
}
