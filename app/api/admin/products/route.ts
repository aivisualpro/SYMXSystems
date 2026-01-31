import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaProduct from "@/lib/models/VidaProduct";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await VidaProduct.find({});
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const newItem = await VidaProduct.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
