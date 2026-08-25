import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VerbalCoaching from "@/lib/models/VerbalCoaching";
import { getRequestScope, canAccessRecord } from "@/lib/scoped-query";
import DropdownOption from "@/lib/models/DropdownOption";

const TERMINAL_STATUSES = ["completed", "unable_to_coach"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await connectToDatabase();
    const coaching = await VerbalCoaching.findById(id).lean();
    if (!coaching) return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });

    // 404 rather than 403 — a 403 would confirm the record exists.
    const scope = await getRequestScope();
    if (!canAccessRecord(scope, coaching as any)) {
      return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });
    }
    return NextResponse.json({ coaching });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch verbal coaching" }, { status: 500 });
  }
}

const EDITABLE_FIELDS = ["coachingDate", "coachedBy", "status", "notes", "disputed", "disputeNotes", "driverSignature"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();
    const session = await getSession();

    const existing = await VerbalCoaching.findById(id);
    if (!existing) return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });

    const scope = await getRequestScope();
    if (!canAccessRecord(scope, existing as any)) {
      return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });
    }

    const update: any = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body) update[key] = body[key];
    }
    if (update.coachingDate) update.coachingDate = new Date(update.coachingDate);
    if (update.driverSignature?.name && update.driverSignature?.signatureImage) {
      update.driverSignature = { ...update.driverSignature, signedAt: new Date() };
    }

    // Stamp the "completed by/when" trail the first time this coaching
    // moves into a terminal status — this is the "mark complete" moment a
    // dispatcher records once they've actually had (or attempted) the
    // conversation, separate from who originally logged it.
    if (update.status && TERMINAL_STATUSES.includes(update.status) && !TERMINAL_STATUSES.includes(existing.status)) {
      update.completedBy = session?.email || "";
      update.completedAt = new Date();
    }

    if (Array.isArray(body.categoryIds)) {
      const categories = await DropdownOption.find({ _id: { $in: body.categoryIds } }, { description: 1 }).lean();
      update.categoryIds = body.categoryIds;
      update.categoryLabels = categories.map((c: any) => c.description);
    }

    const coaching = await VerbalCoaching.findByIdAndUpdate(id, { $set: update }, { new: true });
    return NextResponse.json({ coaching });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update verbal coaching" }, { status: 500 });
  }
}

// Deletion is gated on the same Write-Ups "delete" action as formal
// write-ups (Owner > Roles > Write-Ups > Delete), rather than the old
// hardcoded Super-Admin-only "Admin" virtual module — an owner can now
// grant coaching deletion to the same roles that can delete write-ups,
// e.g. to let an HR admin clean up duplicates without full Super Admin
// access. Still off by default for any role without an explicit Write-Ups
// permissions entry.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await connectToDatabase();

    // Fetch-then-check before deleting. This route previously called
    // findByIdAndDelete directly, which is a one-step destructive operation
    // with no opportunity to verify station ownership — someone could have
    // deleted another station's coaching by ID alone. This is precisely the
    // class of miss the query-guard plugin in Phase 3 is meant to catch
    // mechanically rather than by review.
    const existing = await VerbalCoaching.findById(id);
    if (!existing) return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });

    const scope = await getRequestScope();
    if (!canAccessRecord(scope, existing as any)) {
      return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });
    }

    await VerbalCoaching.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete verbal coaching" }, { status: 500 });
  }
}
