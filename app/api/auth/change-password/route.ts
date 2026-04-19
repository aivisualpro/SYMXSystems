import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";
import bcrypt from "bcrypt";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const changePasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(6)
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = validateBody(changePasswordSchema, rawBody);
    
    if (!validation.success) {
      return validation.response;
    }
    
    const { userId, newPassword } = validation.data;

    // Verify user is changing their own password or is a Super Admin
    if (session.id !== userId && session.role !== "Super Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectToDatabase();
    
    // Hash new password using bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await SymxUser.findByIdAndUpdate(userId, { password: hashedPassword });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Change password API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
