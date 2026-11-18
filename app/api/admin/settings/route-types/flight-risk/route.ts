import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requireSuperAdminApi } from "@/lib/payments-auth";
import { ensureFlightRiskType } from "@/lib/ensure-flight-risk";

/**
 * POST — adds the "Flight Risk" shift type (Super Admin only, safe to repeat).
 * It is also created automatically the first time shift types are loaded, so
 * this is just a manual fallback.
 */
export async function POST() {
  const auth = await requireSuperAdminApi();
  if ("response" in auth) return auth.response;

  await connectToDatabase();
  const r = await ensureFlightRiskType();
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(
    r.created ? { created: true, id: r.id } : { created: false, message: "Flight Risk already exists." }
  );
}
