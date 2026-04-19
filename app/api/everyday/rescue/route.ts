import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRescue from "@/lib/models/SYMXRescue";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("Everyday", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    await requirePermission("Everyday", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { _id, routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue } = body;

        if (!routeId || !date || !transporterId || !rescuedBytransporterId || stopsRescued === undefined || !reason) {
            console.error("[Rescue API] Missing required fields:", { routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason });
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (stopsRescued < 0) {
            return NextResponse.json({ error: "Stops rescued cannot be negative" }, { status: 400 });
        }

        console.log("[Rescue API] Proceeding to save Rescue:", { routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue });

        await connectToDatabase();

        let updatedRescue;
        if (_id) {
            updatedRescue = await SYMXRescue.findByIdAndUpdate(
                _id,
                { $set: { transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue, routeId, date } },
                { new: true }
            );
        } else {
            updatedRescue = await SYMXRescue.create({
                routeId, date, transporterId, rescuedBytransporterId, stopsRescued, reason, performanceRescue
            });
        }

        return NextResponse.json({ message: "Rescue recorded successfully", rescue: updatedRescue });
    } catch (error: any) {
        console.error("Error creating Rescue:", error);
        return NextResponse.json({ error: "Failed to save Rescue record" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
  try {
    await requirePermission("Everyday", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        await connectToDatabase();
        await SYMXRescue.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
