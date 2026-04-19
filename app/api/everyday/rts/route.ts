import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRTS from "@/lib/models/SYMXRTS";

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
        const reasons = await SYMXRTS.distinct("reason");
        let records = [];
        if (dateStr) {
            records = await SYMXRTS.find({ date: dateStr }).lean() as any[];
        }

        return NextResponse.json({ reasons: reasons.filter(Boolean), records });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to fetch RTS data" }, { status: 500 });
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
        const { _id, routeId, date, transporterId, tba, reason } = body;

        if (!routeId || !date || !transporterId || !tba || !reason) {
            console.error("[RTS API] Missing required fields:", { routeId, date, transporterId, tba, reason });
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log("[RTS API] Proceeding to save RTS:", { routeId, date, transporterId, tba, reason });

        await connectToDatabase();

        let updatedRTS;
        if (_id) {
            updatedRTS = await SYMXRTS.findByIdAndUpdate(
                _id,
                { $set: { transporterId, tba, reason, routeId, date } },
                { new: true }
            );
        } else {
            updatedRTS = await SYMXRTS.create({
                routeId, date, transporterId, tba, reason
            });
        }

        return NextResponse.json({ message: "RTS recorded successfully", rts: updatedRTS });
} catch (error: any) {
        console.error("Error creating RTS:", error);
        return NextResponse.json({ error: "Failed to save RTS record" }, { status: 500 });
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
        await SYMXRTS.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
