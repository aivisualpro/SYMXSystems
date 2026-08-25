import mongoose, { Schema, Document } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface ISYMXRTS extends Document {
    routeId: mongoose.Types.ObjectId;
    date: string;
    transporterId: string;
    tba: string;
    reason: string;
    createdAt: Date;
    updatedAt: Date;
}

const symxRTSSchema = new Schema<ISYMXRTS>(
    {
        routeId: { type: Schema.Types.ObjectId, ref: "SYMXRoute", required: true },
        date: { type: String, required: true },
        transporterId: { type: String, required: true },
        tba: { type: String, required: true },
        reason: { type: String, required: true },
    },
    { timestamps: true, collection: "SYMXRTS" }
);

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
symxRTSSchema.plugin(siteOwned, { sortField: "date" });

export default mongoose.models.SYMXRTS || mongoose.model<ISYMXRTS>("SYMXRTS", symxRTSSchema);
