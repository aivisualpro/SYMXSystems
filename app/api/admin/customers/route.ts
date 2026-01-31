import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaCustomer from "@/lib/models/VidaCustomer";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await VidaCustomer.find({});
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const newItem = await VidaCustomer.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
