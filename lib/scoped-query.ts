import { getSession } from "@/lib/auth";
import { resolveUserSiteAccess, type UserSiteAccess } from "@/lib/sites";
import { resolveActiveContext, type SiteContext } from "@/lib/site-context";

// ── Request-level site scoping ────────────────────────────────────────
// The single place API routes obtain "which stations may this request
// read or write". Every site-owned query goes through here.
//
// Two separate ideas, deliberately kept apart:
//
//   allowedSiteIds — what the user MAY reach. From the database, every
//                    request. The security boundary.
//   activeSiteIds  — what they are CURRENTLY looking at. From the site
//                    context cookie, intersected with the above. A view
//                    preference, never a permission.
//
// Reads use activeSiteIds (respect the switcher). Ownership checks use
// allowedSiteIds (a record they may see but haven't selected is still
// theirs — a stale deep link shouldn't 404).

export interface RequestScope {
  userId: string;
  isOrgAdmin: boolean;
  isReadOnly: boolean;
  allowedSiteIds: string[];
  activeSiteIds: string[];
  mode: SiteContext["mode"];
  /** True when the user has no station at all — sees nothing, not everything. */
  isEmpty: boolean;
}

export async function getRequestScope(): Promise<RequestScope> {
  const session = await getSession();
  const access: UserSiteAccess = await resolveUserSiteAccess(session);
  const context = await resolveActiveContext(access);

  // Belt and braces: the context resolver already intersects, but scoping
  // is the one place worth being redundant. A bug here leaks HR records.
  const activeSiteIds = context.siteIds.filter((id) => access.allowedSiteIds.includes(id));

  return {
    userId: access.userId,
    isOrgAdmin: access.isOrgAdmin,
    isReadOnly: access.isReadOnly,
    allowedSiteIds: access.allowedSiteIds,
    activeSiteIds,
    mode: context.mode,
    isEmpty: access.allowedSiteIds.length === 0,
  };
}

/**
 * Mongo filter restricting a query to the stations currently in view.
 *
 * `includeUnassigned` exists only for the migration window: records
 * created before their model gained a siteId have none, and would vanish
 * from the UI mid-migration. It is scoped to the DEFAULT station's users
 * by the caller and must be removed once the backfill is complete and
 * siteId is required — see MULTI_SITE_ARCHITECTURE.md Phase 5.
 */
export function siteFilter(
  scope: RequestScope,
  opts: { includeUnassigned?: boolean } = {}
): Record<string, any> {
  // No station: match nothing. Critically NOT an empty filter — returning
  // {} here would silently expose every record in the system, which is the
  // exact failure this whole design exists to prevent.
  if (scope.activeSiteIds.length === 0) {
    return { _id: { $in: [] } };
  }

  const inScope = { siteId: { $in: scope.activeSiteIds } };
  if (!opts.includeUnassigned) return inScope;

  return {
    $or: [
      inScope,
      { siteId: { $exists: false } },
      { siteId: null },
    ],
  };
}

/**
 * May this scope see a specific record?
 *
 * Checks allowedSiteIds, not activeSiteIds — someone following a link to a
 * record at a station they have access to but haven't selected should see
 * it, not a 404.
 *
 * During the migration a record with no siteId is treated as visible;
 * tighten this with the Phase 5 contract step.
 */
export function canAccessRecord(
  scope: RequestScope,
  record: { siteId?: any } | null | undefined
): boolean {
  if (!record) return false;
  if (scope.isEmpty) return false;
  const siteId = record.siteId ? String(record.siteId) : null;
  if (!siteId) return true; // pre-migration record
  return scope.allowedSiteIds.includes(siteId);
}

/**
 * The station a newly created record belongs to.
 *
 * Taken from the scope, NEVER from the request body — a client-supplied
 * siteId would let anyone plant records at another station.
 *
 * Returns null when the target is ambiguous (viewing several stations at
 * once); callers must then require an explicit choice rather than guessing.
 */
export function resolveWriteSiteId(scope: RequestScope, requestedSiteId?: string | null): string | null {
  if (requestedSiteId) {
    // A caller may pass a station the USER picked in a form — still has to
    // be one they can actually reach.
    return scope.allowedSiteIds.includes(String(requestedSiteId)) ? String(requestedSiteId) : null;
  }
  if (scope.activeSiteIds.length === 1) return scope.activeSiteIds[0];
  return null; // ambiguous — caller must prompt
}
