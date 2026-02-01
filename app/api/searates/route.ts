
import { NextResponse } from 'next/server';
import { refreshContainerTracking } from '@/lib/shipment-refresh';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const container = searchParams.get('container');

  if (!container) {
    return NextResponse.json({ error: 'Container number is required' }, { status: 400 });
  }

  try {
    const data = await refreshContainerTracking(container);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('SeaRates Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tracking data' },
      { status: 500 }
    );
  }
}
