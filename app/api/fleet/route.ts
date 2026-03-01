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

      // All counts + small fetches in parallel — no full collection scans
      const [
        totalVehicles,
        activeVehicles,
        maintenanceVehicles,
        groundedVehicles,
        inactiveVehicles,
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
        expiringSoonDocs,
      ] = await Promise.all([
        Vehicle.countDocuments({}),
        Vehicle.countDocuments({ status: "Active" }),
        Vehicle.countDocuments({ status: "Maintenance" }),
        Vehicle.countDocuments({ status: "Grounded" }),
        Vehicle.countDocuments({ status: "Inactive" }),
        Vehicle.countDocuments({ ownership: "Owned" }),
        Vehicle.countDocuments({ ownership: "Leased" }),
        Vehicle.countDocuments({ ownership: "Rented" }),
        VehicleRepair.find({ currentStatus: { $ne: "Completed" } })
          .sort({ creationDate: -1 }).limit(6)
          .select("description unitNumber estimatedDate currentStatus vin").lean(),
        VehicleRepair.aggregate([
          { $match: { currentStatus: { $ne: "Completed" } } },
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
        VehicleRentalAgreement.find({ registrationEndDate: { $gt: now, $lte: thirtyDaysFromNow } })
          .sort({ registrationEndDate: 1 }).limit(6)
          .select("agreementNumber vin registrationEndDate amount").lean(),
      ]);

      // Build repair status breakdown from aggregation
      const repairStatusMap: Record<string, number> = {};
      (repairStatusAgg as any[]).forEach((r: any) => { repairStatusMap[r._id] = r.count; });
      const totalOpenRepairs = Object.values(repairStatusMap).reduce((a, b) => a + b, 0);

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
        statusBreakdown: [
          { name: "Active", value: activeVehicles, color: "#10b981" },
          { name: "Maintenance", value: maintenanceVehicles, color: "#f59e0b" },
          { name: "Grounded", value: groundedVehicles, color: "#ef4444" },
          { name: "Inactive", value: inactiveVehicles, color: "#6b7280" },
        ],
        ownershipBreakdown: [
          { name: "Owned", value: ownedCount, color: "#3b82f6" },
          { name: "Leased", value: leasedCount, color: "#8b5cf6" },
          { name: "Rented", value: rentedCount, color: "#ec4899" },
        ],
        repairStatusBreakdown,
        openRepairs: repairsOpen,
        totalOpenRepairs,
        recentInspections,
        rentalStats: {
          total: totalRentals,
          active: activeRentals,
          expired: expiredRentals,
          expiringSoon: expiringSoonCount,
          totalAmount: totalRentalAmount,
        },
        expiringSoonRentals: expiringSoonDocs,
      });
    }

    if (section === "vehicles") {
      const vehicles = await Vehicle.find({}).sort({ createdAt: -1 }).lean();
      return NextResponse.json({ vehicles });
    }



    if (section === "repairs") {
      const q = searchParams.get("q") || "";
      const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"));
      const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "100")), 1000);

      const filter = q
        ? {
          $or: [
            { vin: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
            { currentStatus: { $regex: q, $options: "i" } },
            { unitNumber: { $regex: q, $options: "i" } },
          ],
        }
        : {};

      const [repairs, total] = await Promise.all([
        VehicleRepair.find(filter).sort({ creationDate: -1 }).skip(skip).limit(limit).lean(),
        VehicleRepair.countDocuments(filter),
      ]);

      return NextResponse.json({
        repairs,
        total,
        hasMore: skip + repairs.length < total,
      });
    }



    if (section === "inspections") {
      const q = searchParams.get("q") || "";
      const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"));
      const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "100")), 1000);

      const filter = q
        ? {
          $or: [
            { vin: { $regex: q, $options: "i" } },
            { driver: { $regex: q, $options: "i" } },
            { routeId: { $regex: q, $options: "i" } },
            { inspectedBy: { $regex: q, $options: "i" } },
            { comments: { $regex: q, $options: "i" } },
          ],
        }
        : {};

      // Only select fields needed for the list view — skip heavy image URLs
      const listFields = "routeId driver routeDate vin unitNumber mileage comments inspectedBy timeStamp anyRepairs repairCurrentStatus isCompared";

      const [inspections, total] = await Promise.all([
        DailyInspection.find(filter).select(listFields).sort({ routeDate: -1 }).skip(skip).limit(limit).lean(),
        DailyInspection.countDocuments(filter),
      ]);

      return NextResponse.json({
        inspections,
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
      const [emp, user, vehicle] = await Promise.all([
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
      ]);

      if (emp) enriched.driverName = `${(emp as any).firstName || ""} ${(emp as any).lastName || ""}`.trim();
      if (user) enriched.inspectedByName = (user as any).name;
      if (vehicle) {
        enriched.vehicleImage = (vehicle as any).image || "";
        enriched.vehicleName = (vehicle as any).vehicleName || "";
      }

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

    if (section === "rentals") {
      const rentals = await VehicleRentalAgreement.find({}).sort({ createdAt: -1 }).lean();
      return NextResponse.json({ rentals });
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
        const inspection = await VehicleInspection.create(data);
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
