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
        const requestBody = {
          content: message,
          from: from || undefined,
          to: [recipient.phone],
        };

        console.log("[Messaging] Sending to OpenPhone:", JSON.stringify(requestBody, null, 2));

        const res = await fetch(`${QUO_API_BASE}/messages`, {
          method: "POST",
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const responseData = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.error("[Messaging] OpenPhone error response:", res.status, JSON.stringify(responseData));
          return {
            to: recipient.phone,
            name: recipient.name || "",
            success: false,
            error: responseData.message || responseData.error || `HTTP ${res.status}`,
          };
        }

        console.log("[Messaging] OpenPhone success response:", JSON.stringify(responseData, null, 2));

        return {
          to: recipient.phone,
          name: recipient.name || "",
          success: true,
          data: responseData.data,
        };
      } catch (err: any) {
        console.error("[Messaging] Network/fetch error:", err.message);
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
