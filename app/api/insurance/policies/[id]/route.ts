import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import InsurancePolicy from "@/lib/models/InsurancePolicy";

const NUMERIC_FIELDS = [
  "lossRatio", "claimsIncurred", "claimsPaid", "premiumPaid",
  "totalClaims", "openClaims", "policyLimit",
];

// PUT /api/insurance/policies/[id] — update a policy. Admin-only.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Insurance", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    await connectToDatabase();

    const updates: any = {};
    if (body.policyNumber !== undefined) updates.policyNumber = String(body.policyNumber).trim();
    if (body.startDate !== undefined) updates.startDate = body.startDate ? new Date(body.startDate) : undefined;
    if (body.endDate !== undefined) updates.endDate = body.endDate ? new Date(body.endDate) : undefined;
    if (body.company !== undefined) updates.company = body.company;
    if (body.type !== undefined) updates.type = body.type;
    if (body.notes !== undefined) updates.notes = body.notes;

    for (const field of NUMERIC_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field] === "" ? undefined : Number(body[field]);
      }
    }

    // A new loss-run file upload refreshes the timestamp
    if (body.lossRunFile !== undefined) {
      updates.lossRunFile = body.lossRunFile;
      if (body.lossRunFile) updates.lossRunTimestamp = new Date();
    }

    const policy = await InsurancePolicy.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({ policy });
  } catch (error: any) {
    console.error("Error updating insurance policy:", error);
    return NextResponse.json({ error: error.message || "Failed to update policy" }, { status: 500 });
  }
}

// DELETE /api/insurance/policies/[id] — admin-only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Insurance", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectToDatabase();
    const deleted = await InsurancePolicy.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting insurance policy:", error);
    return NextResponse.json({ error: error.message || "Failed to delete policy" }, { status: 500 });
  }
}
