import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveUserSiteAccess, getActiveSites } from "@/lib/sites";
import { SITE_CONTEXT_COOKIE, parseSiteContextCookie, serializeSiteContext, resolveActiveContext } from "@/lib/site-context";

// GET /api/user/sites
// Which sites may the current user reach, and which are currently selected.
//
// The authoritative list comes from the DATABASE on every request — never
// from the JWT and never from the cookie. The cookie only expresses a
// *preference*; it is intersected with real access here, so tampering with
// it can never widen what someone sees.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await resolveUserSiteAccess(session);
  const allSites = await getActiveSites();

  const visibleSites = allSites
    .filter((s: any) => access.allowedSiteIds.includes(String(s._id)))
    .map((s: any) => ({
      id: String(s._id),
      name: s.name,
      code: s.code,
      slug: s.slug,
      siteType: s.siteType,
      isDefault: !!s.isDefault,
      role: access.roleBySite[String(s._id)] || "",
    }));

  const context = await resolveActiveContext(access);

  return NextResponse.json({
    sites: visibleSites,
    isOrgAdmin: access.isOrgAdmin,
    isReadOnly: access.isReadOnly,
    canSwitch: visibleSites.length > 1,
    // Org-wide ("all stations") is only offered to someone holding an
    // explicit org grant. Consolidated views must be intentional, not a
    // side effect of happening to be assigned to every site.
    canViewOrgWide: access.isOrgAdmin,
    context,
  });
}

// PUT /api/user/sites — change the active site context.
//
// Validates the requested selection against real access before persisting.
// A user asking for a site they cannot reach gets 403; the cookie is never
// written with anything they aren't entitled to.
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestedMode = body?.mode;
  const requestedSiteIds: string[] = Array.isArray(body?.siteIds) ? body.siteIds.map(String) : [];

  if (!["single", "multi", "org"].includes(requestedMode)) {
    return NextResponse.json({ error: "mode must be 'single', 'multi' or 'org'" }, { status: 400 });
  }

  const access = await resolveUserSiteAccess(session);

  if (requestedMode === "org" && !access.isOrgAdmin) {
    return NextResponse.json(
      { error: "Company-wide view requires an organization-wide grant." },
      { status: 403 }
    );
  }

  if (requestedMode !== "org") {
    if (requestedSiteIds.length === 0) {
      return NextResponse.json({ error: "siteIds required" }, { status: 400 });
    }
    const notAllowed = requestedSiteIds.filter((id) => !access.allowedSiteIds.includes(id));
    if (notAllowed.length > 0) {
      return NextResponse.json({ error: "You do not have access to that site." }, { status: 403 });
    }
    if (requestedMode === "single" && requestedSiteIds.length !== 1) {
      return NextResponse.json({ error: "single mode takes exactly one site" }, { status: 400 });
    }
  }

  const siteIds = requestedMode === "org" ? access.allowedSiteIds : requestedSiteIds;
  const context = { mode: requestedMode as "single" | "multi" | "org", siteIds };

  const res = NextResponse.json({ context });
  res.cookies.set(SITE_CONTEXT_COOKIE, serializeSiteContext(context), {
    path: "/",
    sameSite: "lax",
    httpOnly: false, // read by the client provider; contains no secrets
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export { parseSiteContextCookie };
