import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXCoachingWriteUp from "@/lib/models/SYMXCoachingWriteUp";
import SymxEmployee from "@/lib/models/SymxEmployee";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      filter.$or = [
        { type: { $regex: search, $options: "i" } },
        { metric: { $regex: search, $options: "i" } },
        { correctiveAction: { $regex: search, $options: "i" } },
      ];
      // Also search by employee name — find matching employee IDs first
      const matchingEmps = await SymxEmployee.find(
        {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { transporterId: { $regex: search, $options: "i" } },
          ],
        },
        { _id: 1 }
      ).lean();
      if (matchingEmps.length > 0) {
        const empIds = matchingEmps.map((e: any) => e._id);
        filter.$or.push({ employeeId: { $in: empIds } });
        filter.$or.push({ supervisor: { $in: empIds } });
      }
    }

    const [data, totalCount, employees] = await Promise.all([
      SYMXCoachingWriteUp.find(filter)
        .sort({ incidentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SYMXCoachingWriteUp.countDocuments(filter),
      SymxEmployee.find({}, { _id: 1, transporterId: 1, firstName: 1, lastName: 1 }).lean(),
    ]);

    // Build _id → name map AND transporterId → name map
    const idNameMap = new Map<string, string>();
    const tidNameMap = new Map<string, string>();
    for (const emp of employees) {
      const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      idNameMap.set(emp._id.toString(), name);
      if (emp.transporterId) tidNameMap.set(emp.transporterId, name);
    }

    // Enrich with employee name and supervisor name
    const enriched = data.map((r: any) => ({
      ...r,
      employeeName: r.employeeId
        ? idNameMap.get(r.employeeId.toString()) || ""
        : tidNameMap.get(r.transporterId) || "",
      supervisorName: r.supervisor ? idNameMap.get(r.supervisor.toString()) || "" : "",
    }));

    return NextResponse.json({
      records: enriched,
      totalCount,
      hasMore: skip + limit < totalCount,
    });
  } catch (error: any) {
    console.error("CoachingWriteUps GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const body = await req.json();
    body.createdBy = session.id || "";

    const record = await SYMXCoachingWriteUp.create(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error("CoachingWriteUps POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
