import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    // Optimized fetch: Select only necessary fields and use lean()
    const items = await SymxUser.find({}, 
      "name email phone AppRole designation isActive serialNo profilePicture location createdAt"
    ).lean();
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const newItem = await SymxUser.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
