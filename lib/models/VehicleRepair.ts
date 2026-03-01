import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleRepair extends Document {
  vehicleId: mongoose.Types.ObjectId;
  vin: string;
  unitNumber: string;
  description: string;
  currentStatus: 'Not Started' | 'In Progress' | 'Waiting for Parts' | 'Sent to Repair Shop' | 'Completed';
  estimatedDate: Date;
  image: string;
  creationDate: Date;
  lastEditOn: Date;
  repairDuration: number; // in days
  createdAt: Date;
  updatedAt: Date;
}

const VehicleRepairSchema: Schema = new Schema({
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  vin: { type: String, default: '', index: true },
  unitNumber: { type: String, default: '' },
  description: { type: String, default: '' },
  currentStatus: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Waiting for Parts', 'Sent to Repair Shop', 'Completed'],
    default: 'Not Started',
    index: true
  },
  estimatedDate: { type: Date },
  image: { type: String, default: '' },
  creationDate: { type: Date, default: Date.now },
  lastEditOn: { type: Date, default: Date.now },
  repairDuration: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'vehiclesRepairs'
});

// Indexes for fast sorted pagination
VehicleRepairSchema.index({ creationDate: -1 });
VehicleRepairSchema.index({ currentStatus: 1, creationDate: -1 });

const VehicleRepair: Model<IVehicleRepair> = mongoose.models.VehicleRepair || mongoose.model<IVehicleRepair>('VehicleRepair', VehicleRepairSchema);

export default VehicleRepair;
