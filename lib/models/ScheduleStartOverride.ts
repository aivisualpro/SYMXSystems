import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/**
 * A start time that applies to EVERY driver on a given schedule type for ONE
 * day at one station ("Route starts 6:30 AM on Oct 28"). Set from the schedule
 * cell's start-time pencil with "apply to all". Anyone assigned that type on
 * that day afterwards picks it up, instead of the type's default start time.
 */
export interface IScheduleStartOverride {
  siteId?: mongoose.Types.ObjectId;
  date: string;      // YYYY-MM-DD (the shift day)
  typeId: string;    // RouteType _id
  startTime: string; // e.g. "06:30 AM"
  updatedBy?: string;
}

const ScheduleStartOverrideSchema = new Schema(
  {
    date: { type: String, required: true },
    typeId: { type: String, required: true },
    startTime: { type: String, required: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "SYMXScheduleStartOverrides" }
);
ScheduleStartOverrideSchema.index({ siteId: 1, date: 1, typeId: 1 }, { unique: true });
ScheduleStartOverrideSchema.plugin(siteOwned, { sortField: "date", modelName: "ScheduleStartOverride" });

const ScheduleStartOverride: Model<IScheduleStartOverride> =
  mongoose.models.ScheduleStartOverride ||
  mongoose.model<IScheduleStartOverride>("ScheduleStartOverride", ScheduleStartOverrideSchema);

export default ScheduleStartOverride;
