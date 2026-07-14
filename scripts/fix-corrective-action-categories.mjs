#!/usr/bin/env node
/**
 * One-time fix for the WriteupSettings.correctiveActionTemplates that
 * were saved using the old seeded category labels (e.g. "Quality –
 * Delivery Completion Rate (DCR)", "Safety – Seatbelt") which don't
 * match this system's real, freeform DropdownOption category strings
 * (e.g. "Delivery Completion Rate", "Safety Infraction"). Renames the
 * mismatched rows to their real-category equivalents, and merges the
 * five separate "Safety – X" rows into a single "Safety Infraction"
 * row (the real category list only has one safety category).
 *
 * Usage:
 *   node scripts/fix-corrective-action-categories.mjs           # writes
 *   node scripts/fix-corrective-action-categories.mjs --dry-run # preview only
 */
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const envFile = fs.readFileSync(path.join(rootDir, ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

function normalize(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// old label (normalized) -> real category label
const RENAME_MAP = new Map(
  [
    ["Quality – Customer Delivery Feedback (CDF)", "Customer Delivery Feedback"],
    ["Quality – Delivery Completion Rate (DCR)", "Delivery Completion Rate"],
    ["Quality – Delivery Success Behaviors (DSB)", "Delivery Success Behaviors"],
    ["Quality – Delivered Not Received (DNR)", "Customer Delivery Feedback DPMO"],
    ["Quality – POD acceptance", "Photo on Delivery"],
    ["Attendance - Lateness/Absences", "Attendance"],
  ].map(([oldLabel, newLabel]) => [normalize(oldLabel), newLabel])
);

const SAFETY_LABELS = new Set(
  ["Safety – Seatbelt", "Safety – Speeding", "Safety – Distraction", "Safety – Following Distance.", "Safety – Sign Signal."].map(
    normalize
  )
);

const SAFETY_COMBINED_PLAN =
  "Seatbelts must be fastened correctly before the vehicle is placed in motion, every trip, no exceptions. Do not exceed the posted speed limit by 10+ mph for any sustained duration, and never exceed 85 mph under any circumstance — adjust speed for road, weather, and traffic conditions at all times. Keep full attention on the road; do not look at or use a phone while the vehicle is in motion. Maintain safe following distance at all times — at least 1+ second of space behind the vehicle ahead, more at higher speeds. Come to a complete stop at every stop sign and red light before proceeding, and never execute an illegal U-turn.";

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = db.collection("SYMXWriteupSettings");

  const docs = await col.find({}).toArray();
  console.log(`Found ${docs.length} WriteupSettings document(s).\n`);

  for (const doc of docs) {
    const templates = doc.correctiveActionTemplates || [];
    if (templates.length === 0) {
      console.log(`${doc._id}: no templates, nothing to do.`);
      continue;
    }

    const kept = [];
    let safetyMerged = false;
    let changed = false;

    for (const t of templates) {
      const key = normalize(t.categoryLabel);

      if (SAFETY_LABELS.has(key)) {
        changed = true;
        if (!safetyMerged) {
          kept.push({ ...t, categoryLabel: "Safety Infraction", planForImprovement: SAFETY_COMBINED_PLAN });
          safetyMerged = true;
        }
        // drop the rest of the safety rows
        continue;
      }

      if (RENAME_MAP.has(key)) {
        changed = true;
        kept.push({ ...t, categoryLabel: RENAME_MAP.get(key) });
        continue;
      }

      kept.push(t);
    }

    if (!changed) {
      console.log(`${doc._id}: no mismatched categories found, nothing to do.`);
      continue;
    }

    console.log(`${doc._id}: ${templates.length} template(s) -> ${kept.length} template(s) after fix.`);
    console.log(`  New category list: ${kept.map((t) => t.categoryLabel).join(", ")}`);

    if (!DRY_RUN) {
      await col.updateOne({ _id: doc._id }, { $set: { correctiveActionTemplates: kept } });
      console.log(`  Saved.`);
    }
  }

  if (DRY_RUN) {
    console.log("\n--dry-run set — no changes written.");
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
