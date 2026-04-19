import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { z } from "zod";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";

import { processEmployees } from "@/lib/imports/employees";
import { processScorecard } from "@/lib/imports/scorecard";
import { processIncidents } from "@/lib/imports/incidents";
import { processFleet } from "@/lib/imports/fleet";
import { processInterviews } from "@/lib/imports/interviews";
import { processMisc } from "@/lib/imports/misc";

const ImportPayloadSchema = z.object({
  type: z.string().min(1),
  data: z.array(z.record(z.string(), z.unknown())).min(1),
  week: z.string().optional()
});

export async function POST(req: NextRequest) {
  try { await requirePermission("Admin", "edit"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawBody = await req.json();
    const parsed = ImportPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload format", details: parsed.error.format() }, { status: 400 });
    }

    const { type, data, week } = parsed.data;

    await connectToDatabase();
    if (week) {
        await SymxAvailableWeek.updateOne({ week }, { $set: { week } }, { upsert: true });
    }

    let response = await processEmployees(type, data, week);
    if (response) return response;

    response = await processScorecard(type, data, week);
    if (response) return response;

    response = await processIncidents(type, data, week);
    if (response) return response;

    response = await processFleet(type, data, week);
    if (response) return response;

    response = await processInterviews(type, data, week);
    if (response) return response;

    response = await processMisc(type, data, week);
    if (response) return response;

    return NextResponse.json({ error: `Invalid import type: ${type}` }, { status: 400 });
  } catch (error: any) {
    console.error("Imports API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process import" }, { status: 500 });
  }
}
