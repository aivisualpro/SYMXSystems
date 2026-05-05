import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Build-time constants — baked in at deploy
const BUILD_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
  || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
  || "dev";

export async function GET() {
  const res = NextResponse.json({ version: BUILD_VERSION });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
