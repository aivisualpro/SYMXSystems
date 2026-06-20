import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SYMXCoachingWriteUp from "@/lib/models/SYMXCoachingWriteUp";
import { generateCoachingPdf } from "@/lib/googleDocs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const record = await SYMXCoachingWriteUp.findById(id).lean();
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();
    // Remove unSignedPdf from the incoming body — we $unset it separately so the
    // background PDF generation can write a fresh URL. MongoDB disallows the same
    // field in both $set and $unset simultaneously (ConflictingUpdateOperators).
    delete body.unSignedPdf;
    // Strip enrichment / read-only fields that the frontend may accidentally include
    delete body._id;
    delete body.__v;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.employeeName;
    delete body.supervisorName;
    delete body.metricName;
    delete body.metricIcon;
    delete body.metricColor;
    // Don't overwrite signedPdf with empty string
    if (!body.signedPdf) delete body.signedPdf;

    const updated = await SYMXCoachingWriteUp.findByIdAndUpdate(
      id,
      { $set: body, $unset: { unSignedPdf: 1 } },
      { new: true }
    );
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Regenerate PDF from Google Doc template (fire-and-forget — don't block the response)
    generateCoachingPdf(id).catch((pdfErr) =>
      console.error("PDF regeneration failed:", pdfErr)
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("CoachingWriteUps PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await SYMXCoachingWriteUp.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("CoachingWriteUps DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
