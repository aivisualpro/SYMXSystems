import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, resolveWriteSiteId, orgWide } from "@/lib/scoped-query";
import SYMXSetting from "@/lib/models/SYMXSetting";

// GET — fetch a setting by key (or all settings)
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
    const scope = await getRequestScope();
    const S = siteFilter(scope, { includeUnassigned: true });
    const writeSiteId = resolveWriteSiteId(scope, null);
        const { searchParams } = new URL(req.url);
        const key = searchParams.get("key");

        if (key) {
            const setting = await SYMXSetting.findOne({ key, ...S }).lean();
            return NextResponse.json(setting || { key, value: null });
        }

        const settings = await SYMXSetting.find(S).sort({ key: 1 }).lean();
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
        // Scope is per-request, so it has to be resolved inside each
        // handler. These were declared in GET only and used here too,
        // which is a ReferenceError the moment this route is called.
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);


        if (!key?.trim()) {
            return NextResponse.json({ error: "Setting key is required" }, { status: 400 });
        }

        if (!writeSiteId) {
            return NextResponse.json(
                { error: "Select a single station first." },
                { status: 400 }
            );
        }

        // Settings are per station (start times differ), so the upsert
        // filter AND the inserted document both carry the station —
        // otherwise saving at DXC8 would overwrite DFO2's row.
        const updated = await SYMXSetting.findOneAndUpdate(
            { key: key.trim(), ...S },
            {
                key: key.trim(),
                siteId: writeSiteId,
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
