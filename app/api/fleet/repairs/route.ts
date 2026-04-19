import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
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
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50")), 500);
    const excludeCompleted = searchParams.get("excludeCompleted") === "true";
    const exactVin = searchParams.get("vin");

    let filter: any = {};
    if (exactVin) {
      filter.vin = exactVin;
    }
    if (q) {
      if (q.length >= 3 && !q.includes(' ')) {
        filter = {
          $or: [
            { vin: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
            { currentStatus: { $regex: q, $options: "i" } },
            { unitNumber: { $regex: q, $options: "i" } },
            { vehicleName: { $regex: q, $options: "i" } },
          ],
        };
      } else {
        filter = { $text: { $search: q } };
      }
    }

    if (excludeCompleted) {
      filter = { ...filter, currentStatus: { $ne: "Completed" } };
    }

    const listFields = "vin unitNumber vehicleName description currentStatus estimatedDate creationDate lastEditOn repairDuration images completedImages completionDate";

    const [repairs, total] = await Promise.all([
      VehicleRepair.find(filter).select(listFields).sort({ creationDate: -1 }).skip(skip).limit(limit).lean(),
      VehicleRepair.countDocuments(filter),
    ]);

    const vinsToResolve = repairs.filter((r: any) => r.vin && !r.vehicleName).map((r: any) => r.vin);
    let vinToNameMap: Record<string, string> = {};
    if (vinsToResolve.length > 0) {
      const vehicles = await Vehicle.find({ vin: { $in: vinsToResolve } }, { vin: 1, vehicleName: 1 }).lean();
      vehicles.forEach((v: any) => { if (v.vin && v.vehicleName) vinToNameMap[v.vin] = v.vehicleName; });
    }
    const enrichedRepairs = repairs.map((r: any) => ({
      ...r,
      vehicleName: r.vehicleName || vinToNameMap[r.vin] || "",
    }));

    return NextResponse.json({
      repairs: enrichedRepairs,
      total,
      hasMore: skip + repairs.length < total,
    });
  } catch (error) {
    console.error("Fleet Repairs GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch repairs" }, { status: 500 });
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
    const session = auth.session;
    const body = await req.json();
    const data = body.data || body;

    if (data) {
      for (const key of Object.keys(data)) {
        if (data[key] === "") data[key] = null;
      }
    }

    data.createdBy = session.id;
    if (data.currentStatus === "Completed" && !data.completionDate) {
      data.completionDate = new Date();
    }

    const repair = await VehicleRepair.create(data);
    return NextResponse.json({ repair, message: "Repair record created successfully" });
  } catch (error: any) {
    console.error("Fleet Repairs POST Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create repair" }, { status: 500 });
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

    data.lastEditOn = new Date();
    
    if (data.currentStatus !== undefined) {
       if (data.currentStatus === "Completed") {
          const existing = await VehicleRepair.findById(id).select("completionDate");
          if (!existing?.completionDate && !data.completionDate) {
             data.completionDate = new Date();
          }
       } else {
          data.$unset = { completionDate: 1 };
       }
    }
    
    const updatePayload: Record<string, any> = { $set: data };
    if (data.$unset) {
       updatePayload.$unset = data.$unset;
       delete data.$unset;
    }

    const repair = await VehicleRepair.findByIdAndUpdate(id, updatePayload, { new: true });
    return NextResponse.json({ repair, message: "Repair updated successfully" });
  } catch (error: any) {
    console.error("Fleet Repairs PUT Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update repair" }, { status: 500 });
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

    await VehicleRepair.findByIdAndDelete(id);
    return NextResponse.json({ message: "Record deleted successfully" });
  } catch (error: any) {
    console.error("Fleet Repairs DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete record" }, { status: 500 });
  }
}
