#!/usr/bin/env node
/**
 * One-time setup: adds "CONDUCT" as a new real Write-Up / Verbal Coaching
 * category (DropdownOption, type "metric"), plus its four subcategories as
 * corrective-action templates (lib/models/WriteupSettings.ts) so they show
 * up in the New Write-Up form's "Specific Issue" picker — same pattern as
 * the existing Safety Infraction subcategories.
 *
 * Safe to run more than once — skips anything that already exists.
 *
 * Usage:
 *   node scripts/add-conduct-category.mjs           # creates it
 *   node scripts/add-conduct-category.mjs --dry-run # preview only
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

const NEW_CATEGORY = "CONDUCT";
const SUBCATEGORIES = [
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

  // ── 1. Category (DropdownOption, type "metric") ──
  const dropdownCol = db.collection("SYMXDropdownOptions");
  const existingCategory = await dropdownCol.findOne({ description: NEW_CATEGORY, type: "metric" });
  if (existingCategory) {
    console.log(`Category "${NEW_CATEGORY}" already exists — skipping insert.`);
  } else {
    const metricOptions = await dropdownCol.find({ type: "metric" }, { projection: { sortOrder: 1 } }).toArray();
    const maxSortOrder = metricOptions.reduce((max, o) => Math.max(max, o.sortOrder || 0), 0);
    const doc = {
      description: NEW_CATEGORY,
      type: "metric",
      isActive: true,
      sortOrder: maxSortOrder + 1,
      image: "",
      color: "",
      icon: "",
      defaultPad: "",
      metricTypeDisplay: "",
      metricTypeGoal: "",
      metricpercentage: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    console.log(`Will insert category: ${JSON.stringify(doc, null, 2)}`);
    if (!DRY_RUN) {
      await dropdownCol.insertOne(doc);
      console.log(`Inserted "${NEW_CATEGORY}" as a new metric category.`);
    }
  }

  // ── 2. Corrective-action templates (subcategories) ──
  // Mirrors the app's "canonical settings" convention: single document,
  // sorted deterministically by _id if stray duplicates exist.
  const settingsCol = db.collection("SYMXWriteupSettings");
  const settings = await settingsCol.find().sort({ _id: 1 }).limit(1).next();
  if (!settings) {
    console.log(
      "No WriteupSettings document found yet — the app creates one lazily the first time Write-Up Settings is opened. " +
      "Open Owner > Write-Up Settings once in the app, then re-run this script to add the CONDUCT subcategory templates."
    );
  } else {
    const templates = settings.correctiveActionTemplates || [];
    const toAdd = SUBCATEGORIES.filter(
      (s) =>
        !templates.some(
          (t) =>
            (t.categoryLabel || "").toLowerCase() === NEW_CATEGORY.toLowerCase() &&
            (t.subCategory || "") === s.subCategory
        )
    );
    if (toAdd.length === 0) {
      console.log("All 4 CONDUCT subcategory templates already exist — nothing to add.");
    } else {
      console.log(
        `Will add ${toAdd.length} corrective-action template(s): ${toAdd.map((s) => s.subCategory).join(", ")}`
      );
      if (!DRY_RUN) {
        const newTemplates = [
          ...templates,
          ...toAdd.map((s) => ({
            categoryLabel: NEW_CATEGORY,
            subCategory: s.subCategory,
            planForImprovement: s.planForImprovement,
            consequences: "",
          })),
        ];
        await settingsCol.updateOne(
          { _id: settings._id },
          { $set: { correctiveActionTemplates: newTemplates, updatedAt: new Date() } }
        );
        console.log("Corrective-action templates updated.");
      }
    }
  }

  if (DRY_RUN) console.log("\n--dry-run set — no changes written.");
  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
