import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import MessageLog from "@/lib/models/MessageLog";

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
        if (confirmation.scheduleDate && confirmation.transporterId) {
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

            return NextResponse.json({ success: true, status: "change_requested" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("Confirm POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
