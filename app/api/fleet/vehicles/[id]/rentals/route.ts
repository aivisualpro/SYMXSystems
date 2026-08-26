import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import Vehicle from "@/lib/models/Vehicle";
import mongoose from "mongoose";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";

// POST: Add rental agreement
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { id } = await params;
        if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid vehicle ID" }, { status: 400 });

        const body = await req.json();
        const { invoiceNumber, agreementNumber, registrationStartDate, registrationEndDate, dueDate, amount, file, image } = body;

        const vehicle = await Vehicle.findById(id, { vin: 1, unitNumber: 1 }).lean();
        if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

        const filesImages: string[] = [];
        if (file) filesImages.push(file);
        if (image) filesImages.push(image);

        const newRental = await VehicleRentalAgreement.create({
            vehicleId: new mongoose.Types.ObjectId(id),
            vin: vehicle.vin || "",
            unitNumber: vehicle.unitNumber || "",
            invoiceNumber: invoiceNumber || "",
            agreementNumber: agreementNumber || "",
            registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
            registrationEndDate: registrationEndDate ? new Date(registrationEndDate) : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            amount: Number(amount) || 0,
            rentalAgreementFilesImages: filesImages
        });

        return NextResponse.json(newRental);
    } catch (error: any) {
        console.error("Add rental agreement error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update rental agreement
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { id } = await params;
        if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid vehicle ID" }, { status: 400 });

        const body = await req.json();
        const { rentalId, invoiceNumber, agreementNumber, registrationStartDate, registrationEndDate, dueDate, amount, file, image } = body;

        if (!rentalId) return NextResponse.json({ error: "Rental Agreement ID required" }, { status: 400 });

        // Build array
        const filesImages: string[] = [];
        if (file) filesImages.push(file);
        if (image) filesImages.push(image);

        // Station filter in the query, not a check afterwards: a rental
        // agreement belongs to the station that signed it, and editing
        // another station's agreement must simply not match.
        const putScope = await getRequestScope();
        const updated = await VehicleRentalAgreement.findOneAndUpdate(
            { _id: rentalId, vehicleId: id, ...siteFilter(putScope, { includeUnassigned: true }) },
            {
                $set: {
                    invoiceNumber: invoiceNumber || "",
                    agreementNumber: agreementNumber || "",
                    registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
                    registrationEndDate: registrationEndDate ? new Date(registrationEndDate) : undefined,
                    dueDate: dueDate ? new Date(dueDate) : undefined,
                    amount: Number(amount) || 0,
                    rentalAgreementFilesImages: filesImages,
                }
            },
            { new: true }
        ).lean();

        if (!updated) return NextResponse.json({ error: "Rental agreement not found for this vehicle" }, { status: 404 });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Update rental agreement error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove rental agreement
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const rentalId = searchParams.get("rentalId");

        if (!mongoose.Types.ObjectId.isValid(id) || !rentalId) {
            return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
        }

        const delScope = await getRequestScope();
        const deleted = await VehicleRentalAgreement.findOneAndDelete({
            _id: rentalId,
            vehicleId: id,
            ...siteFilter(delScope, { includeUnassigned: true }),
        }).lean();
        if (!deleted) return NextResponse.json({ error: "Rental agreement not found" }, { status: 404 });

        return NextResponse.json({ success: true, deletedId: rentalId });
    } catch (error: any) {
        console.error("Delete rental agreement error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
