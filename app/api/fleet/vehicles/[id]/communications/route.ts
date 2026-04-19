import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import mongoose from "mongoose";

// POST: Add communication
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
        const { date, status, comments } = body;

        const newComm = {
            _id: new mongoose.Types.ObjectId(),
            date: new Date(date),
            status: status || "",
            comments: comments || "",
            createdBy: session.user?.name || session.user?.email || "Unknown",
            createdAt: new Date()
        };

        const vehicle = await Vehicle.findByIdAndUpdate(
            id,
            { $push: { fleetCommunications: newComm } },
            { new: true }
        ).lean();

        if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

        return NextResponse.json(newComm);
    } catch (error: any) {
        console.error("Add communication error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update communication
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
        const { commId, date, status, comments } = body;

        if (!commId) return NextResponse.json({ error: "Communication ID required" }, { status: 400 });

        const vehicle = await Vehicle.findOneAndUpdate(
            { _id: id, "fleetCommunications._id": commId },
            {
                $set: {
                    "fleetCommunications.$.date": new Date(date),
                    "fleetCommunications.$.status": status || "",
                    "fleetCommunications.$.comments": comments || ""
                }
            },
            { new: true }
        ).lean();

        if (!vehicle) return NextResponse.json({ error: "Vehicle or communication not found" }, { status: 404 });

        const updatedComm = vehicle.fleetCommunications?.find((c: any) => c._id.toString() === commId);
        return NextResponse.json(updatedComm);
    } catch (error: any) {
        console.error("Update communication error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove communication
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
        const commId = searchParams.get("commId");

        if (!mongoose.Types.ObjectId.isValid(id) || !commId) {
            return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
        }

        const vehicle = await Vehicle.findByIdAndUpdate(
            id,
            { $pull: { fleetCommunications: { _id: commId } } },
            { new: true }
        ).lean();

        if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete communication error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
