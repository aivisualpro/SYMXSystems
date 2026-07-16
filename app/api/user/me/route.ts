import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Minimal "who am I" endpoint — just the current session's own name/email,
// no extra permission gate beyond being logged in (unlike /api/admin/users,
// which requires "Admin" module view and would 403 for HR-only staff).
// Used for lightweight self-service actions like "Assign to me" and "My
// Tickets" filters that shouldn't depend on Admin-tier access.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    name: session.name || session.email || "",
    email: session.email || "",
  });
}
