import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import { enrichReimbursements } from "@/lib/reimbursement-utils";

type RouteParams = { params: Promise<{ id: string }> };

// Dedicated endpoint for the payment/payroll half of the reimbursement
// lifecycle — gated on the "pay" action (see lib/models/SymxAppRole.ts),
// deliberately separate from the general "edit" permission everyone with HR
// access has, since who reviews a request and who actually pays it out are
// meant to be different sets of people. See app/api/admin/reimbursements/
// [id]/route.ts for the review-stage (pending/approved/denied) transitions.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("HR", "pay");
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
    const action = body.action;

    const record = await SymxReimbursement.findById(id);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const byName = session.name || session.email || "Staff";
    const byEmail = session.email || "";
    const setDoc: Record<string, any> = {};
    let activityText = "";

    if (action === "mark_paid_direct") {
      if (record.status !== "approved") {
        return NextResponse.json({ error: "Only an approved request can be marked paid" }, { status: 400 });
      }
      setDoc.status = "paid";
      setDoc.paymentMethod = "direct";
      setDoc.paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
      setDoc.paidBy = byName;
      setDoc.paymentReference = body.paymentReference ? String(body.paymentReference).slice(0, 200) : "";
      const amount = typeof record.amount === "number" ? `$${record.amount.toFixed(2)}` : "";
      activityText = `Marked paid directly${amount ? ` — ${amount}` : ""}${setDoc.paymentReference ? ` (ref: ${setDoc.paymentReference})` : ""}`;
    } else if (action === "queue_payroll") {
      if (record.status !== "approved") {
        return NextResponse.json({ error: "Only an approved request can be queued for payroll" }, { status: 400 });
      }
      setDoc.status = "queued_for_payroll";
      setDoc.paymentMethod = "payroll";
      setDoc.payrollQueuedAt = new Date();
      setDoc.payrollQueuedBy = byName;
      setDoc.payrollBatchLabel = body.payrollBatchLabel ? String(body.payrollBatchLabel).slice(0, 200) : "";
      activityText = `Queued for payroll${setDoc.payrollBatchLabel ? ` — ${setDoc.payrollBatchLabel}` : ""}`;
    } else if (action === "confirm_payroll_paid") {
      if (record.status !== "queued_for_payroll") {
        return NextResponse.json({ error: "Only a request queued for payroll can be confirmed paid" }, { status: 400 });
      }
      setDoc.status = "paid";
      setDoc.paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
      setDoc.payrollConfirmedAt = new Date();
      setDoc.payrollConfirmedBy = byName;
      activityText = "Confirmed paid via payroll";
    } else if (action === "revert") {
      if (record.status !== "paid" && record.status !== "queued_for_payroll") {
        return NextResponse.json({ error: "Only a paid or payroll-queued request can be reverted" }, { status: 400 });
      }
      const fromStatus = record.status;
      setDoc.status = "approved";
      setDoc.paymentMethod = undefined;
      setDoc.paidDate = undefined;
      setDoc.paidBy = undefined;
      setDoc.paymentReference = undefined;
      setDoc.payrollQueuedAt = undefined;
      setDoc.payrollQueuedBy = undefined;
      setDoc.payrollBatchLabel = undefined;
      setDoc.payrollConfirmedAt = undefined;
      setDoc.payrollConfirmedBy = undefined;
      activityText = `Payment reverted (was ${fromStatus === "paid" ? "Paid" : "Queued for Payroll"}) — back to Approved`;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Fields explicitly set to undefined above (the "revert" path) need
    // $unset rather than $set, or Mongo will just skip them entirely and
    // leave the stale payment data in place.
    const unsetKeys = Object.keys(setDoc).filter((k) => setDoc[k] === undefined);
    const setKeys: Record<string, any> = {};
    for (const k of Object.keys(setDoc)) {
      if (setDoc[k] !== undefined) setKeys[k] = setDoc[k];
    }
    const update: Record<string, any> = {
      $push: { activity: { type: "payment", text: activityText, byName, byEmail, createdAt: new Date() } },
    };
    if (Object.keys(setKeys).length > 0) update.$set = setKeys;
    if (unsetKeys.length > 0) update.$unset = Object.fromEntries(unsetKeys.map((k) => [k, ""]));

    const updated = await SymxReimbursement.findByIdAndUpdate(id, update, { new: true }).lean();
    const [enriched] = await enrichReimbursements([updated]);
    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("[REIMBURSEMENT_PAY]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
