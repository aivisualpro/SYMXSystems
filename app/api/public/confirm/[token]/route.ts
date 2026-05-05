import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import RouteType from "@/lib/models/RouteType";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

// All schedule array fields that can hold tokens
const TOKEN_FIELDS = ["shiftNotification", "futureShift", "routeItinerary"];

/**
 * Find a schedule by confirmation token stored in its messaging arrays.
 * Falls back to legacy SYMXScheduleConfirmations for old tokens.
 * Returns { schedule, field, entry, messageType } or null.
 */
async function findByToken(token: string) {
    // 1. Try new system: token stored directly in schedule arrays
    const schedule = await SymxEmployeeSchedule.findOne({
        $or: TOKEN_FIELDS.map(f => ({ [`${f}.token`]: token })),
    }).lean() as any;

    if (schedule) {
        for (const field of TOKEN_FIELDS) {
            const entries: any[] = schedule[field] || [];
            const entry = entries.find((e: any) => e.token === token);
            if (entry) {
                const fieldToTab: Record<string, string> = {
                    shiftNotification: "shift",
                    futureShift: "future-shift",
                    routeItinerary: "route-itinerary",
                };
                return { schedule, field, entry, messageType: fieldToTab[field] || "shift" };
            }
        }
    }

    // 2. Fallback: legacy ScheduleConfirmation collection (tokens created before refactor)
    let legacyDoc: any = null;
    try {
        legacyDoc = await ScheduleConfirmation.findOne({ token }).lean();
    } catch (err: any) {
        console.error("[findByToken] Legacy lookup error:", err.message);
    }
    if (!legacyDoc) return null;

    // Resolve the schedule from legacy doc's transporterId + scheduleDate
    const scheduleQuery: any = { transporterId: legacyDoc.transporterId };
    if (legacyDoc.scheduleDate) {
        // Use day-range to handle timezone/midnight edge cases
        const dayStart = new Date(legacyDoc.scheduleDate + "T00:00:00.000Z");
        const dayEnd = new Date(legacyDoc.scheduleDate + "T23:59:59.999Z");
        scheduleQuery.date = { $gte: dayStart, $lte: dayEnd };
    }
    const legacySchedule = await SymxEmployeeSchedule.findOne(scheduleQuery).sort({ date: -1 }).lean() as any;

    const fieldFromType = TAB_TO_SCHEDULE_FIELD[legacyDoc.messageType] || "shiftNotification";

    // Build a synthetic entry from the legacy doc
    const syntheticEntry = {
        token: legacyDoc.token,
        expiresAt: legacyDoc.expiresAt,
        status: legacyDoc.status || "pending",
        createdAt: legacyDoc.createdAt,
    };

    return {
        schedule: legacySchedule || { _id: null, transporterId: legacyDoc.transporterId, yearWeek: legacyDoc.yearWeek || "" },
        field: fieldFromType,
        entry: syntheticEntry,
        messageType: legacyDoc.messageType || "shift",
        legacyDoc,
    };
}

