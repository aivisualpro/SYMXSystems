import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SymxUser from "@/lib/models/SymxUser";

const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Resolve performer name from session, with DB fallback
async function resolvePerformerName(session: any): Promise<{ email: string; name: string }> {
    const email = session?.email || "unknown";
    const sessionName = session?.name || "";
    if (sessionName && sessionName.length > 1) {
        return { email, name: sessionName };
    }
    try {
        const user = await SymxUser.findOne({ email: email.toLowerCase() }, { name: 1 }).lean() as any;
        if (user?.name) {
            return { email, name: user.name };
        }
    } catch { }
    return { email, name: email };
}

// GET: Fetch routes for a yearWeek (with employee name enrichment + audit counts)
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const yearWeek = searchParams.get("yearWeek");
        const date = searchParams.get("date"); // optional: filter by specific date

        if (!yearWeek) {
            return NextResponse.json({ error: "yearWeek is required" }, { status: 400 });
        }

        await connectToDatabase();

        // Build query — exclude "Off" type records from all dispatching views
        const query: any = { yearWeek };
        if (date) query.date = new Date(date);
        query.type = { $not: { $regex: /^off$/i } };

        const routes = await SYMXRoute.find(query)
            .sort({ date: 1, transporterId: 1 })
            .lean();

        if (routes.length === 0) {
            return NextResponse.json({ routes: [], employees: {}, routesGenerated: false });
        }

        // Enrich with employee data
        const transporterIds = [...new Set(routes.map((r: any) => r.transporterId))];

        const [employees, routeCounts, auditCountsRaw] = await Promise.all([
            SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { transporterId: 1, firstName: 1, lastName: 1, phoneNumber: 1, type: 1 }
            ).lean(),
            // Count total routes per transporter (across all weeks) for "routesCompleted" virtual column
            SYMXRoute.aggregate([
                { $match: { transporterId: { $in: transporterIds }, type: { $ne: "" } } },
                { $group: { _id: "$transporterId", count: { $sum: 1 } } },
            ]),
            // Audit counts per employee for this week
            ScheduleAuditLog.aggregate([
                { $match: { yearWeek } },
                { $group: { _id: "$transporterId", count: { $sum: 1 } } },
            ]),
        ]);

        // Build employee map
        const employeeMap: Record<string, any> = {};
        employees.forEach((emp: any) => {
            employeeMap[emp.transporterId] = {
                name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
                firstName: emp.firstName,
                lastName: emp.lastName,
                phoneNumber: emp.phoneNumber || "",
                type: emp.type || "",
            };
        });

        // Build route count map
        const routeCountMap: Record<string, number> = {};
        routeCounts.forEach((rc: any) => { routeCountMap[rc._id] = rc.count; });

        // Build audit counts map
        const auditCounts: Record<string, number> = {};
        auditCountsRaw.forEach((c: any) => { auditCounts[c._id] = c.count; });

        return NextResponse.json({
            routes,
            employees: employeeMap,
            routeCounts: routeCountMap,
            auditCounts,
            routesGenerated: true,
        });
    } catch (error: any) {
        console.error("Error fetching routes:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch routes" }, { status: 500 });
    }
}

