/**
 * Migration Script: Convert `metric` field in SYMXCoachingWriteUps
 * from string to ObjectId reference to SYMXDropdownOptions (where type="metric")
 *
 * Matches metric string value → description in SYMXDropdownOptions → replaces with _id
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(__dirname, "../.env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* ignore */ }

const MONGODB_URI = process.env.MONGODB_URI || process.env.DEVELOPMENT_MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in .env.local");
  process.exit(1);
}

async function run() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("✅ Connected\n");

  const db = mongoose.connection.db!;
  const coachingCol = db.collection("SYMXCoachingWriteUps");
  const dropdownCol = db.collection("SYMXDropdownOptions");

  // Step 1: Build a lookup map from SYMXDropdownOptions where type="metric"
  const metricOptions = await dropdownCol.find({ type: "metric" }).toArray();
  console.log(`📋 Found ${metricOptions.length} dropdown options with type="metric":`);

  const descriptionToId = new Map<string, mongoose.Types.ObjectId>();
  for (const opt of metricOptions) {
    const desc = (opt.description as string || "").trim();
    descriptionToId.set(desc.toLowerCase(), opt._id as mongoose.Types.ObjectId);
    console.log(`   • "${desc}" → ${opt._id}`);
  }
  console.log();

  // Step 2: Find all coaching write-ups that have a string metric field
  const docs = await coachingCol.find({
    metric: { $exists: true, $ne: null, $type: "string" }
  }).toArray();

  console.log(`📝 Found ${docs.length} coaching write-ups with a string "metric" field\n`);

  if (docs.length === 0) {
    console.log("Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const unmatchedMetrics = new Set<string>();

  for (const doc of docs) {
    const metricStr = (doc.metric as string || "").trim();

    if (!metricStr) {
      skipped++;
      continue;
    }

    const matchedId = descriptionToId.get(metricStr.toLowerCase());

    if (!matchedId) {
      notFound++;
      unmatchedMetrics.add(metricStr);
      continue;
    }

    await coachingCol.updateOne(
      { _id: doc._id },
      { $set: { metric: matchedId } }
    );
    updated++;
  }

  console.log("─── Results ───");
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped (empty): ${skipped}`);
  console.log(`❌ Not found: ${notFound}`);

  if (unmatchedMetrics.size > 0) {
    console.log(`\n⚠️  Unmatched metric values (no matching dropdown description):`);
    for (const m of unmatchedMetrics) {
      console.log(`   • "${m}"`);
    }
  }

  console.log("\n🏁 Migration complete.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
