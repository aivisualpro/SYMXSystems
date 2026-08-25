import { cookies } from "next/headers";
import type { UserSiteAccess } from "@/lib/sites";

// ── Active site context ───────────────────────────────────────────────
// Which site(s) the user is currently looking at. Three modes:
//
//   single — one station. What almost every user has, always.
//   multi  — a chosen subset. For someone covering two stations.
//   org    — every station, consolidated. Requires an org-wide grant.
//
// The cookie is a PREFERENCE, not a permission. It is always intersected
// with the user's real access (resolved from the database) before use, so
// editing it by hand can never widen what someone can see — at worst it
// narrows their own view or gets ignored.

export const SITE_CONTEXT_COOKIE = "symx_site_ctx";

export type SiteContextMode = "single" | "multi" | "org";

export interface SiteContext {
  mode: SiteContextMode;
  siteIds: string[];
}

export function serializeSiteContext(ctx: SiteContext): string {
  return JSON.stringify({ m: ctx.mode, s: ctx.siteIds });
}

export function parseSiteContextCookie(raw: string | undefined | null): SiteContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const mode = parsed?.m;
    const siteIds = Array.isArray(parsed?.s) ? parsed.s.map(String) : [];
    if (!["single", "multi", "org"].includes(mode)) return null;
    return { mode, siteIds };
  } catch {
    return null;
  }
}

/**
 * Resolves the context to actually use for this request.
 *
 * Order:
 *   1. The cookie preference, INTERSECTED with real access.
 *   2. If that leaves nothing valid (revoked access, closed site, tampering),
 *      fall back to the user's primary site.
 *   3. If they have no sites at all, an empty single context — which
 *      downstream scoping will treat as "sees nothing", not "sees everything".
 *
 * Step 3 is the important one. The failure mode of a scoping system must be
 * showing too little, never too much.
 */
export async function resolveActiveContext(access: UserSiteAccess): Promise<SiteContext> {
  const store = await cookies();
  const preference = parseSiteContextCookie(store.get(SITE_CONTEXT_COOKIE)?.value);

  if (preference) {
    if (preference.mode === "org") {
      // Only honour a company-wide preference if the grant still exists.
      if (access.isOrgAdmin) return { mode: "org", siteIds: access.allowedSiteIds };
    } else {
      const stillValid = preference.siteIds.filter((id) => access.allowedSiteIds.includes(id));
      if (stillValid.length > 0) {
        return {
          mode: stillValid.length === 1 ? "single" : "multi",
          siteIds: stillValid,
        };
      }
    }
  }

  if (access.primarySiteId) {
    return { mode: "single", siteIds: [access.primarySiteId] };
  }
  if (access.allowedSiteIds.length > 0) {
    return { mode: "single", siteIds: [access.allowedSiteIds[0]] };
  }
  return { mode: "single", siteIds: [] };
}

/** Human-readable label for headers, reports, and export filenames. */
export function describeContext(ctx: SiteContext, sitesById: Record<string, string>): string {
  if (ctx.mode === "org") return `All stations (${ctx.siteIds.length})`;
  const names = ctx.siteIds.map((id) => sitesById[id] || "Unknown");
  if (names.length === 0) return "No station";
  if (names.length === 1) return names[0];
  return names.join(" + ");
}
