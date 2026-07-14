import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import WriteupSettings, { DEFAULT_CORRECTIVE_ACTION_TEMPLATES } from "@/lib/models/WriteupSettings";
import DropdownOption from "@/lib/models/DropdownOption";

// Single-document collection by convention, but nothing enforces that at
// the DB level — sort deterministically so GET/PUT always agree on which
// document is "the" one, even if stray duplicates exist from before this
// was added (see scripts/dedupe-writeup-settings.mjs for a one-time
// cleanup of any that already exist).
async function getCanonicalSettings() {
  let settings = await WriteupSettings.findOne().sort({ _id: 1 });
  if (!settings) {
    settings = await WriteupSettings.create({});
  }
  return settings;
}

export async function GET() {
  try {
    await requirePermission("Write-Ups", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const settings = (await getCanonicalSettings()).toObject();
    const categories = await DropdownOption.find({ type: "metric" }, { description: 1, isActive: 1, sortOrder: 1 })
      .sort({ sortOrder: 1, description: 1 })
      .lean();
    return NextResponse.json({ settings, categories, defaultTemplates: DEFAULT_CORRECTIVE_ACTION_TEMPLATES });
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
    // TEMP DIAGNOSTIC — remove once the corrective-action-templates
    // not-saving bug is confirmed fixed.
    console.log("[writeup-settings PUT] incoming body:", JSON.stringify(body, null, 2));

    await connectToDatabase();
    const session = await getSession();

    const updates: any = { updatedBy: session?.email || "" };
    if (body.lookbackDays !== undefined) updates.lookbackDays = Number(body.lookbackDays);
    if (body.escalationThresholds !== undefined) updates.escalationThresholds = body.escalationThresholds;
    if (body.stackGroups !== undefined) updates.stackGroups = body.stackGroups;
    if (body.correctiveActionTemplates !== undefined) updates.correctiveActionTemplates = body.correctiveActionTemplates;
    if (body.defaultConsequences !== undefined) updates.defaultConsequences = body.defaultConsequences;

    console.log("[writeup-settings PUT] computed updates:", JSON.stringify(updates, null, 2));

    const existing = await getCanonicalSettings();
    console.log("[writeup-settings PUT] existing doc id:", String(existing._id), "existing templates:", JSON.stringify(existing.correctiveActionTemplates));
    console.log("[writeup-settings PUT] schema has correctiveActionTemplates path:", !!existing.schema.paths["correctiveActionTemplates"]);
    console.log("[writeup-settings PUT] existing.toObject():", JSON.stringify(existing.toObject()));
    console.log("[writeup-settings PUT] collection name:", existing.collection.collectionName, "db name:", existing.db?.name);

    const settings = await WriteupSettings.findByIdAndUpdate(existing._id, { $set: updates }, { new: true });
    console.log("[writeup-settings PUT] saved doc templates:", JSON.stringify(settings?.correctiveActionTemplates));

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("Error updating writeup settings:", error);
    return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
  }
}
