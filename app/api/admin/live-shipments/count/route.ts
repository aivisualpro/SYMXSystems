
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SymxPO from '@/lib/models/SymxPO';

export async function GET() {
  try {
    await connectToDatabase();

    const results = await SymxPO.aggregate([
      { $unwind: "$customerPO" },
      { $unwind: "$customerPO.shipping" },
      { 
        $match: { 
          "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
          "customerPO.shipping.status": "IN_TRANSIT"
        } 
      },
      { $group: { _id: "$customerPO.shipping.containerNo" } },
      { $count: "count" }
    ]);

    const count = results.length > 0 ? results[0].count : 0;
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to fetch live shipments count", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
