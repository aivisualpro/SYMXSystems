import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicle extends Document {
  vin: string;
  year: string;
  vehicleName: string;
  licensePlate: string;
  make: string;
  vehicleModel: string;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Grounded' | 'Decommissioned';
  mileage: number;
  serviceType: string;
  dashcam: string;
  vehicleProvider: string;
  ownership: 'Owned' | 'Leased' | 'Rented';
  unitNumber: string;
  startDate: Date;
  endDate: Date;
  registrationExpiration: Date;
  state: string;
  location: string;
  notes: string;
  info: string;
  image: string;
  locationFrom: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema: Schema = new Schema({
  vin: { type: String, required: true, unique: true, index: true },
  year: { type: String, default: '' },
  vehicleName: { type: String, default: '' },
  licensePlate: { type: String, default: '', index: true },
  make: { type: String, default: '' },
  vehicleModel: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance', 'Grounded', 'Decommissioned'],
    default: 'Active',
    index: true
  },
  mileage: { type: Number, default: 0 },
  serviceType: { type: String, default: '' },
  dashcam: { type: String, default: '' },
  vehicleProvider: { type: String, default: '' },
  ownership: {
    type: String,
    enum: ['Owned', 'Leased', 'Rented'],
    default: 'Owned'
  },
  unitNumber: { type: String, default: '', index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  registrationExpiration: { type: Date },
  state: { type: String, default: '' },
  location: { type: String, default: '' },
  notes: { type: String, default: '' },
  info: { type: String, default: '' },
  image: { type: String, default: '' },
  locationFrom: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'vehicles'
});

// Compound indexes for dashboard aggregation + sorted pagination
VehicleSchema.index({ ownership: 1 });
VehicleSchema.index({ createdAt: -1 });
VehicleSchema.index({ status: 1, vehicleName: 1 });

const Vehicle: Model<IVehicle> = mongoose.models.Vehicle || mongoose.model<IVehicle>('Vehicle', VehicleSchema);

export default Vehicle;
