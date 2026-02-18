import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleActivityLog extends Document {
  vehicleId: mongoose.Types.ObjectId;
  vin: string;
  mileage: number;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  registrationExpiration: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleActivityLogSchema: Schema = new Schema({
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  vin: { type: String, default: '', index: true },
  mileage: { type: Number, default: 0 },
  serviceType: { type: String, default: '' },
  startDate: { type: Date },
  endDate: { type: Date },
  registrationExpiration: { type: Date },
  notes: { type: String, default: '' },
}, { 
  timestamps: true, 
  collection: 'vehiclesActivityLogs' 
});

const VehicleActivityLog: Model<IVehicleActivityLog> = mongoose.models.VehicleActivityLog || mongoose.model<IVehicleActivityLog>('VehicleActivityLog', VehicleActivityLogSchema);

export default VehicleActivityLog;
