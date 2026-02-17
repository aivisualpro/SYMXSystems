import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxSafetyDashboardDFO2 extends Document {
  week: string;
  date: string;
  deliveryAssociate: string;
  transporterId: string;
  eventId: string;
  dateTime: string;
  vin: string;
  programImpact: string;
  metricType: string;
  metricSubtype: string;
  source: string;
  videoLink: string;
  reviewDetails: string;
  employeeId?: mongoose.Types.ObjectId;
  dsp?: string;
  station?: string;
}

const SymxSafetyDashboardDFO2Schema: Schema = new Schema({
  week: { type: String, required: true, index: true },
  date: { type: String },
  deliveryAssociate: { type: String },
  transporterId: { type: String, required: true, index: true },
  eventId: { type: String },
  dateTime: { type: String },
  vin: { type: String },
  programImpact: { type: String },
  metricType: { type: String },
  metricSubtype: { type: String },
  source: { type: String },
  videoLink: { type: String },
  reviewDetails: { type: String },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
  dsp: { type: String },
  station: { type: String },
}, { timestamps: true, collection: 'ScoreCard_safetyDashboardDFO2' });

// Compound index for upsert: one record per event per driver per week
SymxSafetyDashboardDFO2Schema.index({ week: 1, transporterId: 1, eventId: 1 }, { unique: true });

const SymxSafetyDashboardDFO2: Model<ISymxSafetyDashboardDFO2> =
  mongoose.models.SymxSafetyDashboardDFO2 ||
  mongoose.model<ISymxSafetyDashboardDFO2>('SymxSafetyDashboardDFO2', SymxSafetyDashboardDFO2Schema);

export default SymxSafetyDashboardDFO2;