// POST: Generate route records for a yearWeek (from scheduled employees)
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { yearWeek } = body;

        if (!yearWeek) {
            return NextResponse.json({ error: "yearWeek is required" }, { status: 400 });
        }

        await connectToDatabase();

        // Check if routes already exist for this week
        const existingCount = await SYMXRoute.countDocuments({ yearWeek });
        if (existingCount > 0) {
            return NextResponse.json({
                message: "Routes already generated for this week",
                count: existingCount,
                created: 0,
            });
        }

        // Fetch all schedules for this week
        const schedules = await SymxEmployeeSchedule.find(
            { yearWeek },
            { _id: 1, transporterId: 1, date: 1, weekDay: 1, type: 1, subType: 1, trainingDay: 1, van: 1, status: 1 }
        ).lean();

        console.log(`[Generate Routes] Found ${schedules.length} schedule records for ${yearWeek}`);

        if (schedules.length === 0) {
            return NextResponse.json({ error: "No schedules found for this week" }, { status: 404 });
        }

        // Filter out "Off" and empty-type schedules — don't create route records for days off
        const workingSchedules = schedules.filter((s: any) => {
            const t = (s.type || "").trim().toLowerCase();
            return t !== "" && t !== "off";
        });

        console.log(`[Generate Routes] ${schedules.length} total schedules, ${workingSchedules.length} working (excluded Off/empty)`);

        if (workingSchedules.length === 0) {
            return NextResponse.json({
                message: "No working schedules found for this week (all entries are Off or empty)",
                count: 0,
                created: 0,
            });
        }

        // Create route records — one per working schedule entry
        // Use bulkWrite with upserts to handle the unique {transporterId, date} index gracefully
        const bulkOps = workingSchedules.map((s: any) => ({
            updateOne: {
                filter: { transporterId: s.transporterId, date: s.date },
                update: {
                    $set: {
                        scheduleId: s._id,
                        weekDay: s.weekDay,
                        yearWeek,
                        type: s.type || "",
                        subType: s.subType || "",
                        trainingDay: s.trainingDay || "",
                        van: s.van || "",
                    },
                },
                upsert: true,
            },
        }));

        const result = await SYMXRoute.bulkWrite(bulkOps, { ordered: false });
        const createdCount = result.upsertedCount + result.modifiedCount;

        console.log(`[Generate Routes] bulkWrite result: upserted=${result.upsertedCount}, matched=${result.matchedCount}, modified=${result.modifiedCount}, total=${createdCount}`);

        return NextResponse.json({
            message: `Generated ${createdCount} route records for ${yearWeek}`,
            count: createdCount,
            created: createdCount,
        });
    } catch (error: any) {
        console.error("Error generating routes:", error);
        return NextResponse.json({ error: error.message || "Failed to generate routes" }, { status: 500 });
    }
}

// PUT: Update a single route record (+ sync type back to schedule + audit log)
export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { routeId, updates } = body;

        if (!routeId || !updates) {
            return NextResponse.json({ error: "routeId and updates are required" }, { status: 400 });
        }

        await connectToDatabase();

        // Fetch existing route BEFORE updating (for audit old values)
        const existing = await SYMXRoute.findById(routeId).lean() as any;
        if (!existing) {
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        const updated = await SYMXRoute.findByIdAndUpdate(
            routeId,
            { $set: updates },
            { new: true, lean: true }
        ) as any;

        // If type was changed, sync it back to the schedule + create audit log
        if (updates.type !== undefined && existing.type !== updates.type) {
            const isWorking = !["off", ""].includes((updates.type || "").trim().toLowerCase());
            const scheduleUpdates: Record<string, any> = {
                type: updates.type,
                status: isWorking ? "Scheduled" : "Off",
            };
            if (updates.subType !== undefined) scheduleUpdates.subType = updates.subType;

            // Sync to schedule
            if (existing.scheduleId) {
                await SymxEmployeeSchedule.findByIdAndUpdate(
                    existing.scheduleId,
                    { $set: scheduleUpdates }
                );
            }

            // Resolve performer name and employee name
            const performer = await resolvePerformerName(session);

            // Look up employee name
            let employeeName = "";
            try {
                const emp = await SymxEmployee.findOne(
                    { transporterId: existing.transporterId },
                    { firstName: 1, lastName: 1 }
                ).lean() as any;
                if (emp) employeeName = `${emp.firstName} ${emp.lastName}`.toUpperCase();
            } catch { }

            // Get day info
            const dateObj = existing.date ? new Date(existing.date) : null;
            const dayName = dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "";

            // Create audit log
            await ScheduleAuditLog.create({
                yearWeek: existing.yearWeek || "",
                transporterId: existing.transporterId,
                employeeName,
                action: "type_changed",
                field: "type",
                oldValue: existing.type || "",
                newValue: updates.type || "",
                date: existing.date,
                dayOfWeek: dayName,
                performedBy: performer.email,
                performedByName: performer.name,
            });
        }

        return NextResponse.json({ route: updated });
    } catch (error: any) {
        console.error("Error updating route:", error);
        return NextResponse.json({ error: error.message || "Failed to update route" }, { status: 500 });
    }
}
