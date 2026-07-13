import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";

// POST /api/writeups/[id]/upload-signed — attach a photo/PDF of the
// printed-and-signed paper copy. Multiple uploads allowed (front + back).
// Upload the file first via /api/upload/cloudinary (module: "Write-Ups"),
// then call this with the resulting url.
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
    if (!body.url) {
      return NextResponse.json({ error: "File URL is required" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();

    const existing = await Writeup.findById(id);
    if (!existing) return NextResponse.json({ error: "Write-up not found" }, { status: 404 });
    if (existing.status !== "draft" && existing.status !== "uploaded_signed_copy") {
      return NextResponse.json({ error: "This write-up is already closed with a different outcome." }, { status: 400 });
    }

    const attachment = {
      name: body.name || "Signed copy",
      url: body.url,
      category: "Signed Upload",
      uploadedAt: new Date(),
      uploadedBy: session?.email || "",
    };

    const isEscalation = existing.warningLevel === "suspension_review";
    const status = isEscalation ? "escalated" : "uploaded_signed_copy";
    const now = new Date();

    const setFields: any = { status, closedAt: existing.closedAt || now };
    if (isEscalation && !existing.escalatedAt) setFields.escalatedAt = now;

    const writeup = await Writeup.findByIdAndUpdate(
      id,
      {
        $push: {
          attachments: attachment,
          events: { type: "uploaded_signed_copy", actorEmail: session?.email || "", occurredAt: now },
        },
        $set: setFields,
      },
      { new: true }
    );

    return NextResponse.json({ writeup });
  } catch (error: any) {
    console.error("Error uploading signed copy:", error);
    return NextResponse.json({ error: error.message || "Failed to upload signed copy" }, { status: 500 });
  }
}
