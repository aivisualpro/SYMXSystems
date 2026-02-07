import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SymxNotification from '@/lib/models/SymxNotification';

export async function GET() {
  try {
    await connectToDatabase();
    // Fetch notifications, sorted by newest first
    const notifications = await SymxNotification.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
