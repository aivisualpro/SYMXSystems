import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";

export async function POST(request: Request) {
  console.log("[Auth API] Login request received");
  try {
    const { email, password } = await request.json();
    console.log(`[Auth API] Attempting login for: ${email}`);

    // ── Super Admin Bypass ──────────────────────────────────────────
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (
      superAdminEmail &&
      superAdminPassword &&
      email.toLowerCase() === superAdminEmail.toLowerCase() &&
      password === superAdminPassword
    ) {
      console.log("[Auth API] Super Admin login bypass");
      const superAdminData = {
        id: "super-admin",
        email: superAdminEmail.toLowerCase(),
        name: "Super Admin",
        role: "Super Admin",
        avatar: "/logo.png",
      };
      await login(superAdminData);
      return NextResponse.json({ success: true, user: superAdminData });
    }
    // ────────────────────────────────────────────────────────────────

    const start = Date.now();
    await connectToDatabase();
    const dbEnd = Date.now();
    console.log(`[Auth API] DB Connection took: ${dbEnd - start}ms`);
    
    const user = await SymxUser.findOne({ email: email.toLowerCase() });
    const userEnd = Date.now();
    console.log(`[Auth API] User Lookup took: ${userEnd - dbEnd}ms`);

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Your account is inactive. Please contact your administrator." }, { status: 403 });
    }

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.AppRole || "Manager",
      avatar: user.profilePicture || "/logo.png",
    };

    const loginStart = Date.now();
    await login(userData);
    console.log(`[Auth API] Session creation took: ${Date.now() - loginStart}ms`);

    return NextResponse.json({ success: true, user: userData });
  } catch (error: any) {
    console.error("[Auth API] Login Error:", error);
    return NextResponse.json({ 
      error: error.message || "Authentication failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}
