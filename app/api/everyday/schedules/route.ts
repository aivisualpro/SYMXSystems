import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

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
            { 
                transporterId, 
                date: { $gte: startOfDay, $lte: endOfDay }
            },
            { dayBeforeConfirmation },
            { new: true }
        );

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

        if (!dateStr) {
            return NextResponse.json({ error: "Missing dateStr" }, { status: 400 });
        }

        const startOfDay = new Date(dateStr + "T00:00:00.000Z");
        const endOfDay = new Date(dateStr + "T23:59:59.999Z");

        const yearWeek = url.searchParams.get("yearWeek");

        const schedules = (await SymxEmployeeSchedule.find(
            { date: { $gte: startOfDay, $lte: endOfDay } },
            { transporterId: 1, dayBeforeConfirmation: 1 }
        ).lean()) as any[];

        let confirmedIds = new Set<string>();
        if (yearWeek) {
            // Read confirmation status from the schedule's futureShift array (single source of truth)
            const weekSchedules = await SymxEmployeeSchedule.find(
                { yearWeek, futureShift: { $exists: true, $ne: [] } },
                { transporterId: 1, futureShift: 1 }
            ).lean() as any[];
            weekSchedules.forEach((s: any) => {
                const entries: any[] = Array.isArray(s.futureShift) ? s.futureShift : [];
                if (entries.some((e: any) => e.status === "confirmed")) {
                    confirmedIds.add(s.transporterId);
                }
            });
        }

        const enrichedSchedules = schedules.map(s => {
            return {
                ...s,
                futureShiftConfirmed: confirmedIds.has(s.transporterId)
            };
        });

        return NextResponse.json({ schedules: enrichedSchedules });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
