import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import MessageLog from "@/lib/models/MessageLog";

/**
 * POST /api/messaging/webhook
 *
 * OpenPhone (Quo) webhook endpoint.
 * Events handled:
 *   - message.delivered  → marks the outbound message as delivered
 *   - message.received   → records the inbound reply against the matching outbound log
 *
 * Webhook URL to enter in Quo:
 *   https://<your-domain>/api/messaging/webhook
 *
 * No auth secret needed unless you add OPENPHONE_WEBHOOK_SECRET to .env
 * and uncomment the signature verification block below.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[Webhook] OpenPhone event received:", JSON.stringify(body, null, 2));

        const eventType: string = body?.type ?? "";
        const data = body?.data?.object ?? body?.data ?? {};

        // ─── Optional: verify OpenPhone webhook signature ──────────────────────
        // const secret = process.env.OPENPHONE_WEBHOOK_SECRET;
        // if (secret) {
        //   const sig = req.headers.get("openphone-signature") ?? "";
        //   const rawBody = await req.text();
        //   const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
        //   if (sig !== expected) {
        //     console.warn("[Webhook] Invalid signature");
        //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        //   }
        // }
        // ──────────────────────────────────────────────────────────────────────

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
                } else {
                    // Message may have been sent before logging was introduced — create a stub
                    console.warn(`[Webhook] No matching log for message.delivered id=${openPhoneMessageId} — creating stub`);
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
                // Find the most recent outbound message to this phone number
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
                } else {
                    // No prior outbound log — create an inbound-only record
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

        // ── Unhandled event type — acknowledge gracefully ──────────────────────
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
        return NextResponse.json({ ok: true, event: eventType, handled: false });

    } catch (err: any) {
        console.error("[Webhook] Error processing OpenPhone webhook:", err);
        // Always return 200 to prevent OpenPhone from retrying on our logic errors
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 200 }
        );
    }
}

// GET /api/messaging/webhook — health check / verification ping
export async function GET() {
    return NextResponse.json({
        ok: true,
        endpoint: "SYMX Systems — OpenPhone Webhook",
        events: ["message.delivered", "message.received"],
        timestamp: new Date().toISOString(),
    });
}
