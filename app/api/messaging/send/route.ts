import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const QUO_API_BASE = "https://api.openphone.com/v1";

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { recipients, message, from } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "recipients array is required" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { error: "message content is required" },
        { status: 400 }
      );
    }

    // Send messages in parallel batches
    const results: { to: string; success: boolean; error?: string }[] = [];

    const sendPromises = recipients.map(async (recipient: { phone: string; name?: string }) => {
      try {
        const res = await fetch(`${QUO_API_BASE}/messages`, {
          method: "POST",
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: message,
            from: from || undefined,
            to: [recipient.phone],
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          return {
            to: recipient.phone,
            name: recipient.name || "",
            success: false,
            error: errorData.message || `HTTP ${res.status}`,
          };
        }

        return {
          to: recipient.phone,
          name: recipient.name || "",
          success: true,
        };
      } catch (err: any) {
        return {
          to: recipient.phone,
          name: recipient.name || "",
          success: false,
          error: err.message || "Network error",
        };
      }
    });

    const batchResults = await Promise.all(sendPromises);
    results.push(...batchResults);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      sent: successCount,
      failed: failCount,
      total: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Messaging API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
