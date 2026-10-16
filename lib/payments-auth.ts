import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";

/**
 * Payments data is Super Admin ONLY — not governed by the role permission matrix,
 * so no role (Admin, Owner, Dispatcher …) can be granted it by accident.
 * Returns the session on success, or a ready 401/403 response.
 */
export async function requireSuperAdminApi(): Promise<{ session: any } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isSuperAdmin(session)) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { session };
}
