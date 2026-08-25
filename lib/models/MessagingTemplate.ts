import mongoose, { Schema, Document } from "mongoose";
import { siteOwned } from "./plugins/site-owned";
// Hot reload trigger: ensure route-itinerary is loaded

export interface IMessagingTemplate extends Document {
  type: string; // future-shift, shift, off-tomorrow, week-schedule, route-itinerary
  template: string;
  updatedAt: Date;
  createdAt: Date;
}

const MessagingTemplateSchema = new Schema<IMessagingTemplate>(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ["future-shift", "shift", "off-tomorrow", "week-schedule", "route-itinerary", "flyer"],
    },
    template: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
MessagingTemplateSchema.plugin(siteOwned);

delete mongoose.models.MessagingTemplate;

export default mongoose.models.MessagingTemplate ||
  mongoose.model<IMessagingTemplate>("MessagingTemplate", MessagingTemplateSchema);
