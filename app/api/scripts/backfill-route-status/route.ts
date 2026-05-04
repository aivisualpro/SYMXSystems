/**
 * Backfill routeStatus on all SymxEmployeeSchedule records.
 *
 * GET /api/scripts/backfill-route-status
 *
 * Looks up each schedule's `type` against RouteType and sets `routeStatus`.
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

    // 1. Build type → routeStatus map from RouteType config
    const routeTypesCol = db.collection("SYMXRouteTypes");
    const routeTypeDocs = await routeTypesCol
      .find({}, { projection: { name: 1, routeStatus: 1 } })
      .toArray();

    const routeStatusMap: Record<string, string> = {};
    for (const rt of routeTypeDocs) {
      const name = (rt.name || "").trim().toLowerCase();
      const status = (rt.routeStatus || "").trim();
      if (name && status) {
        routeStatusMap[name] = status;
      }
    }

    // 2. Batch-update all schedule records
    const schedulesCol = db.collection("SYMXEmployeeSchedules");
    const totalCount = await schedulesCol.countDocuments();

    const cursor = schedulesCol.find(
      {},
      { projection: { _id: 1, type: 1, routeStatus: 1 } }
    );

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let noMatch = 0;
    const unmatchedTypes = new Set<string>();
    const BATCH_SIZE = 500;
    let batch: { id: any; routeStatus: string }[] = [];

    for await (const doc of cursor) {
      processed++;
      const typeRaw = (doc.type || "").trim();
      const typeLower = typeRaw.toLowerCase();

      // Skip if routeStatus already set
      if (doc.routeStatus && (doc.routeStatus as string).trim() !== "") {
        skipped++;
        continue;
      }

      const resolvedStatus = routeStatusMap[typeLower];
      if (!resolvedStatus) {
        if (typeLower === "" || typeLower === "off") {
          batch.push({ id: doc._id, routeStatus: "Off" });
        } else {
          noMatch++;
          unmatchedTypes.add(typeRaw);
        }
        continue;
      }

      batch.push({ id: doc._id, routeStatus: resolvedStatus });

      if (batch.length >= BATCH_SIZE) {
        const bulkOps = batch.map((item) => ({
          updateOne: {
            filter: { _id: item.id },
            update: { $set: { routeStatus: item.routeStatus } },
          },
        }));
        await schedulesCol.bulkWrite(bulkOps, { ordered: false });
        updated += batch.length;
        batch = [];
      }
    }

    // Flush remaining
    if (batch.length > 0) {
      const bulkOps = batch.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { routeStatus: item.routeStatus } },
        },
      }));
      await schedulesCol.bulkWrite(bulkOps, { ordered: false });
      updated += batch.length;
    }

    return NextResponse.json({
      success: true,
      total: totalCount,
      processed,
      updated,
      skipped,
      noMatch,
      unmatchedTypes: Array.from(unmatchedTypes),
      routeStatusMap,
    });
  } catch (error: any) {
    console.error("Backfill routeStatus error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
