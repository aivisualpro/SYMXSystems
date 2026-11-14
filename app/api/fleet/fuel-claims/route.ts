import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requireSubModulePermission } from "@/lib/auth/require-permission";
import { getRequestScope, siteFilter, resolveWriteSiteId } from "@/lib/scoped-query";
import FuelClaim from "@/lib/models/FuelClaim";

const STATUSES = ["needs_submission", "submitted", "approved", "denied"] as const;
const STATUS_LABEL: Record<string, string> = {
  needs_submission: "Needs submission",
  submitted: "Submitted to Amazon",
  approved: "Approved",
  denied: "Denied",
};

async function guard(action: "view" | "create" | "edit" | "delete") {
  try {
    return { session: await requireSubModulePermission("Fleet", "Fuel Claims", action) };
  } catch (e: any) {
    return { response: NextResponse.json({ error: e.message }, { status: e.name === "ForbiddenError" ? 403 : 401 }) };
  }
}

const ymd = (v: any) => (v ? new Date(String(v).slice(0, 10) + "T00:00:00.000Z") : undefined);
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
const str = (v: any) => (typeof v === "string" ? v.trim() : "");
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

// GET — list claims (+ per-status counts and dollar totals)
export async function GET(req: NextRequest) {
  const g = await guard("view");
  if ("response" in g) return g.response;
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    const S = siteFilter(scope);
    const { searchParams } = new URL(req.url);
    const query: any = { ...S };
    const status = searchParams.get("status");
    if (status && (STATUSES as readonly string[]).includes(status)) query.status = status;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = ymd(from);
      if (to) query.date.$lte = ymd(to);
    }
    const claims = await FuelClaim.find(query).sort({ date: -1, createdAt: -1 }).limit(1000).lean();

    // Summary uses the same scope but ignores the status filter.
    const summaryQuery: any = { ...S };
    if (query.date) summaryQuery.date = query.date;
    const agg = await FuelClaim.aggregate([
      { $match: summaryQuery },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" }, approved: { $sum: { $ifNull: ["$approvedAmount", 0] } } } },
    ]);
    const summary: Record<string, { count: number; amount: number; approved: number }> = {};
    for (const s of STATUSES) summary[s] = { count: 0, amount: 0, approved: 0 };
    for (const a of agg) summary[a._id] = { count: a.count, amount: Math.round(a.amount * 100) / 100, approved: Math.round(a.approved * 100) / 100 };

    return NextResponse.json({ claims, summary });
  } catch (e: any) {
    console.error("[FUEL_CLAIMS_GET]", e);
    return NextResponse.json({ error: "Failed to load fuel claims" }, { status: 500 });
  }
}

