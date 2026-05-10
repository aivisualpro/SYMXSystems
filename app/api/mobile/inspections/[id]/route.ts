/**
 * GET /api/mobile/inspections/[id]
 *
 * Fetches a single DailyInspection record by ID for the mobile app.
 * Auth: JWT via `x-badge-token` header.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import DailyInspection from "@/lib/models/DailyInspection";
import Vehicle from "@/lib/models/Vehicle";

const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    await connectToDatabase();

    const inspection = await DailyInspection.findById(id).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Enrich with vehicle name
    const doc = inspection as any;
    let vehicleName = "";
    if (doc.vin) {
      const vehicle = await Vehicle.findOne(
        { vin: doc.vin },
        { vehicleName: 1 }
      ).lean();
      if (vehicle) vehicleName = (vehicle as any).vehicleName || "";
    }

    return NextResponse.json(
      {
        inspection: {
          id: String(doc._id),
          vin: doc.vin || "",
          vehicleName,
          unitNumber: doc.unitNumber || "",
          driver: doc.driver || "",
          employeeName: doc.employeeName || "",
          inspectedBy: doc.inspectedBy || "",
          routeDate: doc.routeDate,
          timeStamp: doc.timeStamp,
          mileage: doc.mileage || 0,
          comments: doc.comments || "",
          inspectionType: doc.inspectionType || "",
          anyRepairs: doc.anyRepairs || "FALSE",
          repairDescription: doc.repairDescription || "",
          repairCurrentStatus: doc.repairCurrentStatus || "",
          repairImage: doc.repairImage || "",
          vehiclePicture1: doc.vehiclePicture1 || "",
          vehiclePicture2: doc.vehiclePicture2 || "",
          vehiclePicture3: doc.vehiclePicture3 || "",
          vehiclePicture4: doc.vehiclePicture4 || "",
          dashboardImage: doc.dashboardImage || "",
          additionalPicture: doc.additionalPicture || "",
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/inspections/[id] GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
