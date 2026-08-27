import mongoose, { Schema, Document, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface ISYMXWSTOption extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
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
        wst: { type: String, required: true },
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
// ── Unique PER STATION, not globally ──────────────────────────────────
// Wst codes were globally unique, which makes per-station config
// impossible: DXC8 could not have its own "wst" value if DFO2 already
// used it. The clone that seeds a new station's config would fail with a
// duplicate key error, and the station would be left with none.
//
// Scoped to siteId, each station owns its own set and they can share names
// — which is the normal case, since stations run the same kinds of work at
// different rates and start times.
SYMXWSTOptionSchema.index({ siteId: 1, wst: 1 }, { unique: true });

SYMXWSTOptionSchema.plugin(siteOwned, { modelName: "SYMXWSTOption" });

const SYMXWSTOption: Model<ISYMXWSTOption> =
    mongoose.models.SYMXWSTOption ||
    mongoose.model<ISYMXWSTOption>("SYMXWSTOption", SYMXWSTOptionSchema);

export default SYMXWSTOption;
