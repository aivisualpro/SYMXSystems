import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export interface IScheduleConfirmation extends Document {
    token: string;
    transporterId: string;
    employeeName: string;
    scheduleDate?: string;
    yearWeek: string;
    messageType: string;
    messageLogId?: mongoose.Types.ObjectId;

    // Confirmation state
    status: "pending" | "confirmed" | "change_requested";
    confirmedAt?: Date;
    changeRequestedAt?: Date;
    changeRemarks?: string;

    // Expiry
    expiresAt: Date;
    createdAt: Date;
}

const ScheduleConfirmationSchema = new Schema<IScheduleConfirmation>(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: () => crypto.randomBytes(24).toString("hex"),
        },
        transporterId: { type: String, required: true, index: true },
        employeeName: { type: String, default: "" },
        scheduleDate: { type: String },
        yearWeek: { type: String, default: "" },
        messageType: { type: String, required: true },
        messageLogId: { type: Schema.Types.ObjectId, ref: "MessageLog" },
        status: {
            type: String,
            enum: ["pending", "confirmed", "change_requested"],
            default: "pending",
        },
        confirmedAt: { type: Date },
        changeRequestedAt: { type: Date },
        changeRemarks: { type: String },
        expiresAt: { type: Date, required: true, index: true },
    },
    { timestamps: true, collection: "SYMXScheduleConfirmations" }
);

const ScheduleConfirmation: Model<IScheduleConfirmation> =
    mongoose.models.ScheduleConfirmation ||
    mongoose.model<IScheduleConfirmation>("ScheduleConfirmation", ScheduleConfirmationSchema);

export default ScheduleConfirmation;
