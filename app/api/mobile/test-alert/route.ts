/**
 * POST /api/mobile/test-alert
 *
 * Lets a signed-in driver send THEMSELVES a test safety alert, so a phone
 * can be verified (sound, spoken message, lock-screen behaviour) right after
 * it is provisioned — without waiting for a real Netradyne event.
 * Auth: JWT in x-badge-token (same as the rest of /api/mobile/*).
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import { orgWide } from "@/lib/scoped-query";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { sendSafetyAlertPush } from "@/lib/firebase-admin";

const key = new TextEncoder().encode(process.env.JWT_SECRET || "symx_systems_secret_key");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-badge-token");
    if (!token) return NextResponse.json({ error: "Missing x-badge-token header" }, { status: 401, headers: corsHeaders });
    let payload: any;
    try {
      payload = (await jwtVerify(token, key, { algorithms: ["HS256"] })).payload;
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
    }
    const transporterId = String(payload.transporterId || "").trim().toUpperCase();
    if (!transporterId) return NextResponse.json({ error: "Invalid token payload" }, { status: 401, headers: corsHeaders });

    await connectToDatabase();
    const emp: any = await orgWide(
      SymxEmployee.findOne({ transporterId, status: "Active" }, { fcmToken: 1, firstName: 1, lastName: 1 }).lean(),
      "a driver sending a test alert to their own phone — identity comes from the verified token",
    );
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 401, headers: corsHeaders });
    if (!emp.fcmToken) {
      return NextResponse.json({ ok: false, error: "This phone isn't registered for alerts yet. Sign out and back in, then try again." }, { status: 200, headers: corsHeaders });
    }

    const result = await sendSafetyAlertPush(emp.fcmToken, {
      transporterId,
      driverName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      typeDescription: "This is a test of your safety alert system",
      subTypeDescription: "",
      severityDescription: "Test",
      netradyneAlertId: `test-${transporterId}-${Date.now()}`,
    });
    return NextResponse.json(result.ok ? { ok: true } : { ok: false, error: result.reason }, { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[mobile/test-alert]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
