import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";

/**
 * PUT: Manually update (or create) a confirmation status for a specific
 * transporterId + scheduleDate. This upserts the record so it works
 * whether or not a message was ever sent.
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

        // Find an existing confirmation for this transporter + date
        const filter: any = { transporterId };
        if (scheduleDate) {
            filter.scheduleDate = scheduleDate;
        }

        const updateFields: any = {
            status,
            updatedAt: new Date(),
        };

        if (status === "confirmed") {
            updateFields.confirmedAt = new Date();
        } else if (status === "change_requested") {
            updateFields.changeRequestedAt = new Date();
            if (changeRemarks) updateFields.changeRemarks = changeRemarks;
        }

        if (status !== "change_requested") {
            updateFields.changeRemarks = "";
        }

        // Try to find and update existing
        let doc = await ScheduleConfirmation.findOneAndUpdate(
            filter,
            { $set: updateFields },
            { new: true, sort: { updatedAt: -1 } }
        );

        // If no existing record, create a new one
        if (!doc) {
            doc = await ScheduleConfirmation.create({
                transporterId,
                scheduleDate: scheduleDate || "",
                yearWeek: yearWeek || "",
                messageType: "manual",
                status,
                ...(status === "confirmed" ? { confirmedAt: new Date() } : {}),
                ...(status === "change_requested"
                    ? { changeRequestedAt: new Date(), changeRemarks: changeRemarks || "" }
                    : {}),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            });
        }

        return NextResponse.json({
            success: true,
            confirmation: {
                status: doc.status,
                changeRemarks: doc.changeRemarks || "",
                updatedAt: (doc as any).updatedAt,
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
