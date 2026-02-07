import mongoose, { Schema, Document, Model } from 'mongoose';

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

const SymxNotification: Model<ISymxNotification> = mongoose.models.SymxNotification || mongoose.model<ISymxNotification>('SymxNotification', SymxNotificationSchema);

export default SymxNotification;
