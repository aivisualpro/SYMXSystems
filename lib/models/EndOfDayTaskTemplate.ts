import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Admin-configured end-of-day checklist item, shown to every driver on
 * the mobile app once their shift's route work is done. Shared org-wide
 * (like RouteType's base fields) rather than per-station — a station-
 * specific checklist can be added later the same way RouteType grew
 * per-station start-time overrides, if it's ever actually needed.
 */
export interface IEndOfDayTaskTemplate extends Document {
  title: string;
  description?: string;
  requiresPhoto: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const EndOfDayTaskTemplateSchema: Schema = new Schema({
  title: { type: String, required: [true, "Title is required"] },
  description: { type: String, default: '' },
  requiresPhoto: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true, collection: 'EndOfDayTaskTemplates' });

EndOfDayTaskTemplateSchema.index({ isActive: 1, sortOrder: 1 });

const EndOfDayTaskTemplate: Model<IEndOfDayTaskTemplate> =
  mongoose.models.EndOfDayTaskTemplate ||
  mongoose.model<IEndOfDayTaskTemplate>('EndOfDayTaskTemplate', EndOfDayTaskTemplateSchema);

export default EndOfDayTaskTemplate;
