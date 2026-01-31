import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaWarehouse from "@/lib/models/VidaWarehouse";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await VidaWarehouse.find({});
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const newItem = await VidaWarehouse.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating warehouse:", error);
    return NextResponse.json({ error: "Failed to create warehouse" }, { status: 500 });
  }
}
