import mongoose, { Schema, Document, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/**
 * Per-driver, per-day customer feedback counts from Amazon's CDF deep dive:
 * how many deliveries got feedback and how many of those were negative. This is
 * the denominator that turns "3 complaints" into a rate, so trends and
 * "improving after a discussion" can be judged fairly.
 */
export interface ICdfDriverDay extends Document {
    siteId?: mongoose.Types.ObjectId;
    stationCode: string;
    transporterId: string;
    driverName: string;
    date: string; // YYYY-MM-DD
    responses: number;
    negatives: number;
    positives: number;
}

const CdfDriverDaySchema = new Schema<ICdfDriverDay>({
    stationCode: { type: String, default: "" },
    transporterId: { type: String, required: true, index: true },
    driverName: { type: String, default: "" },
    date: { type: String, required: true, index: true },
    responses: { type: Number, default: 0 },
    negatives: { type: Number, default: 0 },
    positives: { type: Number, default: 0 },
}, { timestamps: true, collection: "SYMXCdfDriverDay" });

siteOwned(CdfDriverDaySchema, { sortField: "date", modelName: "CdfDriverDay" });
CdfDriverDaySchema.index({ siteId: 1, transporterId: 1, date: 1 }, { unique: true });

const CdfDriverDay: Model<ICdfDriverDay> =
    mongoose.models.CdfDriverDay || mongoose.model<ICdfDriverDay>("CdfDriverDay", CdfDriverDaySchema);
export default CdfDriverDay;
