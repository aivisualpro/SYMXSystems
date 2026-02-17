import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxAvailableWeek extends Document {
  week: string;
}

const SymxAvailableWeekSchema: Schema = new Schema({
  week: { type: String, required: true, unique: true },
}, { timestamps: true, collection: 'SymxAvailableWeeks' });

const SymxAvailableWeek: Model<ISymxAvailableWeek> =
  mongoose.models.SymxAvailableWeek ||
  mongoose.model<ISymxAvailableWeek>('SymxAvailableWeek', SymxAvailableWeekSchema);

export default SymxAvailableWeek;
