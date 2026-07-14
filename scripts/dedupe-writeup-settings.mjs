#!/usr/bin/env node
/**
 * One-time cleanup for the WriteupSettings "single document" collection.
 *
 * getSettings() (lib/writeup-logic.ts) has been auto-creating a
 * WriteupSettings document via findOne()+create({}) on basically every
 * write-up action (recommend, create, corrective-action lookup, verbal
 * coaching context) since before this schema had correctiveActionTemplates
 * / defaultConsequences fields. Nothing in the DB enforces "only one
 * document" — if that auto-create ever raced with itself, or ran before
 * the admin settings page existed, more than one document can exist. When
 * that happens, GET and PUT on /api/admin/writeup-settings could silently
 * read/write different documents (bare findOne(), no sort), making saved
 * changes on the settings page appear to vanish on reload.
 *
 * This script merges every WriteupSettings document into one (keeping the
 * earliest by _id, matching the app's now-deterministic sort order),
 * unions stackGroups, merges correctiveActionTemplates by category
 * (preferring non-blank entries, then the most recently updated document's
 * version), and takes scalar fields from whichever document was most
 * recently updated. Stray documents are then deleted.
 *
 * Usage:
 *   node scripts/dedupe-writeup-settings.mjs           # merges and writes
 *   node scripts/dedupe-writeup-settings.mjs --dry-run # preview only
 */
import { MongoClient, ObjectId } from "mongodb";
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

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = db.collection("SYMXWriteupSettings");

  const docs = await col.find({}).sort({ _id: 1 }).toArray();
  console.log(`Found ${docs.length} WriteupSettings document(s).`);

  if (docs.length <= 1) {
    console.log("Nothing to merge — 0 or 1 document, already canonical.");
    await mongo.close();
    return;
  }

  const canonical = docs[0];
  const rest = docs.slice(1);
  console.log(`Canonical (kept) document: ${canonical._id}`);
  console.log(`Merging and removing: ${rest.map((d) => d._id).join(", ")}\n`);

  const byUpdatedAtDesc = [...docs].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );
  const mostRecentlyTouched = byUpdatedAtDesc[0];

  // Scalar fields — take from whichever doc was most recently updated.
  const merged = {
    lookbackDays: mostRecentlyTouched.lookbackDays ?? canonical.lookbackDays,
    escalationThresholds: mostRecentlyTouched.escalationThresholds ?? canonical.escalationThresholds,
    defaultConsequences: mostRecentlyTouched.defaultConsequences ?? canonical.defaultConsequences,
    updatedBy: mostRecentlyTouched.updatedBy ?? canonical.updatedBy,
  };

  // stackGroups — union of unique groups (dedupe by sorted, normalized
  // member set) across every document.
  const seenGroups = new Set();
  const stackGroups = [];
  for (const doc of docs) {
    for (const group of doc.stackGroups || []) {
      const key = [...group].map(normalize).sort().join("|");
      if (key && !seenGroups.has(key)) {
        seenGroups.add(key);
        stackGroups.push(group);
      }
    }
  }
  merged.stackGroups = stackGroups;

  // correctiveActionTemplates — merge by normalized categoryLabel. If two
  // documents both have a template for the same category, prefer whichever
  // has a non-blank planForImprovement, breaking ties by most recently
  // updated document.
  const templatesByCategory = new Map();
  for (const doc of byUpdatedAtDesc) {
    for (const t of doc.correctiveActionTemplates || []) {
      const key = normalize(t.categoryLabel);
      if (!key) continue;
      const existing = templatesByCategory.get(key);
      if (!existing) {
        templatesByCategory.set(key, t);
      } else if (!existing.planForImprovement?.trim() && t.planForImprovement?.trim()) {
        // existing was blank, this doc has real content — prefer it
        templatesByCategory.set(key, t);
      }
      // otherwise keep existing (already from a more-recently-updated doc,
      // or already has content)
    }
  }
  merged.correctiveActionTemplates = Array.from(templatesByCategory.values());

  console.log("Merged result:");
  console.log(`  lookbackDays: ${merged.lookbackDays}`);
  console.log(`  stackGroups: ${merged.stackGroups.length} group(s)`);
  console.log(`  correctiveActionTemplates: ${merged.correctiveActionTemplates.length} template(s) — ${merged.correctiveActionTemplates.map((t) => t.categoryLabel).join(", ")}`);
  console.log(`  defaultConsequences: ${merged.defaultConsequences ? "(set)" : "(blank)"}`);

  if (DRY_RUN) {
    console.log("\n--dry-run set — no changes written.");
    await mongo.close();
    return;
  }

  await col.updateOne({ _id: new ObjectId(canonical._id) }, { $set: merged });
  const deleteResult = await col.deleteMany({ _id: { $in: rest.map((d) => new ObjectId(d._id)) } });
  console.log(`\nUpdated ${canonical._id}, deleted ${deleteResult.deletedCount} duplicate document(s). Done.`);

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
