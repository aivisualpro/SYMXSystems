import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";

// GET /api/incidents/vans
// A minimal van-name list for the incident report form's van picker. Any
// logged-in user can call this (session check only, not gated behind the
// Fleet module) since reporting an incident shouldn't require Fleet access —
// it only exposes van names, nothing sensitive.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const vehicles = await Vehicle.find(
      { status: { $ne: "Decommissioned" } },
      { vehicleName: 1, unitNumber: 1, vin: 1 }
    ).lean();

    const vans: string[] = vehicles
      .map((v: any) => v.vehicleName || v.unitNumber || "")
      .filter((name: string) => !!name);

    // Dedupe, then sort numerically-aware so "2" sorts before "10".
    const unique: string[] = Array.from(new Set(vans));
    unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    return NextResponse.json({ vans: unique });
  } catch (error: any) {
    console.error("Error fetching van list:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch vans" }, { status: 500 });
  }
}
