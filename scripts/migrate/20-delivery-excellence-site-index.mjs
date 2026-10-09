#!/usr/bin/env node
import { MongoClient } from "mongodb";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");
const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "20-delivery-excellence-site-index" });
const collectionName = "ScoreCard_DeliveryExcellence";
const legacyKey = { week: 1, transporterId: 1 };
const legacyName = "week_1_transporterId_1";
const canonicalKey = { siteId: 1, week: 1, transporterId: 1 };
const canonicalName = "siteId_1_week_1_transporterId_1";
const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function inspect(collection) {
  const [indexes, documents, incomplete, duplicates] = await Promise.all([
    collection.indexes(),
    collection.find({}).sort({ _id: 1 }).toArray(),
    collection.countDocuments({ $or: [
      { siteId: { $exists: false } }, { siteId: null },
      { week: { $exists: false } }, { week: null }, { week: "" },
      { transporterId: { $exists: false } }, { transporterId: null }, { transporterId: "" },
    ] }),
    collection.aggregate([
      { $match: { siteId: { $exists: true, $ne: null }, week: { $type: "string", $ne: "" }, transporterId: { $type: "string", $ne: "" } } },
      { $group: { _id: { siteId: "$siteId", week: "$week", transporterId: "$transporterId" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray(),
  ]);
  const fingerprint = createHash("sha256").update(JSON.stringify(documents)).digest("hex");
  return { indexes, total: documents.length, fingerprint, incomplete, duplicates };
}

async function main() {
  const client = await connectWithDiagnostics(MongoClient, uri);
  try {
    const collection = client.db().collection(collectionName);
    const before = await inspect(collection);
    console.log(`Records: ${before.total}; incomplete identities: ${before.incomplete}; duplicate groups: ${before.duplicates.length}`);
    console.log(`Indexes: ${before.indexes.map(index => index.name).join(", ")}`);
    if (before.incomplete || before.duplicates.length) throw new Error("Preflight failed; no indexes were changed.");

    const canonical = before.indexes.find(index => index.unique && sameKey(index.key, canonicalKey));
    const legacy = before.indexes.find(index => index.name === legacyName);
    if (legacy && (!legacy.unique || !sameKey(legacy.key, legacyKey))) {
      throw new Error(`${legacyName} exists with an unexpected definition; no indexes were changed.`);
    }
    if (dryRun) {
      console.log(`Would create canonical index: ${!canonical}`);
      console.log(`Would remove legacy index: ${Boolean(legacy)}`);
      return;
    }

    if (!canonical) await collection.createIndex(canonicalKey, { unique: true, name: canonicalName });
    const verified = (await collection.indexes()).find(index => index.unique && sameKey(index.key, canonicalKey));
    if (!verified) throw new Error("Canonical unique index was not verified; legacy index was preserved.");
    if (legacy) await collection.dropIndex(legacy.name);

    const after = await inspect(collection);
    if (!after.indexes.some(index => index.unique && sameKey(index.key, canonicalKey))) throw new Error("Canonical index missing after migration.");
    if (after.indexes.some(index => index.name === legacyName)) throw new Error("Legacy index remains after migration.");
    if (after.total !== before.total) throw new Error("Document count changed unexpectedly.");
    if (after.fingerprint !== before.fingerprint) throw new Error("Document contents changed unexpectedly.");
    console.log(`Verified ${canonicalName}; documents modified: 0.`);
  } finally {
    await client.close();
  }
}

main().catch(error => { console.error(error.message); process.exit(1); });
