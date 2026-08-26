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
        key: { type: String, required: true, unique: true },
        value: { type: Schema.Types.Mixed, required: true },
        description: { type: String, default: "" },
    },
    { timestamps: true, collection: "SYMXSettings" }
);



// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SYMXSettingSchema.plugin(siteOwned, { modelName: "SYMXSetting" });

const SYMXSetting: Model<ISYMXSetting> =
    mongoose.models.SYMXSetting ||
    mongoose.model<ISYMXSetting>("SYMXSetting", SYMXSettingSchema);

export default SYMXSetting;
