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

  // Try to verify user is still active in DB, but fall back to session data
  // if DB is temporarily unreachable
  try {
    await connectToDatabase();
    const user = await SymxUser.findById(session.id);

    if (!user || !user.isActive) {
      await logout();
      return NextResponse.json({ authenticated: false, error: "Account inactive" }, { status: 401 });
    }
  } catch (e) {
    // DB unreachable — trust the JWT session data rather than blocking the user
    console.warn("Session route: DB lookup failed, falling back to JWT session data", e);
  }

  return NextResponse.json({ authenticated: true, user: session });
}
