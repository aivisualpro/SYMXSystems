
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxDVICVehicleInspection extends Document {
  week: string;                // Auto-calculated from startDate, e.g. "2026-W05"
  startDate?: string;          // Original date from CSV
  dsp?: string;
  station?: string;
  transporterId: string;
  transporterName?: string;
  vin?: string;
  fleetType?: string;
  inspectionType?: string;
  inspectionStatus?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  employeeId?: mongoose.Types.ObjectId;
}

const SymxDVICVehicleInspectionSchema: Schema = new Schema({
  week: { type: String, required: true },
  startDate: { type: String },
  dsp: { type: String },
  station: { type: String },
  transporterId: { type: String, required: true },
  transporterName: { type: String },
  vin: { type: String },
  fleetType: { type: String },
  inspectionType: { type: String },
  inspectionStatus: { type: String },
  startTime: { type: String },
  endTime: { type: String },
  duration: { type: String },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
}, { timestamps: true, collection: 'ScoreCard_DVICVehicleInspection' });

// Compound index for uniqueness on Week + Transporter + VIN + startTime
SymxDVICVehicleInspectionSchema.index(
  { week: 1, transporterId: 1, vin: 1, startTime: 1 },
  { unique: true }
);

// Index for querying by week
SymxDVICVehicleInspectionSchema.index({ week: 1 });

// Prevent overwrite error in dev hot reloading
const SymxDVICVehicleInspection: Model<ISymxDVICVehicleInspection> =
  mongoose.models.SymxDVICVehicleInspection ||
  mongoose.model<ISymxDVICVehicleInspection>('SymxDVICVehicleInspection', SymxDVICVehicleInspectionSchema);

export default SymxDVICVehicleInspection;
