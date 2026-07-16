import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import { v2 as cloudinary } from "cloudinary";
import { getNextRequestNumber, enrichReimbursements } from "@/lib/reimbursement-utils";

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
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { transporterId: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { requestNumber: { $regex: search, $options: "i" } },
        { submitterName: { $regex: search, $options: "i" } },
        { "items.description": { $regex: search, $options: "i" } },
      ];
    }

    const [data, totalCount, kpiAgg] = await Promise.all([
      SymxReimbursement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SymxReimbursement.countDocuments(filter),
      SymxReimbursement.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            totalRecords: { $sum: 1 },
            pendingCount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
            pendingAmount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, { $ifNull: ["$amount", 0] }, 0] } },
            approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            approvedAmount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, { $ifNull: ["$amount", 0] }, 0] } },
            queuedCount: { $sum: { $cond: [{ $eq: ["$status", "queued_for_payroll"] }, 1, 0] } },
            queuedAmount: { $sum: { $cond: [{ $eq: ["$status", "queued_for_payroll"] }, { $ifNull: ["$amount", 0] }, 0] } },
            paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
            paidAmount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, { $ifNull: ["$amount", 0] }, 0] } },
            deniedCount: { $sum: { $cond: [{ $eq: ["$status", "denied"] }, 1, 0] } },
            deniedAmount: { $sum: { $cond: [{ $eq: ["$status", "denied"] }, { $ifNull: ["$amount", 0] }, 0] } },
          },
        },
      ]),
    ]);

    const enriched = await enrichReimbursements(data);

    const kpiRaw = kpiAgg[0] || {
      totalAmount: 0, totalRecords: 0,
      pendingCount: 0, pendingAmount: 0,
      approvedCount: 0, approvedAmount: 0,
      queuedCount: 0, queuedAmount: 0,
      paidCount: 0, paidAmount: 0,
      deniedCount: 0, deniedAmount: 0,
    };
    // Outstanding = reviewed and owed but not yet actually paid out — the
    // number that answers "how much do I still need to pay/queue into
    // payroll right now."
    const kpi = {
      ...kpiRaw,
      outstandingAmount: (kpiRaw.approvedAmount || 0) + (kpiRaw.queuedAmount || 0),
      outstandingCount: (kpiRaw.approvedCount || 0) + (kpiRaw.queuedCount || 0),
    };

    return NextResponse.json({
      records: enriched,
      totalCount,
      hasMore: skip + limit < totalCount,
      kpi,
    });
  } catch (error: any) {
    console.error("[REIMBURSEMENTS_GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Admin/manager "on behalf of employee" creation — the driver has no login
// to submit their own request through (see app/submit-reimbursement for
// that path), so this is how a manager or HR staffer enters one directly.
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
      for (const [key, value] of formData.entries()) {
        if (key !== "file") body[key] = value as string;
      }
      if (body.date) body.date = new Date(body.date);
      if (body.items) {
        try { body.items = JSON.parse(body.items); } catch { body.items = []; }
      }

      const files = formData.getAll("file") as File[];
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (file && file.size > 0) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const result: any = await new Promise((resolve, reject) => {
            cloudinary.uploader
              .upload_stream({ folder: "symx-systems/reimbursements", resource_type: "auto" }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
              })
              .end(buffer);
          });
          uploadedUrls.push(result.secure_url);
        }
      }
      if (uploadedUrls.length > 0) {
        body.attachments = uploadedUrls;
        body.attachment = uploadedUrls[0];
      }
    } else {
      body = await req.json();
    }

    const items = Array.isArray(body.items)
      ? body.items
          .map((it: any) => ({
            description: String(it.description || "").slice(0, 500),
            category: it.category ? String(it.category).slice(0, 100) : undefined,
            amount: typeof it.amount === "string" ? parseFloat(it.amount) : Number(it.amount) || 0,
          }))
          .filter((it: any) => it.description && it.amount > 0)
      : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "At least one itemized line with a description and amount is required" }, { status: 400 });
    }

    const requestNumber = await getNextRequestNumber();
    const byName = session.name || session.email || "Staff";
    const byEmail = session.email || "";

    const amount = items.reduce((sum: number, it: any) => sum + it.amount, 0);

    const record: any = {
      requestNumber,
      status: "pending",
      source: "admin",
      createdBy: byName,
      items,
      amount,
      category: items[0]?.category,
      attachments: body.attachments || [],
      attachment: body.attachment || undefined,
      employeeMatchType: body.employeeId ? "manual" : undefined,
      activity: [
        { type: "created", text: "Request created by staff on behalf of employee", byName, byEmail, createdAt: new Date() },
      ],
    };
    if (body.employeeId) record.employeeId = body.employeeId;
    if (body.date) record.date = typeof body.date === "string" ? new Date(body.date) : body.date;
    if (body.notes) record.notes = body.notes;

    const created = await SymxReimbursement.create(record);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("[REIMBURSEMENTS_POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
