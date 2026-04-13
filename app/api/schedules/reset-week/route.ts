import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.email !== "adeel@symxlogistics.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearWeek = searchParams.get("yearWeek");

    if (!yearWeek) {
      return NextResponse.json({ error: "yearWeek parameter is required" }, { status: 400 });
    }

    await connectToDatabase();

    // Perform deletions concurrently
    const [schedulesRes, logsRes, routesRes, routeInfosRes] = await Promise.all([
      SymxEmployeeSchedule.deleteMany({ yearWeek }),
      ScheduleAuditLog.deleteMany({ yearWeek }),
      SYMXRoute.deleteMany({ yearWeek }),
      SYMXRoutesInfo.deleteMany({ yearWeek }),
    ]);

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
