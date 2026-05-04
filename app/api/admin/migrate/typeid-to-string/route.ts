import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

/**
 * ONE-TIME MIGRATION
 * Converts typeId fields stored as BSON ObjectId → plain String
 * in both SYMXEmployeeSchedules and SYMXRoutes collections.
 *
 * DELETE THIS FILE after confirming the migration ran successfully.
 *
 * Run: GET /api/admin/migrate/typeid-to-string
 */
export async function GET() {
    await connectToDatabase();
    const db = mongoose.connection.db!;

    const results: Record<string, any> = {};

    for (const collectionName of ["SYMXEmployeeSchedules", "SYMXRoutes"]) {
        const col = db.collection(collectionName);

        // Find all documents where typeId is stored as a BSON ObjectId (not a string)
        // $type 7 = ObjectId in BSON type codes
        const cursor = col.find({ typeId: { $type: 7 } }, { projection: { _id: 1, typeId: 1 } });
        const docs = await cursor.toArray();

        console.log(`[Migration] ${collectionName}: found ${docs.length} docs with ObjectId typeId`);

        if (docs.length === 0) {
            results[collectionName] = { found: 0, updated: 0 };
            continue;
        }

        // Build bulk ops: convert each ObjectId typeId to its hex string equivalent
        const bulkOps = docs.map((doc: any) => ({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: { typeId: String(doc.typeId) } },
            },
        }));

        const result = await col.bulkWrite(bulkOps, { ordered: false });
        results[collectionName] = {
            found: docs.length,
            updated: result.modifiedCount,
        };

        console.log(`[Migration] ${collectionName}: converted ${result.modifiedCount} ObjectId typeIds to String`);
    }

    return NextResponse.json({
        success: true,
        message: "typeId ObjectId → String migration complete. Delete this route file.",
        results,
    });
}
