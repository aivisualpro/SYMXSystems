import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Compute the 7 dates (Sun–Sat) for a given yearWeek string like "2026-W09".
 * Our weeks run Sunday–Saturday.
 */
function getWeekDates(yearWeek: string): Date[] {
    const match = yearWeek.match(/(\d{4})-W(\d{2})/);
    if (!match) throw new Error("Invalid yearWeek format");

    const year = parseInt(match[1]);
    const week = parseInt(match[2]);

    // Jan 1 of that year
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay(); // 0=Sun

    // Sunday of week 1 = first Sunday on or before Jan 1
    // If Jan 1 is a Sunday, week 1 starts Jan 1
    // Otherwise week 1 starts the next Sunday after (week - 1) * 7 days
    const firstSunday = new Date(jan1);
    firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);

    // The target week's Sunday
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
 * Compute next yearWeek string: "2026-W08" → "2026-W09"
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
 * Body: { yearWeek: "2026-W09" } (optional — defaults to next week after latest)
 * 
 * Creates default "Off" schedule records for ALL active employees
 * for every day (Sun–Sat) of the specified week.
 * Skips if the week already has schedule data.
 */
export async function POST(req: NextRequest) {
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

        // Get all active employees with transporterId
        const employees = await SymxEmployee.find(
            { status: "Active", transporterId: { $exists: true, $ne: "" } },
            { _id: 1, transporterId: 1 }
        ).lean();

        if (employees.length === 0) {
            return NextResponse.json({ error: "No active employees found" }, { status: 400 });
        }

        // Compute the 7 dates for the week
        const dates = getWeekDates(yearWeek);

        // Build bulkWrite operations — $setOnInsert only creates if record doesn't exist
        const operations = (employees as any[]).flatMap((emp) =>
            dates.map((date, dayIdx) => ({
                updateOne: {
                    filter: { transporterId: emp.transporterId, date },
                    update: {
                        $setOnInsert: {
                            transporterId: emp.transporterId,
                            employeeId: emp._id,
                            weekDay: DAY_NAMES[dayIdx],
                            yearWeek,
                            date,
                            status: "Off",
                            type: "Off",
                            subType: "",
                            trainingDay: "",
                            startTime: "",
                            dayBeforeConfirmation: "",
                            dayOfConfirmation: "",
                            weekConfirmation: "",
                            van: "",
                            note: "",
                        },
                    },
                    upsert: true,
                },
            }))
        );

        const result = await SymxEmployeeSchedule.bulkWrite(operations, { ordered: false });

        // Register the week in available weeks
        await SymxAvailableWeek.updateOne(
            { week: yearWeek },
            { $set: { week: yearWeek } },
            { upsert: true }
        );

        const created = result.upsertedCount || 0;

        return NextResponse.json({
            success: true,
            yearWeek,
            created,
            employees: employees.length,
            days: 7,
            alreadyExists: created === 0,
        });
    } catch (error: any) {
        console.error("Generate schedule error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate schedule" },
            { status: 500 }
        );
    }
}
