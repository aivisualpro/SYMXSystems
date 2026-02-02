import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaCategory from "@/lib/models/VidaCategory";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await VidaCategory.find({});
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const newItem = await VidaCategory.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
