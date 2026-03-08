import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import VehicleInspection from "@/lib/models/VehicleInspection";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import DailyInspection from "@/lib/models/DailyInspection";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxUser from "@/lib/models/SymxUser";
import mongoose from "mongoose";

// GET: Single vehicle + related data
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid vehicle ID" }, { status: 400 });
        }

        const vehicle = await Vehicle.findById(id).lean();
        if (!vehicle) {
            return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
        }

        // Fetch all related records using both vehicleId, vin, and unitNumber
        const vin = (vehicle as any).vin || "";
        const unitNumber = (vehicle as any).unitNumber || "";
        const vehicleId = (vehicle as any)._id;

        // Build OR queries for flexible matching
        const matchByVinOrId = {
            $or: [
                { vehicleId },
                ...(vin ? [{ vin }] : []),
                ...(unitNumber ? [{ unitNumber }] : []),
            ],
        };

        const [repairs, activityLogs, inspections, rentalAgreements, masterPhotoInspection, dailyInspections] =
            await Promise.all([
                VehicleRepair.find(matchByVinOrId).sort({ creationDate: -1 }).lean(),
                VehicleActivityLog.find(matchByVinOrId).sort({ createdAt: -1 }).lean(),
                VehicleInspection.find(matchByVinOrId)
                    .sort({ inspectionDate: -1 })
                    .lean(),
                VehicleRentalAgreement.find(matchByVinOrId)
                    .sort({ createdAt: -1 })
                    .lean(),
                vin
                    ? DailyInspection.findOne(
                        { vin, isStandardPhoto: true },
                        { vehiclePicture1: 1, vehiclePicture2: 1, vehiclePicture3: 1, vehiclePicture4: 1, dashboardImage: 1, additionalPicture: 1, routeDate: 1, driver: 1, mileage: 1, comments: 1 }
                    ).sort({ routeDate: -1 }).lean()
                    : null,
                vin
                    ? DailyInspection.find(
                        { vin },
                        { routeDate: 1, driver: 1, mileage: 1, comments: 1, anyRepairs: 1, isStandardPhoto: 1, isCompared: 1, inspectedBy: 1 }
                    ).sort({ routeDate: -1 }).lean()
                    : [],
            ]);

        // Summary stats
        const openRepairs = repairs.filter(
            (r: any) => r.currentStatus !== "Completed"
        ).length;
        const completedRepairs = repairs.filter(
            (r: any) => r.currentStatus === "Completed"
        ).length;
        const totalRepairCost = 0; // Could be computed if cost field existed
        const passedInspections = inspections.filter(
            (i: any) => i.overallResult === "Pass"
        ).length;
        const failedInspections = inspections.filter(
            (i: any) => i.overallResult === "Fail"
        ).length;
        const totalRentalAmount = rentalAgreements.reduce(
            (sum: number, r: any) => sum + (r.amount || 0),
            0
        );

        // Enrich daily inspections with driver & inspector names
        const diArr = (dailyInspections || []) as any[];
        let enrichedDailyInspections = diArr;
        if (diArr.length > 0) {
            const driverIds = [...new Set(diArr.map((i: any) => i.driver).filter(Boolean))];
            const inspectorEmails = [...new Set(diArr.map((i: any) => i.inspectedBy).filter(Boolean))];
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
                if (emp.transporterId) driverMap[emp.transporterId] = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
            }
            const inspectorMap: Record<string, string> = {};
            for (const user of inspectors as any[]) {
                if (user.email) inspectorMap[user.email.toLowerCase()] = user.name || user.email;
            }
            enrichedDailyInspections = diArr.map((insp: any) => ({
                ...insp,
                driverName: insp.driver ? (driverMap[insp.driver] || insp.driver) : "",
                inspectedByName: insp.inspectedBy ? (inspectorMap[insp.inspectedBy.toLowerCase()] || insp.inspectedBy) : "",
            }));
        }

        return NextResponse.json({
            vehicle,
            repairs,
            activityLogs,
            inspections,
            rentalAgreements,
            dailyInspections: enrichedDailyInspections,
            masterPhotoInspection: masterPhotoInspection || null,
            stats: {
                openRepairs,
                completedRepairs,
                totalRepairCost,
                totalInspections: (dailyInspections as any[])?.length || inspections.length,
                passedInspections,
                failedInspections,
                totalActivityLogs: activityLogs.length,
                totalRentals: rentalAgreements.length,
                totalRentalAmount,
            },
        });
    } catch (error) {
        console.error("Vehicle detail API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch vehicle details" },
            { status: 500 }
        );
    }
}
