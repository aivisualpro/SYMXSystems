import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleRentalAgreement extends Document {
  vehicleId: mongoose.Types.ObjectId;
  vin: string;
  unitNumber: string;
  invoiceNumber: string;
  agreementNumber: string;
  registrationStartDate: Date;
  registrationEndDate: Date;
  dueDate: Date;
  amount: number;
  rentalAgreementFilesImages: string[]; // Array of Cloudinary URLs
  createdAt: Date;
  updatedAt: Date;
}

const VehicleRentalAgreementSchema: Schema = new Schema({
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
  vin: { type: String, default: '', index: true },
  unitNumber: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },
  agreementNumber: { type: String, default: '', index: true },
  registrationStartDate: { type: Date },
  registrationEndDate: { type: Date, index: true },
  dueDate: { type: Date },
  amount: { type: Number, default: 0 },
  rentalAgreementFilesImages: { type: [String], default: [] },
}, {
  timestamps: true,
  collection: 'vehiclesRentalAgreements'
});

// Compound indexes for dashboard aggregate queries
VehicleRentalAgreementSchema.index({ registrationEndDate: 1, amount: 1 });
VehicleRentalAgreementSchema.index({ createdAt: -1 });

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
// ── Organization-level, NOT site-owned ────────────────────────────────
// Rental agreements are held company-wide, not per station: the contract
// is with the leasing company rather than with a building, and the same
// agreement can cover a van that moves between stations.
//
// Deliberately reclassified after the Phase 2 backfill, which had stamped
// these to DFO2 — see migration 09.

const VehicleRentalAgreement: Model<IVehicleRentalAgreement> = mongoose.models.VehicleRentalAgreement || mongoose.model<IVehicleRentalAgreement>('VehicleRentalAgreement', VehicleRentalAgreementSchema);

export default VehicleRentalAgreement;
