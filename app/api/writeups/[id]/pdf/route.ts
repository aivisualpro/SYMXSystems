import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";
import DropdownOption from "@/lib/models/DropdownOption";
import { generateCoachingPdfBuffer } from "@/lib/generate-coaching-pdf";

// GET /api/writeups/[id]/pdf — renders the branded Employee Coaching PDF
// on demand (always current, no stale cached file to regenerate).
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

    const w: any = writeup;
    const categories = await DropdownOption.find({ type: "metric", isActive: { $ne: false } }, { description: 1, sortOrder: 1 })
      .sort({ sortOrder: 1, description: 1 })
      .lean();

    const buffer = generateCoachingPdfBuffer({
      employeeName: w.employeeName,
      managerName: w.managerName,
      incidentDate: w.incidentDate,
      warningLevel: w.warningLevel,
      categoryLabel: w.categoryLabel,
      allCategories: categories.map((c: any) => c.description),
      description: w.description,
      planForImprovement: w.planForImprovement,
      consequences: w.consequences,
      priorDates: (w.priorWriteups || []).map((p: any) => ({ date: p.incidentDate, warningLevel: p.warningLevel })),
      priorVerbalCoachingDates: (w.priorVerbalCoachings || []).map((v: any) => v.coachingDate),
      managerSignature: w.managerSignature,
      employeeSignature: w.employeeSignature,
      refusal: w.refusal,
    });

    const filename = `Writeup_${(w.employeeName || "employee").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date(w.incidentDate).toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating write-up PDF:", error);
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
