/**
 * GET /app – Serve the Flutter web SPA.
 *
 * This route handler serves the Flutter web index.html directly,
 * bypassing all Next.js layouts, providers, and session auth.
 * The Flutter app handles its own badge-based JWT auth.
 *
 * Static assets (JS, CSS, images) are served from public/app/
 * by Next.js's built-in static file serving.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Try to read the Flutter web index.html from public/app/
  const htmlPath = join(process.cwd(), "public", "app", "index.html");

  if (!existsSync(htmlPath)) {
    return new NextResponse(
      `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SYMX App</title></head>
<body style="margin:0;background:#0A0E1A;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
  <div style="text-align:center">
    <h2>SYMX Driver App</h2>
    <p style="opacity:0.6">The app build is not available yet.<br>Please try again shortly.</p>
  </div>
</body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const html = readFileSync(htmlPath, "utf-8");
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
