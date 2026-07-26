import { NextRequest, NextResponse } from "next/server";
import { generateScheduleForWeek, getCurrentYearWeek, getNextYearWeek } from "@/lib/schedule-generation";
import { generateRoutesForWeek } from "@/lib/route-generation";

// Force Node runtime (mongoose needs Node, not Edge).
export const runtime = "nodejs";
// Give it room for a full company's worth of schedule + route upserts.
export const maxDuration = 120;
// Never cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/generate-next-week-routes
 *
 * Triggered by Vercel Cron (configured in vercel.json), Friday night
 * Pacific time. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * automatically — same pattern as /api/cron/backup.
 *
 * Solves "the team forgets to generate next week's routes": chains the
 * same two steps a person would do by hand —
 *   1. Backfill next week's schedule from each active employee's standing
 *      weekly pattern (only fills employees missing a record; anything a
 *      manager already edited is left alone).
 *   2. Generate route records from that schedule, including auto van
 *      assignment.
 * Both steps are safe to re-run — nothing is ever deleted, and manually
 * entered data (times, attendance, van/route info already filled in) is
 * never overwritten. If a manager changes the schedule after this runs,
 * they can still hit "Regenerate" in Dispatching to resync — this job
 * only covers the case where nobody does that at all.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const targetWeek = getNextYearWeek(getCurrentYearWeek());

  try {
    const scheduleResult = await generateScheduleForWeek(targetWeek);
    console.log(`[cron/generate-next-week-routes] Schedule for ${targetWeek}:`, scheduleResult);

    const routesResult = await generateRoutesForWeek(targetWeek, false);
    console.log(`[cron/generate-next-week-routes] Routes for ${targetWeek}:`, routesResult);

    return NextResponse.json({
      ok: true,
      yearWeek: targetWeek,
      schedule: scheduleResult,
      routes: routesResult,
    });
  } catch (err: any) {
    console.error("[cron/generate-next-week-routes] Failed:", err);
    return NextResponse.json(
      { ok: false, yearWeek: targetWeek, error: err.message || "Failed to generate next week's routes" },
      { status: 500 }
    );
  }
}
