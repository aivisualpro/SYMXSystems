import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";

// POST /api/writeups/[id]/refuse — manager marks that the employee was
// presented the write-up in person and refused to sign. A refusal still
// counts as "acknowledged" for escalation purposes (the employee was made
// aware), matching how the paper form's witness line works today.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.note || !String(body.note).trim()) {
      return NextResponse.json({ error: "A short note explaining the refusal is required" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();

    const existing = await Writeup.findById(id);
    if (!existing) return NextResponse.json({ error: "Write-up not found" }, { status: 404 });
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "This write-up is already closed." }, { status: 400 });
    }
    if (!existing.managerSignature?.signatureImage) {
      return NextResponse.json({ error: "Manager must sign before recording a refusal" }, { status: 400 });
    }

    const refusal = {
      refused: true,
      note: String(body.note).trim(),
      witnessName: body.witnessName || "",
      witnessSignatureImage: body.witnessSignatureImage || "",
      refusedAt: new Date(),
    };

    const status = existing.warningLevel === "suspension_review" ? "escalated" : "refused_to_sign";

    const writeup = await Writeup.findByIdAndUpdate(
      id,
      {
        $set: { refusal, status, closedAt: new Date() },
        $push: { events: { type: "refused", actorEmail: session?.email || "", payload: { note: refusal.note }, occurredAt: new Date() } },
      },
      { new: true }
    );

    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error recording refusal:", error);
    return NextResponse.json({ error: error.message || "Failed to record refusal" }, { status: 500 });
  }
}
