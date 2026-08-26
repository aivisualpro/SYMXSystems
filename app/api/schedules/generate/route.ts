import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, resolveWriteSiteId } from "@/lib/scoped-query";
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
            // "Latest generated week" is per station — DXC8 may be a week
            // behind DFO2, and taking the global maximum would skip it.
            const weekScope = await getRequestScope();
            const latestWeek = await SymxAvailableWeek.findOne(
                siteFilter(weekScope, { includeUnassigned: true })
            ).sort({ week: -1 }).lean();
            if (!latestWeek) {
                return NextResponse.json({ error: "No existing weeks found" }, { status: 400 });
            }
            yearWeek = getNextYearWeek((latestWeek as any).week);
        }

        const genScope = await getRequestScope();
        const genSiteId = resolveWriteSiteId(genScope, null);
        if (!genSiteId) {
            return NextResponse.json(
                { error: "Select a single station before generating a schedule." },
                { status: 400 }
            );
        }
        const result = await generateScheduleForWeek(yearWeek, genSiteId, session.id);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Generate schedule error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate schedule" },
            { status: 500 }
        );
    }
}
