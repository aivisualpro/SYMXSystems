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
  typeId?: string;          // ObjectId string of the RouteType — source of truth
  startTime?: string;
  dayBeforeConfirmation?: string;
  dayOfConfirmation?: string;
  weekConfirmation?: string;
  van?: string;
  createdBy?: mongoose.Types.ObjectId;

  // ── Messaging status tracking arrays ──
  futureShift: IMessageStatusEntry[];
  shiftNotification: IMessageStatusEntry[];
  offTodayScheduleTom: IMessageStatusEntry[];
  weekSchedule: IMessageStatusEntry[];
  routeItinerary: IMessageStatusEntry[];
}

const SymxEmployeeScheduleSchema: Schema = new Schema({
  transporterId: { type: String, required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
  weekDay: { type: String, required: true },
  yearWeek: { type: String, required: true },
  date: { type: Date, required: true },
  typeId: { type: String },
  startTime: { type: String, default: '' },
  dayBeforeConfirmation: { type: String, default: '' },
  dayOfConfirmation: { type: String, default: '' },
  weekConfirmation: { type: String, default: '' },
  van: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'SymxUser' },

  // ── Messaging status arrays ──
  futureShift: { type: [MessageStatusEntrySchema], default: [] },
  shiftNotification: { type: [MessageStatusEntrySchema], default: [] },
  offTodayScheduleTom: { type: [MessageStatusEntrySchema], default: [] },
  weekSchedule: { type: [MessageStatusEntrySchema], default: [] },
  routeItinerary: { type: [MessageStatusEntrySchema], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'SYMXEmployeeSchedules' });

// Compound index for upsert
SymxEmployeeScheduleSchema.index({ transporterId: 1, date: 1 }, { unique: true });
// Index for week queries
SymxEmployeeScheduleSchema.index({ yearWeek: 1 });
SymxEmployeeScheduleSchema.index({ date: 1 });
SymxEmployeeScheduleSchema.index({ typeId: 1 });

const SymxEmployeeSchedule: Model<ISymxEmployeeSchedule> =
  mongoose.models.SymxEmployeeSchedule ||
  mongoose.model<ISymxEmployeeSchedule>('SymxEmployeeSchedule', SymxEmployeeScheduleSchema);

export default SymxEmployeeSchedule;
