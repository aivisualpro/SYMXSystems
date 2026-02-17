import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxScoreCardRemarks from "@/lib/models/SymxScoreCardRemarks";

// GET — Fetch remarks for a specific driver + week
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const transporterId = searchParams.get("transporterId");
  const week = searchParams.get("week");

  if (!transporterId || !week) {
    return NextResponse.json({ error: "Missing transporterId or week" }, { status: 400 });
  }

  await connectToDatabase();

  const remarks = await SymxScoreCardRemarks.findOne({ transporterId, week }).lean();
  return NextResponse.json({ remarks: remarks || null });
}

// PUT — Upsert remarks for a specific driver + week
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { transporterId, week, ...fields } = body;

  if (!transporterId || !week) {
    return NextResponse.json({ error: "Missing transporterId or week" }, { status: 400 });
  }

  await connectToDatabase();

  // Fetch existing record to detect changes
  const existing = await SymxScoreCardRemarks.findOne({ transporterId, week }).lean();
  const isNew = !existing;

  // Build update — only update fields that are provided
  const update: Record<string, any> = {};
  const changedFields: string[] = [];

  if (fields.driverRemarks !== undefined) {
    update.driverRemarks = fields.driverRemarks;
    if (!existing || existing.driverRemarks !== fields.driverRemarks) changedFields.push('driverRemarks');
  }
  if (fields.driverSignature !== undefined) {
    update.driverSignature = fields.driverSignature;
    update.driverSignatureTimestamp = fields.driverSignature ? new Date() : null;
    if (!existing || existing.driverSignature !== fields.driverSignature) changedFields.push('driverSignature');
  }
  if (fields.managerRemarks !== undefined) {
    update.managerRemarks = fields.managerRemarks;
    if (!existing || existing.managerRemarks !== fields.managerRemarks) changedFields.push('managerRemarks');
  }
  if (fields.managerSignature !== undefined) {
    update.managerSignature = fields.managerSignature;
    update.managerSignatureTimestamp = fields.managerSignature ? new Date() : null;
    if (!existing || existing.managerSignature !== fields.managerSignature) changedFields.push('managerSignature');
  }

  // Always set the manager info from session
  update.managerId = session.id;
  update.managerName = session.name || '';

  // Build history entry
  const historyEntry = {
    action: isNew ? 'created' : 'updated',
    changedFields: isNew ? ['driverRemarks', 'driverSignature', 'managerRemarks', 'managerSignature'] : changedFields,
    changedBy: {
      userId: session.id,
      name: session.name || 'Unknown',
    },
    changedAt: new Date(),
  };

  const result = await SymxScoreCardRemarks.findOneAndUpdate(
    { transporterId, week },
    {
      $set: update,
      $push: { history: historyEntry },
    },
    { upsert: true, new: true, lean: true }
  );

  return NextResponse.json({ remarks: result });
}
