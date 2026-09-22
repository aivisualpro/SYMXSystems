/**
 * POST /api/mobile/device-token
 *
 * Registers (or refreshes) the driver app's Firebase Cloud Messaging
 * token for the signed-in employee, so the Netradyne safety-alert webhook
 * (and any future push notifications) can reach their phone. Called on
 * login and whenever the app detects the FCM token has rotated.
 *
 * Same auth pattern as the rest of /api/mobile/* — JWT in x-badge-token,
 * not the cookie-based web session.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import { orgWide } from "@/lib/scoped-query";
import SymxEmployee from "@/lib/models/SymxEmployee";

const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);

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
    if (!token) {
      return NextResponse.json({ error: "Missing x-badge-token header" }, { status: 401, headers: corsHeaders });
    }

    let payload: any;
    try {
      const result = await jwtVerify(token, key, { algorithms: ["HS256"] });
      payload = result.payload;
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
    }

    const { transporterId, badgeNumber } = payload;
    if (!transporterId && !badgeNumber) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const fcmToken = (body?.fcmToken || "").trim();
    if (!fcmToken) {
      return NextResponse.json({ error: "fcmToken is required" }, { status: 400, headers: corsHeaders });
    }

    await connectToDatabase();

    const escaped = badgeNumber ? String(badgeNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
    const query = transporterId
      ? { transporterId }
      : { badgeNumber: { $regex: new RegExp(`^${escaped}$`, "i") } };

    const employee: any = await orgWide(
      SymxEmployee.findOne(query),
      "resolving the signed-in driver's own record to store their device token — identity comes from their verified token, not a search"
    );

    if (!employee || employee.status !== "Active") {
      return NextResponse.json({ error: "Employee not found or inactive" }, { status: 401, headers: corsHeaders });
    }

    // A device token belongs to whichever driver most recently logged in
    // on that phone — clearing it from any other employee record it was
    // previously attached to (e.g. a shared/handed-down device) avoids a
    // safety alert being pushed to the wrong person's old phone.
    await orgWide(
      SymxEmployee.updateMany(
        { fcmToken, transporterId: { $ne: employee.transporterId } },
        { $set: { fcmToken: "" } }
      ),
      "clearing a device token from whichever employee previously held it, since device tokens are per-phone, not per-employee, and a handed-down or shared device must not keep alerting its old user"
    );

    employee.fcmToken = fcmToken;
    employee.fcmTokenUpdatedAt = new Date();
    await employee.save();

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[mobile/device-token] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
