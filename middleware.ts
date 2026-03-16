import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);

// Only these paths are publicly accessible (no auth required)
const publicPaths = [
  "/login",
  "/forgot-password",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/public/",
  "/api/messaging/webhook",
  "/c/",
];

function isPublicPath(path: string) {
  return publicPaths.some((p) => path === p || path.startsWith(p));
}

function isStaticAsset(path: string) {
  return (
    path.startsWith("/_next") ||
    path === "/sw.js" ||
    path === "/manifest.json" ||
    path.startsWith("/icons/") ||
    path === "/favicon.ico" ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico") ||
    path.endsWith(".webmanifest")
  );
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip static assets
  if (isStaticAsset(path)) {
    return NextResponse.next();
  }

  // Allow public paths
  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  // ── Everything else requires authentication ──
  const sessionCookie = req.cookies.get("symx_session")?.value;

  // No cookie at all → redirect pages to /login, reject APIs with 401
  if (!sessionCookie) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Validate the JWT (not just that a cookie exists — verify signature + expiration)
  try {
    await jwtVerify(sessionCookie, key, { algorithms: ["HS256"] });
  } catch {
    // Invalid or expired token → clear cookie and redirect
    const response = path.startsWith("/api/")
      ? NextResponse.json({ error: "Session expired" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.nextUrl));

    response.cookies.set("symx_session", "", { expires: new Date(0), path: "/" });
    return response;
  }

  // If authenticated user tries to visit /login, redirect to dashboard
  if (path === "/login") {
    return NextResponse.redirect(new URL("/profile", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons\\/.*|.*\\.png$).*)"],
};
