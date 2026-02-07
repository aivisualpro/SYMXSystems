
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxAppRole from "@/lib/models/SymxAppRole";

import SymxUser from "@/lib/models/SymxUser";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    // Sort items by name by default
    const roles = await SymxAppRole.find({}).sort({ name: 1 }).lean();
    
    // Aggregate user counts
    const userCounts = await SymxUser.aggregate([
      { $group: { _id: "$AppRole", count: { $sum: 1 } } }
    ]);

    // Merge counts
    const rolesWithCounts = roles.map((role: any) => {
        const found = userCounts.find(c => c._id === role.name);
        return { ...role, userCount: found ? found.count : 0 };
    });

    return NextResponse.json(rolesWithCounts);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    
    // Basic validation
    if (!body.name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await SymxAppRole.findOne({ name: body.name });
    if (existing) {
       return NextResponse.json({ error: "Role already exists" }, { status: 409 });
    }

    const newItem = await SymxAppRole.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
