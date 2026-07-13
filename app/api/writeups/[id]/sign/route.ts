import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";

// POST /api/writeups/[id]/sign
// In-person signing only (no DA login accounts exist in this app) — the
// manager captures their own signature, then hands the same device to the
// employee to sign right there. Body may include managerSignature and/or
// employeeSignature; a single call can carry both if they sign back to
// back, or two calls if the manager signs first and reviews with the
// employee before handing the device over.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Write-Ups", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();
    const session = await getSession();

    const existing = await Writeup.findById(id);
    if (!existing) return NextResponse.json({ error: "Write-up not found" }, { status: 404 });
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "This write-up is already closed." }, { status: 400 });
    }

    const update: any = { $push: { events: { type: "signed", actorEmail: session?.email || "", occurredAt: new Date() } } };
    const setFields: any = {};

    if (body.managerSignature?.signatureImage) {
      if (!body.managerSignature.name) {
        return NextResponse.json({ error: "Manager name is required to sign" }, { status: 400 });
      }
      setFields.managerSignature = {
        name: body.managerSignature.name,
        signatureImage: body.managerSignature.signatureImage,
        signedAt: new Date(),
      };
    }

    if (body.employeeSignature?.signatureImage) {
      if (!body.employeeSignature.name) {
        return NextResponse.json({ error: "Employee name is required to sign" }, { status: 400 });
      }
      if (!existing.managerSignature?.signatureImage && !setFields.managerSignature) {
        return NextResponse.json({ error: "Manager must sign before the employee signs" }, { status: 400 });
      }
      setFields.employeeSignature = {
        name: body.employeeSignature.name,
        signatureImage: body.employeeSignature.signatureImage,
        signedAt: new Date(),
      };
      // Both sides have now signed in person — the write-up is complete.
      setFields.status = existing.warningLevel === "suspension_review" ? "escalated" : "signed";
      setFields.closedAt = new Date();
    }

    if (Object.keys(setFields).length === 0) {
      return NextResponse.json({ error: "No signature provided" }, { status: 400 });
    }

    update.$set = setFields;
    const writeup = await Writeup.findByIdAndUpdate(id, update, { new: true });
    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error signing writeup:", error);
    return NextResponse.json({ error: error.message || "Failed to sign write-up" }, { status: 500 });
  }
}
