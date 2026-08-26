import mongoose, { Schema, Document } from "mongoose";
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
// ── Organization-level, NOT site-owned ────────────────────────────────
// Message wording is the same at every station — the station-specific
// parts (start times, route names) come from the data merged into the
// template, not from the template itself. Keeping one copy means editing
// a template once rather than three times and drifting.
//
// Deliberately reclassified out of siteOwned after the Phase 2 backfill,
// which had stamped these to DFO2. scripts/migrate/06 clears that.
//
// Contrast with SYMXSetting / RouteType / SYMXWSTOption, which stay
// site-owned: those carry per-station start times and rates.

delete mongoose.models.MessagingTemplate;

export default mongoose.models.MessagingTemplate ||
  mongoose.model<IMessagingTemplate>("MessagingTemplate", MessagingTemplateSchema);
