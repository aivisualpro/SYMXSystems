
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxPO from "@/lib/models/SymxPO";

export async function GET() {
  try {
    await connectToDatabase();
    const items = await SymxPO.find({});
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const data = await req.json();
    const newItem = await SymxPO.create(data);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
