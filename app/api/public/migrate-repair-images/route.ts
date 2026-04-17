import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VehicleRepair from "@/lib/models/VehicleRepair";

export async function GET() {
  try {
    await connectToDatabase();
    
    // Find docs that still have the old 'image' field using the raw mongo driver to bypass mongoose schema stripping
    const repairsWithImage = await VehicleRepair.collection.find({ 
      image: { $exists: true, $ne: "" }, 
    }).toArray();

    let migrated = 0;
    for (const doc of repairsWithImage) {
      if (!doc.images) doc.images = [];
      const imageStr = (doc as any).image;
      if (!doc.images.includes(imageStr)) {
         doc.images.push(imageStr);
      }
      
      // We must use collection.updateOne to do $unset to effectively remove the field from mongo completely
      await VehicleRepair.collection.updateOne(
        { _id: doc._id }, 
        { 
          $set: { images: doc.images },
          $unset: { image: "" }
        }
      );
      migrated++;
    }

    // Now safely unset 'image' on all records where it might be empty string or anything else
    const unsetAll = await VehicleRepair.collection.updateMany({}, { $unset: { image: "" } });

    return NextResponse.json({ 
      success: true, 
      migratedCount: migrated, 
      purgedCount: unsetAll.modifiedCount 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
