import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import WriteupSettings from "@/lib/models/WriteupSettings";
import DropdownOption from "@/lib/models/DropdownOption";

export async function GET() {
  try {
    await requirePermission("Write-Ups", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    let settings = await WriteupSettings.findOne().lean();
    if (!settings) {
      settings = (await WriteupSettings.create({})).toObject();
    }
    const categories = await DropdownOption.find({ type: "metric" }, { description: 1, isActive: 1, sortOrder: 1 })
      .sort({ sortOrder: 1, description: 1 })
      .lean();
    return NextResponse.json({ settings, categories });
  } catch (error: any) {
    console.error("Error fetching writeup settings:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requirePermission("Write-Ups", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    await connectToDatabase();
    const session = await getSession();

    const updates: any = { updatedBy: session?.email || "" };
    if (body.lookbackDays !== undefined) updates.lookbackDays = Number(body.lookbackDays);
    if (body.escalationThresholds !== undefined) updates.escalationThresholds = body.escalationThresholds;
    if (body.stackGroups !== undefined) updates.stackGroups = body.stackGroups;

    let settings = await WriteupSettings.findOne();
    if (!settings) {
      settings = await WriteupSettings.create(updates);
    } else {
      settings = await WriteupSettings.findByIdAndUpdate(settings._id, { $set: updates }, { new: true });
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("Error updating writeup settings:", error);
    return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
  }
}
