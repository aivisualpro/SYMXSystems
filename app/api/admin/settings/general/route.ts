import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXSetting from "@/lib/models/SYMXSetting";

// GET — fetch a setting by key (or all settings)
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Admin", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const key = searchParams.get("key");

        if (key) {
            const setting = await SYMXSetting.findOne({ key }).lean();
            return NextResponse.json(setting || { key, value: null });
        }

        const settings = await SYMXSetting.find().sort({ key: 1 }).lean();
        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update a setting
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Admin", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const body = await req.json();
        const { key, value, description } = body;

        if (!key?.trim()) {
            return NextResponse.json({ error: "Setting key is required" }, { status: 400 });
        }

        const updated = await SYMXSetting.findOneAndUpdate(
            { key: key.trim() },
            {
                key: key.trim(),
                value,
                ...(description !== undefined ? { description } : {}),
            },
            { upsert: true, new: true }
        ).lean();

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
