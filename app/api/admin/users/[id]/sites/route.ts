import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import Organization from "@/lib/models/Organization";
import SymxUser from "@/lib/models/SymxUser";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";
import OrgRoleGrant from "@/lib/models/OrgRoleGrant";

// ── Per-user station access ───────────────────────────────────────────
// Who may see which stations. Super Admin only — this is the control that
// keeps one station's HR records away from another station's staff.
//
// Assignments are effective-dated rather than deleted: revoking access
// end-dates the row so "who could see what, when" stays answerable.

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isSuperAdmin(session)) {
    return { ok: false as const, res: NextResponse.json({ error: "Super Admin only" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  await connectToDatabase();

  const user = await SymxUser.findById(id).select("name email AppRole").lean();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [sites, assignments, grant] = await Promise.all([
    Site.find({}).sort({ isDefault: -1, name: 1 }).lean(),
    UserSiteAssignment.find({ userId: id, endDate: null }).lean(),
    OrgRoleGrant.findOne({ userId: id, endDate: null }).lean(),
  ]);

  const assignedIds = new Set(assignments.map((a: any) => String(a.siteId)));
  const primaryId = assignments.find((a: any) => a.isPrimary)?.siteId;

  return NextResponse.json({
    user: {
      id: String((user as any)._id),
      name: (user as any).name,
      email: (user as any).email,
      role: (user as any).AppRole,
      // Super Admins reach every station regardless of assignments, so the
      // UI must say so rather than showing an empty list that implies no access.
      bypassesAssignments: (user as any).AppRole === "Super Admin",
    },
    sites: sites.map((s: any) => ({
      id: String(s._id),
      name: s.name,
      code: s.code,
      siteType: s.siteType,
      status: s.status,
      isDefault: !!s.isDefault,
      assigned: assignedIds.has(String(s._id)),
      isPrimary: String(primaryId || "") === String(s._id),
    })),
    orgGrant: grant
      ? { scope: (grant as any).scope, grantedBy: (grant as any).grantedBy, reason: (grant as any).reason }
      : null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  await connectToDatabase();
  const body = await req.json().catch(() => ({}));

  const user = await SymxUser.findById(id).select("AppRole email").lean();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const siteIds: string[] = Array.isArray(body.siteIds) ? body.siteIds.map(String) : [];
  const primarySiteId = body.primarySiteId ? String(body.primarySiteId) : siteIds[0] || null;
  const orgScope: string | null = body.orgScope || null; // 'all_sites' | 'read_only_all_sites' | null

  if (orgScope && !["all_sites", "read_only_all_sites"].includes(orgScope)) {
    return NextResponse.json({ error: "Invalid org scope" }, { status: 400 });
  }
  if (primarySiteId && !siteIds.includes(primarySiteId)) {
    return NextResponse.json({ error: "Primary station must be one of the assigned stations" }, { status: 400 });
  }

  const validSites = await Site.find({ _id: { $in: siteIds } }).select("_id").lean();
  if (validSites.length !== siteIds.length) {
    return NextResponse.json({ error: "One or more stations do not exist" }, { status: 400 });
  }

  const actor = auth.session.email || "admin";
  const now = new Date();

  // ── Assignments ──
  const current = await UserSiteAssignment.find({ userId: id, endDate: null }).lean();
  const currentIds = new Set(current.map((a: any) => String(a.siteId)));
  const wanted = new Set(siteIds);

  // Revoke by end-dating, never by deleting — the access history is the
  // point of the effective-dated design.
  const toRevoke = [...currentIds].filter((s) => !wanted.has(s));
  if (toRevoke.length > 0) {
    await UserSiteAssignment.updateMany(
      { userId: id, siteId: { $in: toRevoke }, endDate: null },
      { $set: { endDate: now } }
    );
  }

  const toAdd = [...wanted].filter((s) => !currentIds.has(s));
  for (const siteId of toAdd) {
    await UserSiteAssignment.create({
      userId: id,
      siteId,
      roleName: (user as any).AppRole || "",
      isPrimary: false,
      startDate: now,
      endDate: null,
      grantedBy: actor,
    });
  }

  // Exactly one primary among the surviving assignments.
  if (primarySiteId) {
    await UserSiteAssignment.updateMany({ userId: id, endDate: null }, { $set: { isPrimary: false } });
    await UserSiteAssignment.updateOne(
      { userId: id, siteId: primarySiteId, endDate: null },
      { $set: { isPrimary: true } }
    );
  }

  // ── Org-wide grant ──
  const existingGrant = await OrgRoleGrant.findOne({ userId: id, endDate: null });
  if (orgScope) {
    const org = await Organization.findOne();
    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 400 });
    if (existingGrant) {
      if ((existingGrant as any).scope !== orgScope) {
        await OrgRoleGrant.updateOne({ _id: existingGrant._id }, { $set: { endDate: now } });
        await OrgRoleGrant.create({
          userId: id, organizationId: org._id, roleName: (user as any).AppRole || "",
          scope: orgScope, startDate: now, endDate: null,
          grantedBy: actor, reason: String(body.reason || "Granted via Owner > Sites"),
        });
      }
    } else {
      await OrgRoleGrant.create({
        userId: id, organizationId: org._id, roleName: (user as any).AppRole || "",
        scope: orgScope, startDate: now, endDate: null,
        grantedBy: actor, reason: String(body.reason || "Granted via Owner > Sites"),
      });
    }
  } else if (existingGrant) {
    await OrgRoleGrant.updateOne({ _id: existingGrant._id }, { $set: { endDate: now } });
  }

  return NextResponse.json({ success: true });
}
