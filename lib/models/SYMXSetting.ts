import mongoose, { Schema, Document, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface ISYMXSetting extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
    key: string;
    value: any;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

const SYMXSettingSchema = new Schema<ISYMXSetting>(
    {
        key: { type: String, required: true },
        value: { type: Schema.Types.Mixed, required: true },
        description: { type: String, default: "" },
    },
    { timestamps: true, collection: "SYMXSettings" }
);



// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
// ── Unique PER STATION, not globally ──────────────────────────────────
// Setting keys were globally unique, which makes per-station config
// impossible: DXC8 could not have its own "key" value if DFO2 already
// used it. The clone that seeds a new station's config would fail with a
// duplicate key error, and the station would be left with none.
//
// Scoped to siteId, each station owns its own set and they can share names
// — which is the normal case, since stations run the same kinds of work at
// different rates and start times.
SYMXSettingSchema.index({ siteId: 1, key: 1 }, { unique: true });

SYMXSettingSchema.plugin(siteOwned, { modelName: "SYMXSetting" });

const SYMXSetting: Model<ISYMXSetting> =
    mongoose.models.SYMXSetting ||
    mongoose.model<ISYMXSetting>("SYMXSetting", SYMXSettingSchema);

export default SYMXSetting;
