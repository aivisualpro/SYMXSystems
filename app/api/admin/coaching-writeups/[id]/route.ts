import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SYMXCoachingWriteUp from "@/lib/models/SYMXCoachingWriteUp";

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
    const updated = await SYMXCoachingWriteUp.findByIdAndUpdate(id, { $set: body }, { new: true });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
