#!/usr/bin/env node
/**
 * Write-Up / Verbal Coaching category maintenance (DropdownOption, type
 * "metric"). Does three things, in order:
 *
 *  1. Fixes "CONDUCT" -> "Conduct" if an earlier run of this script (or a
 *     manual add) created it in all-caps, and makes sure its 4
 *     subcategory corrective-action templates exist under the corrected
 *     name (lib/models/WriteupSettings.ts) — Behavior/Professionalism,
 *     Failure to follow procedures, Vehicle Care/Cleanliness, Failure to
 *     Report. If neither casing exists yet, inserts "Conduct" fresh.
 *  2. Adds "Efficiency" as a plain category (no subcategories) if it
 *     doesn't already exist.
 *  3. Reorders ALL metric categories by actual usage — counts how many
 *     Write-ups (categoryLabel) + Verbal Coachings (categoryLabels[])
 *     reference each one and sets sortOrder highest-usage-first, so the
 *     New Write-Up / Log Coaching pickers surface what dispatchers
 *     actually use most, first. Brand-new categories with zero usage
 *     (Conduct, Efficiency) naturally sort to the end until they get used.
 *
 * Safe to run more than once — every step is idempotent.
 *
 * Usage:
 *   node scripts/setup-writeup-categories.mjs           # applies changes
 *   node scripts/setup-writeup-categories.mjs --dry-run # preview only
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

const OLD_CONDUCT = "CONDUCT";
const CONDUCT = "Conduct";
const EFFICIENCY = "Efficiency";
const CONDUCT_SUBCATEGORIES = [
  {
    subCategory: "Behavior/Professionalism",
    planForImprovement:
      "Maintain professional conduct with customers, coworkers, and management at all times. Treat everyone with courtesy and respect, and represent SYMX professionally on and off the route.",
  },
  {
    subCategory: "Failure to follow procedures",
    planForImprovement:
      "Follow all posted procedures, policies, and direct instructions from management. If a procedure is unclear, ask before deviating from it rather than improvising.",
  },
  {
    subCategory: "Vehicle Care/Cleanliness",
    planForImprovement:
      "Keep the assigned vehicle clean, organized, and free of trash or personal clutter inside and out. Report any damage or maintenance needs promptly rather than leaving them unaddressed.",
  },
  {
    subCategory: "Failure to Report",
    planForImprovement:
      "Report incidents, damage, safety concerns, or issues affecting the route to management as soon as they occur — do not wait to be asked or let issues go unreported.",
  },
];

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const dropdownCol = db.collection("SYMXDropdownOptions");
  const settingsCol = db.collection("SYMXWriteupSettings");
  const writeupCol = db.collection("SYMXWriteups");
  const coachingCol = db.collection("SYMXVerbalCoachings");

  // ── 1. Conduct: fix casing or insert fresh ──
  const existingConduct = await dropdownCol.findOne({ description: CONDUCT, type: "metric" });
  const existingOldConduct = await dropdownCol.findOne({ description: OLD_CONDUCT, type: "metric" });

  if (existingConduct) {
    console.log(`Category "${CONDUCT}" already exists — no rename needed.`);
  } else if (existingOldConduct) {
    console.log(`Renaming "${OLD_CONDUCT}" -> "${CONDUCT}" (id ${existingOldConduct._id}).`);
    if (!DRY_RUN) {
      await dropdownCol.updateOne({ _id: existingOldConduct._id }, { $set: { description: CONDUCT, updatedAt: new Date() } });
    }
  } else {
    const metricOptions = await dropdownCol.find({ type: "metric" }, { projection: { sortOrder: 1 } }).toArray();
    const maxSortOrder = metricOptions.reduce((max, o) => Math.max(max, o.sortOrder || 0), 0);
    const doc = {
      description: CONDUCT,
      type: "metric",
      isActive: true,
      sortOrder: maxSortOrder + 1,
      image: "", color: "", icon: "", defaultPad: "",
      metricTypeDisplay: "", metricTypeGoal: "", metricpercentage: "",
      createdAt: new Date(), updatedAt: new Date(),
    };
    console.log(`Inserting new category: "${CONDUCT}"`);
    if (!DRY_RUN) await dropdownCol.insertOne(doc);
  }

  // ── 2. Corrective-action templates for Conduct's subcategories ──
  const settings = await settingsCol.find().sort({ _id: 1 }).limit(1).next();
  if (!settings) {
    console.log(
      "No WriteupSettings document found yet — the app creates one lazily the first time Write-Up Settings is " +
      "opened. Open Owner > Write-Up Settings once in the app, then re-run this script to add the Conduct subcategory templates."
    );
  } else {
    let templates = settings.correctiveActionTemplates || [];
    // Fix casing on any templates saved under the old all-caps label.
    const hasOldCasingTemplates = templates.some((t) => (t.categoryLabel || "") === OLD_CONDUCT);
    if (hasOldCasingTemplates) {
      templates = templates.map((t) => (t.categoryLabel === OLD_CONDUCT ? { ...t, categoryLabel: CONDUCT } : t));
      console.log(`Renamed categoryLabel on existing "${OLD_CONDUCT}" corrective-action template(s) to "${CONDUCT}".`);
    }
    const toAdd = CONDUCT_SUBCATEGORIES.filter(
      (s) => !templates.some((t) => (t.categoryLabel || "").toLowerCase() === CONDUCT.toLowerCase() && (t.subCategory || "") === s.subCategory)
    );
    if (toAdd.length === 0 && !hasOldCasingTemplates) {
      console.log(`All 4 ${CONDUCT} subcategory templates already exist — nothing to add.`);
    } else {
      if (toAdd.length > 0) {
        console.log(`Adding ${toAdd.length} corrective-action template(s): ${toAdd.map((s) => s.subCategory).join(", ")}`);
        templates = [
          ...templates,
          ...toAdd.map((s) => ({ categoryLabel: CONDUCT, subCategory: s.subCategory, planForImprovement: s.planForImprovement, consequences: "" })),
        ];
      }
      if (!DRY_RUN) {
        await settingsCol.updateOne({ _id: settings._id }, { $set: { correctiveActionTemplates: templates, updatedAt: new Date() } });
        console.log("Corrective-action templates updated.");
      }
    }
  }

  // ── 3. Efficiency: plain category, no subcategories ──
  const existingEfficiency = await dropdownCol.findOne({ description: EFFICIENCY, type: "metric" });
  if (existingEfficiency) {
    console.log(`Category "${EFFICIENCY}" already exists — skipping insert.`);
  } else {
    const metricOptions = await dropdownCol.find({ type: "metric" }, { projection: { sortOrder: 1 } }).toArray();
    const maxSortOrder = metricOptions.reduce((max, o) => Math.max(max, o.sortOrder || 0), 0);
    const doc = {
      description: EFFICIENCY,
      type: "metric",
      isActive: true,
      sortOrder: maxSortOrder + 1,
      image: "", color: "", icon: "", defaultPad: "",
      metricTypeDisplay: "", metricTypeGoal: "", metricpercentage: "",
      createdAt: new Date(), updatedAt: new Date(),
    };
    console.log(`Inserting new category: "${EFFICIENCY}"`);
    if (!DRY_RUN) await dropdownCol.insertOne(doc);
  }

  // ── 4. Reorder every metric category by actual usage ──
  const categories = await dropdownCol.find({ type: "metric" }).sort({ sortOrder: 1, description: 1 }).toArray();

  const writeupCounts = await writeupCol
    .aggregate([{ $group: { _id: "$categoryLabel", count: { $sum: 1 } } }])
    .toArray();
  const coachingCounts = await coachingCol
    .aggregate([{ $unwind: "$categoryLabels" }, { $group: { _id: "$categoryLabels", count: { $sum: 1 } } }])
    .toArray();

  const usage = new Map(); // normalized label -> count
  const norm = (s) => (s || "").trim().toLowerCase();
  for (const row of writeupCounts) usage.set(norm(row._id), (usage.get(norm(row._id)) || 0) + row.count);
  for (const row of coachingCounts) usage.set(norm(row._id), (usage.get(norm(row._id)) || 0) + row.count);

  const withUsage = categories.map((c, idx) => ({
    ...c,
    usageCount: usage.get(norm(c.description)) || 0,
    originalRank: idx, // stable tiebreaker: preserves current relative order
  }));

  withUsage.sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.originalRank - b.originalRank;
  });

  console.log("\nUsage-based order (Write-ups + Verbal Coachings combined):");
  withUsage.forEach((c, i) => console.log(`  ${i + 1}. ${c.description}  (${c.usageCount} use${c.usageCount === 1 ? "" : "s"})`));

  const needsUpdate = withUsage.filter((c, i) => c.sortOrder !== i);
  if (needsUpdate.length === 0) {
    console.log("\nsortOrder already matches usage order — nothing to change.");
  } else {
    console.log(`\nWill update sortOrder on ${needsUpdate.length} categor${needsUpdate.length === 1 ? "y" : "ies"}.`);
    if (!DRY_RUN) {
      const ops = withUsage.map((c, i) => ({
        updateOne: { filter: { _id: c._id }, update: { $set: { sortOrder: i, updatedAt: new Date() } } },
      }));
      await dropdownCol.bulkWrite(ops);
      console.log("sortOrder updated for all metric categories.");
    }
  }

  if (DRY_RUN) console.log("\n--dry-run set — no changes written.");
  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
