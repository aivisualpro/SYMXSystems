/**
 * POST /api/mobile/inspections
 *
 * Allows a driver to submit a vehicle inspection from the mobile app.
 * Auth: JWT via `x-badge-token` header (same as my-routes).
 *
 * After creating the DailyInspection record, it also updates the
 * corresponding SYMXRoute with the inspectionTime and inspectionId.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import DailyInspection from "@/lib/models/DailyInspection";
import SYMXRoute from "@/lib/models/SYMXRoute";
import Vehicle from "@/lib/models/Vehicle";

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

// ── GET: fetch last mileage for a van (by vehicle name or VIN) ──
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

    await connectToDatabase();

    const body = await req.json();

    // Resolve VIN + unitNumber + vehicleId from van name
    let vin = body.vin || "";
    let unitNumber = "";
    let vehicleId: any = null;
    if (body.van) {
      const vehicle = await Vehicle.findOne(
        { vehicleName: body.van },
        { vin: 1, unitNumber: 1, _id: 1 }
      ).lean();
      if (vehicle) {
        if (!vin) vin = (vehicle as any).vin || "";
        unitNumber = (vehicle as any).unitNumber || "";
        vehicleId = (vehicle as any)._id || null;
      }
    }

    // Build inspection data
    const inspectionData: any = {
      type: body.type || "Route Inspection",
      inspectionType: body.inspectionType || "Route Inspection",
      driver: body.driver || transporterId,
      employeeName: body.employeeName || "",
      vin,
      unitNumber,
      vehicleId,
      routeDate: body.routeDate ? new Date(body.routeDate) : new Date(),
      mileage: Number(body.mileage) || 0,
      anyRepairs: body.anyRepairs === "TRUE" ? "TRUE" : "FALSE",
      repairDescription: body.repairDescription || null,
      repairCurrentStatus: body.repairCurrentStatus || null,
      repairImage: body.repairImage || null,
      comments: body.comments || null,
      inspectedBy: transporterId,
      routeId: body.routeId || "",
      timeStamp: new Date(),
      // Photo fields
      vehiclePicture1: body.vehiclePicture1 || null,
      vehiclePicture2: body.vehiclePicture2 || null,
      vehiclePicture3: body.vehiclePicture3 || null,
      vehiclePicture4: body.vehiclePicture4 || null,
      dashboardImage: body.dashboardImage || null,
      additionalPicture: body.additionalPicture || null,
    };

    // Clean empty strings to null
    for (const k of Object.keys(inspectionData)) {
      if (inspectionData[k] === "") inspectionData[k] = null;
    }

    // 1. Create the DailyInspection record
    const inspection = await DailyInspection.create(inspectionData);
    const inspectionId = String(inspection._id);

    // 2. Update the corresponding route with inspectionTime + inspectionId
    if (body.routeId) {
      const nowTime = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      });

      await SYMXRoute.findByIdAndUpdate(body.routeId, {
        $set: {
          inspectionTime: nowTime,
          inspectionId,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        inspectionId,
        message: "Inspection submitted successfully",
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/inspections POST]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
