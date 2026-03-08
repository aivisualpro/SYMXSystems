import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import MessageLog from "@/lib/models/MessageLog";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

// GET — Load confirmation data (public, no auth)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        await connectToDatabase();
        const { token } = await params;

        const confirmation = await ScheduleConfirmation.findOne({ token }).lean();
        if (!confirmation) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        // Check expiry
        if (new Date() > new Date(confirmation.expiresAt)) {
            return NextResponse.json({ error: "This confirmation link has expired" }, { status: 410 });
        }

        // Fetch schedule info for display
        let scheduleInfo: any = null;
        let weekSchedules: any[] = [];

        const isWeekSchedule = confirmation.messageType === "week-schedule";

        if (isWeekSchedule && confirmation.transporterId) {
            let schedules: any[] = [];

            // Strategy 1: Find by yearWeek
            if (confirmation.yearWeek) {
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: confirmation.transporterId,
                    yearWeek: confirmation.yearWeek,
                }).sort({ date: 1 }).lean();
                console.log(`[Confirm] Strategy 1 (yearWeek=${confirmation.yearWeek}): found ${schedules.length} schedules`);
            }

            // Strategy 2: If yearWeek didn't match, find by scheduleDate's week range
            if (schedules.length === 0 && confirmation.scheduleDate) {
                const baseDate = new Date(confirmation.scheduleDate);
                // Get the Sunday of that week
                const dayOfWeek = baseDate.getUTCDay();
                const sunday = new Date(baseDate);
                sunday.setUTCDate(baseDate.getUTCDate() - dayOfWeek);
                sunday.setUTCHours(0, 0, 0, 0);
                const saturday = new Date(sunday);
                saturday.setUTCDate(sunday.getUTCDate() + 7);
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: confirmation.transporterId,
                    date: { $gte: sunday, $lt: saturday },
                }).sort({ date: 1 }).lean();
                console.log(`[Confirm] Strategy 2 (date range ${sunday.toISOString()} - ${saturday.toISOString()}): found ${schedules.length} schedules`);
            }

            // Strategy 3: If still nothing, get most recent 7 schedules for this employee
            if (schedules.length === 0) {
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: confirmation.transporterId,
                }).sort({ date: -1 }).limit(7).lean();
                schedules.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                console.log(`[Confirm] Strategy 3 (latest 7): found ${schedules.length} schedules`);
            }

            weekSchedules = schedules.map((s: any) => ({
                date: s.date,
                weekDay: s.weekDay || "",
                type: s.type || "OFF",
                startTime: s.startTime || "",
                van: s.van || "",
            }));

            if (schedules.length > 0) {
                scheduleInfo = {
                    date: schedules[0].date,
                    weekDay: schedules[0].weekDay,
                    type: schedules[0].type,
                    startTime: schedules[0].startTime,
                    van: schedules[0].van,
                };
            }
        } else if (confirmation.scheduleDate && confirmation.transporterId) {
            const schedule = await SymxEmployeeSchedule.findOne({
                transporterId: confirmation.transporterId,
                date: new Date(confirmation.scheduleDate),
            }).lean();
            if (schedule) {
                scheduleInfo = {
                    date: schedule.date,
                    weekDay: schedule.weekDay,
                    type: schedule.type,
                    startTime: schedule.startTime,
                    van: schedule.van,
                };
            }
        }

        // Fetch the original sent message from MessageLog
        let messageContent: string | null = null;
        if (confirmation.messageLogId) {
            const log = await MessageLog.findById(confirmation.messageLogId, { content: 1 }).lean();
            if (log) messageContent = (log as any).content || null;
        }

        return NextResponse.json({
            token: confirmation.token,
            employeeName: confirmation.employeeName,
            status: confirmation.status,
            yearWeek: confirmation.yearWeek,
            messageType: confirmation.messageType,
            scheduleDate: confirmation.scheduleDate,
            confirmedAt: confirmation.confirmedAt,
            changeRequestedAt: confirmation.changeRequestedAt,
            changeRemarks: confirmation.changeRemarks,
            schedule: scheduleInfo,
            weekSchedules,
            messageContent,
        });
    } catch (error: any) {
        console.error("Confirm GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// Helper: update the messaging status array in the schedule document
async function updateScheduleMessagingStatus(
    transporterId: string,
    scheduleDate: string,
    messageType: string,
    newStatus: string,
    replyContent: string,
    yearWeek?: string
) {
    const field = TAB_TO_SCHEDULE_FIELD[messageType];
    if (!field || !transporterId) return;

    try {
        let schedule;

        if (scheduleDate) {
            // Look up by specific date
            schedule = await SymxEmployeeSchedule.findOne({
                transporterId,
                date: new Date(scheduleDate),
            });
        }

        // Fallback: for week-level messages (no date), find any schedule in the yearWeek
        if (!schedule && yearWeek) {
            schedule = await SymxEmployeeSchedule.findOne({
                transporterId,
                yearWeek,
            });
        }

        if (!schedule) return;

        const entries = (schedule as any)[field];
        if (Array.isArray(entries) && entries.length > 0) {
            // Update the last entry's status
            entries[entries.length - 1].status = newStatus;
            entries[entries.length - 1].repliedAt = new Date();
            entries[entries.length - 1].replyContent = replyContent;
            (schedule as any)[field] = entries;
            schedule.markModified(field);
            await schedule.save();
        }
    } catch (err: any) {
        console.error("Failed to update schedule messaging status:", err.message);
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

        const confirmation = await ScheduleConfirmation.findOne({ token });
        if (!confirmation) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        if (new Date() > new Date(confirmation.expiresAt)) {
            return NextResponse.json({ error: "This confirmation link has expired" }, { status: 410 });
        }

        if (action === "confirm") {
            confirmation.status = "confirmed";
            confirmation.confirmedAt = new Date();
            await confirmation.save();

            // Update the schedule entry status
            if (confirmation.scheduleDate && confirmation.transporterId) {
                await SymxEmployeeSchedule.updateOne(
                    {
                        transporterId: confirmation.transporterId,
                        date: new Date(confirmation.scheduleDate),
                    },
                    { $set: { status: "Confirmed" } }
                );
            }

            // Update message log if exists
            if (confirmation.messageLogId) {
                await MessageLog.updateOne(
                    { _id: confirmation.messageLogId },
                    { $set: { status: "received_reply", replyContent: "✅ Confirmed via link", repliedAt: new Date() } }
                );
            }

            // Update messaging status array in schedule → shows "received" in messaging panel
            await updateScheduleMessagingStatus(
                confirmation.transporterId,
                confirmation.scheduleDate || "",
                confirmation.messageType,
                "received",
                "✅ Confirmed via link",
                confirmation.yearWeek
            );

            return NextResponse.json({ success: true, status: "confirmed" });

        } else if (action === "change_request") {
            confirmation.status = "change_requested";
            confirmation.changeRequestedAt = new Date();
            confirmation.changeRemarks = remarks || "";
            await confirmation.save();

            // Update schedule entry
            if (confirmation.scheduleDate && confirmation.transporterId) {
                await SymxEmployeeSchedule.updateOne(
                    {
                        transporterId: confirmation.transporterId,
                        date: new Date(confirmation.scheduleDate),
                    },
                    { $set: { status: "Change Requested" } }
                );
            }

            // Update message log
            if (confirmation.messageLogId) {
                await MessageLog.updateOne(
                    { _id: confirmation.messageLogId },
                    {
                        $set: {
                            status: "received_reply",
                            replyContent: `🔄 Change Requested: ${remarks || "No remarks"}`,
                            repliedAt: new Date(),
                        },
                    }
                );
            }

            // Update messaging status array in schedule → shows "received" in messaging panel
            await updateScheduleMessagingStatus(
                confirmation.transporterId,
                confirmation.scheduleDate || "",
                confirmation.messageType,
                "received",
                `🔄 Change Requested: ${remarks || "No remarks"}`,
                confirmation.yearWeek
            );

            return NextResponse.json({ success: true, status: "change_requested" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("Confirm POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
