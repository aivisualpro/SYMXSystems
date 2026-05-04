/**
 * Backfill script: populate `typeId` on every SYMXEmployeeSchedule document
 * by matching the existing `type` string field to the `name` field in SYMXRouteTypes.
 *
 * Usage:  npx tsx scripts/backfill-typeId.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

if (!MONGO_URI) {
  console.error("❌ No MONGODB_URI found in .env.local");
  process.exit(1);
}

async function run() {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const db = mongoose.connection.db!;
  const routeTypesCol = db.collection("SYMXRouteTypes");
  const schedulesCol = db.collection("SYMXEmployeeSchedules");

  // 1. Build a case-insensitive map: lowercase name → ObjectId
  const routeTypes = await routeTypesCol.find({}).toArray();
  console.log(`📋 Found ${routeTypes.length} route types in SYMXRouteTypes:`);
  const nameToId = new Map<string, mongoose.Types.ObjectId>();
  for (const rt of routeTypes) {
    const key = (rt.name as string || "").trim().toLowerCase();
    if (key) {
      nameToId.set(key, rt._id as mongoose.Types.ObjectId);
      console.log(`   • "${rt.name}" → ${rt._id}`);
    }
  }
  console.log();

  // 2. Get all distinct `type` values currently used in schedules
  const distinctTypes: string[] = await schedulesCol.distinct("type");
  console.log(`📊 Distinct type values in SYMXEmployeeSchedules: ${distinctTypes.length}`);
  const unmapped: string[] = [];
  for (const t of distinctTypes) {
    const key = (t || "").trim().toLowerCase();
    if (key && !nameToId.has(key)) {
      unmapped.push(t);
    }
  }
  if (unmapped.length > 0) {
    console.log(`⚠️  Types without a matching RouteType: ${unmapped.join(", ")}`);
  }
  console.log();

  // 3. Batch-update schedules per route type
  let totalUpdated = 0;
  for (const [lowerName, rtId] of nameToId.entries()) {
    const result = await schedulesCol.updateMany(
      {
        type: { $regex: new RegExp(`^${lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        $or: [{ typeId: { $exists: false } }, { typeId: null }],
      },
      { $set: { typeId: rtId } }
    );
    if (result.modifiedCount > 0) {
      console.log(`   ✅ "${lowerName}" → updated ${result.modifiedCount} schedules`);
      totalUpdated += result.modifiedCount;
    }
  }

  // 4. Clear typeId for empty/null type values (safety)
  const clearResult = await schedulesCol.updateMany(
    { type: { $in: ["", null] }, typeId: { $exists: true, $ne: null } },
    { $unset: { typeId: "" } }
  );
  if (clearResult.modifiedCount > 0) {
    console.log(`   🧹 Cleared typeId on ${clearResult.modifiedCount} empty-type schedules`);
  }

  // 5. Summary
  const totalSchedules = await schedulesCol.countDocuments();
  const withTypeId = await schedulesCol.countDocuments({ typeId: { $exists: true, $ne: null } });
  const withoutTypeId = totalSchedules - withTypeId;

  console.log(`\n📈 Migration Summary:`);
  console.log(`   Total schedules:      ${totalSchedules}`);
  console.log(`   Updated this run:     ${totalUpdated}`);
  console.log(`   Now have typeId:      ${withTypeId}`);
  console.log(`   Missing typeId:       ${withoutTypeId}`);
  console.log(`\n✅ Done!`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
