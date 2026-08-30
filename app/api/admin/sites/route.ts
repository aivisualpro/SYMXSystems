import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import Organization from "@/lib/models/Organization";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";

// ── Sites administration ──────────────────────────────────────────────
// Creating, renaming, or deactivating a station changes who can see what
// across the entire system, so this is Super Admin only — deliberately
// NOT wired to the module permission matrix, where an over-broad role
// could pick it up by accident.

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isSuperAdmin(session)) {
    return { ok: false as const, res: NextResponse.json({ error: "Super Admin only" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.res;

  await connectToDatabase();
  const [sites, org] = await Promise.all([
    Site.find({}).sort({ isDefault: -1, name: 1 }).lean(),
    Organization.findOne().lean(),
  ]);

  // User counts per site, so deactivating a station shows who it affects.
  const counts = await UserSiteAssignment.aggregate([
    { $match: { endDate: null } },
    { $group: { _id: "$siteId", n: { $sum: 1 } } },
  ]);
  const countBySite: Record<string, number> = {};
  for (const c of counts) countBySite[String(c._id)] = c.n;

  return NextResponse.json({
    organization: org ? { id: String((org as any)._id), name: (org as any).name, timezone: (org as any).timezone } : null,
    sites: sites.map((s: any) => ({
      id: String(s._id),
      name: s.name,
      code: s.code,
      slug: s.slug,
      siteType: s.siteType,
      address: s.address || "",
      messaging: {
        quoPhoneNumberId: s.messaging?.quoPhoneNumberId || "",
        quoPhoneNumber: s.messaging?.quoPhoneNumber || "",
      },
      amazon: {
        serviceAreaId: s.amazon?.serviceAreaId || "",
      },
      status: s.status,
      isDefault: !!s.isDefault,
      userCount: countBySite[String(s._id)] || 0,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.res;

  await connectToDatabase();
  const body = await req.json().catch(() => ({}));

  const name = String(body.name || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Station code is required" }, { status: 400 });

  const org = await Organization.findOne();
  if (!org) {
    return NextResponse.json(
      { error: "No organization exists yet. Run the Phase 1 seed migration first." },
      { status: 400 }
    );
  }

  const slug = slugify(body.slug || code);
  const clash = await Site.findOne({ organizationId: org._id, $or: [{ slug }, { code }] });
  if (clash) {
    return NextResponse.json(
      { error: `A station with that code or slug already exists (${(clash as any).code}).` },
      { status: 409 }
    );
  }

  const site = await Site.create({
    organizationId: org._id,
    name,
    code,
    slug,
    siteType: body.siteType === "seasonal" ? "seasonal" : "permanent",
    address: String(body.address || ""),
    status: "active",
    // A newly created station is never the default. The default marks the
    // station existing historical data was backfilled to; reassigning it
    // is a migration concern, not a create-form checkbox.
    isDefault: false,
  });

  return NextResponse.json({ site: { id: String(site._id), name: site.name, code: site.code } }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.res;

  await connectToDatabase();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const site = await Site.findById(id);
  if (!site) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const updates: any = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.address !== undefined) updates.address = String(body.address);
  if (body.siteType !== undefined) updates.siteType = body.siteType === "seasonal" ? "seasonal" : "permanent";
  // Per-station Quo number. Both forms are stored because the two sides of
  // the integration speak different ones: the API wants OpenPhone's PNxxxx
  // id, while the inbound webhook reports the E.164 number.
  // Clearing a number must UNSET it, not write "". The lookup indexes are
  // unique+sparse, so a second station cleared to "" would collide with
  // the first and the save would fail with an unrelated-looking duplicate
  // key error.
  const unsets: Record<string, ""> = {};
  for (const [field, key] of [
    ["quoPhoneNumberId", "messaging.quoPhoneNumberId"],
    ["quoPhoneNumber", "messaging.quoPhoneNumber"],
    ["amazonServiceAreaId", "amazon.serviceAreaId"],
  ] as const) {
    if (body[field] === undefined) continue;
    const value = String(body[field] ?? "").trim();
    if (value) updates[key] = value;
    else unsets[key] = "";
  }

  if (body.status !== undefined) {
    const status = body.status === "inactive" ? "inactive" : "active";
    // The default station is where all historical data lives and where
    // legacy code paths fall back to. Deactivating it would strip access
    // from everyone at once.
    if (status === "inactive" && site.isDefault) {
      return NextResponse.json(
        { error: "The default station can't be deactivated — historical records and fallbacks depend on it." },
        { status: 400 }
      );
    }
    updates.status = status;
  }

  // Code and slug are intentionally immutable. They appear in exports,
  // printed PDFs, and saved links; renaming one silently rewrites the
  // meaning of documents already issued under the old code.
  if (body.code !== undefined && String(body.code).toUpperCase() !== site.code) {
    return NextResponse.json(
      { error: "Station code can't be changed — it appears on issued documents and exports." },
      { status: 400 }
    );
  }

  await Site.findByIdAndUpdate(id, {
    $set: updates,
    ...(Object.keys(unsets).length ? { $unset: unsets } : {}),
  });
  return NextResponse.json({ success: true });
}
