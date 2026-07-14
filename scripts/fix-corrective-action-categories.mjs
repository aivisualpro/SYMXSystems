#!/usr/bin/env node
/**
 * One-time fix for the WriteupSettings.correctiveActionTemplates that
 * were saved using the old seeded category labels (e.g. "Quality –
 * Delivery Completion Rate (DCR)", "Safety – Seatbelt") which don't
 * match this system's real, freeform DropdownOption category strings.
 *
 * Renames the mismatched rows to their real-category equivalents. The
 * five "Safety – X" rows are renamed to categoryLabel "Safety Infraction"
 * (the one real safety category) while KEEPING them as five separate
 * rows, each tagged with a distinct subCategory (Seatbelt / Speeding /
 * Distraction / Following Distance / Sign/Signal) — see the subCategory
 * field added to WriteupSettings' schema. The New Write-Up form uses
 * subCategory to offer a specific-issue picker when a category has more
 * than one template.
 *
 * "Delivered Not Received" is renamed to its own new real category —
 * run scripts/add-dnr-category.mjs first so that category exists.
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

// old categoryLabel (normalized) -> new categoryLabel (simple renames,
// no subCategory involved)
const RENAME_MAP = new Map(
  [
    ["Quality – Customer Delivery Feedback (CDF)", "Customer Delivery Feedback"],
    ["Quality – Delivery Completion Rate (DCR)", "Delivery Completion Rate"],
    ["Quality – Delivery Success Behaviors (DSB)", "Delivery Success Behaviors"],
    ["Quality – Delivered Not Received (DNR)", "Delivered Not Received"],
    ["Quality – POD acceptance", "Photo on Delivery"],
    ["Attendance - Lateness/Absences", "Attendance"],
  ].map(([oldLabel, newLabel]) => [normalize(oldLabel), newLabel])
);

// old categoryLabel (normalized) -> { categoryLabel, subCategory }
const SAFETY_MAP = new Map(
  [
    ["Safety – Seatbelt", "Seatbelt"],
    ["Safety – Speeding", "Speeding"],
    ["Safety – Distraction", "Distraction"],
    ["Safety – Following Distance.", "Following Distance"],
    ["Safety – Sign Signal.", "Sign/Signal"],
  ].map(([oldLabel, subCategory]) => [normalize(oldLabel), subCategory])
);

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

    let changed = false;
    const fixed = templates.map((t) => {
      const key = normalize(t.categoryLabel);

      if (SAFETY_MAP.has(key)) {
        changed = true;
        return { ...t, categoryLabel: "Safety Infraction", subCategory: SAFETY_MAP.get(key) };
      }

      if (RENAME_MAP.has(key)) {
        changed = true;
        return { ...t, categoryLabel: RENAME_MAP.get(key) };
      }

      return t;
    });

    if (!changed) {
      console.log(`${doc._id}: no mismatched categories found, nothing to do.`);
      continue;
    }

    console.log(`${doc._id}: renamed ${fixed.filter((t, i) => t !== templates[i]).length} of ${templates.length} template(s).`);
    console.log(
      `  New category list: ${fixed.map((t) => (t.subCategory ? `${t.categoryLabel} (${t.subCategory})` : t.categoryLabel)).join(", ")}`
    );

    if (!DRY_RUN) {
      await col.updateOne({ _id: doc._id }, { $set: { correctiveActionTemplates: fixed } });
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
