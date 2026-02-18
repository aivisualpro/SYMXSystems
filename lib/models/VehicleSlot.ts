import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleSlot extends Document {
  vehicleSlotNumber: string; // Serial Number e.g. "0001", "0002"
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSlotSchema: Schema = new Schema({
  vehicleSlotNumber: { type: String, required: true, unique: true, index: true },
  location: { type: String, default: '' },
}, { 
  timestamps: true, 
  collection: 'vehiclesSlots' 
});

const VehicleSlot: Model<IVehicleSlot> = mongoose.models.VehicleSlot || mongoose.model<IVehicleSlot>('VehicleSlot', VehicleSlotSchema);

export default VehicleSlot;
