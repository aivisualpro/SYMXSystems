import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

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

    const senderEmail = (session as any)?.user?.email || "system";
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
        let confirmationDoc: any = null;
        if (personalizedContent.includes("{confirmationLink}") && recipient.transporterId) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
          confirmationDoc = await ScheduleConfirmation.create({
            transporterId: recipient.transporterId,
            employeeName: recipient.name || "",
            scheduleDate: recipient.scheduleDate || "",
            yearWeek: recipient.yearWeek || "",
            messageType,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          });
          const confirmUrl = `${baseUrl}/c/${confirmationDoc.token}`;
          personalizedContent = personalizedContent.replace(/\{confirmationLink\}/gi, confirmUrl);
        }

        try {
          const requestBody = {
            content: personalizedContent,
            from,
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
            console.error("[Messaging] OpenPhone error:", res.status, JSON.stringify(responseData));

            await MessageLog.create({
              fromNumber: from,
              toNumber: recipient.phone,
              recipientName: recipient.name ?? "",
              messageType,
              content: personalizedContent,
              status: "failed",
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

          console.log("[Messaging] OpenPhone success:", JSON.stringify(responseData, null, 2));

          const openPhoneMessageId: string = responseData?.data?.id ?? "";

          // Persist to SYMXMessageLogs
          const msgLog = await MessageLog.create({
            openPhoneMessageId,
            fromNumber: from,
            fromDisplay: responseData?.data?.from ?? from,
            toNumber: recipient.phone,
            recipientName: recipient.name ?? "",
            messageType,
            content: personalizedContent,
            status: "sent",
            sentAt: new Date(),
          }).catch(() => null);

          // Link messageLog to confirmation record
          if (confirmationDoc && msgLog) {
            await ScheduleConfirmation.updateOne(
              { _id: confirmationDoc._id },
              { $set: { messageLogId: msgLog._id } }
            ).catch(() => { });
          }

          // ── Push "sent" status into the SymxEmployeeSchedule ──────────────
          if (scheduleField && recipient.transporterId) {
            try {
              // Prefer exact date match; fall back to most recent schedule for this employee
              const scheduleQuery: Record<string, any> = { transporterId: recipient.transporterId };
              if (recipient.scheduleDate) {
                scheduleQuery.date = new Date(recipient.scheduleDate);
              }

              const targetSchedule = await SymxEmployeeSchedule.findOne(scheduleQuery).sort({ date: -1 });

              if (targetSchedule) {
                await SymxEmployeeSchedule.updateOne(
                  { _id: targetSchedule._id },
                  {
                    $push: {
                      [scheduleField]: {
                        status: "sent",
                        createdAt: new Date(),
                        createdBy: senderEmail,
                        messageLogId: msgLog?._id,
                        openPhoneMessageId,
                      },
                    },
                  }
                );
                console.log(
                  `[Messaging] Pushed 'sent' to ${scheduleField} for ${recipient.transporterId} (${targetSchedule.date})`
                );
              } else {
                console.warn(`[Messaging] No schedule found for transporterId=${recipient.transporterId}, skipping`);
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
