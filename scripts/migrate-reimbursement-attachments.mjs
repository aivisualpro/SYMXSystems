/**
 * Migration: Reimbursement attachment path → full AppSheet URL
 *
 * Converts values like:
 *   Reimbursement_Images/47b0e4fd.Attachment.015551.jpg
 * To:
 *   https://www.appsheet.com/template/gettablefileurl?appName=SYMXV2-356960575&appId=4b46e28c-e7e4-464d-a16c-2672b0e0390a&tableName=Reimbursement&fileName=Reimbursement_Images%2F47b0e4fd.Attachment.015551.jpg
 *
 * Also populates the `attachments` array with the resolved URL.
 *
 * Usage:
 *   node scripts/migrate-reimbursement-attachments.mjs
 *
 * Requires MONGODB_URI in .env or .env.local
 */


import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in environment. Add it to .env or .env.local");
  process.exit(1);
}

const BASE_URL =
  "https://www.appsheet.com/template/gettablefileurl?appName=SYMXV2-356960575&appId=4b46e28c-e7e4-464d-a16c-2672b0e0390a&tableName=Reimbursement&fileName=";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("✅ Connected to MongoDB");

  const db = client.db(); // uses DB from the URI
  const collection = db.collection("symxreimbursements");

  // Find all records where attachment is a relative path (not already a URL)
  const cursor = collection.find({
    attachment: { $exists: true, $ne: "", $ne: null },
    $and: [
      { attachment: { $not: /^https?:\/\// } }, // not already a URL
    ],
  });

  const docs = await cursor.toArray();
  console.log(`📋 Found ${docs.length} records with relative attachment paths\n`);

  if (docs.length === 0) {
    console.log("Nothing to migrate.");
    await client.close();
    return;
  }

  // Preview first 5
  console.log("── Preview (first 5) ──");
  for (const doc of docs.slice(0, 5)) {
    const encoded = encodeURIComponent(doc.attachment);
    const fullUrl = BASE_URL + encoded;
    console.log(`  ${doc.attachment}`);
    console.log(`  → ${fullUrl}\n`);
  }

  // Perform bulk update
  const bulkOps = docs.map((doc) => {
    const encoded = encodeURIComponent(doc.attachment);
    const fullUrl = BASE_URL + encoded;
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            attachment: fullUrl,
            attachments: [fullUrl],
          },
        },
      },
    };
  });

  console.log(`\n⏳ Running bulk update for ${bulkOps.length} records...`);
  const result = await collection.bulkWrite(bulkOps);
  console.log(`✅ Done!`);
  console.log(`   Matched:  ${result.matchedCount}`);
  console.log(`   Modified: ${result.modifiedCount}`);

  await client.close();
  console.log("🔌 Disconnected from MongoDB");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
