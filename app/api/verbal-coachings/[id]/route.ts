import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VerbalCoaching from "@/lib/models/VerbalCoaching";
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

// Deletion is restricted to admins regardless of who else has Write-Ups
// edit/delete access — a logged coaching (and its audit trail) shouldn't
// be permanently removable by whoever happens to have general module
// permissions. "Admin" is a virtual module no role can be granted through
// the UI, so this is effectively Super Admin only.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Admin", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await connectToDatabase();
    const deleted = await VerbalCoaching.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete verbal coaching" }, { status: 500 });
  }
}
