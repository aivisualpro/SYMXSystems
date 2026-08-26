import mongoose, { Schema, Document, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface ISYMXRoutesInfo extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
    date: Date;
    rowIndex: number;             // 0-99 for 100 rows
    routeNumber: string;
    stopCount: string;
    packageCount: string;
    routeDuration: string;
    waveTime: string;
    pad: string;
    wst: string;
    wstDuration: string;
    bags: string;
    ov: string;
    stagingLocation: string;
    commercialPackages: string;
    transporterId: string;        // linked to employee
    rawSummary: Record<string, any>;  // full raw JSON from Amazon route-summaries API
}

const SYMXRoutesInfoSchema = new Schema<ISYMXRoutesInfo>(
    {
        date: { type: Date, required: true },
        rowIndex: { type: Number, required: true },
        routeNumber: { type: String, default: "" },
        stopCount: { type: String, default: "" },
        packageCount: { type: String, default: "" },
        routeDuration: { type: String, default: "" },
        waveTime: { type: String, default: "" },
        pad: { type: String, default: "" },
        wst: { type: String, default: "" },
        wstDuration: { type: String, default: "" },
        bags: { type: String, default: "" },
        ov: { type: String, default: "" },
        stagingLocation: { type: String, default: "" },
        commercialPackages: { type: String, default: "" },
        transporterId: { type: String, default: "" },
        rawSummary: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, collection: "SYMXRoutesInfo" }
);

// Each row is unique per date + rowIndex
SYMXRoutesInfoSchema.index({ date: 1, rowIndex: 1 }, { unique: true });
SYMXRoutesInfoSchema.index({ date: 1 });

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SYMXRoutesInfoSchema.plugin(siteOwned, { sortField: "date", modelName: "SYMXRoutesInfo" });

const SYMXRoutesInfo: Model<ISYMXRoutesInfo> =
    mongoose.models.SYMXRoutesInfo ||
    mongoose.model<ISYMXRoutesInfo>("SYMXRoutesInfo", SYMXRoutesInfoSchema);

export default SYMXRoutesInfo;
