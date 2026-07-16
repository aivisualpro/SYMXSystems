import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";

const VALID_OUTCOMES = ["suspended", "terminated", "downgraded", "no_action"];

// POST /api/writeups/[id]/review { decision: "confirmed" | "escalated", outcome?, suspensionDays?, notes? }
// Closes out a write-up once a manager has reviewed it from the Review
// Workbench. Replaces the old resolve-escalation endpoint, which only ever
// fired for Suspension Review cases — every write-up now goes through this
// same decision point, regardless of warning level. Gated behind the
// "approve" action (distinct from "edit"/"create") so the person who issues
// a write-up isn't necessarily the person who reviews it; an org grants
// Approve on Write-Ups to whichever roles are flagged SymxAppRole.isManager.
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
    // Accept legacy "escalated" too, so any pre-redesign record still stuck
    // waiting on HR resolution can be closed out through this same endpoint
    // instead of needing the old resolve-escalation route kept alive.
    if (existing.status !== "pending_review" && existing.status !== "escalated") {
      return NextResponse.json({ error: "This write-up is not pending manager review." }, { status: 400 });
    }

    const decision = String(body.decision || "");
    if (!["confirmed", "escalated"].includes(decision)) {
      return NextResponse.json({ error: "A decision (confirmed or escalated) is required" }, { status: 400 });
    }

    let outcome: string | undefined;
    let suspensionDays: number | undefined;
    let notes = String(body.notes || "").trim();

    if (decision === "escalated") {
      outcome = String(body.outcome || "");
      if (!VALID_OUTCOMES.includes(outcome)) {
        return NextResponse.json({ error: "A valid outcome is required when escalating" }, { status: 400 });
      }
      if (notes.length < 10) {
        return NextResponse.json({ error: "Notes must be at least 10 characters when escalating" }, { status: 400 });
      }
      if (outcome === "suspended") {
        suspensionDays = Number(body.suspensionDays);
        if (!Number.isFinite(suspensionDays) || suspensionDays <= 0) {
          return NextResponse.json({ error: "Number of suspension days is required" }, { status: 400 });
        }
      }
    }

    const now = new Date();
    const managerReview = {
      decision,
      outcome,
      suspensionDays,
      notes,
      reviewedBy: session?.email || "",
      reviewedAt: now,
    };

    const writeup = await Writeup.findByIdAndUpdate(
      id,
      {
        $set: { managerReview, status: "closed", closedAt: now },
        $push: {
          events: {
            type: "manager_reviewed",
            actorEmail: session?.email || "",
            payload: { decision, outcome, suspensionDays },
            occurredAt: now,
          },
        },
      },
      { new: true }
    );

    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error recording manager review:", error);
    return NextResponse.json({ error: error.message || "Failed to record review" }, { status: 500 });
  }
}
