import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, newPassword } = await request.json();

    // Verify user is changing their own password or is a Super Admin
    if (session.id !== userId && session.role !== "Super Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectToDatabase();
    await SymxUser.findByIdAndUpdate(userId, { password: newPassword });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Change password API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
