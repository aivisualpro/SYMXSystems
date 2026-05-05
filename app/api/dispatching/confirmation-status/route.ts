import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

export const dynamic = "force-dynamic";

/**
 * PUT: Manually update confirmation status for a specific
 * transporterId + scheduleDate. Pushes the status change directly
 * to the schedule's shiftNotification array (single source of truth).
 *
 * Body: { transporterId, scheduleDate, yearWeek, status, changeRemarks? }
 */
export async function PUT(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { transporterId, scheduleDate, yearWeek, status, changeRemarks } = body;

        if (!transporterId || !status) {
            return NextResponse.json(
                { error: "transporterId and status are required" },
                { status: 400 }
            );
        }

        const validStatuses = ["pending", "confirmed", "change_requested"];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // ── Push status change into schedule's shiftNotification array ──
        // Single source of truth: SYMXEmployeeSchedules.shiftNotification
        const senderEmail = (session as any).email || (session as any).user?.email || "dispatcher";

        const scheduleQuery: any = { transporterId };
        if (scheduleDate) {
            scheduleQuery.date = new Date(scheduleDate);
        }

        const schedule = await SymxEmployeeSchedule.findOne(scheduleQuery).sort({ date: -1 });

        if (!schedule) {
            return NextResponse.json(
                { error: "No schedule found for this employee/date" },
                { status: 404 }
            );
        }

        await SymxEmployeeSchedule.updateOne(
            { _id: schedule._id },
            {
                $push: {
                    shiftNotification: {
                        status,
                        createdAt: new Date(),
                        createdBy: senderEmail,
                        changeRemarks: status === "change_requested" ? (changeRemarks || "") : undefined,
                    },
                },
            }
        );

        return NextResponse.json({
            success: true,
            confirmation: {
                status,
                changeRemarks: status === "change_requested" ? (changeRemarks || "") : "",
                updatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error("Error updating confirmation status:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update confirmation status" },
            { status: 500 }
        );
    }
}
