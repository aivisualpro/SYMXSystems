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
      // Parallel fetch all summary data
      const [
        vehicles,
        repairsOpen,
        recentActivity,
        inspections,
        rentalAgreements,
      ] = await Promise.all([
        Vehicle.find({}).lean(),
        VehicleRepair.find({ currentStatus: { $ne: "Completed" } }).sort({ creationDate: -1 }).lean(),
        VehicleActivityLog.find({}).sort({ createdAt: -1 }).limit(20).lean(),
        VehicleInspection.find({}).sort({ inspectionDate: -1 }).limit(20).lean(),
        VehicleRentalAgreement.find({}).sort({ createdAt: -1 }).lean(),
      ]);

      // Compute KPIs
      const totalVehicles = vehicles.length;
      const activeVehicles = vehicles.filter((v: any) => v.status === "Active").length;
      const maintenanceVehicles = vehicles.filter((v: any) => v.status === "Maintenance").length;
      const groundedVehicles = vehicles.filter((v: any) => v.status === "Grounded").length;
      const inactiveVehicles = vehicles.filter((v: any) => v.status === "Inactive").length;

      // Status breakdown for donut chart
      const statusBreakdown = [
        { name: "Active", value: activeVehicles, color: "#10b981" },
        { name: "Maintenance", value: maintenanceVehicles, color: "#f59e0b" },
        { name: "Grounded", value: groundedVehicles, color: "#ef4444" },
        { name: "Inactive", value: inactiveVehicles, color: "#6b7280" },
      ];

      // Ownership breakdown
      const ownedCount = vehicles.filter((v: any) => v.ownership === "Owned").length;
      const leasedCount = vehicles.filter((v: any) => v.ownership === "Leased").length;
      const rentedCount = vehicles.filter((v: any) => v.ownership === "Rented").length;

      // Repair status breakdown
      const repairStatusBreakdown = [
        { name: "Not Started", value: repairsOpen.filter((r: any) => r.currentStatus === "Not Started").length },
        { name: "In Progress", value: repairsOpen.filter((r: any) => r.currentStatus === "In Progress").length },
        { name: "Waiting for Parts", value: repairsOpen.filter((r: any) => r.currentStatus === "Waiting for Parts").length },
        { name: "Sent to Shop", value: repairsOpen.filter((r: any) => r.currentStatus === "Sent to Repair Shop").length },
      ];

      // Upcoming registrations (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const upcomingRegistrations = recentActivity.filter((a: any) =>
        a.registrationExpiration &&
        new Date(a.registrationExpiration) <= thirtyDaysFromNow &&
        new Date(a.registrationExpiration) >= now
      );

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
        openRepairs: repairsOpen,
        recentActivity,
        recentInspections: inspections,
        rentalAgreements,
        upcomingRegistrations,
        vehicles,
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

    if (section === "activity") {
      const activity = await VehicleActivityLog.find({}).sort({ createdAt: -1 }).lean();
      return NextResponse.json({ activity });
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

      const [inspections, total] = await Promise.all([
        DailyInspection.find(filter).sort({ routeDate: -1 }).skip(skip).limit(limit).lean(),
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

      // Enrich with references
      const enriched = { ...inspection } as any;

      // Driver name from SymxEmployee by transporterId
      if (inspection.driver) {
        const emp = await SymxEmployee.findOne(
          { transporterId: inspection.driver },
          { firstName: 1, lastName: 1 }
        ).lean() as any;
        if (emp) enriched.driverName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      }

      // Inspected by name from SYMXUsers by email
      if (inspection.inspectedBy) {
        const user = await SymxUser.findOne(
          { email: { $regex: `^${inspection.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
          { name: 1 }
        ).lean() as any;
        if (user) enriched.inspectedByName = user.name;
      }

      // Vehicle image from Vehicle by VIN
      if (inspection.vin) {
        const vehicle = await Vehicle.findOne(
          { vin: inspection.vin },
          { image: 1, vehicleName: 1, unitNumber: 1 }
        ).lean() as any;
        if (vehicle) {
          enriched.vehicleImage = vehicle.image || "";
          enriched.vehicleName = vehicle.vehicleName || "";
        }
      }

      return NextResponse.json({ inspection: enriched });
    }

    if (section === "inspection-compare") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const current = await DailyInspection.findById(id).lean() as any;
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Enrich current
      const enrichedCurrent = { ...current } as any;
      if (current.driver) {
        const emp = await SymxEmployee.findOne({ transporterId: current.driver }, { firstName: 1, lastName: 1 }).lean() as any;
        if (emp) enrichedCurrent.driverName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      }
      if (current.inspectedBy) {
        const user = await SymxUser.findOne(
          { email: { $regex: `^${current.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
          { name: 1 }
        ).lean() as any;
        if (user) enrichedCurrent.inspectedByName = user.name;
      }
      if (current.vin) {
        const vehicle = await Vehicle.findOne({ vin: current.vin }, { image: 1, vehicleName: 1 }).lean() as any;
        if (vehicle) {
          enrichedCurrent.vehicleImage = vehicle.image || "";
          enrichedCurrent.vehicleName = vehicle.vehicleName || "";
        }
      }

      // Find previous
      const previous = current.vin && current.routeDate
        ? await DailyInspection.findOne({
          vin: current.vin,
          _id: { $ne: current._id },
          routeDate: { $lt: current.routeDate },
        }).sort({ routeDate: -1 }).lean() as any
        : null;

      // Enrich previous
      let enrichedPrevious = null;
      if (previous) {
        enrichedPrevious = { ...previous } as any;
        if (previous.driver) {
          const emp = await SymxEmployee.findOne({ transporterId: previous.driver }, { firstName: 1, lastName: 1 }).lean() as any;
          if (emp) enrichedPrevious.driverName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
        }
        if (previous.inspectedBy) {
          const user = await SymxUser.findOne(
            { email: { $regex: `^${previous.inspectedBy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
            { name: 1 }
          ).lean() as any;
          if (user) enrichedPrevious.inspectedByName = user.name;
        }
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
