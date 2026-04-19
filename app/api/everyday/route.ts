import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { SymxEveryday } from "@/lib/models/SymxEveryday";
import { authorizeAction } from "@/lib/rbac";


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
        const auth = await authorizeAction("Everyday", "view");
        if (!auth.authorized) return auth.response;

        await connectToDatabase();
        const url = new URL(req.url);

        const date = url.searchParams.get("date");
        const datesStr = url.searchParams.get("dates");

        if (datesStr) {
            const dateArray = datesStr.split(",");
            const records = await SymxEveryday.find({ date: { $in: dateArray } });
            const result: Record<string, any> = {};
            records.forEach(r => {
                result[r.date] = { notes: r.notes || "", routesAssigned: r.routesAssigned || 0 };
            });
            return NextResponse.json({ records: result });
        }

        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        const record = await SymxEveryday.findOne({ date });
        return NextResponse.json({ notes: record?.notes || "", routesAssigned: record?.routesAssigned || 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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
        const auth = await authorizeAction("Everyday", "edit");
        if (!auth.authorized) return auth.response;

        await connectToDatabase();
        const body = await req.json();
        const { date, notes, routesAssigned } = body;

        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        const updateData: any = {};
        if (notes !== undefined) updateData.notes = notes;
        if (routesAssigned !== undefined) updateData.routesAssigned = routesAssigned;

        const record = await SymxEveryday.findOneAndUpdate(
            { date },
            { $set: updateData },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, record });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
