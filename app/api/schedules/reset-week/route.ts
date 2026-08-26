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
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";

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

    // ── Station scope ──
    // This endpoint deletes a week of operational data across six
    // collections. Unscoped, one station resetting its own week erases
    // every station's routes, schedules, audit logs and confirmations for
    // that week — unrecoverable, and it would present as inexplicable data
    // loss at a station nobody touched.
    //
    // Deleting is restricted to the CURRENTLY SELECTED stations rather than
    // everything the user may reach: a company-wide admin viewing all
    // stations should not wipe all of them from a button labelled "reset
    // week". Narrow, explicit, and it matches what the screen was showing.
    const scope = await getRequestScope();
    if (scope.isEmpty) {
      return NextResponse.json({ error: "No station selected" }, { status: 403 });
    }
    if (scope.activeSiteIds.length !== 1) {
      return NextResponse.json(
        {
          error:
            "Resetting a week affects one station at a time. Select a single station first.",
        },
        { status: 400 }
      );
    }
    const stationScope = siteFilter(scope, { includeUnassigned: true });

    const dbSession = await mongoose.startSession();
    let schedulesRes: any = { deletedCount: 0 };
    let logsRes: any = { deletedCount: 0 };
    let routesRes: any = { deletedCount: 0 };
    let routeInfosRes: any = { deletedCount: 0 };
    let confirmationsRes: any = { deletedCount: 0 };

    try {
      await dbSession.withTransaction(async () => {
        const scoped = { yearWeek, ...stationScope };
        schedulesRes = await SymxEmployeeSchedule.deleteMany(scoped, { session: dbSession });
        logsRes = await ScheduleAuditLog.deleteMany(scoped, { session: dbSession });
        routesRes = await SYMXRoute.deleteMany(scoped, { session: dbSession });
        routeInfosRes = await SYMXRoutesInfo.deleteMany(scoped, { session: dbSession });
        confirmationsRes = await ScheduleConfirmation.deleteMany(scoped, { session: dbSession });
        // Note the different field name — this collection keys on `week`.
        await SymxAvailableWeek.deleteOne(
          { week: yearWeek, ...stationScope },
          { session: dbSession }
        );
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
        confirmations: confirmationsRes.deletedCount,
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
