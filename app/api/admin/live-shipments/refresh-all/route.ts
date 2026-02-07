
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SymxPO from '@/lib/models/SymxPO';
import { refreshContainerTracking } from '@/lib/shipment-refresh';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Security check: Verify a secret token to prevent unauthorized triggers
  // In a real app, you'd set CRON_SECRET in your .env
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const token = searchParams.get('token');
  
  const SECRET = process.env.CRON_SECRET || 'vida-refresh-secret-123';
  
  if (token !== SECRET && authHeader !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();

    // Find all unique containers that are either IN_TRANSIT or PLANNED
    const results = await SymxPO.aggregate([
      { $unwind: "$customerPO" },
      { $unwind: "$customerPO.shipping" },
      { 
        $match: { 
          "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
          "customerPO.shipping.status": { $in: ["IN_TRANSIT", "PLANNED", "Booking Confirmed", "On Water"] }
        } 
      },
      { $group: { _id: "$customerPO.shipping.containerNo" } }
    ]);

    const containers = results.map(r => r._id);
    console.log(`Starting scheduled refresh for ${containers.length} containers at 9 AM...`);

    const summary = {
      total: containers.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process in sequence to avoid rate limits or use Promise.all with concurrency control
    for (const containerNo of containers) {
      try {
        await refreshContainerTracking(containerNo);
        summary.success++;
      } catch (err: any) {
        summary.failed++;
        summary.errors.push(`${containerNo}: ${err.message}`);
        console.error(`Failed to refresh ${containerNo}:`, err.message);
      }
    }

    return NextResponse.json({
      message: 'Refresh completed',
      timestamp: new Date().toISOString(),
      summary
    });
  } catch (error: any) {
    console.error('Refresh All Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh shipments' },
      { status: 500 }
    );
  }
}
