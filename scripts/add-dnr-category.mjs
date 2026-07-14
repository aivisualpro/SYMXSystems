#!/usr/bin/env node
/**
 * One-time setup: adds "Delivered Not Received" as a new real write-up
 * category (DropdownOption, type "metric") so it's selectable in the New
 * Write-Up form and the seeded corrective-action template for it
 * (lib/models/WriteupSettings.ts) actually matches a real category
 * instead of being orphaned.
 *
 * Safe to run more than once — does nothing if the category already
 * exists (matches the model's unique index on description+type).
 *
 * Usage:
 *   node scripts/add-dnr-category.mjs           # creates it
 *   node scripts/add-dnr-category.mjs --dry-run # preview only
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

const NEW_CATEGORY = "Delivered Not Received";

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = db.collection("SYMXDropdownOptions");

  const existing = await col.findOne({ description: NEW_CATEGORY, type: "metric" });
  if (existing) {
    console.log(`"${NEW_CATEGORY}" already exists (type: metric) — nothing to do.`);
    await mongo.close();
    return;
  }

  const metricOptions = await col.find({ type: "metric" }, { projection: { sortOrder: 1 } }).toArray();
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

  console.log(`Will insert: ${JSON.stringify(doc, null, 2)}`);

  if (DRY_RUN) {
    console.log("\n--dry-run set — no changes written.");
    await mongo.close();
    return;
  }

  await col.insertOne(doc);
  console.log(`\nInserted "${NEW_CATEGORY}" as a new metric category.`);

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
