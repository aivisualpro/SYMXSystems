import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/**
 * Per-station default PAD for a wave time. `wave` is 24h "HH:MM" (Pacific).
 * Rows are created either by hand in Settings or automatically the first time
 * the Cortex sync computes a wave time the station hasn't seen (pad blank,
 * `discovered: true`) so the owner can assign it.
 */
export interface IWavePadDefault {
  siteId?: mongoose.Types.ObjectId;
  wave: string;
  pad: string;
  discovered: boolean;
  lastSeenAt?: Date;
}

const WavePadDefaultSchema = new Schema(
  {
    wave: { type: String, required: true },
    pad: { type: String, default: "" },
    discovered: { type: Boolean, default: false },
    lastSeenAt: { type: Date },
  },
  { timestamps: true, collection: "SYMXWavePadDefaults" }
);

siteOwned(WavePadDefaultSchema, { modelName: "WavePadDefault" });
WavePadDefaultSchema.index({ siteId: 1, wave: 1 }, { unique: true });

const WavePadDefault: Model<IWavePadDefault> =
  mongoose.models.WavePadDefault || mongoose.model<IWavePadDefault>("WavePadDefault", WavePadDefaultSchema);
export default WavePadDefault;
