import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

/**
 * POST /api/messaging/webhook
 *
 * OpenPhone (Quo) webhook endpoint.
 * Events handled:
 *   - message.delivered  → marks outbound message as delivered + updates schedule
 *   - message.received   → records inbound reply + updates schedule
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[Webhook] OpenPhone event received:", JSON.stringify(body, null, 2));

        // Quo sends webhook with top-level "event" key (not "type")
        // Support both formats for safety
        const eventType: string =
            body?.event ?? body?.type ?? body?.object?.type ?? "";

        // Quo wraps the message object in body.data.object
        const data = body?.data?.object ?? body?.data ?? {};

        await connectToDatabase();

        // ── message.delivered ─────────────────────────────────────────────────
        if (eventType === "message.delivered") {
            const openPhoneMessageId: string = data?.id ?? "";
            const deliveredAt = data?.deliveredAt ? new Date(data.deliveredAt) : new Date();

            if (openPhoneMessageId) {
                const updated = await MessageLog.findOneAndUpdate(
                    { openPhoneMessageId },
                    {
                        $set: {
                            status: "delivered",
                            deliveredAt,
                            deliveryWebhookPayload: body,
                        },
                    },
                    { new: true }
                );

                if (updated) {
                    console.log(`[Webhook] Marked message ${openPhoneMessageId} as DELIVERED`);

                    // ── Push "delivered" status into the schedule ──────────────────
                    await pushStatusToSchedule(
                        updated.toNumber,
                        updated.messageType,
                        "delivered",
                        "quo",
                        openPhoneMessageId,
                        updated._id
                    );
                } else {
                    console.warn(
                        `[Webhook] No matching log for message.delivered id=${openPhoneMessageId} — creating stub`
                    );
                    await MessageLog.create({
                        openPhoneMessageId,
                        fromNumber: data?.from ?? "",
                        fromDisplay: data?.from ?? "",
                        toNumber: Array.isArray(data?.to) ? (data.to[0] ?? "") : (data?.to ?? ""),
                        recipientName: "",
                        messageType: "unknown",
                        content: data?.content ?? "",
                        status: "delivered",
                        deliveredAt,
                        deliveryWebhookPayload: body,
                    });
                }
            }

            return NextResponse.json({ ok: true, event: "message.delivered" });
        }

        // ── message.received (incoming reply) ─────────────────────────────────
        if (eventType === "message.received") {
            const inboundFrom: string = Array.isArray(data?.from)
                ? (data.from[0] ?? "")
                : (data?.from ?? "");
            const replyContent: string = data?.content ?? data?.text ?? "";
            const receivedAt = data?.createdAt ? new Date(data.createdAt) : new Date();
            const to: string = data?.to ?? data?.phoneNumberId ?? "";

            console.log(`[Webhook] Inbound reply from ${inboundFrom}: "${replyContent}"`);

            if (inboundFrom) {
                const logEntry = await MessageLog.findOne(
                    { toNumber: inboundFrom, status: { $in: ["sent", "delivered"] } },
                    null,
                    { sort: { sentAt: -1 } }
                );

                if (logEntry) {
                    logEntry.status = "received_reply";
                    logEntry.repliedAt = receivedAt;
                    logEntry.replyContent = replyContent;
                    logEntry.replyWebhookPayload = body;
                    await logEntry.save();
                    console.log(`[Webhook] Recorded reply for log ${logEntry._id}`);

                    // ── Push "received" status into the schedule ────────────────
                    await pushStatusToSchedule(
                        logEntry.toNumber,
                        logEntry.messageType,
                        "received",
                        "quo",
                        logEntry.openPhoneMessageId,
                        logEntry._id
                    );
                } else {
                    await MessageLog.create({
                        openPhoneMessageId: data?.id ?? undefined,
                        fromNumber: to,
                        fromDisplay: to,
                        toNumber: inboundFrom,
                        recipientName: "",
                        messageType: "inbound",
                        content: replyContent,
                        status: "received_reply",
                        repliedAt: receivedAt,
                        replyContent,
                        replyWebhookPayload: body,
                    });
                    console.log(`[Webhook] Created inbound-only log for ${inboundFrom}`);
                }
            }

            return NextResponse.json({ ok: true, event: "message.received" });
        }

        // ── Unhandled event type ──────────────────────────────────────────────
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
        return NextResponse.json({ ok: true, event: eventType, handled: false });
    } catch (err: any) {
        console.error("[Webhook] Error processing OpenPhone webhook:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
}

// GET /api/messaging/webhook — health check
export async function GET() {
    return NextResponse.json({
        ok: true,
        endpoint: "SYMX Systems — OpenPhone Webhook",
        events: ["message.delivered", "message.received"],
        timestamp: new Date().toISOString(),
    });
}

// ── Helper: push status entry into the correct schedule field ──────────────────
async function pushStatusToSchedule(
    phoneNumber: string,
    messageType: string,
    status: "delivered" | "received",
    createdBy: string,
    openPhoneMessageId?: string,
    messageLogId?: any
) {
    const scheduleField = TAB_TO_SCHEDULE_FIELD[messageType];
    if (!scheduleField) {
        console.log(`[Webhook] No schedule field mapping for messageType=${messageType}, skipping`);
        return;
    }

    try {
        // Find the employee by phone number
        const cleanPhone = phoneNumber.replace(/\D/g, "").slice(-10);
        const employee = await SymxEmployee.findOne({
            $or: [
                { phoneNumber: phoneNumber },
                { phoneNumber: { $regex: cleanPhone + "$" } },
            ],
        }).lean();

        if (!employee) {
            console.log(`[Webhook] No employee found for phone ${phoneNumber}, skipping schedule update`);
            return;
        }

        const transporterId = (employee as any).transporterId;

        // Find the most recent schedule for this employee
        // — don't restrict by future date; delivery can come right after send
        const schedule = await SymxEmployeeSchedule.findOne({
            transporterId,
        }).sort({ date: -1 }); // most recently scheduled day

        if (!schedule) {
            console.log(`[Webhook] No schedule found for ${transporterId}, skipping`);
            return;
        }

        await SymxEmployeeSchedule.updateOne(
            { _id: schedule._id },
            {
                $push: {
                    [scheduleField]: {
                        status,
                        createdAt: new Date(),
                        createdBy,
                        messageLogId,
                        openPhoneMessageId,
                    },
                },
            }
        );

        console.log(
            `[Webhook] Pushed '${status}' to ${scheduleField} for ${transporterId} (schedule date: ${schedule.date})`
        );
    } catch (err: any) {
        console.error(`[Webhook] Schedule update error: ${err.message}`);
    }
}
