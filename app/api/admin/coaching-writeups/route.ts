import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXCoachingWriteUp from "@/lib/models/SYMXCoachingWriteUp";
import SymxEmployee from "@/lib/models/SymxEmployee";
import DropdownOption from "@/lib/models/DropdownOption";

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

    // Lightweight count lookup for auto-calculated fields
    const action = searchParams.get("action");
    if (action === "counts") {
      const empId = searchParams.get("employeeId");
      if (!empId) return NextResponse.json({ correctiveActionCount: 0, metricNoticeCount: 0 });
      const correctiveActionCount = await SYMXCoachingWriteUp.countDocuments({ employeeId: empId });
      const metricId = searchParams.get("metric");
      const metricNoticeCount = metricId
        ? await SYMXCoachingWriteUp.countDocuments({ employeeId: empId, metric: metricId })
        : 0;
      return NextResponse.json({ correctiveActionCount, metricNoticeCount });
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (search) {
      filter.$or = [
        { type: { $regex: search, $options: "i" } },
        { correctiveAction: { $regex: search, $options: "i" } },
      ];

      // Search by metric name — find matching dropdown IDs first
      const matchingMetrics = await DropdownOption.find(
        { type: "metric", description: { $regex: search, $options: "i" } },
        { _id: 1 }
      ).lean();
      if (matchingMetrics.length > 0) {
        filter.$or.push({ metric: { $in: matchingMetrics.map((m: any) => m._id) } });
      }

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

    const [data, totalCount, employees, supervisors, metricOptions] = await Promise.all([
      SYMXCoachingWriteUp.find(filter)
        .sort({ incidentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SYMXCoachingWriteUp.countDocuments(filter),
      SymxEmployee.find({}, { _id: 1, transporterId: 1, firstName: 1, lastName: 1 }).sort({ firstName: 1, lastName: 1 }).lean(),
      SymxEmployee.find({ type: "Operations", status: "Active" }, { _id: 1, firstName: 1, lastName: 1 }).sort({ firstName: 1, lastName: 1 }).lean(),
      DropdownOption.find({ type: "metric" }, { _id: 1, description: 1, icon: 1, color: 1 }).lean(),
    ]);

    // Build _id → name map AND transporterId → name map
    const idNameMap = new Map<string, string>();
    const tidNameMap = new Map<string, string>();
    for (const emp of employees) {
      const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      idNameMap.set(emp._id.toString(), name);
      if (emp.transporterId) tidNameMap.set(emp.transporterId, name);
    }

    // Build metric _id → { description, icon, color } map
    const metricMap = new Map<string, { description: string; icon: string; color: string }>();
    for (const opt of metricOptions) {
      metricMap.set(opt._id.toString(), {
        description: (opt as any).description || "",
        icon: (opt as any).icon || "",
        color: (opt as any).color || "",
      });
    }

    // Enrich with employee name, supervisor name, and metric details
    const enriched = data.map((r: any) => {
      const metricInfo = r.metric ? metricMap.get(r.metric.toString()) : null;
      return {
        ...r,
        employeeName: r.employeeId
          ? idNameMap.get(r.employeeId.toString()) || ""
          : tidNameMap.get(r.transporterId) || "",
        supervisorName: r.supervisor ? idNameMap.get(r.supervisor.toString()) || "" : "",
        metricName: metricInfo?.description || "",
        metricIcon: metricInfo?.icon || "",
        metricColor: metricInfo?.color || "",
      };
    });

    return NextResponse.json({
      records: enriched,
      totalCount,
      hasMore: skip + limit < totalCount,
      employees: employees.map((e: any) => ({ _id: e._id.toString(), name: `${e.firstName || ""} ${e.lastName || ""}`.trim() })),
      supervisors: supervisors.map((e: any) => ({ _id: e._id.toString(), name: `${e.firstName || ""} ${e.lastName || ""}`.trim() })),
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

    // Auto-calculate correctiveActionNumber: count of existing records for this employee + 1
    if (body.employeeId) {
      const existingCount = await SYMXCoachingWriteUp.countDocuments({ employeeId: body.employeeId });
      body.correctiveActionNumber = String(existingCount + 1);
    }

    // Auto-calculate metricNoticeNumber: count of existing records for this employee + same metric + 1
    if (body.employeeId && body.metric) {
      const metricCount = await SYMXCoachingWriteUp.countDocuments({ employeeId: body.employeeId, metric: body.metric });
      body.metricNoticeNumber = String(metricCount + 1);
    }

    const record = await SYMXCoachingWriteUp.create(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    console.error("CoachingWriteUps POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
