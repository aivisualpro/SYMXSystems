import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";

const VALID_OUTCOMES = ["suspended", "terminated", "downgraded", "no_action"];

// POST /api/writeups/[id]/resolve-escalation { outcome, notes, suspensionDays? }
// Closes out a Suspension Review write-up once HR has made the call. Gated
// behind the "approve" action (distinct from "edit") so the person who
// writes someone up isn't necessarily the person who decides their fate —
// an org can grant Approve on Write-Ups only to HR Managers/Owner.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "approve");
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
    if (existing.status !== "escalated") {
      return NextResponse.json({ error: "This write-up is not pending escalation review." }, { status: 400 });
    }

    const outcome = String(body.outcome || "");
    if (!VALID_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: "A valid outcome is required" }, { status: 400 });
    }
    const notes = String(body.notes || "").trim();
    if (notes.length < 10) {
      return NextResponse.json({ error: "Resolution notes must be at least 10 characters" }, { status: 400 });
    }
    let suspensionDays: number | undefined;
    if (outcome === "suspended") {
      suspensionDays = Number(body.suspensionDays);
      if (!Number.isFinite(suspensionDays) || suspensionDays <= 0) {
        return NextResponse.json({ error: "Number of suspension days is required" }, { status: 400 });
      }
    }

    const now = new Date();
    const escalation = {
      outcome,
      suspensionDays,
      notes,
      resolvedBy: session?.email || "",
      resolvedAt: now,
    };

    const writeup = await Writeup.findByIdAndUpdate(
      id,
      {
        $set: { escalation, status: "closed", closedAt: now },
        $push: {
          events: {
            type: "escalation_resolved",
            actorEmail: session?.email || "",
            payload: { outcome, suspensionDays },
            occurredAt: now,
          },
        },
      },
      { new: true }
    );

    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error resolving escalation:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve escalation" }, { status: 500 });
  }
}
