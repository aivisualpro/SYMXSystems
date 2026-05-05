import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

export const dynamic = "force-dynamic";
/**
 * GET /api/messaging/history
 *
 * Single source of truth: reads messaging history from
 * SYMXEmployeeSchedules messaging arrays only.
 * No MessageLog or ScheduleConfirmation joins.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const messageType = searchParams.get("messageType");
        const scheduleDate = searchParams.get("scheduleDate");
        const yearWeek = searchParams.get("yearWeek");

        if (!messageType) {
            return NextResponse.json({ error: "messageType is required" }, { status: 400 });
        }

        await connectToDatabase();

        const scheduleField = TAB_TO_SCHEDULE_FIELD[messageType];
        if (!scheduleField) {
            return NextResponse.json({ logs: [] });
        }

        // Build schedule query
        const scheduleQuery: Record<string, any> = {};
        if (scheduleDate) {
            scheduleQuery.date = new Date(scheduleDate);
        } else if (yearWeek) {
            scheduleQuery.yearWeek = yearWeek;
        } else {
            return NextResponse.json({ logs: [] });
        }

        // Only fetch schedules that have entries in the messaging array
        scheduleQuery[`${scheduleField}.0`] = { $exists: true };

        const schedules = await SymxEmployeeSchedule.find(
            scheduleQuery,
            { transporterId: 1, date: 1, [scheduleField]: 1 }
        ).lean() as any[];

        if (schedules.length === 0) {
            return NextResponse.json({ logs: [] });
        }

        // Employee name lookup
        const transporterIds = [...new Set(schedules.map(s => s.transporterId))];
        const employees = await SymxEmployee.find(
            { transporterId: { $in: transporterIds } },
            { transporterId: 1, firstName: 1, lastName: 1, phoneNumber: 1 }
        ).lean() as any[];

        const empMap = new Map<string, any>();
        for (const emp of employees) {
            empMap.set(emp.transporterId, emp);
        }

        // Build log entries from the arrays
        const logs: any[] = [];

        for (const sched of schedules) {
            const entries: any[] = sched[scheduleField] || [];
            if (entries.length === 0) continue;

            const emp = empMap.get(sched.transporterId);
            const empName = emp ? `${emp.firstName} ${emp.lastName}`.toUpperCase() : sched.transporterId;
            const empPhone = emp?.phoneNumber || "";

            // Sort entries chronologically
            const sorted = [...entries].sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            // Find key entries
            const sentEntry = sorted.find((e: any) => e.status === "sent");
            const deliveredEntry = sorted.find((e: any) => e.status === "delivered");
            const confirmedEntry = sorted.find((e: any) => e.status === "confirmed");
            const changeEntry = sorted.find((e: any) => e.status === "change_requested");

            // Determine overall status
            let overallStatus = sorted[sorted.length - 1]?.status || "sent";
            let confirmation: any = null;

            if (confirmedEntry) {
                overallStatus = "received_reply";
                confirmation = {
                    status: "confirmed",
                    confirmedAt: confirmedEntry.createdAt,
                };
            } else if (changeEntry) {
                overallStatus = "received_reply";
                confirmation = {
                    status: "change_requested",
                    changeRequestedAt: changeEntry.createdAt,
                    changeRemarks: changeEntry.changeRemarks || "",
                };
            }

            logs.push({
                _id: `${sched._id}_${messageType}`,
                recipientName: empName,
                toNumber: empPhone.startsWith("+") ? empPhone : `+1${empPhone.replace(/\D/g, "")}`,
                messageType,
                content: sentEntry?.content || "",
                status: overallStatus,
                sentBy: sentEntry?.createdBy || "",
                sentAt: sentEntry?.createdAt || sorted[0]?.createdAt || sched.createdAt,
                deliveredAt: deliveredEntry?.createdAt || undefined,
                repliedAt: confirmedEntry?.createdAt || changeEntry?.createdAt || undefined,
                replyContent: confirmedEntry
                    ? "✅ Confirmed via link"
                    : changeEntry
                        ? `🔄 Change Requested: ${changeEntry.changeRemarks || "No remarks"}`
                        : undefined,
                confirmation,
            });
        }

        // Sort by sentAt descending
        logs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

        const res = NextResponse.json({ logs });
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
        return res;
    } catch (error: any) {
        console.error("Message History API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
