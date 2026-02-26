import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessageLog extends Document {
    // OpenPhone message ID — set after successful send, updated on webhook events
    openPhoneMessageId?: string;

    // Who sent it
    fromNumber: string;       // OpenPhone phoneNumberId (e.g. PNxxxxxxxxx)
    fromDisplay: string;      // Readable number e.g. +15105551234

    // Recipient
    toNumber: string;         // E.164 phone number
    recipientName: string;

    // Message content
    messageType: string;      // future-shift | shift | off-tomorrow | week-schedule | route-itinerary
    content: string;          // personalized message text

    // Status lifecycle
    status: "sent" | "delivered" | "failed" | "received_reply";
    deliveredAt?: Date;
    repliedAt?: Date;
    replyContent?: string;

    // Metadata
    sentAt: Date;
    errorMessage?: string;

    // Raw webhook payloads for debugging
    deliveryWebhookPayload?: Record<string, any>;
    replyWebhookPayload?: Record<string, any>;
}

const MessageLogSchema = new Schema<IMessageLog>(
    {
        openPhoneMessageId: { type: String, index: true, sparse: true },
        fromNumber: { type: String, required: true },
        fromDisplay: { type: String, default: "" },
        toNumber: { type: String, required: true },
        recipientName: { type: String, default: "" },
        messageType: { type: String, required: true },
        content: { type: String, required: true },
        status: {
            type: String,
            enum: ["sent", "delivered", "failed", "received_reply"],
            default: "sent",
        },
        deliveredAt: { type: Date },
        repliedAt: { type: Date },
        replyContent: { type: String },
        sentAt: { type: Date, default: Date.now },
        errorMessage: { type: String },
        deliveryWebhookPayload: { type: Schema.Types.Mixed },
        replyWebhookPayload: { type: Schema.Types.Mixed },
    },
    { timestamps: true, collection: "SYMXMessageLogs" }
);

// Compound index for quick lookups by phone + type
MessageLogSchema.index({ toNumber: 1, messageType: 1, sentAt: -1 });

const MessageLog: Model<IMessageLog> =
    mongoose.models.MessageLog ||
    mongoose.model<IMessageLog>("MessageLog", MessageLogSchema);

export default MessageLog;
