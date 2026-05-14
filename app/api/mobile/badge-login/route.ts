/**
 * POST /api/mobile/badge-login
 *
 * Public endpoint for mobile-app login (badge PIN or email).
 * Accepts EITHER:
 *   { badgeNumber: "1234" }            — PIN-style badge lookup
 *   { email: "driver@example.com" }   — email-based lookup
 *
 * Looks up an active SymxEmployee and returns a signed JWT that
 * the Flutter app stores as `x-badge-token`.
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

// ── GET — diagnostic: /api/mobile/badge-login?email=xxx ──
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "pass ?email=..." }, { headers: corsHeaders });
  await connectToDatabase();
  const exact   = await SymxEmployee.findOne({ email }).lean() as any;
  const lower   = await SymxEmployee.findOne({ email: email.toLowerCase() }).lean() as any;
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex   = await SymxEmployee.findOne({ email: { $regex: new RegExp(`^${escaped}$`, "i") } }).lean() as any;
  return NextResponse.json({
    query: { email, escaped: `^${escaped}$` },
    exact:  exact  ? { email: exact.email,  status: exact.status,  badge: exact.badgeNumber  } : null,
    lower:  lower  ? { email: lower.email,  status: lower.status,  badge: lower.badgeNumber  } : null,
    regex:  regex  ? { email: regex.email,  status: regex.status,  badge: regex.badgeNumber  } : null,
  }, { headers: corsHeaders });
}

// ── POST handler ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    // ── Validate: require badgeNumber OR email ──────────────────────
    if (!body?.badgeNumber && !body?.email) {
      return NextResponse.json(
        { error: "badgeNumber or email is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    await connectToDatabase();

    let employee: any = null;

    if (body.email) {
      // ── Email-based lookup ──────────────────────────────────────
      const emailRaw = String(body.email).trim();
      console.log(`[badge-login] Email lookup — raw: "${emailRaw}"`);

      // Strategy 1: case-insensitive regex
      const escapedEmail = emailRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      employee = await SymxEmployee.findOne({
        email: { $regex: new RegExp(`^${escapedEmail}$`, "i") },
      }).lean();

      // Strategy 2: exact lowercase fallback (in case regex fails)
      if (!employee) {
        employee = await SymxEmployee.findOne({
          email: emailRaw.toLowerCase(),
        }).lean();
      }

      // Strategy 3: exact as-typed fallback
      if (!employee) {
        employee = await SymxEmployee.findOne({ email: emailRaw }).lean();
      }

      console.log(`[badge-login] Email lookup result — found: ${!!employee}, status: ${employee?.status}`);

      if (!employee) {
        return NextResponse.json(
          { error: "No employee found with that email address." },
          { status: 401, headers: corsHeaders }
        );
      }
      if (employee.status !== "Active") {
        return NextResponse.json(
          { error: `Employee account is ${employee.status}. Please contact your administrator.` },
          { status: 403, headers: corsHeaders }
        );
      }
    } else {
      // ── Badge-number lookup (PIN) ───────────────────────────────
      const badgeNumber = String(body.badgeNumber).trim();

      // Escape regex special characters to prevent injection
      const escaped = badgeNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      employee = await SymxEmployee.findOne({
        badgeNumber: { $regex: new RegExp(`^${escaped}$`, "i") },
      }).lean();

      if (!employee || employee.status !== "Active") {
        return NextResponse.json(
          { error: "Invalid badge number." },
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // ── Build the public employee payload ──────────────────────────
    const firstName = (employee.firstName || "").trim();
    const lastName  = (employee.lastName  || "").trim();
    const employeePayload = {
      transporterId: employee.transporterId || "",
      badgeNumber:   employee.badgeNumber   || "",
      email:         employee.email         || "",
      firstName,
      lastName,
      fullName:      `${firstName} ${lastName}`.toUpperCase(),
      profileImage:  employee.profileImage  || "",
      type:          employee.type          || "",
    };

    // ── Sign a JWT (30-day expiry) ──────────────────────────────────
    const token = await new SignJWT({
      transporterId: employeePayload.transporterId,
      badgeNumber:   employeePayload.badgeNumber,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);

    const res = NextResponse.json(
      { success: true, employee: employeePayload, token },
      { status: 200, headers: corsHeaders }
    );
    // Bias the root-route chooser for returning drivers
    res.cookies.set("symx_role", "driver", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return res;
  } catch (err: any) {
    console.error("[mobile/badge-login] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
