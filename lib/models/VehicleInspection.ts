import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleInspection extends Document {
  vehicleId: mongoose.Types.ObjectId;
  vin: string;
  unitNumber: string;
  inspectionType: 'Pre-Trip' | 'Post-Trip' | 'Monthly' | 'Annual' | 'DOT' | 'Safety';
  inspectionDate: Date;
  inspectorName: string;
  overallResult: 'Pass' | 'Fail' | 'Needs Attention';
  mileage: number;
  exteriorCondition: string;
  interiorCondition: string;
  tiresCondition: string;
  brakesCondition: string;
  lightsCondition: string;
  fluidLevels: string;
  defectsFound: string;
  actionRequired: string;
  images: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleInspectionSchema: Schema = new Schema({
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  vin: { type: String, default: '', index: true },
  unitNumber: { type: String, default: '' },
  inspectionType: { 
    type: String, 
    enum: ['Pre-Trip', 'Post-Trip', 'Monthly', 'Annual', 'DOT', 'Safety'],
    default: 'Pre-Trip',
    index: true 
  },
  inspectionDate: { type: Date, default: Date.now },
  inspectorName: { type: String, default: '' },
  overallResult: { 
    type: String, 
    enum: ['Pass', 'Fail', 'Needs Attention'],
    default: 'Pass' 
  },
  mileage: { type: Number, default: 0 },
  exteriorCondition: { type: String, default: 'Good' },
  interiorCondition: { type: String, default: 'Good' },
  tiresCondition: { type: String, default: 'Good' },
  brakesCondition: { type: String, default: 'Good' },
  lightsCondition: { type: String, default: 'Good' },
  fluidLevels: { type: String, default: 'Normal' },
  defectsFound: { type: String, default: '' },
  actionRequired: { type: String, default: '' },
  images: { type: [String], default: [] },
  notes: { type: String, default: '' },
}, { 
  timestamps: true, 
  collection: 'vehiclesInspections' 
});

const VehicleInspection: Model<IVehicleInspection> = mongoose.models.VehicleInspection || mongoose.model<IVehicleInspection>('VehicleInspection', VehicleInspectionSchema);

export default VehicleInspection;
