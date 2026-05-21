import mongoose, { Schema, Document } from "mongoose";

export interface ICoachingWriteUpFile {
  name: string;
  url: string;
}

export interface ISYMXCoachingWriteUp extends Document {
  employeeId?: mongoose.Types.ObjectId;
  durationOfIncident?: string;
  incidentDate?: Date;
  incidentWeek?: string;
  type?: string;
  metric?: mongoose.Types.ObjectId;
  correctiveActionNumber?: string;
  metricNoticeNumber?: string;
  correctiveAction?: string;
  correctiveActionDate?: Date;
  supervisor?: mongoose.Types.ObjectId;
  metricValue?: string;
  seatbeltOffRate?: string;
  speedingEventRate?: string;
  distractionsRate?: string;
  signSignalViolationsRate?: string;
  followingDistanceRate?: string;
  DAMishandledPackage?: string;
  DAWasUnprofessional?: string;
  DADidNotFollowMyDeliveryInstructions?: string;
  deliveredToWrongAddress?: string;
  neverReceivedDelivery?: string;
  receivedWrongItem?: string;
  improvedByDate?: Date;
  suggestion?: string;
  totalNegativeFeedbacks?: string;
  priorDiscussionOrWarningsOnThisSubject?: string;
  goal?: string;
  files?: ICoachingWriteUpFile[];
  unSignedPdf?: string;
  signedPdf?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CoachingWriteUpFileSchema = new Schema(
  {
    name: { type: String },
    url: { type: String },
  },
  { _id: false }
);

const SYMXCoachingWriteUpSchema = new Schema<ISYMXCoachingWriteUp>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", index: true },
    durationOfIncident: { type: String },
    incidentDate: { type: Date },
    incidentWeek: { type: String, index: true },
    type: { type: String },
    metric: { type: Schema.Types.ObjectId, ref: "DropdownOption" },
    correctiveActionNumber: { type: String },
    metricNoticeNumber: { type: String },
    correctiveAction: { type: String },
    correctiveActionDate: { type: Date },
    supervisor: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    metricValue: { type: String },
    seatbeltOffRate: { type: String },
    speedingEventRate: { type: String },
    distractionsRate: { type: String },
    signSignalViolationsRate: { type: String },
    followingDistanceRate: { type: String },
    DAMishandledPackage: { type: String },
    DAWasUnprofessional: { type: String },
    DADidNotFollowMyDeliveryInstructions: { type: String },
    deliveredToWrongAddress: { type: String },
    neverReceivedDelivery: { type: String },
    receivedWrongItem: { type: String },
    improvedByDate: { type: Date },
    suggestion: { type: String },
    totalNegativeFeedbacks: { type: String },
    priorDiscussionOrWarningsOnThisSubject: { type: String },
    goal: { type: String },
    files: { type: [CoachingWriteUpFileSchema], default: [] },
    unSignedPdf: { type: String },
    signedPdf: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true, collection: "SYMXCoachingWriteUps" }
);

// Compound index for upsert deduplication
SYMXCoachingWriteUpSchema.index({ employeeId: 1, incidentDate: 1 });
SYMXCoachingWriteUpSchema.index({ transporterId: 1, incidentDate: 1 });

const SYMXCoachingWriteUp =
  mongoose.models.SYMXCoachingWriteUp ||
  mongoose.model<ISYMXCoachingWriteUp>("SYMXCoachingWriteUp", SYMXCoachingWriteUpSchema);

export default SYMXCoachingWriteUp;
