/**
 * GET /api/mobile/me
 *
 * Returns the currently authenticated mobile employee by reading
 * the JWT from the `x-badge-token` header.
 *
 * This is a parallel auth path — it does NOT touch the existing
 * cookie-based session flow in lib/auth.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";

// ── JWT secret (same as badge-login) ──
const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);

// ── CORS headers ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

// ── OPTIONS preflight ──
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ── GET handler ──
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-badge-token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing x-badge-token header" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify and decode the JWT
    let payload: any;
    try {
      const result = await jwtVerify(token, key, {
        algorithms: ["HS256"],
      });
      payload = result.payload;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { transporterId, badgeNumber } = payload;

    if (!transporterId && !badgeNumber) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401, headers: corsHeaders }
      );
    }

    await connectToDatabase();

    // Look up the employee by transporterId or badgeNumber from the token
    const escaped = badgeNumber
      ? String(badgeNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "";
    const query = transporterId
      ? { transporterId }
      : { badgeNumber: { $regex: new RegExp(`^${escaped}$`, "i") } };

    const employee = await SymxEmployee.findOne(query).lean();

    if (!employee || employee.status !== "Active") {
      return NextResponse.json(
        { error: "Employee not found or inactive" },
        { status: 401, headers: corsHeaders }
      );
    }

    const firstName = (employee.firstName || "").trim();
    const lastName = (employee.lastName || "").trim();

    return NextResponse.json(
      {
        success: true,
        employee: {
          transporterId: employee.transporterId || "",
          badgeNumber: employee.badgeNumber || "",
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.toUpperCase(),
          profileImage: employee.profileImage || "",
          type: employee.type || "",
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/me] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
