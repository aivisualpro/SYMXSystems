import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SymxAvailableWeek from "@/lib/models/SymxAvailableWeek";

export async function DELETE(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    const allowedEmails = ["adeel@symxlogistics.com", "symx@symxlogistics.com"];
    if (!session || !allowedEmails.includes(session.email?.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearWeek = searchParams.get("yearWeek");

    if (!yearWeek) {
      return NextResponse.json({ error: "yearWeek parameter is required" }, { status: 400 });
    }

    await connectToDatabase();

    const dbSession = await mongoose.startSession();
    let schedulesRes: any = { deletedCount: 0 };
    let logsRes: any = { deletedCount: 0 };
    let routesRes: any = { deletedCount: 0 };
    let routeInfosRes: any = { deletedCount: 0 };

    try {
      await dbSession.withTransaction(async () => {
        schedulesRes = await SymxEmployeeSchedule.deleteMany({ yearWeek }, { session: dbSession });
        logsRes = await ScheduleAuditLog.deleteMany({ yearWeek }, { session: dbSession });
        routesRes = await SYMXRoute.deleteMany({ yearWeek }, { session: dbSession });
        routeInfosRes = await SYMXRoutesInfo.deleteMany({ yearWeek }, { session: dbSession });
        await SymxAvailableWeek.deleteOne({ week: yearWeek }, { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({
      success: true,
      deleted: {
        schedules: schedulesRes.deletedCount,
        logs: logsRes.deletedCount,
        routes: routesRes.deletedCount,
        routeInfos: routeInfosRes.deletedCount,
      }
    });
  } catch (error: any) {
    console.error("Reset Week API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
