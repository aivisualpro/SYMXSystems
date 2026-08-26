import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, canAccessRecord } from "@/lib/scoped-query";
import Vehicle from "@/lib/models/Vehicle";
import DailyInspection from "@/lib/models/DailyInspection";
import { authorizeAction } from "@/lib/rbac";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try { await requirePermission("Fleet", "view"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Fleet", "view");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const includeReturned = searchParams.get("includeReturned") === "true";
    // Vehicles carry currentSiteId — they transfer between stations.
    const vScope = await getRequestScope();
    const filter: any = {
      ...siteFilter(vScope, { includeUnassigned: true, field: "currentSiteId" }),
      ...(includeReturned ? {} : { status: { $ne: "Returned" } }),
    };
    
    // Fetch vehicles and latest inspection mileage in parallel
    const [vehiclesRaw, latestMileages] = await Promise.all([
      Vehicle.find(filter)
        .select("-notes -info -__v")
        .sort({ createdAt: -1 })
        .lean(),
      // Get the latest non-zero mileage per VIN from daily inspections
      DailyInspection.aggregate([
        // Scoped: this feeds the mileage column of the station's own
        // vehicle list, so it must not average in another station's
        // odometer readings.
        { $match: { mileage: { $gt: 0 }, ...siteFilter(vScope, { includeUnassigned: true }) } },
        { $sort: { routeDate: -1 } },
        { $group: {
          _id: "$vin",
          lastMileage: { $first: "$mileage" },
          lastMileageDate: { $first: "$routeDate" },
        }},
      ]),
    ]);

    // Build a lookup map: VIN → { mileage, date }
    const mileageMap = new Map<string, { mileage: number; date: Date }>();
    for (const entry of latestMileages) {
      if (entry._id) {
        mileageMap.set(entry._id, { mileage: entry.lastMileage, date: entry.lastMileageDate });
      }
    }

    // Enrich vehicles with latest inspection mileage
    const vehicles = vehiclesRaw.map((v: any) => {
      const inspectionMileage = v.vin ? mileageMap.get(v.vin) : null;
      if (inspectionMileage) {
        v.mileage = inspectionMileage.mileage;
        v.lastMileageDate = inspectionMileage.date;
      }
      return v;
    });
      
    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Fleet Vehicles GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 });
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

    const vehicle = await Vehicle.create(data);
    return NextResponse.json({ vehicle, message: "Vehicle created successfully" });
  } catch (error: any) {
    console.error("Fleet Vehicles POST Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create vehicle" }, { status: 500 });
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

    // Ownership check: this route $sets whatever the body contains, so
    // without it any vehicle id could be edited from any station.
    const putScope = await getRequestScope();
    const existing = await Vehicle.findById(id).lean();
    if (!existing || !canAccessRecord(putScope, { siteId: (existing as any).currentSiteId })) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // Station changes do NOT go through here. Moving a van removes it from
    // one station's fleet and adds it to another's, which needs a record of
    // who did it and when — see POST /api/fleet/vehicles/[id]/transfer.
    // Silently dropping the field rather than erroring, because older
    // clients may still send back the whole vehicle object they were given.
    delete (data as any).currentSiteId;
    delete (data as any).siteId;

    const vehicle = await Vehicle.findByIdAndUpdate(id, { $set: data }, { new: true });
    return NextResponse.json({ vehicle, message: "Vehicle updated successfully" });
  } catch (error: any) {
    console.error("Fleet Vehicles PUT Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update vehicle" }, { status: 500 });
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

    await Vehicle.findByIdAndDelete(id);
    return NextResponse.json({ message: "Vehicle deleted successfully" });
  } catch (error: any) {
    console.error("Fleet Vehicles DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete vehicle" }, { status: 500 });
  }
}
