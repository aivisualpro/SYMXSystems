import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import DropdownOption from "@/lib/models/DropdownOption";
import { recommendWarningLevel, getCorrectiveActionTemplate, getVerbalCoachingContext, getAvailableSubCategories } from "@/lib/writeup-logic";

// GET /api/writeups/recommend?employeeId=&categoryId=
// Live preview of the prior-history panel + recommended warning level,
// auto-fill corrective-action text, and prior verbal-coaching context —
// used while the manager is still filling out the New Write-Up form
// (before a draft is created).
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Write-Ups", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const categoryId = searchParams.get("categoryId");
    const subCategory = searchParams.get("subCategory") || undefined;
    if (!employeeId || !categoryId) {
      return NextResponse.json({ error: "employeeId and categoryId are required" }, { status: 400 });
    }

    await connectToDatabase();
    const category = await DropdownOption.findById(categoryId).lean();
    const categoryLabel = (category as any)?.description || "";

    const [rec, correctiveAction, verbalCoachingContext, availableSubCategories] = await Promise.all([
      recommendWarningLevel(employeeId, categoryId, categoryLabel, undefined, subCategory),
      getCorrectiveActionTemplate(categoryLabel, subCategory),
      getVerbalCoachingContext(employeeId, categoryLabel),
      getAvailableSubCategories(categoryLabel),
    ]);

    return NextResponse.json({ ...rec, correctiveAction, verbalCoachingContext, availableSubCategories });
  } catch (error: any) {
    console.error("Error computing recommendation:", error);
    return NextResponse.json({ error: error.message || "Failed to compute recommendation" }, { status: 500 });
  }
}
