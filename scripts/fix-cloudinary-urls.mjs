#!/usr/bin/env node
/**
 * Fix existing proxy URLs → direct Cloudinary CDN URLs
 * Usage: node scripts/fix-cloudinary-urls.mjs
 */
import { MongoClient } from "mongodb";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load .env
const envFile = fs.readFileSync(path.join(rootDir, ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = db.collection("symxcoachingwriteups");

  const records = await col.find({ "files.url": { $regex: "^/api/proxy" } }).toArray();
  console.log(`Found ${records.length} records with proxy URLs\n`);

  for (const rec of records) {
    const updated = [];
    for (const f of rec.files || []) {
      if (f.url?.startsWith("/api/proxy")) {
        const urlObj = new URL(f.url, "http://localhost");
        const pid = urlObj.searchParams.get("pid");
        const rt = urlObj.searchParams.get("rt") || "image";
        if (pid) {
          try {
            const info = await cloudinary.api.resource(pid, { resource_type: rt });
            console.log(`  ✅ ${pid} → ${info.secure_url}`);
            updated.push({ name: f.name, url: info.secure_url });
            continue;
          } catch (e) {
            console.error(`  ❌ ${pid}: ${e.message}`);
          }
        }
      }
      updated.push(f);
    }
    await col.updateOne({ _id: rec._id }, { $set: { files: updated } });
    console.log(`  Updated record ${rec._id}\n`);
  }

  console.log("Done!");
  await mongo.close();
}

main().catch(e => { console.error(e); process.exit(1); });
