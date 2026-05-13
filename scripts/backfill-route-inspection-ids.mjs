/**
 * Backfill: Stamp inspectionId + inspectionTime onto SYMXRoutes
 * ──────────────────────────────────────────────────────────────
 * For every DailyInspection with a non-empty `routeId`, ensure
 * the matching SYMXRoute has `inspectionId` and `inspectionTime`
 * set from the latest DailyInspection (by timeStamp).
 *
 * Run with:
 *   node scripts/backfill-route-inspection-ids.mjs
 *   node scripts/backfill-route-inspection-ids.mjs --dry-run
 *
 * Requires MONGODB_URI in your .env (or set it inline).
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env ──
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    console.warn("⚠️  Could not load .env — using existing env vars");
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not set. Check your .env");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const BUSINESS_TZ = "America/Los_Angeles";

async function main() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log("✅  Connected to MongoDB");
  if (DRY_RUN) console.log("🔍  DRY RUN — no writes will be performed\n");

  const db = mongoose.connection.db;
  const inspectionsCol = db.collection("dailyInspections");
  const routesCol = db.collection("SYMXRoutes");

  // 1. Aggregate: for each routeId, get the latest inspection (by timeStamp desc)
  console.log("📋  Aggregating latest DailyInspection per routeId...");
  const latestInspections = await inspectionsCol.aggregate([
    { $match: { routeId: { $nin: ["", null] } } },
    { $sort: { timeStamp: -1 } },
    {
      $group: {
        _id: "$routeId",
        inspectionId: { $first: "$_id" },
        timeStamp: { $first: "$timeStamp" },
      },
    },
  ]).toArray();

  console.log(`📊  Found ${latestInspections.length} unique routeIds with inspections`);

  if (latestInspections.length === 0) {
    console.log("\nℹ️  Nothing to backfill.");
    await mongoose.disconnect();
    return;
  }

  // 2. Build a map: routeId → { inspectionId, inspectionTime }
  const inspMap = new Map();
  for (const row of latestInspections) {
    const ts = row.timeStamp ? new Date(row.timeStamp) : new Date();
    const inspectionTime = ts.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: BUSINESS_TZ,
    });
    inspMap.set(row._id, {
      inspectionId: String(row.inspectionId),
      inspectionTime,
    });
  }

  // 3. Fetch all SYMXRoutes whose _id matches a routeId in our map
  const routeIds = [...inspMap.keys()];
  // Convert string routeIds to ObjectIds where possible
  const objectIds = routeIds
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const routes = await routesCol
    .find(
      { _id: { $in: objectIds } },
      { projection: { _id: 1, inspectionId: 1, inspectionTime: 1 } }
    )
    .toArray();

  console.log(`🚛  Matched ${routes.length} SYMXRoute documents\n`);

  // 4. Build bulk update ops — only for routes that need updating
  const ops = [];
  let alreadyCurrent = 0;
  let needsUpdate = 0;

  for (const route of routes) {
    const routeIdStr = String(route._id);
    const insp = inspMap.get(routeIdStr);
    if (!insp) continue;

    // Skip if already set correctly
    if (route.inspectionId === insp.inspectionId) {
      alreadyCurrent++;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { _id: route._id },
        update: {
          $set: {
            inspectionId: insp.inspectionId,
            inspectionTime: insp.inspectionTime,
          },
        },
      },
    });
    needsUpdate++;
  }

  console.log(`📊  Backfill summary:`);
  console.log(`   ✅ Already current: ${alreadyCurrent}`);
  console.log(`   🔧 Needs update:   ${needsUpdate}`);
  console.log(`   📋 Total routes:    ${routes.length}`);

  // 5. Execute bulk write
  if (ops.length > 0 && !DRY_RUN) {
    const result = await routesCol.bulkWrite(ops, { ordered: false });
    console.log(
      `\n✅  Bulk write complete: ${result.modifiedCount} routes backfilled`
    );
  } else if (DRY_RUN && ops.length > 0) {
    console.log(`\n🔍  DRY RUN: Would update ${ops.length} routes`);
  } else {
    console.log("\nℹ️  No operations needed — all routes are up-to-date.");
  }

  await mongoose.disconnect();
  console.log("🔒  Connection closed. Done!");
}

main().catch((err) => {
  console.error("❌  Backfill failed:", err);
  process.exit(1);
});
