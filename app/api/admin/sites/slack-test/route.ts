import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";

// Sends a test message to a Slack incoming-webhook URL (Super Admin only).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Super Admin only" }, { status: 403 });

  const { webhookUrl, code } = await req.json().catch(() => ({}));
  const url = String(webhookUrl || "").trim();
  if (!/^https:\/\/hooks\.slack\.com\/services\//.test(url)) {
    return NextResponse.json({ error: "Enter a valid Slack webhook URL (https://hooks.slack.com/services/…)" }, { status: 400 });
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `:white_check_mark: *${code || "Station"}* — SYMX Slack connection test. Efficiency alerts and capture-watchdog messages will appear here.` }),
    });
    if (!res.ok) return NextResponse.json({ error: `Slack rejected it (${res.status}). Check the webhook URL.` }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
