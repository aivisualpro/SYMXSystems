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

            // Split into sessions: each "sent" entry starts a new group,
            // subsequent entries (delivered, received, confirmed, change_requested)
            // belong to that session until the next "sent".
            const sessions: any[][] = [];
            for (const entry of sorted) {
                if (entry.status === "sent") {
                    sessions.push([entry]);
                } else if (sessions.length > 0) {
                    sessions[sessions.length - 1].push(entry);
                } else {
                    // Orphaned entry before any sent — start a session anyway
                    sessions.push([entry]);
                }
            }

            // Build a log entry for each session
            for (let si = 0; si < sessions.length; si++) {
                const session = sessions[si];
                const sentEntry = session.find((e: any) => e.status === "sent");
                const deliveredEntry = session.find((e: any) => e.status === "delivered");
                const receivedEntry = session.find((e: any) => e.status === "received");

                const confirmationEvents = session
                    .filter((e: any) => e.status === "confirmed" || e.status === "change_requested")
                    .map((e: any) => ({
                        status: e.status,
                        ...(e.status === "confirmed" ? { confirmedAt: e.createdAt } : {}),
                        ...(e.status === "change_requested" ? {
                            changeRequestedAt: e.createdAt,
                            changeRemarks: e.changeRemarks || "",
                        } : {}),
                        createdBy: e.createdBy || "",
                    }));

                const lastConfEvent = confirmationEvents.length > 0
                    ? confirmationEvents[confirmationEvents.length - 1]
                    : null;
                let overallStatus = session[session.length - 1]?.status || "sent";
                if (lastConfEvent) overallStatus = "received_reply";

                const confirmation: any = lastConfEvent || null;

                logs.push({
                    _id: `${sched._id}_${messageType}_${si}`,
                    recipientName: empName,
                    toNumber: empPhone.startsWith("+") ? empPhone : `+1${empPhone.replace(/\D/g, "")}`,
                    messageType,
                    content: sentEntry?.content || "",
                    status: overallStatus,
                    sentBy: sentEntry?.createdBy || "",
                    sentAt: sentEntry?.createdAt || session[0]?.createdAt || sched.createdAt,
                    deliveredAt: deliveredEntry?.createdAt || undefined,
                    receivedAt: receivedEntry?.createdAt || undefined,
                    confirmationEvents,
                    confirmation,
                });
            }
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
