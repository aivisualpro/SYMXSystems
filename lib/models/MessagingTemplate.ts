import mongoose, { Schema, Document } from "mongoose";
// Hot reload trigger: ensure route-itinerary is loaded

export interface IMessagingTemplate extends Document {
  /** Owning station. Absent on legacy org-wide templates (kept only as a fallback seed). */
  siteId?: mongoose.Types.ObjectId;
  type: string; // future-shift, shift, off-tomorrow, week-schedule, route-itinerary
  template: string;
  updatedAt: Date;
  createdAt: Date;
}

const MessagingTemplateSchema = new Schema<IMessagingTemplate>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    type: {
      type: String,
      required: true,
      enum: ["future-shift", "shift", "off-tomorrow", "week-schedule", "route-itinerary", "flyer", "training-reminder"],
    },
    template: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// ── Per station ──
// Each station keeps its OWN compose wording, so editing DFO2's morning
// message no longer changes DXC8's. Each station also has a saved default per
// type (Site.messageDefaults); compose wording is reset to that default every
// night at 11 PM Pacific (see lib/messaging/template-store.ts).
//
// One document per (station, type). Legacy documents with no siteId (from
// when wording was shared org-wide) are only read as a fallback seed.
MessagingTemplateSchema.index({ siteId: 1, type: 1 }, { unique: true });

delete mongoose.models.MessagingTemplate;

export default mongoose.models.MessagingTemplate ||
  mongoose.model<IMessagingTemplate>("MessagingTemplate", MessagingTemplateSchema);
