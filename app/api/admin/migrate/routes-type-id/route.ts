/**
 * ONE-TIME migration endpoint: stamps typeId onto all SYMXRoutes records.
 * Call: GET /api/admin/migrate/routes-type-id
 * Delete this file after the migration is confirmed.
 */
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import RouteType from "@/lib/models/RouteType";

export async function GET() {
  await dbConnect();

  // Use native collection to bypass Mongoose strict-mode field stripping
  const db = mongoose.connection.db!;
  const routesCol = db.collection("SYMXRoutes");
  const routeTypesCol = db.collection("SYMXRouteTypes");

  // 1. Build name → _id string map from RouteTypes
  const routeTypes = await routeTypesCol.find({}, { projection: { name: 1 } }).toArray();
  const nameToId = new Map<string, string>();
  for (const rt of routeTypes) {
    nameToId.set((rt.name || "").trim().toLowerCase(), String(rt._id));
  }

  // 2. Fetch all routes (only _id + type needed)
  const routes = await routesCol.find({}, { projection: { _id: 1, type: 1 } }).toArray();

  // 3. Build bulk ops
  const ops: any[] = [];
  const unmatchedTypes = new Set<string>();

  for (const route of routes) {
    const key = (route.type || "").trim().toLowerCase();
    const typeId = nameToId.get(key);
    if (typeId) {
      ops.push({
        updateOne: {
          filter: { _id: route._id },
          update: { $set: { typeId } },
        },
      });
    } else {
      if (key) unmatchedTypes.add(route.type);
    }
  }

  let modifiedCount = 0;
  if (ops.length > 0) {
    // bulkWrite on native collection — no Mongoose schema, no field stripping
    const result = await routesCol.bulkWrite(ops, { ordered: false });
    modifiedCount = result.modifiedCount;
  }

  return NextResponse.json({
    success: true,
    totalRoutes: routes.length,
    matched: ops.length,
    unmatched: routes.length - ops.length,
    unmatchedTypeStrings: [...unmatchedTypes],
    modifiedCount,
  });
}

