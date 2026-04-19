import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import RouteType from "@/lib/models/RouteType";

export async function GET() {
    await connectToDatabase();
    const routes = await RouteType.find().sort({ sortOrder: 1, name: 1 }).lean();
    return NextResponse.json(routes);
}
