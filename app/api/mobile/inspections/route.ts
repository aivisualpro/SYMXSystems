/**
 * POST /api/mobile/inspections
 *
 * Allows a driver to submit a vehicle inspection from the mobile app.
 * Auth: JWT via `x-badge-token` header (same as my-routes).
 *
 * Delegates to the shared `createInspectionForRoute` helper which
 * handles vehicle resolution, idempotency, and SYMXRoute write-back.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import DailyInspection from "@/lib/models/DailyInspection";
import Vehicle from "@/lib/models/Vehicle";
import { createInspectionForRoute } from "@/lib/inspections/createInspectionForRoute";

// ── JWT secret ──
const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);

// ── CORS headers ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ── GET: fetch inspection by routeId, or last mileage for a van ──
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-badge-token");
    if (!token) {
      return NextResponse.json(
        { error: "Missing x-badge-token header" },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await jwtVerify(token, key, { algorithms: ["HS256"] });
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);

    // ── Route-based lookup: GET /api/mobile/inspections?routeId=... ──
    const routeId = searchParams.get("routeId");
    if (routeId) {
      const inspection = await DailyInspection.findOne({ routeId })
        .sort({ timeStamp: -1 })
        .lean();
      return NextResponse.json(
        { inspection: inspection || null },
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Fallback: last mileage by VIN / van name ──
    const vanParam = searchParams.get("vin") || searchParams.get("van") || "";

    if (!vanParam) {
      return NextResponse.json(
        { lastMileage: null },
        { status: 200, headers: corsHeaders }
      );
    }

    // Resolve VIN: the param might be a vehicle name (e.g. "SYMX-123")
    // or a raw VIN. Try vehicle name lookup first.
    let vin = vanParam;
    const vehicle = await Vehicle.findOne(
      { vehicleName: vanParam },
      { vin: 1 }
    ).lean();
    if (vehicle && (vehicle as any).vin) {
      vin = (vehicle as any).vin;
    }

    const lastInspection = await DailyInspection.findOne(
      { vin },
      { mileage: 1 }
    )
      .sort({ routeDate: -1 })
      .lean();

    const mileage = (lastInspection as any)?.mileage || null;

    return NextResponse.json(
      { lastMileage: mileage },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/inspections GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ── POST: submit an inspection ──
export async function POST(req: NextRequest) {
  try {
    // ── Auth ──
    const token = req.headers.get("x-badge-token");
    if (!token) {
      return NextResponse.json(
        { error: "Missing x-badge-token header" },
        { status: 401, headers: corsHeaders }
      );
    }

    let payload: any;
    try {
      const result = await jwtVerify(token, key, { algorithms: ["HS256"] });
      payload = result.payload;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    const transporterId = (payload.transporterId || "").trim().toUpperCase();
    if (!transporterId) {
      return NextResponse.json(
        { error: "Token missing transporterId" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();

    const result = await createInspectionForRoute({
      routeId: body.routeId || "",
      transporterId: body.driver || transporterId,
      employeeName: body.employeeName,
      inspectedBy: transporterId,
      van: body.van,
      vin: body.vin,
      mileage: Number(body.mileage) || 0,
      anyRepairs: body.anyRepairs,
      repairDescription: body.repairDescription,
      repairCurrentStatus: body.repairCurrentStatus,
      repairImage: body.repairImage,
      comments: body.comments,
      vehiclePicture1: body.vehiclePicture1,
      vehiclePicture2: body.vehiclePicture2,
      vehiclePicture3: body.vehiclePicture3,
      vehiclePicture4: body.vehiclePicture4,
      dashboardImage: body.dashboardImage,
      additionalPicture: body.additionalPicture,
      routeDate: body.routeDate,
      inspectionType: body.inspectionType || body.type,
    });

    return NextResponse.json(
      {
        success: true,
        inspectionId: result.inspection._id,
        created: result.created,
        message: result.created
          ? "Inspection submitted successfully"
          : "Inspection already exists for this route",
      },
      { status: result.created ? 201 : 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/inspections POST]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
