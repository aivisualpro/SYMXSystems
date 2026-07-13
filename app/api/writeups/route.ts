import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";
import DropdownOption from "@/lib/models/DropdownOption";
import { recommendWarningLevel } from "@/lib/writeup-logic";

// GET /api/writeups?status=&employeeId=&categoryId=&search=&from=&to=
// Manager/dispatcher/admin tool — employees don't have their own login in
// this app, so unlike Incidents there's no "any logged-in user" tier here.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Write-Ups", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: any = {};
    if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;
    if (categoryId) query.categoryId = categoryId;
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { categoryLabel: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    // Date-range filter on the incident date (7/30/90-day presets or a
    // custom range from the Write-Ups dashboard).
    if (from || to) {
      query.incidentDate = {};
      if (from) query.incidentDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.incidentDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const writeups = await Writeup.find(query).sort({ incidentDate: -1, createdAt: -1 }).lean();
    return NextResponse.json({ writeups });
  } catch (error: any) {
    console.error("Error fetching writeups:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch write-ups" }, { status: 500 });
  }
}

// POST /api/writeups — create a draft. Computes the recommended warning
// level from prior history right away so the manager sees it immediately.
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Write-Ups", "create");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.employeeId) {
      return NextResponse.json({ error: "Employee is required" }, { status: 400 });
    }
    if (!body.categoryId) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();

    const category = await DropdownOption.findById(body.categoryId).lean();
    const categoryLabel = (category as any)?.description || body.categoryLabel || "";

    const rec = await recommendWarningLevel(body.employeeId, body.categoryId, categoryLabel);

    const warningLevel = body.warningLevelOverride || rec.recommended;
    const isOverride = !!body.warningLevelOverride && body.warningLevelOverride !== rec.recommended;
    if (isOverride && (!body.warningLevelOverrideReason || body.warningLevelOverrideReason.trim().length < 10)) {
      return NextResponse.json({ error: "Override reason must be at least 10 characters" }, { status: 400 });
    }

    const writeup = await Writeup.create({
      transporterId: body.transporterId || "",
      employeeId: body.employeeId,
      employeeName: body.employeeName || "",
      categoryId: body.categoryId,
      categoryLabel,
      warningLevel,
      warningLevelAuto: rec.recommended,
      warningLevelOverrideReason: isOverride ? body.warningLevelOverrideReason : "",
      warningLevelOverriddenBy: isOverride ? session?.email || "" : "",
      incidentDate: body.incidentDate ? new Date(body.incidentDate) : new Date(),
      description: body.description || "",
      planForImprovement: body.planForImprovement || "",
      consequences: body.consequences || "",
      priorWriteups: rec.priors.map((p) => ({ writeupId: p.writeupId, incidentDate: p.incidentDate, warningLevel: p.warningLevel })),
      status: "draft",
      managerName: session?.name || session?.email || "",
      isHistorical: false,
      createdBy: session?.email || "",
      events: [{ type: "created", actorEmail: session?.email || "", occurredAt: new Date() }],
    });

    return NextResponse.json({ writeup, recommendation: rec });
  } catch (error: any) {
    console.error("Error creating writeup:", error);
    return NextResponse.json({ error: error.message || "Failed to create write-up" }, { status: 500 });
  }
}
