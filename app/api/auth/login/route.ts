import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";
import bcrypt from "bcrypt";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  console.log("[Auth API] Login request received");
  try {
    const rawBody = await request.json();
    const validation = validateBody(loginSchema, rawBody);
    
    if (!validation.success) {
      return validation.response;
    }
    
    const { email, password } = validation.data;
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
        name: superAdminEmail.split("@")[0].split(/[._-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
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

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // ── Safe Password Migration & Validation ────────────────────────────────
    let isPasswordValid = false;

    // Detect if the stored password isn't a bcrypt hash (bcrypt hashes usually start with $2a$, $2b$, or $2y$)
    const isLegacyPlaintext = !user.password.startsWith("$2");

    if (isLegacyPlaintext) {
      // Check exact match for plaintext
      if (user.password === password) {
        isPasswordValid = true;
        // Migrate password to bcrypt immediately
        try {
          const hashedPassword = await bcrypt.hash(password, 12);
          user.password = hashedPassword;
          await user.save();
          console.log(`[Auth API] Successfully migrated password to bcrypt for: ${email}`);
        } catch (migrationError) {
          console.error(`[Auth API] Password migration failed for: ${email}`, migrationError);
        }
      }
    } else {
      // Use bcrypt to check
      isPasswordValid = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    // ────────────────────────────────────────────────────────────────────────

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
      error: "Authentication failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}
