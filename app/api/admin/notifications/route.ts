import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SymxNotification from '@/lib/models/SymxNotification';

export async function GET() {
  try {
    await requirePermission("Admin", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
