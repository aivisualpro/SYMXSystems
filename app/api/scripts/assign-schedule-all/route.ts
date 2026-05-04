/**
 * Set all employees' day fields (sunday–saturday) to the "Assign Schedule" RouteType ObjectId.
 *
 * GET /api/scripts/assign-schedule-all
 *
 * Finds the RouteType named "Assign Schedule" and bulk-updates every employee.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db!;

    // 1. Find the "Assign Schedule" route type
    const routeTypesCol = db.collection("SYMXRouteTypes");
    const assignScheduleRT = await routeTypesCol.findOne({
      name: { $regex: /^assign\s+schedule$/i },
    });

    if (!assignScheduleRT) {
      return NextResponse.json(
        { error: 'RouteType "Assign Schedule" not found in SYMXRouteTypes collection' },
        { status: 404 }
      );
    }

    const assignScheduleId = assignScheduleRT._id;

    // 2. Bulk-update ALL employees to set every day to this ObjectId
    const employeesCol = db.collection("SYMXEmployees");
    const totalCount = await employeesCol.countDocuments();

    const result = await employeesCol.updateMany(
      {},
      {
        $set: {
          sunday: assignScheduleId,
          monday: assignScheduleId,
          tuesday: assignScheduleId,
          wednesday: assignScheduleId,
          thursday: assignScheduleId,
          friday: assignScheduleId,
          saturday: assignScheduleId,
        },
      }
    );

    return NextResponse.json({
      success: true,
      assignScheduleRouteType: {
        _id: String(assignScheduleId),
        name: assignScheduleRT.name,
        color: assignScheduleRT.color,
        icon: assignScheduleRT.icon,
      },
      totalEmployees: totalCount,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("Assign Schedule All error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
