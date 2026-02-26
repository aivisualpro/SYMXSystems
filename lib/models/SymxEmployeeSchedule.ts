import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Messaging status entry (one per event in the lifecycle) ──
export interface IMessageStatusEntry {
  status: 'pending' | 'sent' | 'delivered' | 'received';
  createdAt: Date;
  createdBy: string; // user email / "system" / "quo" (webhook)
  messageLogId?: mongoose.Types.ObjectId; // links to SYMXMessageLogs
  openPhoneMessageId?: string;
}

const MessageStatusEntrySchema = new Schema<IMessageStatusEntry>(
  {
    status: { type: String, enum: ['pending', 'sent', 'delivered', 'received'], required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: 'system' },
    messageLogId: { type: Schema.Types.ObjectId, ref: 'MessageLog' },
    openPhoneMessageId: { type: String },
  },
  { _id: false }
);

export interface ISymxEmployeeSchedule extends Document {
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId;
  weekDay: string;
  yearWeek: string; // Format: yyyy-Wxx
  date: Date;
  status: string;
  type: string;
  subType?: string;
  trainingDay?: string;
  startTime?: string;
  dayBeforeConfirmation?: string;
  dayOfConfirmation?: string;
  weekConfirmation?: string;
  van?: string;
  note?: string;

  // ── Messaging status tracking arrays ──
  futureShift: IMessageStatusEntry[];
  shiftNotification: IMessageStatusEntry[];
  offTodayScheduleTom: IMessageStatusEntry[];
  weekSchedule: IMessageStatusEntry[];
  routeItinerary: IMessageStatusEntry[];
}

const SymxEmployeeScheduleSchema: Schema = new Schema({
  transporterId: { type: String, required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
  weekDay: { type: String, required: true },
  yearWeek: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  status: { type: String, default: '' },
  type: { type: String, default: '' },
  subType: { type: String, default: '' },
  trainingDay: { type: String, default: '' },
  startTime: { type: String, default: '' },
  dayBeforeConfirmation: { type: String, default: '' },
  dayOfConfirmation: { type: String, default: '' },
  weekConfirmation: { type: String, default: '' },
  van: { type: String, default: '' },
  note: { type: String, default: '' },

  // ── Messaging status arrays ──
  futureShift: { type: [MessageStatusEntrySchema], default: [] },
  shiftNotification: { type: [MessageStatusEntrySchema], default: [] },
  offTodayScheduleTom: { type: [MessageStatusEntrySchema], default: [] },
  weekSchedule: { type: [MessageStatusEntrySchema], default: [] },
  routeItinerary: { type: [MessageStatusEntrySchema], default: [] },
}, { timestamps: true, collection: 'SYMXEmployeeSchedules' });

// Compound index for upsert
SymxEmployeeScheduleSchema.index({ transporterId: 1, date: 1 }, { unique: true });
// Index for week queries
SymxEmployeeScheduleSchema.index({ yearWeek: 1 });

const SymxEmployeeSchedule: Model<ISymxEmployeeSchedule> =
  mongoose.models.SymxEmployeeSchedule ||
  mongoose.model<ISymxEmployeeSchedule>('SymxEmployeeSchedule', SymxEmployeeScheduleSchema);

export default SymxEmployeeSchedule;
