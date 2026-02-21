import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
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

    // Build query filter
    const filter: any = {};
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { transporterId: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Run data fetch, count, KPI aggregation, and employee lookup in parallel
    const [data, totalCount, kpiAgg, employees] = await Promise.all([
      SymxReimbursement.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SymxReimbursement.countDocuments(filter),
      // KPI aggregation on the full (unfiltered) dataset for dashboard stats
      SymxReimbursement.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            totalRecords: { $sum: 1 },
            unpaidCount: { $sum: { $cond: [{ $ne: ["$status", "Paid"] }, 1, 0] } },
            unpaidAmount: { $sum: { $cond: [{ $ne: ["$status", "Paid"] }, { $ifNull: ["$amount", 0] }, 0] } },
            paidCount: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] } },
            paidAmount: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, { $ifNull: ["$amount", 0] }, 0] } },
          },
        },
      ]),
      SymxEmployee.find({}, { transporterId: 1, firstName: 1, lastName: 1 }).lean(),
    ]);

    // Build a transporterId → full name map
    const nameMap = new Map<string, string>();
    for (const emp of employees) {
      if (emp.transporterId) {
        nameMap.set(emp.transporterId, `${emp.firstName || ""} ${emp.lastName || ""}`.trim());
      }
    }

    // Enrich each record with the resolved employee name
    const enriched = data.map((r: any) => ({
      ...r,
      employeeName: r.employeeName || nameMap.get(r.transporterId) || "",
    }));

    const kpi = kpiAgg[0] || {
      totalAmount: 0, totalRecords: 0,
      unpaidCount: 0, unpaidAmount: 0,
      paidCount: 0, paidAmount: 0,
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
    const record = await SymxReimbursement.create(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
