/**
 * One-time migration: Convert base64 profilePicture & signature
 * in SYMXUsers to Cloudinary URLs, then compact the collection.
 *
 * Run with: npx tsx scripts/migrate-base64-to-cloudinary.ts
 */

import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://adeel_db_user:MX3ZW3LRoVYHob1g@symxproduction.e1h4x4o.mongodb.net/SYMXProduction";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dw7rpned8",
    api_key: process.env.CLOUDINARY_API_KEY || "595728568351393",
    api_secret: process.env.CLOUDINARY_API_SECRET || "V8aoO9kRSosN6ktKv3EHSywYVhg",
});

function isBase64(str: string): boolean {
    return typeof str === "string" && str.startsWith("data:image/");
}

async function uploadBase64(base64: string, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            base64,
            { folder, resource_type: "auto" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result!.secure_url);
            }
        );
    });
}

async function main() {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected.\n");

    const db = mongoose.connection.db!;
    const collection = db.collection("SYMXUsers");

    // Get stats before
    const statsBefore: any = await db.command({ collStats: "SYMXUsers" });
    console.log(`📊 BEFORE: SYMXUsers size = ${(statsBefore.size / 1024).toFixed(1)} KB, docs = ${statsBefore.count}, avgObjSize = ${(statsBefore.avgObjSize / 1024).toFixed(1)} KB\n`);

    // Find users with base64 images
    const users = await collection.find({
        $or: [
            { profilePicture: { $regex: "^data:image/" } },
            { signature: { $regex: "^data:image/" } },
        ],
    }).toArray();

    console.log(`🔍 Found ${users.length} user(s) with base64 images.\n`);

    let migrated = 0;
    let errors = 0;

    for (const user of users) {
        const updates: any = {};
        const name = (user as any).name || user._id;

        try {
            if ((user as any).profilePicture && isBase64((user as any).profilePicture)) {
                const picSize = ((user as any).profilePicture.length / 1024).toFixed(1);
                process.stdout.write(`  👤 ${name}: uploading profilePicture (${picSize} KB)...`);
                const url = await uploadBase64((user as any).profilePicture, "symx-systems/users/profile");
                updates.profilePicture = url;
                console.log(` ✅ → ${url.substring(0, 60)}...`);
            }

            if ((user as any).signature && isBase64((user as any).signature)) {
                const sigSize = ((user as any).signature.length / 1024).toFixed(1);
                process.stdout.write(`  ✍️  ${name}: uploading signature (${sigSize} KB)...`);
                const url = await uploadBase64((user as any).signature, "symx-systems/users/signature");
                updates.signature = url;
                console.log(` ✅ → ${url.substring(0, 60)}...`);
            }

            if (Object.keys(updates).length > 0) {
                await collection.updateOne({ _id: user._id }, { $set: updates });
                migrated++;
            }
        } catch (err: any) {
            console.error(` ❌ Error: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n📦 Migration complete: ${migrated} migrated, ${errors} errors.\n`);

    // Run compact to reclaim space (requires admin or appropriate role)
    try {
        console.log("🗜️  Running compact on SYMXUsers to reclaim disk space...");
        await db.command({ compact: "SYMXUsers" });
        console.log("✅ Compact complete.\n");
    } catch (err: any) {
        console.log(`⚠️  Compact not available (Atlas may handle this automatically): ${err.message}\n`);
    }

    // Get stats after
    const statsAfter: any = await db.command({ collStats: "SYMXUsers" });
    console.log(`📊 AFTER: SYMXUsers size = ${(statsAfter.size / 1024).toFixed(1)} KB, docs = ${statsAfter.count}, avgObjSize = ${(statsAfter.avgObjSize / 1024).toFixed(1)} KB`);
    console.log(`💾 Space saved: ${((statsBefore.size - statsAfter.size) / 1024).toFixed(1)} KB\n`);

    await mongoose.disconnect();
    console.log("🔌 Disconnected. Done!");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
