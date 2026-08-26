import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, findScopedById, orgWide, resolveWriteSiteId } from "@/lib/scoped-query";
import Vehicle from "@/lib/models/Vehicle";
import DailyInspection from "@/lib/models/DailyInspection";
import VehicleInspection from "@/lib/models/VehicleInspection";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxUser from "@/lib/models/SymxUser";
import DropdownOption from "@/lib/models/DropdownOption";
import { authorizeAction } from "@/lib/rbac";
import { createInspectionForRoute } from "@/lib/inspections/createInspectionForRoute";

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
    const section = searchParams.get("section") || "inspections";

    if (section === "inspections" || section === "list") {
      const q = searchParams.get("q") || "";
      const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"));
      const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50")), 500);

      const scope = await getRequestScope();
      let filter: any = { ...siteFilter(scope, { includeUnassigned: true }) };
      if (q) {
        if (q.length >= 3 && !q.includes(' ')) {
          filter = {
            $or: [
              { vin: { $regex: q, $options: "i" } },
              { driver: { $regex: q, $options: "i" } },
              { routeId: { $regex: q, $options: "i" } },
              { inspectedBy: { $regex: q, $options: "i" } },
              { comments: { $regex: q, $options: "i" } },
            ],
          };
        } else {
          filter = { $text: { $search: q } };
        }
      }

      const standardOnly = searchParams.get("standardOnly") === "true";
      if (standardOnly) filter = { ...filter, isStandardPhoto: true };

      const listFields = "routeId driver routeDate vin unitNumber mileage comments inspectedBy timeStamp anyRepairs repairCurrentStatus isCompared isStandardPhoto inspectionType vehiclePicture1 vehiclePicture2 vehiclePicture3 vehiclePicture4 dashboardImage additionalPicture";

      const [inspections, total] = await Promise.all([
        DailyInspection.find(filter).select(listFields).sort({ routeDate: -1 }).skip(skip).limit(limit).lean(),
        DailyInspection.countDocuments(filter),
      ]);

      const driverIds = [...new Set(inspections.map((i: any) => i.driver).filter(Boolean))];
      const inspectorEmails = [...new Set(inspections.map((i: any) => i.inspectedBy).filter(Boolean))];

      const [employees, inspectors] = await Promise.all([
        driverIds.length > 0 ? SymxEmployee.find({ transporterId: { $in: driverIds } }, { transporterId: 1, firstName: 1, lastName: 1 }).lean() : [],
        inspectorEmails.length > 0 ? SymxUser.find({ email: { $in: inspectorEmails } }, { email: 1, name: 1 }).lean() : [],
      ]);

      const driverMap: Record<string, string> = {};
      for (const emp of employees as any[]) {
        if (emp.transporterId) driverMap[emp.transporterId] = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      }

      const inspectorMap: Record<string, string> = {};
      for (const user of inspectors as any[]) {
        if (user.email) inspectorMap[user.email.toLowerCase()] = user.name || user.email;
      }

      const inspVins = [...new Set(inspections.map((i: any) => i.vin).filter(Boolean))];
      const vinVehicles = inspVins.length > 0 ? await Vehicle.find({ vin: { $in: inspVins } }, { vin: 1, vehicleName: 1 }).lean() : [];
      const vinNameMap: Record<string, string> = {};
      for (const v of vinVehicles as any[]) {
        if (v.vin && v.vehicleName) vinNameMap[v.vin] = v.vehicleName;
      }

      const photoFields = ["vehiclePicture1", "vehiclePicture2", "vehiclePicture3", "vehiclePicture4", "dashboardImage", "additionalPicture"];
      const requiredPhotoFields = ["vehiclePicture1", "vehiclePicture2", "vehiclePicture3", "vehiclePicture4", "dashboardImage"];

      const enrichedInspections = inspections.map((insp: any) => {
        const photoCount = requiredPhotoFields.filter(f => !!insp[f]).length;
        const result: any = {
          ...insp,
          driverName: insp.driver ? (driverMap[insp.driver] || insp.driver) : "",
          inspectedByName: insp.inspectedBy ? (inspectorMap[insp.inspectedBy.toLowerCase()] || insp.inspectedBy) : "",
          vehicleName: insp.vin ? (vinNameMap[insp.vin] || "") : "",
          photoCount,
        };
        for (const f of photoFields) delete result[f];
        return result;
      });

      return NextResponse.json({ inspections: enrichedInspections, total, hasMore: skip + inspections.length < total });
    }

    if (section === "inspection-detail" || section === "detail") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const detailScope = await getRequestScope();
      const inspection = await findScopedById<any>(DailyInspection, id, detailScope) as any;
      if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const enriched = { ...inspection } as any;
      const [emp, user, vehicle, standardPhotoCount] = await Promise.all([
        inspection.driver ? SymxEmployee.findOne({ transporterId: inspection.driver }, { firstName: 1, lastName: 1 }).lean() : null,
        inspection.inspectedBy ? SymxUser.findOne({ email: inspection.inspectedBy }, { name: 1 }).lean().then(u => u || SymxUser.findOne({ email: { $regex: `^${inspection.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { name: 1 }).lean()) : null,
        inspection.vin ? Vehicle.findOne({ vin: inspection.vin }, { image: 1, vehicleName: 1, unitNumber: 1 }).lean() : null,
        inspection.vin ? orgWide(DailyInspection.countDocuments({ vin: inspection.vin, isStandardPhoto: true, _id: { $ne: inspection._id } }), "a van's inspection photos belong to the asset — comparing today against a previous condition must work even if the van changed stations") : 0,
      ]);

      if (emp) enriched.driverName = `${(emp as any).firstName || ""} ${(emp as any).lastName || ""}`.trim();
      if (user) enriched.inspectedByName = (user as any).name;
      if (vehicle) {
        enriched.vehicleImage = (vehicle as any).image || "";
        enriched.vehicleName = (vehicle as any).vehicleName || "";
      }
      enriched.hasStandardPhoto = standardPhotoCount > 0;
      return NextResponse.json({ inspection: enriched });
    }

    if (section === "inspection-compare" || section === "compare") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const cmpScope = await getRequestScope();
      const current = await findScopedById<any>(DailyInspection, id, cmpScope) as any;
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const [emp, user, vehicle, previous] = await Promise.all([
        current.driver ? SymxEmployee.findOne({ transporterId: current.driver }, { firstName: 1, lastName: 1 }).lean() : null,
        current.inspectedBy ? SymxUser.findOne({ email: current.inspectedBy }, { name: 1 }).lean().then(u => u || SymxUser.findOne({ email: { $regex: `^${current.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { name: 1 }).lean()) : null,
        current.vin ? Vehicle.findOne({ vin: current.vin }, { image: 1, vehicleName: 1 }).lean() : null,
        current.vin && current.routeDate ? orgWide(DailyInspection.findOne({ vin: current.vin, _id: { $ne: current._id }, routeDate: { $lt: current.routeDate } }).sort({ routeDate: -1 }), "a van's inspection photos belong to the asset — comparing today against a previous condition must work even if the van changed stations").lean() : null,
      ]);

      const enrichedCurrent = { ...current } as any;
      if (emp) enrichedCurrent.driverName = `${(emp as any).firstName || ""} ${(emp as any).lastName || ""}`.trim();
      if (user) enrichedCurrent.inspectedByName = (user as any).name;
      if (vehicle) {
        enrichedCurrent.vehicleImage = (vehicle as any).image || "";
        enrichedCurrent.vehicleName = (vehicle as any).vehicleName || "";
      }

      let enrichedPrevious = null;
      if (previous) {
        enrichedPrevious = { ...(previous as any) } as any;
        const [prevEmp, prevUser] = await Promise.all([
          (previous as any).driver ? SymxEmployee.findOne({ transporterId: (previous as any).driver }, { firstName: 1, lastName: 1 }).lean() : null,
          (previous as any).inspectedBy ? SymxUser.findOne({ email: (previous as any).inspectedBy }, { name: 1 }).lean().then(u => u || SymxUser.findOne({ email: { $regex: `^${(previous as any).inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { name: 1 }).lean()) : null,
        ]);
        if (prevEmp) enrichedPrevious.driverName = `${(prevEmp as any).firstName || ""} ${(prevEmp as any).lastName || ""}`.trim();
        if (prevUser) enrichedPrevious.inspectedByName = (prevUser as any).name;
      }
      return NextResponse.json({ current: enrichedCurrent, previous: enrichedPrevious });
    }

    if (section === "inspection-master" || section === "master") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const cmpScope = await getRequestScope();
      const current = await findScopedById<any>(DailyInspection, id, cmpScope) as any;
      if (!current || !current.vin) return NextResponse.json({ error: "Not found or no VIN" }, { status: 404 });

      const master = await orgWide(DailyInspection.findOne({ vin: current.vin, isStandardPhoto: true, _id: { $ne: current._id } }).sort({ routeDate: -1 }), "a van's inspection photos belong to the asset — comparing today against a previous condition must work even if the van changed stations").lean() as any;
      if (!master) return NextResponse.json({ master: null });

      const [mEmp, mUser] = await Promise.all([
        master.driver ? SymxEmployee.findOne({ transporterId: master.driver }, { firstName: 1, lastName: 1 }).lean() : null,
        master.inspectedBy ? SymxUser.findOne({ email: master.inspectedBy }, { name: 1 }).lean() : null,
      ]);
      const enrichedMaster = { ...master } as any;
      if (mEmp) enrichedMaster.driverName = `${(mEmp as any).firstName || ""} ${(mEmp as any).lastName || ""}`.trim();
      if (mUser) enrichedMaster.inspectedByName = (mUser as any).name;
      return NextResponse.json({ master: enrichedMaster });
    }

    // Resolve a single inspection for a VIN, either the Master (isStandardPhoto)
    // or the nearest inspection on-or-before a given calendar date.
    // Used by the vehicle-level "Compare" tab and the custom-date option on the
    // inspection detail page's Compare dropdown.
    if (section === "inspection-by-date") {
      const vin = searchParams.get("vin");
      const dateParam = searchParams.get("date"); // "YYYY-MM-DD" or "master"
      const excludeId = searchParams.get("excludeId");
      if (!vin || !dateParam) return NextResponse.json({ error: "vin and date required" }, { status: 400 });

      const baseQuery: any = { vin };
      if (excludeId) baseQuery._id = { $ne: excludeId };

      let found: any = null;
      if (dateParam === "master") {
        found = await orgWide(DailyInspection.findOne({ ...baseQuery, isStandardPhoto: true }).sort({ routeDate: -1 }), "a van's inspection photos belong to the asset — comparing today against a previous condition must work even if the van changed stations").lean();
      } else {
        const onOrBefore = new Date(`${dateParam}T23:59:59.999Z`);
        if (isNaN(onOrBefore.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
        found = await orgWide(DailyInspection.findOne({ ...baseQuery, routeDate: { $lte: onOrBefore } }).sort({ routeDate: -1 }), "a van's inspection photos belong to the asset — comparing today against a previous condition must work even if the van changed stations").lean();
      }

      if (!found) return NextResponse.json({ inspection: null });

      const enriched = { ...found } as any;
      const [emp, user] = await Promise.all([
        found.driver ? SymxEmployee.findOne({ transporterId: found.driver }, { firstName: 1, lastName: 1 }).lean() : null,
        found.inspectedBy ? SymxUser.findOne({ email: found.inspectedBy }, { name: 1 }).lean() : null,
      ]);
      if (emp) enriched.driverName = `${(emp as any).firstName || ""} ${(emp as any).lastName || ""}`.trim();
      if (user) enriched.inspectedByName = (user as any).name;
      return NextResponse.json({ inspection: enriched });
    }

    if (section === "inspection-dropdowns" || section === "dropdowns") {
      const [employees, vehiclesList, inspectionTypes] = await Promise.all([
        SymxEmployee.find({}, { transporterId: 1, firstName: 1, lastName: 1 }).sort({ firstName: 1 }).lean(),
        Vehicle.find({ status: { $ne: "Returned" } }, { vin: 1, unitNumber: 1, vehicleName: 1 }).sort({ unitNumber: 1 }).lean(),
        DropdownOption.find({ type: "inspection", isActive: true }).sort({ sortOrder: 1, description: 1 }).lean(),
      ]);
      return NextResponse.json({
        employees: employees.filter((e: any) => e.transporterId),
        vehicles: vehiclesList.filter((v: any) => v.vin),
        inspectionTypes: inspectionTypes.map((t: any) => ({ value: t.description, label: t.description })),
      });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Fleet Inspections GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch inspections data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Allow EITHER Fleet.edit OR Dispatching.edit — dispatchers create inspections
  // from the closing page but only have Dispatching permissions, not Fleet.
  let hasPermission = false;
  try { await requirePermission("Fleet", "edit"); hasPermission = true; } catch { /* try Dispatching */ }
  if (!hasPermission) {
    try { await requirePermission("Dispatching", "edit"); hasPermission = true; } catch (e: any) {
      if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await connectToDatabase();
    const body = await req.json();
    const data = body.data || body;

    const result = await createInspectionForRoute({
      routeId: data.routeId || "",
      transporterId: data.driver || "",
      employeeName: data.employeeName,
      inspectedBy: data.inspectedBy || "",
      van: data.van,
      vin: data.vin,
      mileage: Number(data.mileage) || 0,
      anyRepairs: data.anyRepairs,
      repairDescription: data.repairDescription,
      repairCurrentStatus: data.repairCurrentStatus,
      repairImage: data.repairImage,
      comments: data.comments,
      vehiclePicture1: data.vehiclePicture1,
      vehiclePicture2: data.vehiclePicture2,
      vehiclePicture3: data.vehiclePicture3,
      vehiclePicture4: data.vehiclePicture4,
      dashboardImage: data.dashboardImage,
      additionalPicture: data.additionalPicture,
      routeDate: data.routeDate,
      inspectionType: data.inspectionType || data.type,
    });

    return NextResponse.json({
      inspection: result.inspection,
      created: result.created,
      message: result.created
        ? "Inspection created successfully"
        : "Inspection already exists for this route",
    });
  } catch (error: any) {
    console.error("Fleet Inspections POST Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create record" }, { status: 500 });
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

    // Original god-route used VehicleInspection mapped by accident,
    // assuming here it was meant to be VehicleInspection. Let's keep doing that for backward comp.
    const inspection = await VehicleInspection.findByIdAndUpdate(id, { $set: data }, { new: true });
    return NextResponse.json({ inspection, message: "Inspection updated successfully" });
  } catch (error: any) {
    console.error("Fleet Inspections PUT Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update record" }, { status: 500 });
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

    // Fetch first so we can get the routeId for SYMXRoute cleanup
    const delScope = await getRequestScope();
    const inspection = await findScopedById<any>(DailyInspection, id, delScope) as any;
    if (!inspection) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    // Delete the inspection from DailyInspection
    await DailyInspection.findByIdAndDelete(id);

    // Clear inspectionId + inspectionTime on the linked SYMXRoute so the
    // dispatching closing page shows the route as pending again
    if (inspection.routeId) {
      SYMXRoute.findOneAndUpdate(
        { _id: inspection.routeId, inspectionId: String(id) },
        { $set: { inspectionId: "", inspectionTime: "" } }
      ).exec().catch((err: any) => {
        console.error("[DELETE inspection] SYMXRoute cleanup failed:", err);
      });
    }

    return NextResponse.json({ message: "Record deleted successfully" });
  } catch (error: any) {
    console.error("Fleet Inspections DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete record" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try { await requirePermission("Fleet", "edit"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const body = await req.json();
    const { action, id } = body;

    if (action === "toggle-standard-photo") {
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const patchScope = await getRequestScope();
      const inspection = await findScopedById<any>(DailyInspection, id, patchScope) as any;
      if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const newValue = !inspection.isStandardPhoto;

      if (newValue && inspection.vin) {
        // Clearing the previous master spans stations deliberately: a VIN
        // has ONE master photo. Scoped, a van that moved would end up with
        // a master at each station and comparisons would pick either.
        await orgWide(
          DailyInspection.updateMany(
            { vin: inspection.vin, isStandardPhoto: true, _id: { $ne: inspection._id } },
            { $set: { isStandardPhoto: false } }
          ),
          "a van's inspection photos belong to the asset — comparing today against a previous condition must work even if the van changed stations"
        );
      }

      inspection.isStandardPhoto = newValue;
      await inspection.save();

      return NextResponse.json({ success: true, isStandardPhoto: newValue });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Fleet Inspections PATCH Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}
