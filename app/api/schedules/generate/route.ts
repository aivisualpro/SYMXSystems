import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";
import { generateScheduleForWeek, getNextYearWeek } from "@/lib/schedule-generation";

/**
 * POST /api/schedules/generate
 * Body: { yearWeek: "2026-W09" }
 * 
 * Smart schedule generation:
 * - Creates default "Off" records for ALL active employees
 * - For existing weeks: only fills in MISSING employee records
 * - Idempotent: calling twice is safe, existing data is never touched
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();

        const body = await req.json();
        let { yearWeek } = body;

        if (!yearWeek) {
            const latestWeek = await SymxAvailableWeek.findOne().sort({ week: -1 }).lean();
            if (!latestWeek) {
                return NextResponse.json({ error: "No existing weeks found" }, { status: 400 });
            }
            yearWeek = getNextYearWeek((latestWeek as any).week);
        }

        const result = await generateScheduleForWeek(yearWeek, session.id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Generate schedule error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate schedule" },
            { status: 500 }
        );
    }
}
