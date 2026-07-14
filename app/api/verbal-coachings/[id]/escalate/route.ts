import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VerbalCoaching from "@/lib/models/VerbalCoaching";
import Writeup from "@/lib/models/Writeup";
import DropdownOption from "@/lib/models/DropdownOption";
import { recommendWarningLevel, getCorrectiveActionTemplate, getVerbalCoachingContext } from "@/lib/writeup-logic";

// POST /api/verbal-coachings/[id]/escalate { categoryId? }
// Turns a verbal coaching into a formal Write-Up draft — the manager
// still reviews/signs it like any other write-up. If the coaching covers
// multiple categories, categoryId picks which one to formalize (defaults
// to the first if the coaching only has one).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "create");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await connectToDatabase();
    const session = await getSession();

    const coaching = await VerbalCoaching.findById(id);
    if (!coaching) return NextResponse.json({ error: "Verbal coaching not found" }, { status: 404 });
    if (coaching.linkedWriteupId) {
      return NextResponse.json({ error: "This verbal coaching has already been escalated to a write-up." }, { status: 400 });
    }
    if (!coaching.employeeId) {
      return NextResponse.json({ error: "This coaching isn't linked to a matched employee record and can't be escalated." }, { status: 400 });
    }

    const categoryId = body.categoryId || (coaching.categoryIds[0] ? String(coaching.categoryIds[0]) : undefined);
    if (!categoryId) {
      return NextResponse.json({ error: "A category is required" }, { status: 400 });
    }

    const category = await DropdownOption.findById(categoryId).lean();
    const categoryLabel = (category as any)?.description || coaching.categoryLabels[0] || "";

    const [rec, correctiveAction, verbalCoachingContext] = await Promise.all([
      recommendWarningLevel(String(coaching.employeeId), categoryId, categoryLabel),
      getCorrectiveActionTemplate(categoryLabel),
      getVerbalCoachingContext(String(coaching.employeeId), categoryLabel),
    ]);

    const description = coaching.notes
      ? `Escalated from verbal coaching on ${new Date(coaching.coachingDate).toLocaleDateString()}: ${coaching.notes}`
      : `Escalated from verbal coaching on ${new Date(coaching.coachingDate).toLocaleDateString()}.`;

    const writeup = await Writeup.create({
      transporterId: coaching.transporterId || "",
      employeeId: coaching.employeeId,
      employeeName: coaching.employeeName || "",
      categoryId,
      categoryLabel,
      warningLevel: rec.recommended,
      warningLevelAuto: rec.recommended,
      incidentDate: coaching.coachingDate || new Date(),
      description,
      planForImprovement: correctiveAction.planForImprovement,
      consequences: correctiveAction.consequences,
      priorWriteups: rec.priors.map((p) => ({ writeupId: p.writeupId, incidentDate: p.incidentDate, warningLevel: p.warningLevel })),
      priorVerbalCoachings: verbalCoachingContext.items.map((v) => ({ coachingDate: v.coachingDate, categoryLabels: v.categoryLabels })),
      status: "draft",
      managerName: session?.name || session?.email || "",
      isHistorical: false,
      createdBy: session?.email || "",
      events: [{ type: "created", actorEmail: session?.email || "", payload: { escalatedFromVerbalCoachingId: coaching._id }, occurredAt: new Date() }],
    });

    coaching.linkedWriteupId = writeup._id as any;
    await coaching.save();

    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error escalating verbal coaching:", error);
    return NextResponse.json({ error: error.message || "Failed to escalate verbal coaching" }, { status: 500 });
  }
}
