import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";

const EDITABLE_FIELDS = [
  "incidentDate",
  "description",
  "planForImprovement",
  "consequences",
  "warningLevel",
  "warningLevelOverrideReason",
];

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
    const writeup = await Writeup.findById(id).lean();
    if (!writeup) return NextResponse.json({ error: "Write-up not found" }, { status: 404 });
    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error fetching writeup:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch write-up" }, { status: 500 });
  }
}

// PUT /api/writeups/[id] — edit a draft only. Once any terminal signing
// action has happened (signed / refused_to_sign / uploaded_signed_copy),
// the record is locked — matches the immutability rule from the paper
// process (corrections require a new write-up, not silently editing a
// signed one out from under the signature).
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

    const existing = await Writeup.findById(id);
    if (!existing) return NextResponse.json({ error: "Write-up not found" }, { status: 404 });
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "This write-up has already been signed/closed and can no longer be edited. Create a new write-up instead." }, { status: 400 });
    }

    const updates: any = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (updates.incidentDate) updates.incidentDate = new Date(updates.incidentDate);

    if (updates.warningLevel && updates.warningLevel !== existing.warningLevelAuto) {
      if (!updates.warningLevelOverrideReason || String(updates.warningLevelOverrideReason).trim().length < 10) {
        return NextResponse.json({ error: "Override reason must be at least 10 characters" }, { status: 400 });
      }
      updates.warningLevelOverriddenBy = session?.email || "";
    } else if (updates.warningLevel && updates.warningLevel === existing.warningLevelAuto) {
      updates.warningLevelOverrideReason = "";
      updates.warningLevelOverriddenBy = "";
    }

    const writeup = await Writeup.findByIdAndUpdate(
      id,
      { $set: updates, $push: { events: { type: "updated", actorEmail: session?.email || "", occurredAt: new Date() } } },
      { new: true }
    );

    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error updating writeup:", error);
    return NextResponse.json({ error: error.message || "Failed to update write-up" }, { status: 500 });
  }
}

// DELETE /api/writeups/[id] — drafts only.
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
    const existing = await Writeup.findById(id);
    if (!existing) return NextResponse.json({ error: "Write-up not found" }, { status: 404 });
    if (existing.status !== "draft" && !existing.isHistorical) {
      return NextResponse.json({ error: "Only draft write-ups can be deleted." }, { status: 400 });
    }
    await Writeup.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting writeup:", error);
    return NextResponse.json({ error: error.message || "Failed to delete write-up" }, { status: 500 });
  }
}
