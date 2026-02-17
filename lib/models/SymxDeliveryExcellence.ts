
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxDeliveryExcellence extends Document {
  week: string;
  deliveryAssociate: string;
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId; // Reference to SymxEmployee

  overallStanding?: string;
  overallScore?: number;
  
  ficoMetric?: number;
  ficoTier?: string;
  ficoScore?: number;
  
  speedingEventRate?: number;
  speedingEventRateTier?: string;
  speedingEventRateScore?: number;
  
  seatbeltOffRate?: number;
  seatbeltOffRateTier?: string;
  seatbeltOffRateScore?: number;
  
  distractionsRate?: number;
  distractionsRateTier?: string;
  distractionsRateScore?: number;
  
  signSignalViolationsRate?: number;
  signSignalViolationsRateTier?: string;
  signSignalViolationsRateScore?: number;
  
  followingDistanceRate?: number;
  followingDistanceRateTier?: string;
  followingDistanceRateScore?: number;
  
  cdfDpmo?: number;
  cdfDpmoTier?: string;
  cdfDpmoScore?: number;
  
  ced?: number;
  cedTier?: string;
  cedScore?: number;
  
  dcr?: string; // e.g. "100.00%"
  dcrTier?: string;
  dcrScore?: number;
  
  dsb?: number;
  dsbDpmoTier?: string;
  dsbDpmoScore?: number;
  
  pod?: string; // e.g. "99.60%"
  podTier?: string;
  podScore?: number;
  
  psb?: number;
  psbTier?: string;
  psbScore?: number;
  
  packagesDelivered?: number;
  
  // Weights
  ficoMetricWeightApplied?: number;
  speedingEventRateWeightApplied?: number;
  seatbeltOffRateWeightApplied?: number;
  distractionsRateWeightApplied?: number;
  signSignalViolationsRateWeightApplied?: number;
  followingDistanceRateWeightApplied?: number;
  cdfDpmoWeightApplied?: number;
  cedWeightApplied?: number;
  dcrWeightApplied?: number;
  dsbDpmoWeightApplied?: number;
  podWeightApplied?: number;
  psbWeightApplied?: number;
}

const SymxDeliveryExcellenceSchema: Schema = new Schema({
  week: { type: String, required: true },
  deliveryAssociate: { type: String },
  transporterId: { type: String, required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },

  overallStanding: { type: String },
  overallScore: { type: Number },

  ficoMetric: { type: Number },
  ficoTier: { type: String },
  ficoScore: { type: Number },

  speedingEventRate: { type: Number },
  speedingEventRateTier: { type: String },
  speedingEventRateScore: { type: Number },

  seatbeltOffRate: { type: Number },
  seatbeltOffRateTier: { type: String },
  seatbeltOffRateScore: { type: Number },

  distractionsRate: { type: Number },
  distractionsRateTier: { type: String },
  distractionsRateScore: { type: Number },

  signSignalViolationsRate: { type: Number },
  signSignalViolationsRateTier: { type: String },
  signSignalViolationsRateScore: { type: Number },

  followingDistanceRate: { type: Number },
  followingDistanceRateTier: { type: String },
  followingDistanceRateScore: { type: Number },

  cdfDpmo: { type: Number },
  cdfDpmoTier: { type: String },
  cdfDpmoScore: { type: Number },

  ced: { type: Number },
  cedTier: { type: String },
  cedScore: { type: Number },

  dcr: { type: String }, // Keep as string for percentage formatting or parse? Sample shows "100.00%"
  dcrTier: { type: String },
  dcrScore: { type: Number },

  dsb: { type: Number },
  dsbDpmoTier: { type: String },
  dsbDpmoScore: { type: Number },

  pod: { type: String },
  podTier: { type: String },
  podScore: { type: Number },

  psb: { type: Number },
  psbTier: { type: String },
  psbScore: { type: Number },

  packagesDelivered: { type: Number },

  ficoMetricWeightApplied: { type: Number },
  speedingEventRateWeightApplied: { type: Number },
  seatbeltOffRateWeightApplied: { type: Number },
  distractionsRateWeightApplied: { type: Number },
  signSignalViolationsRateWeightApplied: { type: Number },
  followingDistanceRateWeightApplied: { type: Number },
  cdfDpmoWeightApplied: { type: Number },
  cedWeightApplied: { type: Number },
  dcrWeightApplied: { type: Number },
  dsbDpmoWeightApplied: { type: Number },
  podWeightApplied: { type: Number },
  psbWeightApplied: { type: Number },

}, { timestamps: true, collection: 'ScoreCard_DeliveryExcellence' });

// Add compound index for Week + Transporter ID to ensure uniqueness logic is optimized for lookups
SymxDeliveryExcellenceSchema.index({ week: 1, transporterId: 1 }, { unique: true });

const SymxDeliveryExcellence: Model<ISymxDeliveryExcellence> = mongoose.models.SymxDeliveryExcellence || mongoose.model<ISymxDeliveryExcellence>('SymxDeliveryExcellence', SymxDeliveryExcellenceSchema);

export default SymxDeliveryExcellence;
