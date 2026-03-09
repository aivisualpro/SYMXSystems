import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";

// GET: Fetch a single route by ID (all fields)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: "Route ID is required" }, { status: 400 });
        }

        await connectToDatabase();

        const route = await SYMXRoute.findById(id).lean();

        if (!route) {
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        return NextResponse.json({ route });
    } catch (error: any) {
        console.error("Error fetching route:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch route" }, { status: 500 });
    }
}
