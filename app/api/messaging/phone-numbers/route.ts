import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope } from "@/lib/scoped-query";
import { getSendableNumbers } from "@/lib/messaging/station-numbers";

const QUO_API_BASE = "https://api.openphone.com/v1";

// GET /api/messaging/phone-numbers
//
// The numbers this user may send from. Sourced from the STATIONS they can
// reach, not from OpenPhone — each station has its own number, and the
// picker must not offer one belonging to a station they cannot use.
//
// OpenPhone is consulted only to enrich what is already configured (its
// friendly name), and only when an API key exists. A missing key or a
// failed call degrades to the configured numbers rather than failing the
// request: this endpoint loads on every page, and it used to return 500
// on every one of them in any environment without the key — noise that
// buries real errors.

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const scope = await getRequestScope();
    const stationNumbers = await getSendableNumbers(scope);

    const data = stationNumbers.map((n) => ({
      id: n.phoneNumberId,
      number: n.phoneNumber,
      name: `${n.code} — ${n.name}`,
      siteId: n.siteId,
      stationCode: n.code,
    }));

    // ── Optional enrichment ──
    const apiKey = process.env.QUO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        data,
        // Told plainly rather than implied by an empty list, so "no numbers
        // configured" and "cannot reach OpenPhone" stay distinguishable.
        source: "stations",
        note:
          data.length === 0
            ? "No station has a Quo number configured yet — set one in Owner > Stations."
            : undefined,
      });
    }

    try {
      const res = await fetch(`${QUO_API_BASE}/phone-numbers`, {
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const live = await res.json();
        const byId = new Map(
          (live?.data || []).map((p: any) => [p.id, p])
        );
        for (const d of data) {
          const match: any = byId.get(d.id);
          if (match?.name) d.name = `${d.stationCode} — ${match.name}`;
          if (!d.number && match?.number) d.number = match.number;
        }
      }
    } catch {
      // Enrichment only. The configured numbers are what matters, and
      // failing the request because a cosmetic label could not be fetched
      // would take messaging down for a naming detail.
    }

    return NextResponse.json({ data, source: "stations" });
  } catch (error: any) {
    console.error("Phone Numbers API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
