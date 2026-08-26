import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface ISymxNotification extends Document {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  relatedId?: string; // e.g. Container Number
  link?: string; // e.g. /admin/live-shipments
}

const SymxNotificationSchema: Schema = new Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  relatedId: { type: String },
  link: { type: String }
});

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxNotificationSchema.plugin(siteOwned, { sortField: "createdAt", modelName: "SymxNotification" });

const SymxNotification: Model<ISymxNotification> = mongoose.models.SymxNotification || mongoose.model<ISymxNotification>('SymxNotification', SymxNotificationSchema);

export default SymxNotification;
