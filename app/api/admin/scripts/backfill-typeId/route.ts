import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * GET /api/admin/scripts/backfill-typeId
 * One-time migration: populate typeId on SYMXEmployeeSchedules
 * by matching the `type` string to `name` in SYMXRouteTypes.
 *
 * Uses the NATIVE MongoDB driver (bypasses Mongoose strict schema)
 * to ensure typeId is actually written to documents.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const db = mongoose.connection.db!;
    const routeTypesCol = db.collection("SYMXRouteTypes");
    const schedulesCol = db.collection("SYMXEmployeeSchedules");

    // 1. Load all route types and build a case-insensitive map
    const routeTypes = await routeTypesCol.find({}).toArray();
    const nameToId = new Map<string, any>();
    for (const rt of routeTypes) {
      const key = ((rt.name as string) || "").trim().toLowerCase();
      if (key) nameToId.set(key, rt._id);
    }

    const log: string[] = [];
    log.push(`Found ${routeTypes.length} route types`);

    // 2. Batch update schedules per route type (native driver — no schema stripping)
    let totalUpdated = 0;
    for (const [lowerName, rtId] of nameToId.entries()) {
      const result = await schedulesCol.updateMany(
        {
          type: { $regex: new RegExp(`^${lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        },
        { $set: { typeId: rtId } }
      );
      if (result.modifiedCount > 0) {
        log.push(`"${lowerName}" → updated ${result.modifiedCount} schedules`);
        totalUpdated += result.modifiedCount;
      }
    }

    // 3. Clear typeId for empty type values
    const clearResult = await schedulesCol.updateMany(
      { type: { $in: ["", null] }, typeId: { $exists: true, $ne: null } },
      { $unset: { typeId: "" } }
    );
    if (clearResult.modifiedCount > 0) {
      log.push(`Cleared typeId on ${clearResult.modifiedCount} empty-type schedules`);
    }

    // 4. Summary (also via native driver)
    const totalSchedules = await schedulesCol.countDocuments();
    const withTypeId = await schedulesCol.countDocuments({ typeId: { $exists: true, $ne: null } });

    return NextResponse.json({
      success: true,
      totalRouteTypes: routeTypes.length,
      totalSchedules,
      updatedThisRun: totalUpdated,
      withTypeId,
      missingTypeId: totalSchedules - withTypeId,
      log,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