// GET — Load confirmation data (public, no auth)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        await connectToDatabase();
        const { token } = await params;

        const result = await findByToken(token);
        if (!result) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        const { schedule, field, entry, messageType } = result;

        // Check expiry
        if (entry.expiresAt && new Date() > new Date(entry.expiresAt)) {
            return NextResponse.json({ error: "This confirmation link has expired" }, { status: 410 });
        }

        // Get employee name
        const employee = await SymxEmployee.findOne(
            { transporterId: schedule.transporterId },
            { firstName: 1, lastName: 1 }
        ).lean() as any;
        const employeeName = employee
            ? `${employee.firstName} ${employee.lastName}`.toUpperCase()
            : schedule.transporterId;

        // Fetch schedule info for display
        let scheduleInfo: any = null;
        let weekSchedules: any[] = [];
        const scheduleDate = schedule.date
            ? new Date(schedule.date).toISOString().split("T")[0]
            : "";

        const isWeekSchedule = messageType === "week-schedule";

        if (isWeekSchedule && schedule.transporterId) {
            // Fetch all schedules for the week
            let schedules: any[] = [];
            if (schedule.yearWeek) {
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: schedule.transporterId,
                    yearWeek: schedule.yearWeek,
                }).sort({ date: 1 }).lean();
            }

            if (schedules.length === 0) {
                // Fallback: date range from this schedule
                const dayOfWeek = new Date(schedule.date).getUTCDay();
                const sunday = new Date(schedule.date);
                sunday.setUTCDate(sunday.getUTCDate() - dayOfWeek);
                sunday.setUTCHours(0, 0, 0, 0);
                const nextSunday = new Date(sunday);
                nextSunday.setUTCDate(sunday.getUTCDate() + 7);
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: schedule.transporterId,
                    date: { $gte: sunday, $lt: nextSunday },
                }).sort({ date: 1 }).lean();
            }

            // Resolve route types
            const allTypeIds = new Set<string>();
            schedules.forEach((s: any) => { if (s.typeId) allTypeIds.add(String(s.typeId)); });
            const routeTypes = allTypeIds.size > 0
                ? await RouteType.find({ _id: { $in: [...allTypeIds] } }, { _id: 1, name: 1 }).lean() as any[]
                : [];
            const rtMap = new Map<string, string>();
            routeTypes.forEach((rt: any) => rtMap.set(String(rt._id), rt.name || ""));
            const resolveType = (s: any) => s?.typeId ? (rtMap.get(String(s.typeId)) || s.type || "OFF") : (s.type || "OFF");

            weekSchedules = schedules.map((s: any) => ({
                date: s.date,
                weekDay: s.weekDay || "",
                type: resolveType(s),
                startTime: s.startTime || "",
                van: s.van || "",
            }));

            if (schedules.length > 0) {
                scheduleInfo = {
                    date: schedules[0].date,
                    weekDay: schedules[0].weekDay,
                    type: resolveType(schedules[0]),
                    startTime: schedules[0].startTime,
                    van: schedules[0].van,
                };
            }
        } else {
            // Resolve type for single schedule
            let typeName = schedule.type || "OFF";
            if (schedule.typeId) {
                const rt = await RouteType.findById(schedule.typeId, { name: 1 }).lean() as any;
                if (rt?.name) typeName = rt.name;
            }

            scheduleInfo = {
                date: schedule.date,
                weekDay: schedule.weekDay,
                type: typeName,
                startTime: schedule.startTime,
                van: schedule.van,
            };
        }

        // Get message content from the sent entry
        const messageContent = entry.content || null;

        // Derive current confirmation status from the schedule's messaging array
        const entries: any[] = schedule[field] || [];
        let currentStatus = "pending";
        let confirmedAt: any = undefined;
        let changeRequestedAt: any = undefined;
        let changeRemarks: any = undefined;

        if (entries.length > 0) {
            const statusPriority: Record<string, number> = {
                confirmed: 5, change_requested: 4, received: 3, delivered: 2, sent: 1, pending: 0,
            };
            let bestEntry = entries[entries.length - 1];
            let bestPriority = -1;
            for (const e of entries) {
                const p = statusPriority[e.status] ?? -1;
                if (p > bestPriority) { bestPriority = p; bestEntry = e; }
            }
            currentStatus = bestEntry.status || "pending";
            if (bestEntry.status === "confirmed") confirmedAt = bestEntry.createdAt;
            if (bestEntry.status === "change_requested") {
                changeRequestedAt = bestEntry.createdAt;
                changeRemarks = bestEntry.changeRemarks || "";
            }
        }

        return NextResponse.json({
            token,
            employeeName,
            status: currentStatus,
            yearWeek: schedule.yearWeek || "",
            messageType,
            scheduleDate,
            confirmedAt,
            changeRequestedAt,
            changeRemarks,
            schedule: scheduleInfo,
            weekSchedules,
            messageContent,
        });
    } catch (error: any) {
        console.error("Confirm GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST — Submit confirmation or change request (public, no auth)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        await connectToDatabase();
        const { token } = await params;
        const body = await req.json();
        const { action, remarks } = body; // action: "confirm" | "change_request"

        const result = await findByToken(token);
        if (!result) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        const { schedule, field, entry } = result;

        // Check expiry
        if (entry.expiresAt && new Date() > new Date(entry.expiresAt)) {
            return NextResponse.json({ error: "This confirmation link has expired" }, { status: 410 });
        }

        if (action === "confirm") {
            // Update the schedule entry status
            await SymxEmployeeSchedule.updateOne(
                { _id: schedule._id },
                { $set: { status: "Confirmed" } }
            );

            // Push "confirmed" into the schedule's messaging array (single source of truth)
            await SymxEmployeeSchedule.updateOne(
                { _id: schedule._id },
                {
                    $push: {
                        [field]: {
                            status: "confirmed",
                            createdAt: new Date(),
                            createdBy: "employee",
                        },
                    },
                }
            );

            return NextResponse.json({ success: true, status: "confirmed" });

        } else if (action === "change_request") {
            // Update schedule entry status
            await SymxEmployeeSchedule.updateOne(
                { _id: schedule._id },
                { $set: { status: "Change Requested" } }
            );

            // Push "change_requested" into the schedule's messaging array (single source of truth)
            await SymxEmployeeSchedule.updateOne(
                { _id: schedule._id },
                {
                    $push: {
                        [field]: {
                            status: "change_requested",
                            createdAt: new Date(),
                            createdBy: "employee",
                            changeRemarks: remarks || "",
                        },
                    },
                }
            );

            return NextResponse.json({ success: true, status: "change_requested" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("Confirm POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
