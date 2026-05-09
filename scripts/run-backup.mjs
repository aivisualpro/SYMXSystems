/**
 * Manual MongoDB backup runner.
 *
 * Usage:
 *   npm run backup
 *
 * Reads MONGODB_URI + CLOUDINARY_* from .env (matching the project's existing pattern),
 * dumps every collection to a single gzipped JSON, and uploads to Cloudinary as a
 * raw resource under: mongodb-backups/<YYYY-MM-DD>/full-backup-<timestamp>.json.gz
 *
 * Each run creates a NEW dated file — nothing is ever overwritten.
 */

import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { gzip } from "zlib";
import { promisify } from "util";
import { readFileSync } from "fs";
import { resolve } from "path";

const gzipAsync = promisify(gzip);

// --- Load .env (same lightweight pattern as scripts/migrate-confirmations.mjs)
const envPath = resolve(process.cwd(), ".env");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf-8");
} catch {
  console.error(`Couldn't read ${envPath} — make sure you run this from the project root.`);
  process.exit(1);
}
const env = {};
envContent.split("\n").forEach((line) => {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
});

const required = [
  "MONGODB_URI",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const startedAt = Date.now();

console.log("→ Connecting to MongoDB…");
await mongoose.connect(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
});

const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();
console.log(`→ Found ${collections.length} collections in "${db.databaseName}"`);

const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const timestamp = now.getTime();

const backup = {
  metadata: {
    database: db.databaseName,
    createdAt: now.toISOString(),
    collectionCount: collections.length,
    collections: collections.map((c) => c.name),
  },
  collections: {},
};

let totalDocs = 0;
for (const col of collections) {
  if (col.name.startsWith("system.")) continue;
  const docs = await db.collection(col.name).find({}).toArray();
  backup.collections[col.name] = docs;
  totalDocs += docs.length;
  process.stdout.write(`  • ${col.name}: ${docs.length} docs\n`);
}

console.log(`→ Total documents: ${totalDocs}`);

const json = JSON.stringify(backup);
const compressed = await gzipAsync(Buffer.from(json));
console.log(
  `→ Compressed ${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MB → ${(compressed.length / 1024 / 1024).toFixed(2)} MB`,
);

const publicId = `mongodb-backups/${dateStr}/full-backup-${timestamp}`;
console.log(`→ Uploading to Cloudinary as ${publicId}…`);

const uploadResult = await new Promise((res, rej) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      resource_type: "raw",
      public_id: publicId,
      overwrite: false,
      use_filename: false,
      unique_filename: false,
      tags: ["mongodb-backup", `date:${dateStr}`, `db:${db.databaseName}`],
    },
    (err, r) => (err ? rej(err) : res(r)),
  );
  stream.end(compressed);
});

await mongoose.disconnect();

console.log("\n Backup complete");
console.log("   Date         :", dateStr);
console.log("   Collections  :", collections.length);
console.log("   Documents    :", totalDocs);
console.log("   Size         :", (compressed.length / 1024 / 1024).toFixed(2), "MB (gzipped)");
console.log("   URL          :", uploadResult.secure_url);
console.log("   Duration     :", ((Date.now() - startedAt) / 1000).toFixed(1), "s");
