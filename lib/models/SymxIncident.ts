import mongoose, { Schema, Document } from "mongoose";

export interface ISymxIncident extends Document {
  transporterId: string;
  employeeName?: string;
  employeeId?: mongoose.Types.ObjectId;
  reportedDate?: Date;
  incidentDate?: Date;
  claimType?: string;
  van?: string;
  claimantName?: string;
  shortDescription?: string;
  claimNumber?: string;
  claimantLawyer?: string;
  claimStatus?: string;
  statusDetail?: string;
  coverageDescription?: string;
  claimIncurred?: string;
  employeeNotes?: string;
  supervisorNotes?: string;
  thirdPartyName?: string;
  thirdPartyPhone?: string;
  thirdPartyEmail?: string;
  withInsurance?: boolean;
  insurancePolicy?: string;
  paid?: number;
  reserved?: number;
  incidentUploadFile?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SymxIncidentSchema = new Schema<ISymxIncident>(
  {
    transporterId: { type: String, index: true },
    employeeName: { type: String },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    reportedDate: { type: Date },
    incidentDate: { type: Date },
    claimType: { type: String },
    van: { type: String },
    claimantName: { type: String },
    shortDescription: { type: String },
    claimNumber: { type: String },
    claimantLawyer: { type: String },
    claimStatus: { type: String, default: "Open" },
    statusDetail: { type: String },
    coverageDescription: { type: String },
    claimIncurred: { type: String },
    employeeNotes: { type: String },
    supervisorNotes: { type: String },
    thirdPartyName: { type: String },
    thirdPartyPhone: { type: String },
    thirdPartyEmail: { type: String },
    withInsurance: { type: Boolean, default: false },
    insurancePolicy: { type: String },
    paid: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    incidentUploadFile: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true, collection: "symxincidents" }
);

SymxIncidentSchema.index({ transporterId: 1, incidentDate: 1 });
SymxIncidentSchema.index({ claimNumber: 1 }, { sparse: true });

const SymxIncident =
  mongoose.models.SymxIncident ||
  mongoose.model<ISymxIncident>("SymxIncident", SymxIncidentSchema);

export default SymxIncident;
