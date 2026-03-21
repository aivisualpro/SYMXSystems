import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxIncident from "@/lib/models/SymxIncident";
import SymxEmployee from "@/lib/models/SymxEmployee";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";

    const filter: any = {};
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { transporterId: { $regex: search, $options: "i" } },
        { claimNumber: { $regex: search, $options: "i" } },
        { claimantName: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { claimType: { $regex: search, $options: "i" } },
      ];
    }

    const [data, totalCount, kpiAgg, employees] = await Promise.all([
      SymxIncident.find(filter)
        .sort({ incidentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SymxIncident.countDocuments(filter),
      SymxIncident.aggregate([
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
            totalReserved: { $sum: { $ifNull: ["$reserved", 0] } },
            openCount: { $sum: { $cond: [{ $ne: ["$claimStatus", "Close"] }, 1, 0] } },
            closedCount: { $sum: { $cond: [{ $eq: ["$claimStatus", "Close"] }, 1, 0] } },
            injuryCount: { $sum: { $cond: [{ $eq: ["$claimType", "Injury"] }, 1, 0] } },
            autoCount: { $sum: { $cond: [{ $eq: ["$claimType", "Auto"] }, 1, 0] } },
            propertyDamageCount: { $sum: { $cond: [{ $eq: ["$claimType", "Property Damage"] }, 1, 0] } },
          },
        },
      ]),
      SymxEmployee.find({}, { transporterId: 1, firstName: 1, lastName: 1 }).lean(),
    ]);

    const nameMap = new Map<string, string>();
    for (const emp of employees) {
      if (emp.transporterId) {
        nameMap.set(emp.transporterId, `${emp.firstName || ""} ${emp.lastName || ""}`.trim());
      }
    }

    const enriched = data.map((r: any) => ({
      ...r,
      employeeName: r.employeeName || nameMap.get(r.transporterId) || "",
    }));

    const kpi = kpiAgg[0] || {
      totalRecords: 0, totalPaid: 0, totalReserved: 0,
      openCount: 0, closedCount: 0, injuryCount: 0, autoCount: 0, propertyDamageCount: 0,
    };

    return NextResponse.json({
      records: enriched,
      totalCount,
      hasMore: skip + limit < totalCount,
      kpi,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const body = await req.json();
    const record = await SymxIncident.create(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
