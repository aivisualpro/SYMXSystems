import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";

/** Stations the extension should visit on a scheduled run. */
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
};
const KEY = process.env.CORTEX_SYNC_KEY || "symx-ext-route-sync-2026";

export async function GET(req: NextRequest) {
    if (req.headers.get("x-extension-key") !== KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    await connectToDatabase();
    const sites = await Site.find({ status: "active", "amazon.serviceAreaId": { $exists: true, $ne: "" } }, { code: 1, amazon: 1 }).lean() as any[];
    return NextResponse.json({
        stations: sites.map((s) => ({ code: s.code, serviceAreaId: s.amazon.serviceAreaId })),
    }, { headers: CORS });
}

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }); }
