import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const messageType = searchParams.get("messageType"); // week-schedule, shift, etc.
        const yearWeek = searchParams.get("yearWeek");
        const scheduleDate = searchParams.get("scheduleDate"); // YYYY-MM-DD for date-specific tabs
        const limit = parseInt(searchParams.get("limit") || "100");

        await connectToDatabase();

        // Build query
        const query: any = {};
        if (messageType) query.messageType = messageType;

        // If scheduleDate is specified, find logs via two paths:
        // 1) MessageLog records that have scheduleDate matching (new records)
        // 2) MessageLog records linked from ScheduleConfirmation records with matching scheduleDate (old records)
        let logs: any[] = [];

        if (scheduleDate) {
            const dateRegex = { $regex: new RegExp("^" + scheduleDate) };

            // Path 1: MessageLogs with scheduleDate field
            const directQuery: any = { ...query, scheduleDate: dateRegex };

            // Path 2: Find messageLogIds from ScheduleConfirmation records that have this scheduleDate
            const confirmQuery: any = {
                scheduleDate: dateRegex,
                messageLogId: { $exists: true },
            };
            if (messageType) confirmQuery.messageType = messageType;
            const confirmations = await ScheduleConfirmation.find(
                confirmQuery,
                { messageLogId: 1 }
            ).lean();
            const confirmLogIds = confirmations.map((c: any) => c.messageLogId);

            // Combine: logs matching directly OR linked via confirmations
            if (confirmLogIds.length > 0) {
                logs = await MessageLog.find({
                    $or: [
                        directQuery,
                        { _id: { $in: confirmLogIds }, ...(messageType ? { messageType } : {}) },
                    ],
                })
                    .sort({ sentAt: -1 })
                    .limit(limit)
                    .lean();
            } else {
                logs = await MessageLog.find(directQuery)
                    .sort({ sentAt: -1 })
                    .limit(limit)
                    .lean();
            }
        } else if (yearWeek) {
            // For week-level tabs (week-schedule), use the yearWeek field if stored,
            // otherwise fall back to sentAt date range
            query.$or = [
                { yearWeek },
                // Fallback: filter by date range of that ISO week (for older records)
                (() => {
                    const weekMatch = yearWeek.match(/(\d{4})-W?(\d{1,2})/);
                    if (weekMatch) {
                        const year = parseInt(weekMatch[1]);
                        const week = parseInt(weekMatch[2]);
                        const jan4 = new Date(Date.UTC(year, 0, 4));
                        const dayOfWeek = jan4.getUTCDay() || 7;
                        const startOfWeek1 = new Date(jan4);
                        startOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
                        const startOfTargetWeek = new Date(startOfWeek1);
                        startOfTargetWeek.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
                        const rangeStart = new Date(startOfTargetWeek);
                        rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
                        const rangeEnd = new Date(startOfTargetWeek);
                        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
                        return { sentAt: { $gte: rangeStart, $lt: rangeEnd } };
                    }
                    return {};
                })(),
            ];
            logs = await MessageLog.find(query)
                .sort({ sentAt: -1 })
                .limit(limit)
                .lean();
        } else {
            logs = await MessageLog.find(query)
                .sort({ sentAt: -1 })
                .limit(limit)
                .lean();
        }

        // Get associated confirmations for these logs
        const logIds = logs.map((l: any) => l._id);
        const confirmations = await ScheduleConfirmation.find({
            messageLogId: { $in: logIds },
        }).lean();

        // Map confirmations by messageLogId
        const confirmMap: Record<string, any> = {};
        confirmations.forEach((c: any) => {
            confirmMap[c.messageLogId.toString()] = {
                status: c.status,
                confirmedAt: c.confirmedAt,
                changeRequestedAt: c.changeRequestedAt,
                changeRemarks: c.changeRemarks,
                token: c.token,
            };
        });

        // Enrich logs with confirmation data
        const enrichedLogs = logs.map((log: any) => ({
            _id: log._id,
            recipientName: log.recipientName,
            toNumber: log.toNumber,
            messageType: log.messageType,
            content: log.content,
            status: log.status,
            sentAt: log.sentAt,
            deliveredAt: log.deliveredAt,
            repliedAt: log.repliedAt,
            replyContent: log.replyContent,
            errorMessage: log.errorMessage,
            confirmation: confirmMap[log._id.toString()] || null,
        }));

        return NextResponse.json({ logs: enrichedLogs });
    } catch (error: any) {
        console.error("Message History API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

