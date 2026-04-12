import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRescue from "@/lib/models/SYMXRescue";

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const dateStr = req.nextUrl.searchParams.get("dateStr");

        await connectToDatabase();
        const reasons = await SYMXRescue.distinct("reason");
        let records = [];
        if (dateStr) {
            records = await SYMXRescue.find({ date: dateStr }).lean() as any[];
        }

        return NextResponse.json({ reasons: reasons.filter(Boolean), records });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to fetch Rescue data" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue } = body;

        if (!routeId || !date || !transporterId || !rescuedBytransporterId || stopsRescued === undefined || !reason) {
            console.error("[Rescue API] Missing required fields:", { routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason });
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log("[Rescue API] Proceeding to save Rescue:", { routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue });

        await connectToDatabase();

        const updatedRescue = await SYMXRescue.findOneAndUpdate(
            { routeId, date },
            { $set: { transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue } },
            { new: true, upsert: true }
        );

        return NextResponse.json({ message: "Rescue recorded successfully", rescue: updatedRescue });
    } catch (error: any) {
        console.error("Error creating Rescue:", error);
        return NextResponse.json({ error: "Failed to save Rescue record" }, { status: 500 });
    }
}
