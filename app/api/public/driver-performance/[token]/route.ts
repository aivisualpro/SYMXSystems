import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { loadPublicDriverPerformance } from "@/lib/driver-ranking/driver-performance-public";
import { publicDriverPerformanceEnabled } from "@/lib/driver-ranking/driver-performance-public-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    if (!publicDriverPerformanceEnabled()) {
      return NextResponse.json({ error: "This performance link is invalid or inactive." }, { status: 404 });
    }
    const { token } = await context.params;
    await connectToDatabase();
    const data = await loadPublicDriverPerformance(token, request.nextUrl.searchParams.get("week") || undefined);
    if (!data) return NextResponse.json({ error: "This performance link is invalid or inactive." }, { status: 404 });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    const unavailable = String(error?.message || "").includes("not available");
    return NextResponse.json({ error: unavailable ? error.message : "Performance data is unavailable." }, { status: unavailable ? 400 : 500 });
  }
}
