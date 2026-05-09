/**
 * POST /api/mobile/badge-login
 *
 * Public endpoint for mobile-app badge-number login (PIN-style).
 * Looks up an active SymxEmployee by badgeNumber and returns a
 * signed JWT that the Flutter app stores as `x-badge-token`.
 *
 * This is a parallel auth path — it does NOT touch the existing
 * cookie-based session flow in lib/auth.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";

// ── JWT secret (reuse the same secret used by the main auth system) ──
const secretKey = process.env.JWT_SECRET || (() => {
  console.warn(
    "⚠️  JWT_SECRET is not set — using fallback. Set it in Vercel env vars for production."
  );
  return "symx_systems_secret_key";
})();
const key = new TextEncoder().encode(secretKey);

// ── CORS headers applied to every response ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── OPTIONS preflight ──
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ── POST handler ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body?.badgeNumber) {
      return NextResponse.json(
        { error: "badgeNumber is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const badgeNumber = String(body.badgeNumber).trim();

    // Escape regex special characters to prevent injection
    const escaped = badgeNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    await connectToDatabase();

    // Case-insensitive lookup by badgeNumber
    const employee = await SymxEmployee.findOne({
      badgeNumber: { $regex: new RegExp(`^${escaped}$`, "i") },
    }).lean();

    if (!employee || employee.status !== "Active") {
      return NextResponse.json(
        { error: "Invalid badge number" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Build the public employee payload
    const firstName = (employee.firstName || "").trim();
    const lastName = (employee.lastName || "").trim();
    const employeePayload = {
      transporterId: employee.transporterId || "",
      badgeNumber: employee.badgeNumber || "",
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.toUpperCase(),
      profileImage: employee.profileImage || "",
      type: employee.type || "",
    };

    // Sign a JWT (30-day expiry)
    const token = await new SignJWT({
      transporterId: employeePayload.transporterId,
      badgeNumber: employeePayload.badgeNumber,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);

    return NextResponse.json(
      { success: true, employee: employeePayload, token },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/badge-login] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
