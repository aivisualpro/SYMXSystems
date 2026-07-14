import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";
import DropdownOption from "@/lib/models/DropdownOption";
import { generateCombinedCoachingPdfBuffer } from "@/lib/generate-coaching-pdf";

// POST /api/writeups/combined-pdf { ids: string[] }
// Combines the selected write-ups into a single PDF (one form per page),
// in the same order the ids were given, for bulk download/printing.
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Write-Ups", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No write-ups selected" }, { status: 400 });
    }

    await connectToDatabase();

    const [writeups, categories] = await Promise.all([
      Writeup.find({ _id: { $in: ids } }).lean(),
      DropdownOption.find({ type: "metric", isActive: { $ne: false } }, { description: 1, sortOrder: 1 })
        .sort({ sortOrder: 1, description: 1 })
        .lean(),
    ]);

    if (writeups.length === 0) {
      return NextResponse.json({ error: "No matching write-ups found" }, { status: 404 });
    }

    // Preserve the order the ids were selected/sorted in on the client,
    // not whatever order Mongo happens to return them in.
    const byId = new Map(writeups.map((w: any) => [String(w._id), w]));
    const ordered = ids.map((id: string) => byId.get(id)).filter(Boolean) as any[];

    const allCategories = categories.map((c: any) => c.description);

    const buffer = generateCombinedCoachingPdfBuffer(
      ordered.map((w: any) => ({
        employeeName: w.employeeName,
        managerName: w.managerName,
        incidentDate: w.incidentDate,
        warningLevel: w.warningLevel,
        categoryLabel: w.categoryLabel,
        allCategories,
        description: w.description,
        planForImprovement: w.planForImprovement,
        consequences: w.consequences,
        priorDates: (w.priorWriteups || []).map((p: any) => ({ date: p.incidentDate, warningLevel: p.warningLevel })),
        priorVerbalCoachingDates: (w.priorVerbalCoachings || []).map((v: any) => v.coachingDate),
        managerSignature: w.managerSignature,
        employeeSignature: w.employeeSignature,
        refusal: w.refusal,
      }))
    );

    const filename = `Writeups_Combined_${new Date().toISOString().split("T")[0]}_${ordered.length}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating combined write-up PDF:", error);
    return NextResponse.json({ error: error.message || "Failed to generate combined PDF" }, { status: 500 });
  }
}
