import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxWarehouse from "@/lib/models/SymxWarehouse";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await SymxWarehouse.find({});
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
    const newItem = await SymxWarehouse.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating warehouse:", error);
    return NextResponse.json({ error: "Failed to create warehouse" }, { status: 500 });
  }
}
