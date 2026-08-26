import { NextRequest, NextResponse } from "next/server";
import { generateScheduleForWeek, getCurrentYearWeek, getNextYearWeek } from "@/lib/schedule-generation";
import { generateRoutesForWeek } from "@/lib/route-generation";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";

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
    // ── Runs per station ──
    // This job is unauthenticated and has no station context of its own,
    // so it loops over the active stations rather than generating once.
    // Generating "for everything" would merge every station's roster into
    // a single week of routes belonging nowhere.
    //
    // Stations are read from the database, never hard-coded: opening a
    // fourth station must not require editing this file.
    await connectToDatabase();
    const stations = await Site.find({ status: "active" }, { _id: 1, code: 1 }).lean();

    // One station failing must not stop the others. A seasonal station
    // with no roster yet throws "No active employees found", and that
    // should not prevent the permanent stations getting their week.
    const results: Record<string, any> = {};
    for (const station of stations as any[]) {
      const code = station.code || String(station._id);
      try {
        const scheduleResult = await generateScheduleForWeek(targetWeek, String(station._id));
        const routesResult = await generateRoutesForWeek(targetWeek, String(station._id), false);
        results[code] = { ok: true, schedule: scheduleResult, routes: routesResult };
        console.log(`[cron/generate-next-week-routes] ${code} ${targetWeek}:`, routesResult);
      } catch (err: any) {
        results[code] = { ok: false, error: err?.message || "failed" };
        console.error(`[cron/generate-next-week-routes] ${code} failed:`, err?.message);
      }
    }

    const failed = Object.entries(results).filter(([, r]) => !r.ok).map(([c]) => c);

    return NextResponse.json({
      ok: failed.length === 0,
      yearWeek: targetWeek,
      stations: results,
      // Surfaced explicitly so a partial run doesn't read as a clean success.
      failedStations: failed,
    });
  } catch (err: any) {
    console.error("[cron/generate-next-week-routes] Failed:", err);
    return NextResponse.json(
      { ok: false, yearWeek: targetWeek, error: err.message || "Failed to generate next week's routes" },
      { status: 500 }
    );
  }
}
