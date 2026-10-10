import mongoose, { Schema, Document, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/**
 * One negative Customer Delivery Feedback (CDF) item from Amazon's
 * performance portal, keyed by tracking id (TBA). Captured daily (data trails
 * by about a day) by the Chrome extension, then worked by dispatch: the
 * feedback has to be discussed with the driver and that conversation recorded.
 */
export type CdfStatus = "open" | "discussed" | "dismissed";

export interface ICdfFeedback extends Document {
    siteId?: mongoose.Types.ObjectId;
    stationCode: string;
    trackingId: string;
    deliveryId?: string;
    transporterId: string;
    driverName: string;
    deliveryDate: string;          // YYYY-MM-DD (station local, as Amazon reports it)
    deliveredAt?: Date;
    scorecardWeek?: string;
    level2: string;                // Amazon category code
    level3: string;                // Amazon detail code
    reasons: string[];             // human-readable
    shipmentReason?: string;
    // Link back to the stop in Cortex.
    itineraryId?: string;
    stopIndex?: number;
    serviceAreaId?: string;
    capturedAt: Date;
    // ── Discussion tracking ──
    status: CdfStatus;
    discussedAt?: Date;
    discussedBy?: string;
    discussedById?: string;
    outcome?: string;
    note?: string;
}

const CdfFeedbackSchema = new Schema<ICdfFeedback>({
    stationCode: { type: String, default: "" },
    trackingId: { type: String, required: true },
    deliveryId: { type: String, default: "" },
    transporterId: { type: String, default: "", index: true },
    driverName: { type: String, default: "" },
    deliveryDate: { type: String, required: true, index: true },
    deliveredAt: { type: Date },
    scorecardWeek: { type: String, default: "" },
    level2: { type: String, default: "" },
    level3: { type: String, default: "" },
    reasons: { type: [String], default: [] },
    shipmentReason: { type: String, default: "" },
    itineraryId: { type: String, default: "" },
    stopIndex: { type: Number },
    serviceAreaId: { type: String, default: "" },
    capturedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["open", "discussed", "dismissed"], default: "open", index: true },
    discussedAt: { type: Date },
    discussedBy: { type: String, default: "" },
    discussedById: { type: String, default: "" },
    outcome: { type: String, default: "" },
    note: { type: String, default: "" },
}, { timestamps: true, collection: "SYMXCdfFeedback" });

siteOwned(CdfFeedbackSchema, { sortField: "deliveryDate", modelName: "CdfFeedback", extraIndexes: [["status", "deliveryDate"]] });
CdfFeedbackSchema.index({ siteId: 1, trackingId: 1 }, { unique: true });

const CdfFeedback: Model<ICdfFeedback> =
    mongoose.models.CdfFeedback || mongoose.model<ICdfFeedback>("CdfFeedback", CdfFeedbackSchema);
export default CdfFeedback;
