import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const QUO_API_BASE = "https://api.openphone.com/v1";

// GET /api/messaging/phone-numbers
//
// ── Why this endpoint decides an order ────────────────────────────────
//
// The compose panel selects `data[0]` as the default sending number. That
// was harmless while the account held exactly one number, and became a
// silent fault the moment a second was added: the provider's ordering
// changed, the default changed with it, and messages went out from the
// wrong number with nothing on screen to say so.
//
// "First one the provider happened to return" is not a decision anybody
// made, so this endpoint makes one instead. Ordering is settled here
// rather than in the client because the same list feeds every caller.

/**
 * The number to fall back on when nothing is configured — DFO2, the
 * station this account has always sent from.
 *
 * A constant in the code is the wrong long-term home for this, and it is
 * here on purpose anyway: this whole file is replaced by the per-station
 * lookup when the multi-site work ships, and until then the alternative
 * is leaving the default to chance. The env var below overrides it
 * without a deploy, so this is a floor rather than a decision that has to
 * be revisited in code.
 *
 * Note the two numbers on the account both end 7969 — DFO2 is 925 and
 * DXC8 is 669. Worth reading twice before changing this line.
 */
const FALLBACK_DEFAULT_NUMBER = "+19254417969"; // DFO2 — (925) 441-7969

/**
 * Which number should be offered first.
 *
 * Set QUO_DEFAULT_PHONE_NUMBER to an E.164 number ("+15105551234"), an
 * OpenPhone id ("PNxxxxxxxx"), or the label shown in OpenPhone ("DFO2").
 * Matching all three means it can be set from whatever the operator has
 * to hand, without them having to know which form this code wants.
 */
function preferredKey(): string {
  return (process.env.QUO_DEFAULT_PHONE_NUMBER || FALLBACK_DEFAULT_NUMBER)
    .trim()
    .toLowerCase();
}

function matchesPreferred(entry: any, key: string): boolean {
  if (!key) return false;
  return [entry?.number, entry?.id, entry?.name]
    .filter(Boolean)
    .some((v: any) => String(v).trim().toLowerCase() === key);
}

/**
 * Order the numbers so the intended default is first.
 *
 * The preferred number wins — configured, or DFO2 by default. If that
 * number is not on the account at all (renumbered, removed), the OLDEST
 * number comes first, which is a real rule rather than an accident: the
 * number a business has been texting from is the one already saved in
 * the phones of everyone receiving those texts, so a newly added number
 * should never quietly displace it. Entries with no usable creation date
 * keep their relative order, so an unexpected payload degrades to
 * today's behaviour instead of shuffling.
 */
function orderNumbers(list: any[]): any[] {
  const key = preferredKey();
  const withIndex = list.map((entry, index) => ({ entry, index }));

  withIndex.sort((a, b) => {
    const aPref = matchesPreferred(a.entry, key);
    const bPref = matchesPreferred(b.entry, key);
    if (aPref !== bPref) return aPref ? -1 : 1;

    const aTime = Date.parse(a.entry?.createdAt ?? "");
    const bTime = Date.parse(b.entry?.createdAt ?? "");
    const aOk = !Number.isNaN(aTime);
    const bOk = !Number.isNaN(bTime);
    if (aOk && bOk && aTime !== bTime) return aTime - bTime;
    if (aOk !== bOk) return aOk ? -1 : 1;

    return a.index - b.index;
  });

  return withIndex.map((w) => w.entry);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.QUO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Quo API key not configured" },
        { status: 500 }
      );
    }

    const res = await fetch(`${QUO_API_BASE}/phone-numbers`, {
      method: "GET",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || `Failed to fetch phone numbers: HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (Array.isArray(data?.data)) {
      // `phoneNumber` is an ALIAS, not a rename. The provider calls this
      // field `number` while the compose panel reads `phoneNumber`, which
      // is why the picker renders an empty "()" beside every entry — the
      // sending number was never actually visible to the person choosing
      // it. The alias fixes the display without touching the client, and
      // keeping `number` leaves anything reading the provider's own shape
      // unaffected.
      data.data = orderNumbers(data.data).map((entry: any) => ({
        ...entry,
        phoneNumber: entry?.phoneNumber ?? entry?.number ?? "",
      }));
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Phone Numbers API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
