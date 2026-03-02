import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import RouteType from "@/lib/models/RouteType";

// GET — list all route types
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const routes = await RouteType.find().sort({ sortOrder: 1, name: 1 }).lean();
        return NextResponse.json(routes);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update route type
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const body = await req.json();
        const { _id, name, color, startTime, sortOrder, isActive } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Route type name is required" }, { status: 400 });
        }

        if (_id) {
            // Update existing
            const updated = await RouteType.findByIdAndUpdate(
                _id,
                { name: name.trim(), color, startTime, sortOrder, isActive },
                { new: true }
            ).lean();
            if (!updated) return NextResponse.json({ error: "Route type not found" }, { status: 404 });
            return NextResponse.json(updated);
        } else {
            // Create new
            const route = await RouteType.create({
                name: name.trim(),
                color: color || "#6B7280",
                startTime: startTime || "",
                sortOrder: sortOrder ?? 0,
                isActive: isActive ?? true,
            });
            return NextResponse.json(route.toJSON());
        }
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json({ error: "Route type with this name already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove a route type
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await RouteType.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
