import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VerbalCoaching from "@/lib/models/VerbalCoaching";
import DropdownOption from "@/lib/models/DropdownOption";

// GET /api/verbal-coachings?status=&employeeId=&categoryId=&search=&from=&to=
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
    // "new" as a filter also pulls in the legacy "scheduled" bucket from
    // historical imports — both mean "not yet actioned."
    if (status === "new") query.status = { $in: ["new", "scheduled"] };
    else if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;
    if (categoryId) query.categoryIds = categoryId;
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { categoryLabels: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { coachedBy: { $regex: search, $options: "i" } },
      ];
    }
    if (from || to) {
      query.coachingDate = {};
      if (from) query.coachingDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.coachingDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const coachings = await VerbalCoaching.find(query).sort({ coachingDate: -1, createdAt: -1 }).lean();
    return NextResponse.json({ coachings });
  } catch (error: any) {
    console.error("Error fetching verbal coachings:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch verbal coachings" }, { status: 500 });
  }
}

// POST /api/verbal-coachings — quick-log a coaching conversation. No
// signature/ladder involved; this is the informal, high-volume tier.
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
    if (!Array.isArray(body.categoryIds) || body.categoryIds.length === 0) {
      return NextResponse.json({ error: "At least one category is required" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();

    const categories = await DropdownOption.find({ _id: { $in: body.categoryIds } }, { description: 1 }).lean();
    const categoryLabels = categories.map((c: any) => c.description);

    // Default is "new" — a dispatcher logging a coaching shouldn't have to
    // claim it's "completed" just to save the record. If they ARE logging
    // it after the fact as already completed/unable-to-coach, stamp the
    // completion trail right away rather than requiring a second edit.
    const status = ["new", "completed", "unable_to_coach"].includes(body.status) ? body.status : "new";
    const isTerminal = status === "completed" || status === "unable_to_coach";

    let driverSignature;
    if (body.driverSignature?.name && body.driverSignature?.signatureImage) {
      driverSignature = {
        name: body.driverSignature.name,
        signatureImage: body.driverSignature.signatureImage,
        signedAt: new Date(),
      };
    }

    const coaching = await VerbalCoaching.create({
      transporterId: body.transporterId || "",
      employeeId: body.employeeId,
      employeeName: body.employeeName || "",
      categoryIds: body.categoryIds,
      categoryLabels,
      coachingDate: body.coachingDate ? new Date(body.coachingDate) : new Date(),
      coachedBy: body.coachedBy || session?.name || session?.email || "",
      status,
      notes: body.notes || "",
      disputed: !!body.disputed,
      disputeNotes: body.disputed ? body.disputeNotes || "" : "",
      driverSignature,
      isHistorical: false,
      completedBy: isTerminal ? session?.email || "" : undefined,
      completedAt: isTerminal ? new Date() : undefined,
      createdBy: session?.email || "",
    });

    return NextResponse.json({ coaching });
  } catch (error: any) {
    console.error("Error creating verbal coaching:", error);
    return NextResponse.json({ error: error.message || "Failed to create verbal coaching" }, { status: 500 });
  }
}
