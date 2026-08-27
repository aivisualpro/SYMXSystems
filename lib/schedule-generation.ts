import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";
import RouteType, { routeTypeStartTime } from "@/lib/models/RouteType";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_FIELDS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Compute the 7 dates (Sun–Sat) for a given yearWeek string like "2026-W09".
 */
export function getWeekDates(yearWeek: string): Date[] {
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

/** Business timezone — all "today" checks use Pacific Time. */
const BUSINESS_TZ = "America/Los_Angeles";

/** Today's date (Pacific Time) as "YYYY-MM-DD". */
function getTodayPacific(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/** Compute the current yearWeek (Sun-based) from today's date in Pacific Time. */
export function getCurrentYearWeek(): string {
    const todayStr = getTodayPacific();
    const date = new Date(todayStr + "T00:00:00.000Z");
    const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat
    const sundayOfThisWeek = new Date(date);
    sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
    const year = sundayOfThisWeek.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay();
    const firstSunday = new Date(jan1);
    firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
    const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

/**
 * Compute next yearWeek: "2026-W08" → "2026-W09"
 */
export function getNextYearWeek(yearWeek: string): string {
    const match = yearWeek.match(/(\d{4})-W(\d{2})/);
    if (!match) throw new Error("Invalid yearWeek format");
    let year = parseInt(match[1]);
    let week = parseInt(match[2]) + 1;
    if (week > 52) { year++; week = 1; }
    return `${year}-W${String(week).padStart(2, "0")}`;
}

export interface GenerateScheduleResult {
    success: true;
    yearWeek: string;
    created: number;
    employees: number;
    existingEmployees: number;
    missingEmployees: number;
    days: number;
    isNewWeek: boolean;
    message?: string;
}

/**
 * Smart schedule generation, shared by the authenticated Scheduling-page
 * route and the Friday-night cron job.
 * - Creates default schedule records (from each employee's standing
 *   day-of-week pattern) for ALL active employees.
 * - For existing weeks: only fills in MISSING employee records — anything
 *   a manager already edited is left untouched.
 * - Idempotent: calling twice is safe.
 */
/**
 * Generate a week's schedule for ONE station.
 *
 * siteId is required, not optional. This is called from a request handler
 * and from an unauthenticated cron job; optional would let the cron path
 * build one combined schedule from every station's roster.
 */
export async function generateScheduleForWeek(
    yearWeek: string,
    siteId: string,
    userId?: string
): Promise<GenerateScheduleResult> {
    if (!siteId) throw new Error("generateScheduleForWeek requires a siteId");
    await connectToDatabase();
    const S = { siteId };

    // Employees are rostered at their PRIMARY station. Someone loaned to
    // another station for a day still belongs to their home roster, so the
    // week is built from the people based here.
    const employees = await SymxEmployee.find(
        { status: "Active", transporterId: { $exists: true, $ne: "" }, primarySiteId: siteId },
        { _id: 1, transporterId: 1, sunday: 1, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1 }
    ).lean();

    const routeTypes = await RouteType.find({}).lean();
    const routeTypeMap = new Map<string, any>();
    for (const rt of routeTypes) {
        routeTypeMap.set(String(rt._id), rt);
    }

    if (employees.length === 0) {
        throw new Error("No active employees found");
    }

    const dates = getWeekDates(yearWeek);

    const existingRecords = await SymxEmployeeSchedule.find(
        { yearWeek, ...S },
        { transporterId: 1 }
    ).lean();

    const existingTransporterIds = new Set(
        (existingRecords as any[]).map(r => r.transporterId)
    );

    const missingEmployees = (employees as any[]).filter(
        emp => !existingTransporterIds.has(emp.transporterId)
    );

    const isNewWeek = existingRecords.length === 0;

    if (missingEmployees.length === 0) {
        return {
            success: true,
            yearWeek,
            created: 0,
            employees: employees.length,
            existingEmployees: existingTransporterIds.size,
            missingEmployees: 0,
            days: 7,
            isNewWeek: false,
            message: "All employees already have schedule records for this week",
        };
    }

    const offRouteType = routeTypes.find((rt: any) => (rt.name || "").trim().toLowerCase() === "off");

    const isValidObjectId = userId && typeof userId === "string" && /^[a-f\d]{24}$/i.test(userId);
    const userObjectId = isValidObjectId ? new mongoose.Types.ObjectId(userId) : undefined;
    const records = missingEmployees.flatMap((emp) =>
        dates.map((date, dayIdx) => {
            const dayField = DAY_FIELDS[dayIdx];
            const empDayId = (emp as any)[dayField] ? String((emp as any)[dayField]) : null;
            const matchedRoute = empDayId ? routeTypeMap.get(empDayId) : null;
            const resolvedTypeId = matchedRoute?._id ? String(matchedRoute._id) : (offRouteType?._id ? String(offRouteType._id) : undefined);

            return {
                transporterId: emp.transporterId,
                siteId,
                employeeId: emp._id,
                weekDay: DAY_NAMES[dayIdx],
                yearWeek,
                date,
                typeId: resolvedTypeId,
                // The station's own start time for this shared route type —
                // the same type runs at different hours per station.
                startTime: routeTypeStartTime(matchedRoute, siteId),
                dayBeforeConfirmation: "",
                dayOfConfirmation: "",
                weekConfirmation: "",
                van: "",
                ...(userObjectId ? { createdBy: userObjectId } : {}),
            };
        })
    );

    const dbSession = await mongoose.startSession();
    try {
        await dbSession.withTransaction(async () => {
            await SymxEmployeeSchedule.insertMany(records, { session: dbSession });
            await SymxAvailableWeek.updateOne(
                { week: yearWeek, ...S },
                { $set: { week: yearWeek, siteId } },
                { upsert: true, session: dbSession }
            );
        });
    } finally {
        await dbSession.endSession();
    }

    return {
        success: true,
        yearWeek,
        created: records.length,
        employees: employees.length,
        existingEmployees: existingTransporterIds.size,
        missingEmployees: missingEmployees.length,
        days: 7,
        isNewWeek,
    };
}
