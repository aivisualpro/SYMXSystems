import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";
import RouteType from "@/lib/models/RouteType";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_FIELDS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Compute the 7 dates (Sun–Sat) for a given yearWeek string like "2026-W09".
 */
function getWeekDates(yearWeek: string): Date[] {
    const match = yearWeek.match(/(\d{4})-W(\d{2})/);
    if (!match) throw new Error("Invalid yearWeek format");
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay();
    const firstSunday = new Date(jan1);
    firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
    const weekSunday = new Date(firstSunday);
    weekSunday.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekSunday);
        d.setUTCDate(weekSunday.getUTCDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * Compute next yearWeek: "2026-W08" → "2026-W09"
 */
function getNextYearWeek(yearWeek: string): string {
    const match = yearWeek.match(/(\d{4})-W(\d{2})/);
    if (!match) throw new Error("Invalid yearWeek format");
    let year = parseInt(match[1]);
    let week = parseInt(match[2]) + 1;
    if (week > 52) { year++; week = 1; }
    return `${year}-W${String(week).padStart(2, "0")}`;
}

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

        // Get ALL active employees including their day-of-week assignments
        const employees = await SymxEmployee.find(
            { status: "Active", transporterId: { $exists: true, $ne: "" } },
            { _id: 1, transporterId: 1, sunday: 1, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1 }
        ).lean();

        // Load all route types and build id→RouteType map
        const routeTypes = await RouteType.find().lean();
        const routeTypeMap = new Map<string, any>();
        for (const rt of routeTypes) {
            routeTypeMap.set(String(rt._id), rt);
        }

        if (employees.length === 0) {
            return NextResponse.json({ error: "No active employees found" }, { status: 400 });
        }

        // Get the 7 dates for this week
        const dates = getWeekDates(yearWeek);

        // Find which transporterIds already have records for this week
        const existingRecords = await SymxEmployeeSchedule.find(
            { yearWeek },
            { transporterId: 1 }
        ).lean();

        const existingTransporterIds = new Set(
            (existingRecords as any[]).map(r => r.transporterId)
        );

        // Only create operations for MISSING employees
        const missingEmployees = (employees as any[]).filter(
            emp => !existingTransporterIds.has(emp.transporterId)
        );

        const isNewWeek = existingRecords.length === 0;

        if (missingEmployees.length === 0) {
            // All employees already have records — nothing to do
            return NextResponse.json({
                success: true,
                yearWeek,
                created: 0,
                employees: employees.length,
                existingEmployees: existingTransporterIds.size,
                missingEmployees: 0,
                days: 7,
                isNewWeek: false,
                message: "All employees already have schedule records for this week",
            });
        }

        // Find fallback "Off" route type for employees with no day assignment
        const offRouteType = routeTypes.find((rt: any) => (rt.name || "").trim().toLowerCase() === "off");

        // Build insert operations only for missing employees
        const isValidObjectId = session.id && typeof session.id === 'string' && /^[a-f\d]{24}$/i.test(session.id);
        const userId = isValidObjectId ? new mongoose.Types.ObjectId(session.id) : undefined;
        const records = missingEmployees.flatMap((emp) =>
            dates.map((date, dayIdx) => {
                const dayField = DAY_FIELDS[dayIdx];
                const empDayId = (emp as any)[dayField] ? String((emp as any)[dayField]) : null;
                const matchedRoute = empDayId ? routeTypeMap.get(empDayId) : null;
                const resolvedTypeId = matchedRoute?._id ? String(matchedRoute._id) : (offRouteType?._id ? String(offRouteType._id) : undefined);

                return {
                    transporterId: emp.transporterId,
                    employeeId: emp._id,
                    weekDay: DAY_NAMES[dayIdx],
                    yearWeek,
                    date,
                    typeId: resolvedTypeId,
                    startTime: matchedRoute?.startTime || "",
                    dayBeforeConfirmation: "",
                    dayOfConfirmation: "",
                    weekConfirmation: "",
                    van: "",
                    ...(userId ? { createdBy: userId } : {}),
                };
            })
        );

        const dbSession = await mongoose.startSession();
        try {
            await dbSession.withTransaction(async () => {
                await SymxEmployeeSchedule.insertMany(records, { session: dbSession });

                // Register the week in available weeks
                await SymxAvailableWeek.updateOne(
                    { week: yearWeek },
                    { $set: { week: yearWeek } },
                    { upsert: true, session: dbSession }
                );
            });
        } finally {
            await dbSession.endSession();
        }

        return NextResponse.json({
            success: true,
            yearWeek,
            created: records.length,
            employees: employees.length,
            existingEmployees: existingTransporterIds.size,
            missingEmployees: missingEmployees.length,
            days: 7,
            isNewWeek,
        });
    } catch (error: any) {
        console.error("Generate schedule error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate schedule" },
            { status: 500 }
        );
    }
}
