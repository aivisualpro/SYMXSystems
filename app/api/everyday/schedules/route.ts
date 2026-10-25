import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, resolveWriteSiteId } from "@/lib/scoped-query";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import { entriesInWindow, messageWindowForTab } from "@/lib/messaging-constants";

export async function PUT(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        await connectToDatabase();

        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);
        const { transporterId, dateStr, dayBeforeConfirmation } = await req.json();

        if (!transporterId || !dateStr) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // We assume dateStr is YYYY-MM-DD
        const startOfDay = new Date(dateStr + "T00:00:00.000Z");
        const endOfDay = new Date(dateStr + "T23:59:59.999Z");

        // The exact date might be slightly shifted based on timezone during creation,
        // so query the entire day in UTC
        const record = await SymxEmployeeSchedule.findOneAndUpdate(
            { ...S, 
                transporterId, 
                date: { $gte: startOfDay, $lte: endOfDay },
                ...S
            },
            { $set: { dayBeforeConfirmation } },
            { new: true }
        );

        if (!record) {
            return NextResponse.json(
                { error: "No schedule record found for this employee on this date" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, record });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        await connectToDatabase();
        const url = new URL(req.url);
        const dateStr = url.searchParams.get("dateStr");
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });

        if (!dateStr) {
            return NextResponse.json({ error: "Missing dateStr" }, { status: 400 });
        }

        const startOfDay = new Date(dateStr + "T00:00:00.000Z");
        const endOfDay = new Date(dateStr + "T23:59:59.999Z");

        const yearWeek = url.searchParams.get("yearWeek");

        const schedules = (await SymxEmployeeSchedule.find(
            { date: { $gte: startOfDay, $lte: endOfDay }, ...S },
            { transporterId: 1, dayBeforeConfirmation: 1 }
        ).lean()) as any[];

        // "Tomorrow's shift" (future-shift / off-tomorrow) messages are recorded on the
        // schedule row of the day they were SENT (shift day minus 1) — see
        // /api/messaging/send. So a confirmation for shift day D lives on the row
        // dated D-1, and only on that row. (This used to scan the whole week, which
        // marked a driver confirmed for a day whose message was never sent just
        // because they had confirmed a different day's message that week.)
        const prev = new Date(dateStr + "T12:00:00.000Z");
        prev.setUTCDate(prev.getUTCDate() - 1);
        const prevStr = prev.toISOString().split("T")[0];
        const confirmedIds = new Set<string>();
        const sentIds = new Set<string>();
        const prevDocs = await SymxEmployeeSchedule.find(
            {
                date: { $gte: new Date(prevStr + "T00:00:00.000Z"), $lte: new Date(prevStr + "T23:59:59.999Z") },
                futureShift: { $exists: true, $ne: [] },
                ...S,
            },
            { transporterId: 1, futureShift: 1 }
        ).lean() as any[];
        prevDocs.forEach((d: any) => {
            const [wFrom, wTo] = messageWindowForTab("future-shift", prevStr);
            const entries: any[] = entriesInWindow(Array.isArray(d.futureShift) ? d.futureShift : [], wFrom, wTo);
            if (entries.length) sentIds.add(d.transporterId);
            if (entries.some((e: any) => e.status === "confirmed")) confirmedIds.add(d.transporterId);
        });

        const enrichedSchedules = schedules.map(s => {
            return {
                ...s,
                futureShiftConfirmed: confirmedIds.has(s.transporterId),
                futureShiftSent: sentIds.has(s.transporterId)
            };
        });

        return NextResponse.json({ schedules: enrichedSchedules });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
