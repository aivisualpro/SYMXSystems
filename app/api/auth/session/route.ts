import { NextResponse } from "next/server";
import { getSession, logout } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Super Admin bypass — no DB user to look up
  if (session.id === "super-admin") {
    return NextResponse.json({ authenticated: true, user: session });
  }

  await connectToDatabase();
  const user = await SymxUser.findById(session.id);

  if (!user || !user.isActive) {
    await logout();
    return NextResponse.json({ authenticated: false, error: "Account inactive" }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: session });
}
