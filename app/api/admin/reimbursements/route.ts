import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    await requirePermission("HR", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const contentType = req.headers.get("content-type") || "";
    let body: any = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      // Extract text fields
      for (const [key, value] of formData.entries()) {
        if (key !== "file") {
          body[key] = value as string;
        }
      }
      // Parse amount
      if (body.amount) body.amount = parseFloat(body.amount);
      // Parse date
      if (body.date) body.date = new Date(body.date);

      // Handle file upload
      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result: any = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "symx-systems/reimbursements", resource_type: "auto" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(buffer);
        });
        body.attachment = result.secure_url;
      }
    } else {
      body = await req.json();
    }

    const record = await SymxReimbursement.create(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
