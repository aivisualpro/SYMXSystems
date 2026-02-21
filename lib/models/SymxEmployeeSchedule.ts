import mongoose, { Schema, Document, Model } from 'mongoose';

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
}, { timestamps: true, collection: 'SYMXEmployeeSchedules' });

// Compound index for upsert
SymxEmployeeScheduleSchema.index({ transporterId: 1, date: 1 }, { unique: true });
// Index for week queries
SymxEmployeeScheduleSchema.index({ yearWeek: 1 });

const SymxEmployeeSchedule: Model<ISymxEmployeeSchedule> =
  mongoose.models.SymxEmployeeSchedule ||
  mongoose.model<ISymxEmployeeSchedule>('SymxEmployeeSchedule', SymxEmployeeScheduleSchema);

export default SymxEmployeeSchedule;
