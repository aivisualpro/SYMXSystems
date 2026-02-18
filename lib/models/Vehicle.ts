import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicle extends Document {
  vehicleSlotNumber: string;
  vin: string;
  year: string;
  licensePlate: string;
  make: string;
  vehicleModel: string;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Grounded' | 'Decommissioned';
  dashcam: string;
  vehicleProvider: string;
  ownership: 'Owned' | 'Leased' | 'Rented';
  unitNumber: string;
  state: string;
  location: string;
  info: string;
  image: string;
  locationFrom: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema: Schema = new Schema({
  vehicleSlotNumber: { type: String, default: '', index: true },
  vin: { type: String, required: true, unique: true, index: true },
  year: { type: String, default: '' },
  licensePlate: { type: String, default: '', index: true },
  make: { type: String, default: '' },
  vehicleModel: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Maintenance', 'Grounded', 'Decommissioned'],
    default: 'Active',
    index: true 
  },
  dashcam: { type: String, default: '' },
  vehicleProvider: { type: String, default: '' },
  ownership: { 
    type: String, 
    enum: ['Owned', 'Leased', 'Rented'],
    default: 'Owned' 
  },
  unitNumber: { type: String, default: '', index: true },
  state: { type: String, default: '' },
  location: { type: String, default: '' },
  info: { type: String, default: '' },
  image: { type: String, default: '' },
  locationFrom: { type: String, default: '' },
}, { 
  timestamps: true, 
  collection: 'vehicles' 
});

const Vehicle: Model<IVehicle> = mongoose.models.Vehicle || mongoose.model<IVehicle>('Vehicle', VehicleSchema);

export default Vehicle;
