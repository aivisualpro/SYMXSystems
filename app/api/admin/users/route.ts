import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";
import bcrypt from "bcrypt";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  phone: z.string().optional(),
  AppRole: z.string().optional(),
  designation: z.string().optional(),
  isActive: z.boolean().optional(),
  serialNo: z.string().optional(),
  profilePicture: z.string().optional(),
  location: z.string().optional()
}).passthrough();

export async function GET(req: NextRequest) {
  try {
    await requirePermission("Admin", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    await requirePermission("Admin", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await req.json();
    const validation = validateBody(userSchema, rawBody);
    
    if (!validation.success) {
      return validation.response;
    }
    const body = validation.data;
    
    // Hash password if present
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12);
    }
    
    const newItem = await SymxUser.create(body);
    return NextResponse.json(newItem);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
