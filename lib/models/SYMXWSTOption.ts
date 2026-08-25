import mongoose, { Schema, Document, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface ISYMXWSTOption extends Document {
    wst: string;
    revenue: number;
    amazonServiceType: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const SYMXWSTOptionSchema = new Schema<ISYMXWSTOption>(
    {
        wst: { type: String, required: true, unique: true },
        revenue: { type: Number, default: 0 },
        amazonServiceType: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "SYMXWSTOptions" }
);


// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SYMXWSTOptionSchema.plugin(siteOwned);

const SYMXWSTOption: Model<ISYMXWSTOption> =
    mongoose.models.SYMXWSTOption ||
    mongoose.model<ISYMXWSTOption>("SYMXWSTOption", SYMXWSTOptionSchema);

export default SYMXWSTOption;
