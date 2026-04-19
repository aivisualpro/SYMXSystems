import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
import DailyInspection from "@/lib/models/DailyInspection";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import SYMXRoute from "@/lib/models/SYMXRoute";
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
    const section = searchParams.get("section") || "dashboard";

    if (section === "dashboard") {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const notReturned = { status: { $ne: "Returned" } };

      const [
        totalVehicles, vehicleStatusAgg, ownedCount, leasedCount, rentedCount,
        repairsOpen, repairStatusAgg, recentInspections, totalRentals, activeRentals,
        expiredRentals, expiringSoonCount, rentalAmountAgg, fleetNotWorkingDocs,
        registrationExpiringDocs, expiringSoonDocs,
      ] = await Promise.all([
        Vehicle.countDocuments(notReturned),
        Vehicle.aggregate([{ $match: notReturned }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        Vehicle.countDocuments({ ...notReturned, ownership: "Owned" }),
        Vehicle.countDocuments({ ...notReturned, ownership: "Leased" }),
        Vehicle.countDocuments({ ...notReturned, ownership: "Rented" }),
        VehicleRepair.find({ currentStatus: { $ne: "Completed" } }).sort({ creationDate: -1 }).limit(6).select("description unitNumber estimatedDate currentStatus vin").lean(),
        VehicleRepair.aggregate([{ $group: { _id: "$currentStatus", count: { $sum: 1 } } }]),
        DailyInspection.find({}).sort({ routeDate: -1 }).limit(6).select("vin unitNumber routeDate driver anyRepairs").lean(),
        VehicleRentalAgreement.countDocuments({}),
        VehicleRentalAgreement.countDocuments({ registrationEndDate: { $gt: now } }),
        VehicleRentalAgreement.countDocuments({ registrationEndDate: { $lte: now } }),
        VehicleRentalAgreement.countDocuments({ registrationEndDate: { $gt: now, $lte: thirtyDaysFromNow } }),
        VehicleRentalAgreement.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
        Vehicle.find({ status: { $in: ["Grounded", "Maintenance", "Inactive"] } }).select("unitNumber vehicleName status mileage updatedAt notes fleetCommunications").lean(),
        Vehicle.find({ status: "Active", registrationExpiration: { $gte: new Date(), $lte: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 90) } }).select("unitNumber vehicleName registrationExpiration status").sort({ registrationExpiration: 1 }).limit(10).lean(),
        VehicleRentalAgreement.find({ registrationEndDate: { $gt: now, $lte: thirtyDaysFromNow } }).sort({ registrationEndDate: 1 }).limit(6).select("agreementNumber vin registrationEndDate amount").lean(),
      ]);

      const vehicleStatusColorMap: Record<string, string> = {
        "Active": "#10b981", "Maintenance": "#f59e0b", "Grounded": "#ef4444",
        "Inactive": "#6b7280", "Decommissioned": "#8b5cf6", "Empty": "#3b82f6",
      };
      const vehicleStatusMap: Record<string, number> = {};
      (vehicleStatusAgg as any[]).forEach((r: any) => { if (r._id) vehicleStatusMap[r._id] = r.count; });

      const statusBreakdown = Object.entries(vehicleStatusMap).map(([name, value]) => ({ name, value, color: vehicleStatusColorMap[name] || "#6b7280" }));
      const statusOrder = ["Active", "Maintenance", "Grounded", "Inactive", "Decommissioned"];
      statusBreakdown.sort((a, b) => {
        const ai = statusOrder.indexOf(a.name);
        const bi = statusOrder.indexOf(b.name);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      const repairStatusMap: Record<string, number> = {};
      (repairStatusAgg as any[]).forEach((r: any) => { repairStatusMap[r._id || "Unknown"] = r.count; });
      const totalRepairs = Object.values(repairStatusMap).reduce((a, b) => a + b, 0);

      const BUSINESS_TZ = "America/Los_Angeles";
      const todayPT = new Date(new Date().toLocaleString("en-US", { timeZone: BUSINESS_TZ }));
      const todayStart = new Date(todayPT.getFullYear(), todayPT.getMonth(), todayPT.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const todayDateStr = todayStart.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

      const todayRoutes = await SYMXRoute.find(
        { date: { $gte: todayStart, $lt: todayEnd }, type: { $nin: ["off", "Off", "OFF", "oFF"] } },
        { type: 1, subType: 1, packageCount: 1, stopCount: 1, routeDuration: 1, van: 1, serviceType: 1, attendance: 1 }
      ).lean() as any[];

      const parseDuration = (d: string) => {
        if (!d) return 0;
        const parts = d.split(":");
        if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60;
        return parseFloat(d) || 0;
      };

      const routeTypes = todayRoutes.map(r => (r.type || "").toLowerCase().trim());
      const routeCount = routeTypes.filter(t => t === "route").length;
      
      const routesWithPkgs = todayRoutes.filter(r => r.packageCount > 0);
      const totalPackages = todayRoutes.reduce((s, r) => s + (r.packageCount || 0), 0);
      
      const dispatching = {
        date: todayDateStr,
        loadout: {
          routes: routeCount,
          operations: routeTypes.filter(t => ["operations", "operation"].includes(t)).length,
          callOut: routeTypes.filter(t => ["call out", "callout", "call-out"].includes(t)).length,
          reduction: routeTypes.filter(t => t === "reduction").length,
          avgRouteDuration: 0,
          avgPackageCount: routesWithPkgs.length > 0 ? Math.round(totalPackages / routesWithPkgs.length) : 0,
          totalPackageCount: totalPackages,
        },
        roster: {
          assignedRoutes: todayRoutes.length,
          workingVans: { total: todayRoutes.filter(r => r.van).length, xl: 0, lg: 0, sm: 0 },
          routesRostered: { total: routeCount, xl: 0, lg: 0, sm: 0 },
          extras: { standby: 0, open: 0, close: 0 },
          other: { amzTraining: 0, trainingOTR: 0, trainer: 0 },
        },
      };

      return NextResponse.json({
        kpis: {
          totalVehicles,
          activeVehicles: vehicleStatusMap["Active"] || 0,
          maintenanceVehicles: vehicleStatusMap["Maintenance"] || 0,
          groundedVehicles: vehicleStatusMap["Grounded"] || 0,
          inactiveVehicles: vehicleStatusMap["Inactive"] || 0,
        },
        statusBreakdown,
        ownershipBreakdown: [
          { name: "Owned", value: ownedCount, color: "#3b82f6" },
          { name: "Leased", value: leasedCount, color: "#8b5cf6" },
          { name: "Rented", value: rentedCount, color: "#ec4899" },
        ],
        repairStatusBreakdown: [
          { name: "Not Started", value: repairStatusMap["Not Started"] || 0 },
          { name: "In Progress", value: repairStatusMap["In Progress"] || 0 },
          { name: "Waiting for Parts", value: repairStatusMap["Waiting for Parts"] || 0 },
          { name: "Sent to Shop", value: repairStatusMap["Sent to Repair Shop"] || 0 },
        ],
        repairStatusMap,
        totalRepairs,
        totalOpenRepairs: totalRepairs,
        openRepairs: repairsOpen,
        recentInspections,
        rentalStats: {
          total: totalRentals, active: activeRentals, expired: expiredRentals,
          expiringSoon: expiringSoonCount, totalAmount: (rentalAmountAgg as any[])[0]?.total || 0,
        },
        expiringSoonRentals: expiringSoonDocs,
        fleetNotWorking: fleetNotWorkingDocs,
        registrationExpiring: registrationExpiringDocs,
        dispatching,
      });
    }

    if (section === "efficiency") {
      const yearWeek = searchParams.get("yearWeek");
      if (!yearWeek) return NextResponse.json({ error: "yearWeek is required" }, { status: 400 });

      const effAgg = await SYMXRoute.aggregate([
        { $match: { yearWeek, type: { $nin: ["off", "Off", "OFF", "oFF"] }, driverEfficiency: { $gt: 0 } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "America/Los_Angeles" } }, avgEfficiency: { $avg: "$driverEfficiency" }, totalCost: { $sum: "$totalCost" }, routeCount: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      return NextResponse.json({ yearWeek, days: effAgg.map((a: any) => ({ date: a._id, efficiency: Math.round(a.avgEfficiency * 100) / 100, cpr: Math.round(a.totalCost * 100) / 100, routeCount: a.routeCount })) });
    }

    if (section === "efficiency-history") {
      const daysBack = parseInt(searchParams.get("days") || "365");
      const startDate = new Date(); startDate.setDate(startDate.getDate() - daysBack); startDate.setHours(0, 0, 0, 0);

      const histAgg = await SYMXRoute.aggregate([
        { $match: { date: { $gte: startDate }, type: { $nin: ["off", "Off", "OFF", "oFF"] } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "America/Los_Angeles" } }, avgEfficiency: { $avg: { $cond: [{ $gt: ["$driverEfficiency", 0] }, "$driverEfficiency", null] } }, totalCost: { $sum: "$totalCost" }, routesPlanned: { $sum: 1 }, totalPackages: { $sum: "$packageCount" }, totalStops: { $sum: "$stopCount" } } },
        { $sort: { _id: 1 } },
      ]);

      return NextResponse.json({ data: histAgg.map((r: any) => ({
        date: r._id,
        efficiency: r.avgEfficiency ? Math.round(r.avgEfficiency * 100) / 100 : 0,
        cpr: r.routesPlanned > 0 ? Math.round((r.totalCost / r.routesPlanned) * 100) / 100 : 0,
        routesPlanned: r.routesPlanned, totalPackages: r.totalPackages, delivered: r.totalStops, notDelivered: 0,
      })) });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Fleet Dashboard GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
