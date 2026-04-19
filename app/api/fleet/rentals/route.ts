import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import { authorizeAction } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try { await requirePermission("Fleet", "view"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Fleet", "view");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    
    const rentals = await VehicleRentalAgreement.find({}).sort({ createdAt: -1 }).lean();

    let enrichedRentals: any[] = rentals as any[];
    try {
      const uniqueVins: string[] = Array.from(
        new Set((rentals as any[]).map((r: any) => r.vin).filter((v: any) => typeof v === "string" && v.length > 0))
      );
      if (uniqueVins.length > 0) {
        const vinNameMap: Record<string, string> = {};
        const vehicles = await Vehicle.find({ vin: { $in: uniqueVins } }, { vin: 1, vehicleName: 1 }).lean();
        (vehicles as any[]).forEach((v: any) => { if (v.vin && v.vehicleName) vinNameMap[v.vin] = v.vehicleName; });
        enrichedRentals = (rentals as any[]).map((r: any) => ({ ...r, vehicleName: vinNameMap[r.vin] || "" }));
      }
    } catch (enrichErr) {
      console.warn("[Fleet] Rentals vehicleName enrichment failed, returning without:", enrichErr);
    }

    return NextResponse.json({ rentals: enrichedRentals });
  } catch (error) {
    console.error("Fleet Rentals GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch rentals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await requirePermission("Fleet", "edit"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Fleet", "create");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    const body = await req.json();
    const data = body.data || body;

    if (data) {
      for (const key of Object.keys(data)) {
        if (data[key] === "") data[key] = null;
      }
    }

    const rental = await VehicleRentalAgreement.create(data);
    return NextResponse.json({ rental, message: "Rental agreement created successfully" });
  } catch (error: any) {
    console.error("Fleet Rentals POST Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create rental record" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try { await requirePermission("Fleet", "edit"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Fleet", "edit");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    const body = await req.json();
    const id = body.id || new URL(req.url).searchParams.get("id");
    const data = body.data || body;

    if (data) {
      for (const key of Object.keys(data)) {
        if (data[key] === "") data[key] = null;
      }
    }

    const rental = await VehicleRentalAgreement.findByIdAndUpdate(id, { $set: data }, { new: true });
    return NextResponse.json({ rental, message: "Rental agreement updated successfully" });
  } catch (error: any) {
    console.error("Fleet Rentals PUT Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update rental record" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try { await requirePermission("Fleet", "delete"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await VehicleRentalAgreement.findByIdAndDelete(id);
    return NextResponse.json({ message: "Record deleted successfully" });
  } catch (error: any) {
    console.error("Fleet Rentals DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete record" }, { status: 500 });
  }
}
