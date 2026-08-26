import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
import { authorizeAction } from "@/lib/rbac";
import { getRequestScope, siteFilter, findScopedById, resolveWriteSiteId, orgWide} from "@/lib/scoped-query";

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

    const scope = await getRequestScope();
    let filter: any = { ...siteFilter(scope, { includeUnassigned: true }) };
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

    const listFields = "vin unitNumber vehicleName description currentStatus estimatedDate creationDate lastEditOn repairDuration images completedImages completionDate imagesNotAvailable completionNotes";

    const [repairs, total] = await Promise.all([
      VehicleRepair.find(filter).select(listFields).sort({ creationDate: -1 }).skip(skip).limit(limit).lean(),
      VehicleRepair.countDocuments(filter),
    ]);

    const vinsToResolve = repairs.filter((r: any) => r.vin && !r.vehicleName).map((r: any) => r.vin);
    let vinToNameMap: Record<string, string> = {};
    if (vinsToResolve.length > 0) {
      const vehicles = await orgWide(
        Vehicle.find({ vin: { $in: vinsToResolve } }, { vin: 1, vehicleName: 1 }),
        "resolving names/vans for records already scoped to this station — a driver or van loaned in from elsewhere must still display, not appear blank"
      ).lean();
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

    // Owning station comes from the scope, never the request body — a
    // client-supplied siteId would let anyone file a repair against
    // another station's fleet.
    const scope = await getRequestScope();
    const siteId = resolveWriteSiteId(scope, null);
    if (!siteId) {
      return NextResponse.json(
        { error: "Select a single station before creating a repair." },
        { status: 400 }
      );
    }
    data.siteId = siteId;
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
    
    // Ownership check before writing. findByIdAndUpdate on its own would
    // happily update another station's repair record.
    const putScope = await getRequestScope();
    const owned = await findScopedById<any>(VehicleRepair, id, putScope);
    if (!owned) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

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

    // Same hole as the verbal-coaching DELETE found earlier: deleting by
    // id alone crosses stations. 404 rather than 403 so a mismatch does
    // not confirm the record exists.
    const delScope = await getRequestScope();
    const target = await findScopedById<any>(VehicleRepair, id, delScope);
    if (!target) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

    await VehicleRepair.findByIdAndDelete(id);
    return NextResponse.json({ message: "Record deleted successfully" });
  } catch (error: any) {
    console.error("Fleet Repairs DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete record" }, { status: 500 });
  }
}
