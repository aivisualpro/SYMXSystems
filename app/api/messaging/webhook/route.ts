import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

/**
 * POST /api/messaging/webhook
 *
 * OpenPhone (Quo) webhook endpoint.
 *
 * Quo payload structure:
 * {
 *   "object": {
 *     "id": "EVfc3c...",
 *     "type": "message.delivered",   ← event type lives here
 *     "data": {
 *       "object": {                  ← the actual message object lives here
 *         "id": "AC238...",
 *         "from": "+1925...",
 *         "to": "+1512...",
 *         "status": "delivered",
 *         ...
 *       }
 *     }
 *   }
 * }
 */

// ── Verify Quo webhook signature ─────────────────────────────────────────────
async function verifySignature(req: NextRequest, rawBody: string): Promise<boolean> {
    const secret = process.env.QUO_WEBHOOK_SECRET;
    if (!secret) return true; // skip if not configured

    const signature = req.headers.get("x-openphone-signature") ?? "";
    if (!signature) return false;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBody);
    const expected = hmac.digest("hex");

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}

export async function POST(req: NextRequest) {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify signature if secret is configured
    const sigValid = await verifySignature(req, rawBody);
    if (!sigValid) {
        console.warn("[Webhook] Invalid signature — rejecting");
        return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    try {
        console.log("[Webhook] Raw payload:", JSON.stringify(body, null, 2));

        // ── Parse Quo's actual payload structure ──────────────────────────────
        // Quo wraps everything under body.object
        // body.object.type      → event type
        // body.object.data.object → the message object
        const eventObject = body?.object ?? body; // fallback: treat body itself as the event
        const eventType: string =
            eventObject?.type ?? body?.event ?? body?.type ?? "";

        // The message data is nested under data.object inside the event object
        const data =
            eventObject?.data?.object ?? // Quo standard: body.object.data.object
            body?.data?.object ??        // alternative flat format
            body?.data ??                // bare data key
            {};

        console.log(`[Webhook] eventType="${eventType}" data.id="${data?.id}" data.status="${data?.status}"`);

        await connectToDatabase();

        // ── message.delivered ─────────────────────────────────────────────────
        if (eventType === "message.delivered") {
            const openPhoneMessageId: string = data?.id ?? "";
            const deliveredAt = data?.deliveredAt ? new Date(data.deliveredAt) : new Date();

            console.log(`[Webhook] Processing delivery for openPhoneMessageId="${openPhoneMessageId}"`);

            if (!openPhoneMessageId) {
                console.warn("[Webhook] message.delivered received but no id found in data");
                return NextResponse.json({ ok: true, event: "message.delivered", warn: "no message id" });
            }

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
                console.log(`[Webhook] ✅ Marked message ${openPhoneMessageId} as DELIVERED`);
                await pushStatusToSchedule(
                    updated.toNumber,
                    updated.messageType,
                    "delivered",
                    "quo",
                    openPhoneMessageId,
                    updated._id
                );
            } else {
                console.warn(`[Webhook] No matching MessageLog for id="${openPhoneMessageId}" — storing stub`);
                await MessageLog.create({
                    openPhoneMessageId,
                    fromNumber: data?.from ?? "",
                    fromDisplay: data?.from ?? "",
                    toNumber: Array.isArray(data?.to) ? (data.to[0] ?? "") : (data?.to ?? ""),
                    recipientName: "",
                    messageType: "unknown",
                    content: data?.body ?? data?.content ?? "",
                    status: "delivered",
                    deliveredAt,
                    deliveryWebhookPayload: body,
                });
            }

            return NextResponse.json({ ok: true, event: "message.delivered" });
        }

        // ── message.received (incoming reply) ─────────────────────────────────
        if (eventType === "message.received") {
            const inboundFrom: string = Array.isArray(data?.from)
                ? (data.from[0] ?? "")
                : (data?.from ?? "");
            const replyContent: string = data?.body ?? data?.content ?? data?.text ?? "";
            const receivedAt = data?.createdAt ? new Date(data.createdAt) : new Date();
            const to: string = Array.isArray(data?.to) ? (data.to[0] ?? "") : (data?.to ?? data?.phoneNumberId ?? "");

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
                    console.log(`[Webhook] ✅ Recorded reply for log ${logEntry._id}`);

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

        // ── Unhandled event ───────────────────────────────────────────────────
        console.log(`[Webhook] Unhandled event type: "${eventType}"`);
        return NextResponse.json({ ok: true, event: eventType, handled: false });

    } catch (err: any) {
        console.error("[Webhook] Error processing webhook:", err);
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

// ── Helper: push a status entry into the correct schedule field ───────────────
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
        console.log(`[Webhook] No schedule field for messageType="${messageType}", skipping`);
        return;
    }

    try {
        const cleanPhone = phoneNumber.replace(/\D/g, "").slice(-10);
        const employee = await SymxEmployee.findOne({
            $or: [
                { phoneNumber },
                { phoneNumber: { $regex: cleanPhone + "$" } },
            ],
        }).lean();

        if (!employee) {
            console.log(`[Webhook] No employee for phone=${phoneNumber}, skipping schedule update`);
            return;
        }

        const transporterId = (employee as any).transporterId;

        // Find most recent schedule — no date restriction so near-instant delivery works
        const schedule = await SymxEmployeeSchedule.findOne({ transporterId }).sort({ date: -1 });

        if (!schedule) {
            console.log(`[Webhook] No schedule for transporterId=${transporterId}, skipping`);
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

        console.log(`[Webhook] ✅ Pushed "${status}" → ${scheduleField} for ${transporterId}`);
    } catch (err: any) {
        console.error(`[Webhook] Schedule update error: ${err.message}`);
    }
}
