import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";

/**
 * Lightweight polling endpoint for live message status updates.
 * Accepts: messageType, phones (comma-separated), yearWeek (optional), scheduleDate (optional)
 * Returns: { statuses: { [phone]: { status, createdAt, changeRemarks? } } }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageType = searchParams.get("messageType") || "";
    const phones = searchParams.get("phones")?.split(",").filter(Boolean) || [];
    const yearWeek = searchParams.get("yearWeek") || "";
    const scheduleDate = searchParams.get("scheduleDate") || "";

    if (!messageType || phones.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    await connectToDatabase();

    // Build match — scope to yearWeek and optionally scheduleDate
    let weekLogIdFilter: any = null;
    let weekConfirmations: any[] = [];
    if (yearWeek) {
      const confirmQuery: Record<string, any> = {
        yearWeek, messageType, messageLogId: { $exists: true },
      };
      // For date-specific tabs, scope by scheduleDate
      if (scheduleDate) {
        confirmQuery.scheduleDate = { $regex: new RegExp("^" + scheduleDate) };
      }
      weekConfirmations = await ScheduleConfirmation.find(
        confirmQuery,
        { messageLogId: 1, status: 1, changeRemarks: 1 }
      ).lean();
      const wkLogIds = weekConfirmations.map((c: any) => c.messageLogId);
      weekLogIdFilter = wkLogIds.length > 0 ? { $in: wkLogIds } : null;
    }

    // If scheduleDate was specified but no confirmations found via ScheduleConfirmation,
    // try falling back to MessageLog.scheduleDate directly
    if (yearWeek && !weekLogIdFilter && scheduleDate) {
      const logMatch: any = { messageType, toNumber: { $in: phones }, scheduleDate: { $regex: new RegExp("^" + scheduleDate) } };
      const latestLogs = await MessageLog.aggregate([
        { $match: logMatch },
        { $sort: { sentAt: -1 } },
        {
          $group: {
            _id: "$toNumber",
            status: { $first: "$status" },
            sentAt: { $first: "$sentAt" },
            messageLogId: { $first: "$_id" },
          },
        },
      ]);

      if (latestLogs.length === 0) {
        return NextResponse.json({ statuses: {} });
      }

      // Look up confirmations for these specific log IDs
      const fallbackLogIds = latestLogs.map((l: any) => l.messageLogId);
      const fallbackConfirmations = await ScheduleConfirmation.find(
        { messageLogId: { $in: fallbackLogIds } },
        { messageLogId: 1, status: 1, changeRemarks: 1 }
      ).lean();

      const confirmMap: Record<string, any> = {};
      fallbackConfirmations.forEach((c: any) => {
        confirmMap[c.messageLogId.toString()] = c;
      });

      const statuses: Record<string, { status: string; createdAt: string; changeRemarks?: string }> = {};
      latestLogs.forEach((log: any) => {
        const confirmation = confirmMap[log.messageLogId.toString()];
        let finalStatus = log.status;
        let changeRemarks = "";
        if (confirmation?.status === "confirmed") finalStatus = "confirmed";
        else if (confirmation?.status === "change_requested") {
          finalStatus = "change_requested";
          changeRemarks = confirmation.changeRemarks || "";
        }
        statuses[log._id] = {
          status: finalStatus,
          createdAt: log.sentAt?.toISOString?.() || log.sentAt,
          ...(changeRemarks ? { changeRemarks } : {}),
        };
      });

      return NextResponse.json({ statuses });
    }

    if (yearWeek && !weekLogIdFilter) {
      // No confirmations for this week — return empty
      return NextResponse.json({ statuses: {} });
    }

    const matchStage: any = { messageType, toNumber: { $in: phones } };
    if (weekLogIdFilter) matchStage._id = weekLogIdFilter;

    // Get latest log per phone
    const latestLogs = await MessageLog.aggregate([
      { $match: matchStage },
      { $sort: { sentAt: -1 } },
      {
        $group: {
          _id: "$toNumber",
          status: { $first: "$status" },
          sentAt: { $first: "$sentAt" },
          messageLogId: { $first: "$_id" },
        },
      },
    ]);

    // Reuse the confirmations we already fetched (no 2nd query needed)
    const confirmMap: Record<string, any> = {};
    weekConfirmations.forEach((c: any) => {
      confirmMap[c.messageLogId.toString()] = c;
    });

    // Build result map
    const statuses: Record<
      string,
      { status: string; createdAt: string; changeRemarks?: string }
    > = {};

    latestLogs.forEach((log: any) => {
      const confirmation = confirmMap[log.messageLogId.toString()];
      let finalStatus = log.status;
      let changeRemarks = "";

      if (confirmation?.status === "confirmed") {
        finalStatus = "confirmed";
      } else if (confirmation?.status === "change_requested") {
        finalStatus = "change_requested";
        changeRemarks = confirmation.changeRemarks || "";
      }

      statuses[log._id] = {
        status: finalStatus,
        createdAt: log.sentAt?.toISOString?.() || log.sentAt,
        ...(changeRemarks ? { changeRemarks } : {}),
      };
    });

    return NextResponse.json({ statuses });
  } catch (error: any) {
    console.error("Live status poll error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

