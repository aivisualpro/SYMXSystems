import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

/**
 * Lightweight polling endpoint for live message status updates.
 * Reads from shiftNotification/futureShift/routeItinerary arrays in
 * SYMXEmployeeSchedules (single source of truth).
 *
 * Accepts: messageType, transporterIds (comma-separated), yearWeek, scheduleDate
 * Returns: { statuses: { [transporterId]: { status, createdAt, changeRemarks? } } }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageType = searchParams.get("messageType") || "";
    const transporterIds = searchParams.get("transporterIds")?.split(",").filter(Boolean) || [];
    const yearWeek = searchParams.get("yearWeek") || "";
    const scheduleDate = searchParams.get("scheduleDate") || "";

    if (!messageType || transporterIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    await connectToDatabase();

    const scheduleField = TAB_TO_SCHEDULE_FIELD[messageType];
    if (!scheduleField) {
      return NextResponse.json({ statuses: {} });
    }

    // Query schedules directly by transporterId — no phone lookup needed
    const scheduleQuery: any = { transporterId: { $in: transporterIds } };
    if (scheduleDate) {
      const dayStart = new Date(scheduleDate + "T00:00:00.000Z");
      const dayEnd = new Date(scheduleDate + "T23:59:59.999Z");
      scheduleQuery.date = { $gte: dayStart, $lte: dayEnd };
    } else if (yearWeek) {
      scheduleQuery.yearWeek = yearWeek;
    }

    const schedules = await SymxEmployeeSchedule.find(
      scheduleQuery,
      { transporterId: 1, [scheduleField]: 1 }
    ).lean() as any[];

    // Build status map keyed by transporterId
    const statuses: Record<string, { status: string; createdAt: string; changeRemarks?: string }> = {};

    const statusPriority: Record<string, number> = {
      confirmed: 5, change_requested: 4, received: 3, delivered: 2, sent: 1, pending: 0,
    };

    schedules.forEach((sched: any) => {
      const entries: any[] = Array.isArray(sched[scheduleField]) ? sched[scheduleField] : [];
      if (entries.length === 0) return;

      let bestEntry = entries[entries.length - 1];
      let bestPriority = -1;
      for (const entry of entries) {
        const p = statusPriority[entry.status] ?? -1;
        if (p > bestPriority) {
          bestPriority = p;
          bestEntry = entry;
        }
      }

      statuses[sched.transporterId] = {
        status: bestEntry.status || "pending",
        createdAt: bestEntry.createdAt?.toISOString?.() || bestEntry.createdAt || new Date().toISOString(),
        ...(bestEntry.changeRemarks ? { changeRemarks: bestEntry.changeRemarks } : {}),
      };
    });

    return NextResponse.json({ statuses });
  } catch (error: any) {
    console.error("Live status poll error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
