import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";

const QUO_API_BASE = "https://api.openphone.com/v1";

// GET /api/admin/quo/numbers
//
// Every number on the Quo account, for the station editor to offer as a
// dropdown.
//
// This exists separately from /api/messaging/phone-numbers, which answers
// "what may this user send from" and is scoped to the stations in view.
// Assigning a number is the opposite question — you are choosing from
// numbers that are deliberately NOT yet attached to any station — so
// reusing the scoped endpoint here would hide exactly the numbers the
// admin came to pick.
//
// Super Admin only, matching /api/admin/sites: the number is what ties a
// station to its messages in both directions, so changing it reassigns
// message history and inbound replies.

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isSuperAdmin(session)) {
    return { ok: false as const, res: NextResponse.json({ error: "Super Admin only" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.res;

  await connectToDatabase();

  // Who already holds what. Sent alongside the numbers so the editor can
  // say "already on DXC8" instead of letting someone pick a number that
  // the unique index will then reject with a database error.
  const sites = await Site.find(
    { "messaging.quoPhoneNumberId": { $exists: true, $ne: "" } },
    { code: 1, name: 1, messaging: 1 }
  ).lean();

  const claimedById = new Map<string, { siteId: string; code: string }>();
  const claimedByNumber = new Map<string, { siteId: string; code: string }>();
  for (const s of sites as any[]) {
    const who = { siteId: String(s._id), code: s.code };
    if (s.messaging?.quoPhoneNumberId) claimedById.set(s.messaging.quoPhoneNumberId, who);
    if (s.messaging?.quoPhoneNumber) claimedByNumber.set(s.messaging.quoPhoneNumber, who);
  }

  const apiKey = process.env.QUO_API_KEY;

  // A missing key or an unreachable provider must not make the field
  // uneditable — the editor falls back to typing the values by hand, so
  // `reason` is returned rather than an error status. Failing the request
  // would mean an outage at OpenPhone blocks station configuration here.
  const unavailable = (reason: string) =>
    NextResponse.json({ numbers: [], available: false, reason });

  if (!apiKey) {
    return unavailable(
      "QUO_API_KEY is not set in this environment, so the number list cannot be loaded. Enter the values manually."
    );
  }

  try {
    const res = await fetch(`${QUO_API_BASE}/phone-numbers`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return unavailable(`Quo returned HTTP ${res.status} when listing numbers. Enter the values manually.`);
    }

    const body = await res.json();
    const list = Array.isArray(body?.data) ? body.data : [];

    const numbers = list.map((n: any) => {
      const id = String(n?.id || "");
      const number = String(n?.number || "");
      const claim = claimedById.get(id) || claimedByNumber.get(number);
      return {
        id,
        number,
        // OpenPhone's label is optional; falling back to the number keeps
        // the dropdown readable rather than showing a blank row.
        label: String(n?.name || "").trim() || number,
        claimedBySiteId: claim?.siteId || null,
        claimedByCode: claim?.code || null,
      };
    });

    // Unclaimed first — those are the ones an admin is usually here to
    // assign — then by label so the order is stable between loads.
    numbers.sort((a: any, b: any) => {
      if (!!a.claimedBySiteId !== !!b.claimedBySiteId) return a.claimedBySiteId ? 1 : -1;
      return String(a.label).localeCompare(String(b.label));
    });

    return NextResponse.json({ numbers, available: true });
  } catch (err: any) {
    return unavailable(
      `Could not reach Quo (${err?.message || "network error"}). Enter the values manually.`
    );
  }
}