// POST — create a claim
export async function POST(req: NextRequest) {
  const g = await guard("create");
  if ("response" in g) return g.response;
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    const siteId = resolveWriteSiteId(scope, null);
    if (!siteId) return NextResponse.json({ error: "Select a single station before adding a claim." }, { status: 400 });

    const b = await req.json();
    if (!str(b.driverName)) return NextResponse.json({ error: "Driver is required" }, { status: 400 });
    if (!b.date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
    if (!(num(b.amount) > 0)) return NextResponse.json({ error: "Enter the amount on the receipt" }, { status: 400 });
    if (!Array.isArray(b.receipts) || b.receipts.length === 0) {
      return NextResponse.json({ error: "Attach at least one receipt photo" }, { status: 400 });
    }

    const d = ymd(b.date)!;
    const claimNumber = `FC-${d.toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const session: any = g.session;

    const claim = await FuelClaim.create({
      siteId,
      claimNumber,
      date: d,
      expenseType: b.expenseType === "EV Charging" ? "EV Charging" : "Fuel",
      driverName: str(b.driverName),
      transporterId: str(b.transporterId),
      employeeId: /^[0-9a-fA-F]{24}$/.test(String(b.employeeId || "")) ? b.employeeId : undefined,
      tripType: b.tripType === "Rescue" ? "Rescue" : "Route",
      routeNumber: str(b.routeNumber),
      vendor: str(b.vendor),
      amount: num(b.amount),
      paidWith: str(b.paidWith),
      driverRepaid: ["yes", "no", "not_needed"].includes(b.driverRepaid) ? b.driverRepaid : "no",
      notes: str(b.notes),
      receipts: b.receipts.filter((u: any) => typeof u === "string" && u).slice(0, 12),
      status: "needs_submission",
      activity: [{ text: "Claim created", byName: session?.name, byEmail: session?.email, createdAt: new Date() }],
      createdBy: session?.email || session?.name || "",
    });
    return NextResponse.json({ claim });
  } catch (e: any) {
    console.error("[FUEL_CLAIMS_POST]", e);
    return NextResponse.json({ error: e.message || "Failed to create claim" }, { status: 500 });
  }
}

// PUT — edit details and/or move through the Amazon steps
export async function PUT(req: NextRequest) {
  const g = await guard("edit");
  if ("response" in g) return g.response;
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const claim = await FuelClaim.findOne({ _id: b.id, ...siteFilter(scope) });
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    const session: any = g.session;
    const log = (text: string) => claim.activity.push({ text, byName: session?.name, byEmail: session?.email, createdAt: new Date() });

    // Details
    if (b.date) claim.date = ymd(b.date)!;
    if (b.expenseType) claim.expenseType = b.expenseType === "EV Charging" ? "EV Charging" : "Fuel";
    if (b.driverName !== undefined && str(b.driverName)) claim.driverName = str(b.driverName);
    if (b.transporterId !== undefined) claim.transporterId = str(b.transporterId);
    if (b.tripType) claim.tripType = b.tripType === "Rescue" ? "Rescue" : "Route";
    if (b.routeNumber !== undefined) claim.routeNumber = str(b.routeNumber);
    if (b.vendor !== undefined) claim.vendor = str(b.vendor);
    if (b.amount !== undefined && num(b.amount) > 0) claim.amount = num(b.amount);
    if (b.paidWith !== undefined) claim.paidWith = str(b.paidWith);
    if (b.driverRepaid && ["yes", "no", "not_needed"].includes(b.driverRepaid)) claim.driverRepaid = b.driverRepaid;
    if (b.notes !== undefined) claim.notes = str(b.notes);
    if (Array.isArray(b.receipts)) claim.receipts = b.receipts.filter((u: any) => typeof u === "string" && u).slice(0, 12);

    // Saved PDF
    if (b.pdfUrl !== undefined) {
      claim.pdfUrl = str(b.pdfUrl);
      claim.pdfPublicId = str(b.pdfPublicId);
      claim.pdfGeneratedAt = new Date();
    }

    // Amazon status
    if (b.status && (STATUSES as readonly string[]).includes(b.status) && b.status !== claim.status) {
      const from = claim.status;
      claim.status = b.status;
      if (b.status === "needs_submission") {
        claim.submittedDate = undefined; claim.decidedDate = undefined; claim.approvedAmount = undefined; claim.denialReason = "";
      }
      if (b.status === "submitted") {
        claim.submittedDate = ymd(b.submittedDate) || today();
        if (b.amazonReference !== undefined) claim.amazonReference = str(b.amazonReference);
        claim.decidedDate = undefined; claim.denialReason = "";
      }
      if (b.status === "approved") {
        claim.decidedDate = ymd(b.decidedDate) || today();
        claim.approvedAmount = b.approvedAmount !== undefined && b.approvedAmount !== "" ? num(b.approvedAmount) : claim.amount;
        claim.denialReason = "";
        if (b.amazonReference !== undefined && str(b.amazonReference)) claim.amazonReference = str(b.amazonReference);
      }
      if (b.status === "denied") {
        claim.decidedDate = ymd(b.decidedDate) || today();
        claim.denialReason = str(b.denialReason);
        claim.approvedAmount = undefined;
      }
      log(`Status: ${STATUS_LABEL[from]} → ${STATUS_LABEL[b.status]}${b.status === "denied" && str(b.denialReason) ? ` (${str(b.denialReason)})` : ""}`);
    } else if (b.status === claim.status) {
      // Same status, allow editing the status details
      if (b.amazonReference !== undefined) claim.amazonReference = str(b.amazonReference);
      if (claim.status === "submitted" && b.submittedDate) claim.submittedDate = ymd(b.submittedDate);
      if (claim.status === "approved" && b.approvedAmount !== undefined && b.approvedAmount !== "") claim.approvedAmount = num(b.approvedAmount);
      if (claim.status === "denied" && b.denialReason !== undefined) claim.denialReason = str(b.denialReason);
    }
    if (b.note && str(b.note)) log(`Note: ${str(b.note)}`);

    claim.updatedBy = session?.email || session?.name || "";
    await claim.save();
    return NextResponse.json({ claim });
  } catch (e: any) {
    console.error("[FUEL_CLAIMS_PUT]", e);
    return NextResponse.json({ error: e.message || "Failed to update claim" }, { status: 500 });
  }
}

// DELETE — remove a claim
export async function DELETE(req: NextRequest) {
  const g = await guard("delete");
  if ("response" in g) return g.response;
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const res = await FuelClaim.deleteOne({ _id: id, ...siteFilter(scope) });
    if (!res.deletedCount) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[FUEL_CLAIMS_DELETE]", e);
    return NextResponse.json({ error: "Failed to delete claim" }, { status: 500 });
  }
}
