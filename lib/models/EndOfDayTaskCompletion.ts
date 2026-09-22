import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface IEndOfDayTaskItem {
  templateId: mongoose.Types.ObjectId;
  title: string;          // snapshot, so an edited/deleted template later doesn't rewrite history
  completedAt: Date;
  photoUrl?: string;
}

/**
 * One document per driver per day, holding every end-of-day checklist
 * item they've completed that day. Upserted incrementally as each item
 * is checked off (see app/api/mobile/end-of-day-tasks/route.ts) rather
 * than requiring one all-or-nothing submission — a driver completing
 * tasks over the course of closing out their route shouldn't lose
 * earlier progress if the app is closed mid-checklist.
 */
export interface IEndOfDayTaskCompletion extends Document {
  siteId?: mongoose.Types.ObjectId;
  transporterId: string;
  date: string;            // "YYYY-MM-DD", business (Pacific) date
  items: IEndOfDayTaskItem[];
  createdAt: Date;
  updatedAt: Date;
}

const EndOfDayTaskItemSchema = new Schema<IEndOfDayTaskItem>({
  templateId: { type: Schema.Types.ObjectId, ref: 'EndOfDayTaskTemplate', required: true },
  title: { type: String, required: true },
  completedAt: { type: Date, required: true },
  photoUrl: { type: String },
}, { _id: false });

const EndOfDayTaskCompletionSchema: Schema = new Schema({
  transporterId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  items: { type: [EndOfDayTaskItemSchema], default: [] },
}, { timestamps: true, collection: 'EndOfDayTaskCompletions' });

EndOfDayTaskCompletionSchema.index({ transporterId: 1, date: 1 }, { unique: true });

siteOwned(EndOfDayTaskCompletionSchema, { sortField: "date", modelName: "EndOfDayTaskCompletion" });

const EndOfDayTaskCompletion: Model<IEndOfDayTaskCompletion> =
  mongoose.models.EndOfDayTaskCompletion ||
  mongoose.model<IEndOfDayTaskCompletion>('EndOfDayTaskCompletion', EndOfDayTaskCompletionSchema);

export default EndOfDayTaskCompletion;
