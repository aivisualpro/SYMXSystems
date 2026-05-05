import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const QUO_API_BASE = "https://api.openphone.com/v1";

/** Generate a short, URL-safe confirmation token (8 chars). */
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

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
    const { recipients, message, from, messageType = "unknown" } = body;

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

    if (!from) {
      return NextResponse.json(
        { error: "from phone number ID is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const senderEmail = (session as any)?.email || "system";
    const scheduleField = TAB_TO_SCHEDULE_FIELD[messageType];

    // Send messages in parallel
    const sendPromises = recipients.map(
      async (recipient: {
        phone: string;
        name?: string;
        message?: string;
        transporterId?: string;
        scheduleDate?: string;
        yearWeek?: string;
      }) => {
        let personalizedContent = recipient.message ?? message;

        // ── Generate confirmation link if template uses {confirmationLink} ──
        let confirmationToken: string | null = null;
        if (personalizedContent.includes("{confirmationLink}") && recipient.transporterId) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
            || req.nextUrl.origin;
          confirmationToken = generateToken();
          const confirmUrl = `${baseUrl}/c/${confirmationToken}`;
          personalizedContent = personalizedContent.replace(/\{confirmationLink\}/gi, confirmUrl);
        }

        try {
          const requestBody = {
            content: personalizedContent,
            from,
            to: [recipient.phone],
          };

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
            console.error("[Messaging] OpenPhone error:", res.status, JSON.stringify(responseData));

            await MessageLog.create({
              fromNumber: from,
              toNumber: recipient.phone,
              recipientName: recipient.name ?? "",
              messageType,
              content: personalizedContent,
              status: "failed",
              scheduleDate: recipient.scheduleDate || "",
              yearWeek: recipient.yearWeek || "",
              errorMessage:
                responseData.message || responseData.error || `HTTP ${res.status}`,
            }).catch(() => { });

            return {
              to: recipient.phone,
              name: recipient.name || "",
              success: false,
              error: responseData.message || responseData.error || `HTTP ${res.status}`,
            };
          }

          const openPhoneMessageId: string = responseData?.data?.id ?? "";

          // Persist to SYMXMessageLogs
          await MessageLog.create({
            openPhoneMessageId,
            fromNumber: from,
            fromDisplay: responseData?.data?.from ?? from,
            toNumber: recipient.phone,
            recipientName: recipient.name ?? "",
            messageType,
            content: personalizedContent,
            status: "sent",
            scheduleDate: recipient.scheduleDate || "",
            yearWeek: recipient.yearWeek || "",
            sentAt: new Date(),
          }).catch(() => null);

          // ── Push "sent" status into the SymxEmployeeSchedule ──────────────
          // Single source of truth: token, content, and all status data
          // lives in the shiftNotification/futureShift/routeItinerary array.
          // NO ScheduleConfirmation collection is used.
          if (scheduleField && recipient.transporterId) {
            try {
              const scheduleQuery: Record<string, any> = { transporterId: recipient.transporterId };
              if (recipient.scheduleDate) {
                // Use day-range to handle timezone/midnight edge cases
                const dayStart = new Date(recipient.scheduleDate + "T00:00:00.000Z");
                const dayEnd = new Date(recipient.scheduleDate + "T23:59:59.999Z");
                scheduleQuery.date = { $gte: dayStart, $lte: dayEnd };
              }

              const targetSchedule = await SymxEmployeeSchedule.findOne(scheduleQuery).sort({ date: -1 });

              if (targetSchedule) {
                const entryData: Record<string, any> = {
                  status: "sent",
                  createdAt: new Date(),
                  createdBy: senderEmail,
                  content: personalizedContent,
                  openPhoneMessageId,
                };

                // Store token + expiry directly in the entry (replaces ScheduleConfirmation)
                if (confirmationToken) {
                  entryData.token = confirmationToken;
                  entryData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
                }

                await SymxEmployeeSchedule.updateOne(
                  { _id: targetSchedule._id },
                  {
                    $push: {
                      [scheduleField]: entryData,
                    },
                  }
                );
              }
            } catch (schedErr: any) {
              console.error("[Messaging] Schedule update error:", schedErr.message);
            }
          }

          return {
            to: recipient.phone,
            name: recipient.name || "",
            success: true,
            data: responseData.data,
            openPhoneMessageId,
          };
        } catch (err: any) {
          console.error("[Messaging] Network error:", err.message);

          await MessageLog.create({
            fromNumber: from,
            toNumber: recipient.phone,
            recipientName: recipient.name ?? "",
            messageType,
            content: personalizedContent,
            status: "failed",
            scheduleDate: recipient.scheduleDate || "",
            yearWeek: recipient.yearWeek || "",
            errorMessage: err.message || "Network error",
          }).catch(() => { });

          return {
            to: recipient.phone,
            name: recipient.name || "",
            success: false,
            error: err.message || "Network error",
          };
        }
      }
    );

    const results = await Promise.all(sendPromises);

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
