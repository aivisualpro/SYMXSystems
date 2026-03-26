import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
import DailyInspection from "@/lib/models/DailyInspection";
import VehicleInspection from "@/lib/models/VehicleInspection";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxUser from "@/lib/models/SymxUser";
import DropdownOption from "@/lib/models/DropdownOption";

// GET: Fleet dashboard summary + all data
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section") || "dashboard";

    if (section === "dashboard") {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Exclude "Returned" vehicles from all counts
      const notReturned = { status: { $ne: "Returned" } };

      // All counts + small fetches in parallel — no full collection scans
      const [
        totalVehicles,
        vehicleStatusAgg,
        ownedCount,
        leasedCount,
        rentedCount,
        repairsOpen,
        repairStatusAgg,
        recentInspections,
        totalRentals,
        activeRentals,
        expiredRentals,
        expiringSoonCount,
        rentalAmountAgg,
        fleetNotWorkingDocs,
        registrationExpiringDocs,
        expiringSoonDocs,
      ] = await Promise.all([
        Vehicle.countDocuments(notReturned),
        Vehicle.aggregate([
          { $match: notReturned },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Vehicle.countDocuments({ ...notReturned, ownership: "Owned" }),
        Vehicle.countDocuments({ ...notReturned, ownership: "Leased" }),
        Vehicle.countDocuments({ ...notReturned, ownership: "Rented" }),
        VehicleRepair.find({ currentStatus: { $ne: "Completed" } })
          .sort({ creationDate: -1 }).limit(6)
          .select("description unitNumber estimatedDate currentStatus vin").lean(),
        VehicleRepair.aggregate([
          { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
        ]),
        DailyInspection.find({}).sort({ routeDate: -1 }).limit(6)
          .select("vin unitNumber routeDate driver anyRepairs").lean(),
        VehicleRentalAgreement.countDocuments({}),
        VehicleRentalAgreement.countDocuments({ registrationEndDate: { $gt: now } }),
        VehicleRentalAgreement.countDocuments({ registrationEndDate: { $lte: now } }),
        VehicleRentalAgreement.countDocuments({ registrationEndDate: { $gt: now, $lte: thirtyDaysFromNow } }),
        VehicleRentalAgreement.aggregate([
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Vehicle.find({ status: { $in: ["Grounded", "Maintenance", "Inactive"] } })
          .select("unitNumber vehicleName status mileage updatedAt notes fleetCommunications").lean(),
        Vehicle.find({
            status: "Active",
            registrationExpiration: {
              $gte: new Date(),
              $lte: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 90)
            }
          })
          .select("unitNumber vehicleName registrationExpiration status")
          .sort({ registrationExpiration: 1 }).limit(10).lean(),
        VehicleRentalAgreement.find({ registrationEndDate: { $gt: now, $lte: thirtyDaysFromNow } })
          .sort({ registrationEndDate: 1 }).limit(6)
          .select("agreementNumber vin registrationEndDate amount").lean(),
      ]);

      // Build vehicle status breakdown from aggregation
      const vehicleStatusColorMap: Record<string, string> = {
        "Active": "#10b981",
        "Maintenance": "#f59e0b",
        "Grounded": "#ef4444",
        "Inactive": "#6b7280",
        "Decommissioned": "#8b5cf6",
        "Empty": "#3b82f6",
      };
      const vehicleStatusMap: Record<string, number> = {};
      (vehicleStatusAgg as any[]).forEach((r: any) => {
        if (r._id) vehicleStatusMap[r._id] = r.count;
      });

      const statusBreakdown = Object.entries(vehicleStatusMap).map(([name, value]) => ({
        name,
        value,
        color: vehicleStatusColorMap[name] || "#6b7280",
      }));
      // Sort so consistent order: Active first, then by count descending
      const statusOrder = ["Active", "Maintenance", "Grounded", "Inactive", "Decommissioned"];
      statusBreakdown.sort((a, b) => {
        const ai = statusOrder.indexOf(a.name);
        const bi = statusOrder.indexOf(b.name);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      const activeVehicles = vehicleStatusMap["Active"] || 0;
      const maintenanceVehicles = vehicleStatusMap["Maintenance"] || 0;
      const groundedVehicles = vehicleStatusMap["Grounded"] || 0;
      const inactiveVehicles = vehicleStatusMap["Inactive"] || 0;
      const repairStatusMap: Record<string, number> = {};
      (repairStatusAgg as any[]).forEach((r: any) => { repairStatusMap[r._id || "Unknown"] = r.count; });
      const totalRepairs = Object.values(repairStatusMap).reduce((a, b) => a + b, 0);

      const repairStatusBreakdown = [
        { name: "Not Started", value: repairStatusMap["Not Started"] || 0 },
        { name: "In Progress", value: repairStatusMap["In Progress"] || 0 },
        { name: "Waiting for Parts", value: repairStatusMap["Waiting for Parts"] || 0 },
        { name: "Sent to Shop", value: repairStatusMap["Sent to Repair Shop"] || 0 },
      ];

      const totalRentalAmount = (rentalAmountAgg as any[])[0]?.total || 0;

      return NextResponse.json({
        kpis: {
          totalVehicles,
          activeVehicles,
          maintenanceVehicles,
          groundedVehicles,
          inactiveVehicles,
        },
        statusBreakdown,
        ownershipBreakdown: [
          { name: "Owned", value: ownedCount, color: "#3b82f6" },
          { name: "Leased", value: leasedCount, color: "#8b5cf6" },
          { name: "Rented", value: rentedCount, color: "#ec4899" },
        ],
        repairStatusBreakdown,
        repairStatusMap,
        totalRepairs,
        totalOpenRepairs: totalRepairs,
        openRepairs: repairsOpen,
        recentInspections,
        rentalStats: {
          total: totalRentals,
          active: activeRentals,
          expired: expiredRentals,
          expiringSoon: expiringSoonCount,
          totalAmount: totalRentalAmount,
        },
        expiringSoonRentals: expiringSoonDocs,
        fleetNotWorking: fleetNotWorkingDocs,
        registrationExpiring: registrationExpiringDocs,
      });
    }

    if (section === "vehicles") {
      const includeReturned = searchParams.get("includeReturned") === "true";
      const filter: any = includeReturned ? {} : { status: { $ne: "Returned" } };
      const vehicles = await Vehicle.find(filter)
        .select("-notes -info -__v")
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ vehicles });
    }



    if (section === "repairs") {
      const q = searchParams.get("q") || "";
      const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"));
      const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50")), 500);
      const excludeCompleted = searchParams.get("excludeCompleted") === "true";

      let filter: any = {};
      if (q) {
        // Use $text index for full-word matches (indexed, very fast)
        // Fall back to $regex for partial substring matches
        if (q.length >= 3 && !q.includes(' ')) {
          // Short single term → use regex for partial matching
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
          // Multi-word or longer queries → use $text index
          filter = { $text: { $search: q } };
        }
      }

      // Exclude completed repairs when toggle is off
      if (excludeCompleted) {
        filter = { ...filter, currentStatus: { $ne: "Completed" } };
      }

      // Select only fields needed for the list view
      const listFields = "vin unitNumber vehicleName description currentStatus estimatedDate creationDate lastEditOn repairDuration image";

      const [repairs, total] = await Promise.all([
        VehicleRepair.find(filter).select(listFields).sort({ creationDate: -1 }).skip(skip).limit(limit).lean(),
        VehicleRepair.countDocuments(filter),
      ]);

      // Enrich: resolve vehicleName from Vehicle collection for records missing it
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
    }



    if (section === "inspections") {
      const q = searchParams.get("q") || "";
      const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"));
      const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50")), 500);

      let filter: any = {};
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

      // Filter to standard photos only if requested
      const standardOnly = searchParams.get("standardOnly") === "true";
      if (standardOnly) {
        filter = { ...filter, isStandardPhoto: true };
      }

      // Only select fields needed for the list view — skip heavy image URLs but include photo fields for count
      const listFields = "routeId driver routeDate vin unitNumber mileage comments inspectedBy timeStamp anyRepairs repairCurrentStatus isCompared isStandardPhoto inspectionType vehiclePicture1 vehiclePicture2 vehiclePicture3 vehiclePicture4 dashboardImage additionalPicture";

      const [inspections, total] = await Promise.all([
        DailyInspection.find(filter).select(listFields).sort({ routeDate: -1 }).skip(skip).limit(limit).lean(),
        DailyInspection.countDocuments(filter),
      ]);

      // Batch-resolve driver transporterIds → employee names AND inspectedBy emails → user names
      const driverIds = [...new Set(inspections.map((i: any) => i.driver).filter(Boolean))];
      const inspectorEmails = [...new Set(inspections.map((i: any) => i.inspectedBy).filter(Boolean))];

      const [employees, inspectors] = await Promise.all([
        driverIds.length > 0
          ? SymxEmployee.find({ transporterId: { $in: driverIds } }, { transporterId: 1, firstName: 1, lastName: 1 }).lean()
          : [],
        inspectorEmails.length > 0
          ? SymxUser.find({ email: { $in: inspectorEmails } }, { email: 1, name: 1 }).lean()
          : [],
      ]);

      const driverMap: Record<string, string> = {};
      for (const emp of employees as any[]) {
        if (emp.transporterId) {
          driverMap[emp.transporterId] = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
        }
      }

      const inspectorMap: Record<string, string> = {};
      for (const user of inspectors as any[]) {
        if (user.email) {
          inspectorMap[user.email.toLowerCase()] = user.name || user.email;
        }
      }

      // Batch-resolve VINs → vehicleName
      const inspVins = [...new Set(inspections.map((i: any) => i.vin).filter(Boolean))];
      const vinVehicles = inspVins.length > 0
        ? await Vehicle.find({ vin: { $in: inspVins } }, { vin: 1, vehicleName: 1 }).lean()
        : [];
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
        // Remove the actual URLs from the response to keep it lightweight
        for (const f of photoFields) delete result[f];
        return result;
      });

      return NextResponse.json({
        inspections: enrichedInspections,
        total,
        hasMore: skip + inspections.length < total,
      });
    }

    if (section === "inspection-detail") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const inspection = await DailyInspection.findById(id).lean() as any;
      if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Enrich with references — ALL IN PARALLEL
      const enriched = { ...inspection } as any;
      const [emp, user, vehicle, standardPhotoCount] = await Promise.all([
        inspection.driver
          ? SymxEmployee.findOne({ transporterId: inspection.driver }, { firstName: 1, lastName: 1 }).lean()
          : null,
        inspection.inspectedBy
          ? SymxUser.findOne({ email: inspection.inspectedBy }, { name: 1 }).lean()
            .then(u => u || SymxUser.findOne({ email: { $regex: `^${inspection.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { name: 1 }).lean())
          : null,
        inspection.vin
          ? Vehicle.findOne({ vin: inspection.vin }, { image: 1, vehicleName: 1, unitNumber: 1 }).lean()
          : null,
        inspection.vin
          ? DailyInspection.countDocuments({ vin: inspection.vin, isStandardPhoto: true, _id: { $ne: inspection._id } })
          : 0,
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

    if (section === "inspection-compare") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const current = await DailyInspection.findById(id).lean() as any;
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Fetch current enrichments + previous inspection — ALL IN PARALLEL
      const [emp, user, vehicle, previous] = await Promise.all([
        current.driver
          ? SymxEmployee.findOne({ transporterId: current.driver }, { firstName: 1, lastName: 1 }).lean()
          : null,
        current.inspectedBy
          ? SymxUser.findOne({ email: current.inspectedBy }, { name: 1 }).lean()
            .then(u => u || SymxUser.findOne({ email: { $regex: `^${current.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { name: 1 }).lean())
          : null,
        current.vin
          ? Vehicle.findOne({ vin: current.vin }, { image: 1, vehicleName: 1 }).lean()
          : null,
        current.vin && current.routeDate
          ? DailyInspection.findOne({ vin: current.vin, _id: { $ne: current._id }, routeDate: { $lt: current.routeDate } })
            .sort({ routeDate: -1 }).lean()
          : null,
      ]);

      const enrichedCurrent = { ...current } as any;
      if (emp) enrichedCurrent.driverName = `${(emp as any).firstName || ""} ${(emp as any).lastName || ""}`.trim();
      if (user) enrichedCurrent.inspectedByName = (user as any).name;
      if (vehicle) {
        enrichedCurrent.vehicleImage = (vehicle as any).image || "";
        enrichedCurrent.vehicleName = (vehicle as any).vehicleName || "";
      }

      // Enrich previous — parallel if exists
      let enrichedPrevious = null;
      if (previous) {
        enrichedPrevious = { ...(previous as any) } as any;
        const [prevEmp, prevUser] = await Promise.all([
          (previous as any).driver
            ? SymxEmployee.findOne({ transporterId: (previous as any).driver }, { firstName: 1, lastName: 1 }).lean()
            : null,
          (previous as any).inspectedBy
            ? SymxUser.findOne({ email: (previous as any).inspectedBy }, { name: 1 }).lean()
              .then(u => u || SymxUser.findOne({ email: { $regex: `^${(previous as any).inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, { name: 1 }).lean())
            : null,
        ]);
        if (prevEmp) enrichedPrevious.driverName = `${(prevEmp as any).firstName || ""} ${(prevEmp as any).lastName || ""}`.trim();
        if (prevUser) enrichedPrevious.inspectedByName = (prevUser as any).name;
      }

      return NextResponse.json({ current: enrichedCurrent, previous: enrichedPrevious });
    }

    // Fetch the master/standard photo inspection for a VIN (for comparison)
    if (section === "inspection-master") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const current = await DailyInspection.findById(id).lean() as any;
      if (!current || !current.vin) return NextResponse.json({ error: "Not found or no VIN" }, { status: 404 });

      const master = await DailyInspection.findOne(
        { vin: current.vin, isStandardPhoto: true, _id: { $ne: current._id } }
      ).sort({ routeDate: -1 }).lean() as any;

      if (!master) return NextResponse.json({ master: null });

      // Enrich master
      const [mEmp, mUser] = await Promise.all([
        master.driver ? SymxEmployee.findOne({ transporterId: master.driver }, { firstName: 1, lastName: 1 }).lean() : null,
        master.inspectedBy ? SymxUser.findOne({ email: master.inspectedBy }, { name: 1 }).lean() : null,
      ]);
      const enrichedMaster = { ...master } as any;
      if (mEmp) enrichedMaster.driverName = `${(mEmp as any).firstName || ""} ${(mEmp as any).lastName || ""}`.trim();
      if (mUser) enrichedMaster.inspectedByName = (mUser as any).name;

      return NextResponse.json({ master: enrichedMaster });
    }

    if (section === "rentals") {
      const rentals = await VehicleRentalAgreement.find({}).sort({ createdAt: -1 }).lean();

      // Enrich with vehicleName by batch-resolving VINs → Vehicle collection
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
    }

    // Dropdowns for inspection form — employees + vehicles
    if (section === "inspection-dropdowns") {
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
    console.error("Fleet API Error:", error);
    return NextResponse.json({ error: "Failed to fetch fleet data" }, { status: 500 });
  }
}

// POST: Create new vehicle, slot, repair, etc.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const body = await req.json();
    const { type, data } = body;

    switch (type) {
      case "vehicle": {
        const vehicle = await Vehicle.create(data);
        return NextResponse.json({ vehicle, message: "Vehicle created successfully" });
      }



      case "repair": {
        const repair = await VehicleRepair.create(data);
        return NextResponse.json({ repair, message: "Repair record created successfully" });
      }

      case "activity": {
        const activity = await VehicleActivityLog.create(data);
        return NextResponse.json({ activity, message: "Activity log created successfully" });
      }

      case "inspection": {
        const inspection = await DailyInspection.create({ ...data, timeStamp: data.timeStamp || new Date() });
        return NextResponse.json({ inspection, message: "Inspection created successfully" });
      }

      case "rental": {
        const rental = await VehicleRentalAgreement.create(data);
        return NextResponse.json({ rental, message: "Rental agreement created successfully" });
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Fleet POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create record" },
      { status: 500 }
    );
  }
}

// PUT: Update record
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const body = await req.json();
    const { type, id, data } = body;

    switch (type) {
      case "vehicle": {
        const vehicle = await Vehicle.findByIdAndUpdate(id, { $set: data }, { new: true });
        return NextResponse.json({ vehicle, message: "Vehicle updated successfully" });
      }

      case "repair": {
        data.lastEditOn = new Date();
        const repair = await VehicleRepair.findByIdAndUpdate(id, { $set: data }, { new: true });
        return NextResponse.json({ repair, message: "Repair updated successfully" });
      }
      case "activity": {
        const activity = await VehicleActivityLog.findByIdAndUpdate(id, { $set: data }, { new: true });
        return NextResponse.json({ activity, message: "Activity log updated successfully" });
      }
      case "inspection": {
        const inspection = await VehicleInspection.findByIdAndUpdate(id, { $set: data }, { new: true });
        return NextResponse.json({ inspection, message: "Inspection updated successfully" });
      }
      case "rental": {
        const rental = await VehicleRentalAgreement.findByIdAndUpdate(id, { $set: data }, { new: true });
        return NextResponse.json({ rental, message: "Rental agreement updated successfully" });
      }
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Fleet PUT Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update record" },
      { status: 500 }
    );
  }
}

// DELETE: Remove record
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
    }

    switch (type) {
      case "vehicle": await Vehicle.findByIdAndDelete(id); break;

      case "repair": await VehicleRepair.findByIdAndDelete(id); break;
      case "activity": await VehicleActivityLog.findByIdAndDelete(id); break;
      case "inspection": await VehicleInspection.findByIdAndDelete(id); break;
      case "rental": await VehicleRentalAgreement.findByIdAndDelete(id); break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ message: "Record deleted successfully" });
  } catch (error: any) {
    console.error("Fleet DELETE Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete record" },
      { status: 500 }
    );
  }
}

// PATCH: Toggle standard photo on an inspection
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectToDatabase();
    const body = await req.json();
    const { action, id } = body;

    if (action === "toggle-standard-photo") {
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const inspection = await DailyInspection.findById(id) as any;
      if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const newValue = !inspection.isStandardPhoto;

      if (newValue && inspection.vin) {
        // Clear any existing standard photo for this VIN (only one master per vehicle)
        await DailyInspection.updateMany(
          { vin: inspection.vin, isStandardPhoto: true, _id: { $ne: inspection._id } },
          { $set: { isStandardPhoto: false } }
        );
      }

      inspection.isStandardPhoto = newValue;
      await inspection.save();

      return NextResponse.json({ success: true, isStandardPhoto: newValue });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Fleet PATCH Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}
