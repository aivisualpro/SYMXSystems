import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";
import Site from "@/lib/models/Site";
import UserSiteAssignment from "@/lib/models/UserSiteAssignment";
import { getDefaultSite } from "@/lib/sites";
import { getSession } from "@/lib/auth";
import bcrypt from "bcrypt";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  phone: z.string().optional(),
  AppRole: z.string().optional(),
  designation: z.string().optional(),
  isActive: z.boolean().optional(),
  serialNo: z.string().optional(),
  profilePicture: z.string().optional(),
  location: z.string().optional(),
  // Stations this user may reach. Optional so existing API callers keep
  // working; omitting it falls back to the default station rather than
  // creating an account with no access at all.
  siteIds: z.array(z.string()).optional(),
  primarySiteId: z.string().optional(),
}).passthrough();

export async function GET(req: NextRequest) {
  try {
    await requirePermission("Admin", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    // Optimized fetch: Select only necessary fields and use lean()
    const items = await SymxUser.find({}, 
      "name email phone AppRole designation isActive serialNo profilePicture location createdAt"
    ).lean();
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("Admin", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await req.json();
    const validation = validateBody(userSchema, rawBody);
    
    if (!validation.success) {
      return validation.response;
    }
    const body = validation.data as any;

    // Hash password if present
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12);
    }

    // Station assignment is stored in its own collection, not on the user
    // document — strip it before creating the user.
    const requestedSiteIds: string[] = Array.isArray(body.siteIds) ? body.siteIds.map(String) : [];
    const requestedPrimary: string | undefined = body.primarySiteId ? String(body.primarySiteId) : undefined;
    delete body.siteIds;
    delete body.primarySiteId;

    // Validate BEFORE creating the user, so a bad station id can't leave a
    // half-created account with no assignment behind.
    let siteIds = requestedSiteIds;
    if (siteIds.length > 0) {
      const found = await Site.find({ _id: { $in: siteIds } }).select("_id").lean();
      if (found.length !== siteIds.length) {
        return NextResponse.json({ error: "One or more stations do not exist" }, { status: 400 });
      }
    } else {
      // No station chosen — assign the default rather than creating an
      // account with none. An account with no assignment would land on the
      // default-station fallback anyway (see lib/sites.ts), but recording a
      // real assignment keeps the access audit accurate and means the user
      // isn't flagged as unassigned in the switcher.
      const fallback = await getDefaultSite();
      if (fallback) siteIds = [String((fallback as any)._id)];
    }

    const newItem = await SymxUser.create(body);

    if (siteIds.length > 0) {
      const primary = requestedPrimary && siteIds.includes(requestedPrimary) ? requestedPrimary : siteIds[0];
      const actor = (await getSession())?.email || "admin";
      await UserSiteAssignment.insertMany(
        siteIds.map((siteId) => ({
          userId: newItem._id,
          siteId,
          roleName: body.AppRole || "",
          isPrimary: siteId === primary,
          startDate: new Date(),
          endDate: null,
          grantedBy: actor,
        }))
      );
    }

    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
