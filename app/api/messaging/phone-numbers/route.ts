import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const QUO_API_BASE = "https://api.openphone.com/v1";

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
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Phone Numbers API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
