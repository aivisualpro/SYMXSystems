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
  insurancePolicyId?: mongoose.Types.ObjectId;
  paid?: number;
  reserved?: number;
  incidentUploadFile?: string;
  attachments?: { name: string; url: string; category: string }[];

  // ── Fields from the official SYMX Safety Incident Report Form ──
  policeReportFiled?: boolean;
  policeReportNumber?: string;
  medicalTreatmentRequired?: boolean;
  medicalTreatmentType?: string; // Triage / First Aid / Clinical / Emergency / Other
  witnesses?: string;            // free text — matches the paper form's blank-line format
  thirdPartyInvolvementType?: string; // None / Animal / Person / Vehicle / Equipment / Other

  // ── Contact / follow-up log — HR/Admin only, same tier as supervisorNotes ──
  contactLog?: { date: Date; contactedBy: string; method: string; note: string }[];

  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SymxIncidentSchema = new Schema<ISymxIncident>(
  {
    transporterId: { type: String },
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
    insurancePolicyId: { type: Schema.Types.ObjectId, ref: "InsurancePolicy" },
    paid: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    incidentUploadFile: { type: String },
    attachments: [{ name: { type: String }, url: { type: String }, category: { type: String, default: "Other" }, _id: false }],

    policeReportFiled: { type: Boolean, default: false },
    policeReportNumber: { type: String, default: "" },
    medicalTreatmentRequired: { type: Boolean, default: false },
    medicalTreatmentType: { type: String, default: "" },
    witnesses: { type: String, default: "" },
    thirdPartyInvolvementType: { type: String, default: "" },

    contactLog: [{
      date: { type: Date, default: Date.now },
      contactedBy: { type: String, default: "" },
      method: { type: String, default: "" },
      note: { type: String, default: "" },
      _id: false,
    }],

    createdBy: { type: String },
  },
  { timestamps: true, collection: "symxincidents" }
);

SymxIncidentSchema.index({ transporterId: 1, incidentDate: 1 });
SymxIncidentSchema.index({ claimNumber: 1 }, { sparse: true });
SymxIncidentSchema.index({ claimStatus: 1, incidentDate: -1 });
SymxIncidentSchema.index({ insurancePolicyId: 1 });

const SymxIncident =
  mongoose.models.SymxIncident ||
  mongoose.model<ISymxIncident>("SymxIncident", SymxIncidentSchema);

export default SymxIncident;
