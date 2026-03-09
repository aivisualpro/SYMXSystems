import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";

// GET — list all WST options
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const options = await SYMXWSTOption.find().sort({ sortOrder: 1, wst: 1 }).lean();
        return NextResponse.json(options);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update a WST option
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const body = await req.json();
        const { _id, wst, revenue, isActive, sortOrder } = body;

        if (!wst?.trim()) {
            return NextResponse.json({ error: "WST is required" }, { status: 400 });
        }

        if (_id) {
            const updated = await SYMXWSTOption.findByIdAndUpdate(
                _id,
                {
                    wst: wst.trim(),
                    revenue: parseFloat(revenue) || 0,
                    isActive: isActive ?? true,
                    sortOrder: sortOrder ?? 0,
                },
                { new: true }
            ).lean();
            if (!updated) return NextResponse.json({ error: "Option not found" }, { status: 404 });
            return NextResponse.json(updated);
        } else {
            const option = await SYMXWSTOption.create({
                wst: wst.trim(),
                revenue: parseFloat(revenue) || 0,
                isActive: isActive ?? true,
                sortOrder: sortOrder ?? 0,
            });
            return NextResponse.json(option.toJSON());
        }
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json({ error: "This WST option already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove a WST option
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await SYMXWSTOption.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
