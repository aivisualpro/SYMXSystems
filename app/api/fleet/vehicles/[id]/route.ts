import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import VehicleInspection from "@/lib/models/VehicleInspection";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
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

        const [repairs, activityLogs, inspections, rentalAgreements] =
            await Promise.all([
                VehicleRepair.find(matchByVinOrId).sort({ creationDate: -1 }).lean(),
                VehicleActivityLog.find(matchByVinOrId).sort({ createdAt: -1 }).lean(),
                VehicleInspection.find(matchByVinOrId)
                    .sort({ inspectionDate: -1 })
                    .lean(),
                VehicleRentalAgreement.find(matchByVinOrId)
                    .sort({ createdAt: -1 })
                    .lean(),
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

        return NextResponse.json({
            vehicle,
            repairs,
            activityLogs,
            inspections,
            rentalAgreements,
            stats: {
                openRepairs,
                completedRepairs,
                totalRepairCost,
                totalInspections: inspections.length,
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
