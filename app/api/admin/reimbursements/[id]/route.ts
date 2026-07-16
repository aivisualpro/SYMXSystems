import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxReimbursement, { ReimbursementStatus } from "@/lib/models/SymxReimbursement";
import { enrichReimbursements } from "@/lib/reimbursement-utils";

type RouteParams = { params: Promise<{ id: string }> };

// Only review-stage transitions go through this general edit route. The
// payment-lifecycle transitions ("paid" / "queued_for_payroll") are gated
// behind a separate "pay" permission and only ever set by
// app/api/admin/reimbursements/[id]/pay/route.ts — allowing them here would
// let anyone with plain HR-edit access bypass that gate.
const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "Reopened for review",
  approved: "Approved",
  denied: "Denied",
};

export async function GET(req: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const record = await SymxReimbursement.findById(id).lean();
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [enriched] = await enrichReimbursements([record]);
    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("[REIMBURSEMENT_GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    await connectToDatabase();
    const body = await req.json();

    const { status, activityNote, activityType, denyReason, items, ...rest } = body;

    const setDoc: Record<string, any> = { ...rest };
    const pushEntries: any[] = [];
    const byName: string = session.name || session.email || "Staff";
    const byEmail: string = session.email || "";

    // Recompute amount whenever items are edited — findByIdAndUpdate below
    // does not run the model's pre("save") hook, so this can't be left to
    // the schema to keep in sync the way create() can.
    if (Array.isArray(items)) {
      const cleanItems = items
        .map((it: any) => ({
          description: String(it.description || "").slice(0, 500),
          category: it.category ? String(it.category).slice(0, 100) : undefined,
          amount: typeof it.amount === "string" ? parseFloat(it.amount) : Number(it.amount) || 0,
        }))
        .filter((it: any) => it.description && it.amount > 0);
      if (cleanItems.length === 0) {
        return NextResponse.json({ error: "At least one itemized line with a description and amount is required" }, { status: 400 });
      }
      setDoc.items = cleanItems;
      setDoc.amount = cleanItems.reduce((sum: number, it: any) => sum + it.amount, 0);
      setDoc.category = cleanItems[0]?.category;
    }

    if (status && REVIEW_STATUS_LABEL[status]) {
      setDoc.status = status as ReimbursementStatus;
      if (status === "denied") {
        setDoc.denyReason = denyReason ? String(denyReason).slice(0, 1000) : "";
      } else {
        setDoc.denyReason = "";
      }
      if (status === "approved" || status === "denied") {
        setDoc.reviewedBy = byName;
        setDoc.reviewedAt = new Date();
      }
      const reasonSuffix = status === "denied" && denyReason ? ` — ${denyReason}` : "";
      pushEntries.push({
        type: "status_change",
        text: `${REVIEW_STATUS_LABEL[status]}${reasonSuffix}`,
        byName,
        byEmail,
        createdAt: new Date(),
      });
    }

    // Employee link/unlink — surfaced as a system activity line so the case
    // history shows when/why a request's employee association changed.
    if (Object.prototype.hasOwnProperty.call(rest, "employeeId")) {
      setDoc.employeeMatchType = rest.employeeId ? "manual" : undefined;
      if (rest.employeeId) setDoc.suggestedEmployeeId = undefined;
      pushEntries.push({
        type: "system",
        text: rest.employeeId ? "Linked to employee record" : "Unlinked from employee record",
        byName,
        byEmail,
        createdAt: new Date(),
      });
    }

    if (typeof activityNote === "string" && activityNote.trim()) {
      pushEntries.push({
        type: activityType === "system" ? "system" : "note",
        text: activityNote.trim(),
        byName,
        byEmail,
        createdAt: new Date(),
      });
    }

    const update: Record<string, any> = {};
    if (Object.keys(setDoc).length > 0) update.$set = setDoc;
    if (pushEntries.length > 0) update.$push = { activity: { $each: pushEntries } };

    const updated = Object.keys(update).length > 0
      ? await SymxReimbursement.findByIdAndUpdate(id, update, { new: true }).lean()
      : await SymxReimbursement.findById(id).lean();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [enriched] = await enrichReimbursements([updated]);
    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("[REIMBURSEMENT_PUT]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("HR", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await SymxReimbursement.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[REIMBURSEMENT_DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
