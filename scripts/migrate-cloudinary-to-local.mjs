#!/usr/bin/env node
/**
 * Migration script: Download all coaching writeup attachments from Cloudinary
 * and save them to public/uploads/, then update MongoDB documents with local URLs.
 *
 * Usage: node scripts/migrate-cloudinary-to-local.mjs
 */
import { MongoClient } from "mongodb";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load env manually
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

const UPLOADS_DIR = path.join(rootDir, "public", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

async function downloadFromCloudinary(publicId, resourceType = "image") {
  // Use the generate_archive API — the ONLY method that bypasses strict CDN access control
  const archiveUrl = cloudinary.utils.download_zip_url({
    public_ids: [publicId],
    resource_type: resourceType,
    flatten_folders: true,
  });

  const res = await fetch(archiveUrl);
  if (!res.ok) {
    console.error(`  ❌ Failed to download ${publicId}: ${res.status}`);
    return null;
  }

  const zipBuffer = Buffer.from(await res.arrayBuffer());

  // Write zip to temp, extract, get the file
  const tmpZip = path.join(UPLOADS_DIR, `_tmp_${Date.now()}.zip`);
  const tmpExtract = path.join(UPLOADS_DIR, `_tmp_${Date.now()}_extract`);
  fs.writeFileSync(tmpZip, zipBuffer);
  fs.mkdirSync(tmpExtract, { recursive: true });

  try {
    execSync(`unzip -o "${tmpZip}" -d "${tmpExtract}"`, { stdio: "pipe" });
  } catch (e) {
    console.error(`  ❌ unzip failed for ${publicId}`);
    fs.unlinkSync(tmpZip);
    fs.rmSync(tmpExtract, { recursive: true, force: true });
    return null;
  }

  // Find the extracted file
  const files = fs.readdirSync(tmpExtract).filter((f) => !f.startsWith("."));
  if (files.length === 0) {
    console.error(`  ❌ No files in zip for ${publicId}`);
    fs.unlinkSync(tmpZip);
    fs.rmSync(tmpExtract, { recursive: true, force: true });
    return null;
  }

  // Get the original filename from the public_id
  const originalName = publicId.split("/").pop() || files[0];
  const localFileName = `${Date.now()}-${originalName}`;
  const localPath = path.join(UPLOADS_DIR, localFileName);

  fs.copyFileSync(path.join(tmpExtract, files[0]), localPath);

  // Cleanup
  fs.unlinkSync(tmpZip);
  fs.rmSync(tmpExtract, { recursive: true, force: true });

  return `/uploads/${localFileName}`;
}

async function main() {
  console.log("🔄 Migrating Cloudinary attachments to local storage...\n");

  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const collection = db.collection("symxcoachingwriteups");

  // Find all records with files that have proxy URLs
  const records = await collection
    .find({ "files.url": { $regex: "^/api/proxy" } })
    .toArray();

  console.log(`Found ${records.length} records with proxy URLs\n`);

  let totalMigrated = 0;
  let totalFailed = 0;

  for (const record of records) {
    console.log(`📄 Record ${record._id}:`);
    const updatedFiles = [];

    for (const file of record.files || []) {
      if (file.url && file.url.startsWith("/api/proxy")) {
        // Extract public_id from the proxy URL
        const urlObj = new URL(file.url, "http://localhost");
        const pid = urlObj.searchParams.get("pid");
        const rt = urlObj.searchParams.get("rt") || "image";

        if (!pid) {
          console.log(`  ⚠️  No public_id in URL: ${file.url}`);
          updatedFiles.push(file);
          totalFailed++;
          continue;
        }

        console.log(`  📥 Downloading: ${pid}`);
        const localUrl = await downloadFromCloudinary(pid, rt);
        if (localUrl) {
          console.log(`  ✅ Saved to: ${localUrl}`);
          updatedFiles.push({ name: file.name, url: localUrl });
          totalMigrated++;
        } else {
          updatedFiles.push(file); // Keep original on failure
          totalFailed++;
        }
      } else {
        updatedFiles.push(file); // Already local, keep as-is
      }
    }

    // Update the record
    await collection.updateOne(
      { _id: record._id },
      { $set: { files: updatedFiles } }
    );
    console.log(`  ✏️  Updated record\n`);
  }

  console.log(`\n✅ Migration complete: ${totalMigrated} migrated, ${totalFailed} failed`);
  await mongo.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
