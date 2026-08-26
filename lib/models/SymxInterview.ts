import mongoose, { Schema, Document } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface ISymxInterview extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
  fullName?: string;
  phoneNumber?: string;
  workStartDate?: string;
  typeOfWork?: string;
  workDays?: string;
  lastEmployerInfo?: string;
  howDidYouHear?: string;
  disclaimer?: string;
  status?: string;
  amazonOnboardingStatus?: string;
  interviewNotes?: string;
  rating?: string;
  image?: string;
  dlPhoto?: string;
  updatedBy?: string;
  updatedTimestamp?: Date;
  interviewedBy?: string;
  interviewTimestamp?: Date;
  onboardingPage?: string;
  eeCode?: string;
  transporterId?: string;
  badgeNumber?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  hiredDate?: Date;
  dob?: Date;
  hourlyStatus?: string;
  rate?: string;
  gasCardPin?: string;
  dlExpiration?: Date;
  onboardingNotes?: string;
  backgroundCheckStatus?: string;
  backgroundCheckFile?: string;
  drugTestStatus?: string;
  drugTestFile?: string;
  offerLetterStatus?: string;
  offerLetterFile?: string;
  handbookStatus?: string;
  handbookFile?: string;
  paycomStatus?: string;
  i9Status?: string;
  i9File?: string;
  classroomTrainingDate?: Date;
  sexualHarassmentFile?: string;
  workOpportunityTaxCredit?: string;
  finalInterviewDate?: Date;
  finalInterviewTime?: string;
  finalInterviewBy?: string;
  finalInterviewStatus?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SymxInterviewSchema = new Schema<ISymxInterview>(
  {
    fullName: { type: String },
    phoneNumber: { type: String },
    workStartDate: { type: String },
    typeOfWork: { type: String },
    workDays: { type: String },
    lastEmployerInfo: { type: String },
    howDidYouHear: { type: String },
    disclaimer: { type: String },
    status: { type: String, default: "New" },
    amazonOnboardingStatus: { type: String },
    interviewNotes: { type: String },
    rating: { type: String },
    image: { type: String },
    dlPhoto: { type: String },
    updatedBy: { type: String },
    updatedTimestamp: { type: Date },
    interviewedBy: { type: String },
    interviewTimestamp: { type: Date },
    onboardingPage: { type: String },
    eeCode: { type: String },
    transporterId: { type: String, index: true },
    badgeNumber: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    gender: { type: String },
    email: { type: String },
    streetAddress: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    hiredDate: { type: Date },
    dob: { type: Date },
    hourlyStatus: { type: String },
    rate: { type: String },
    gasCardPin: { type: String },
    dlExpiration: { type: Date },
    onboardingNotes: { type: String },
    backgroundCheckStatus: { type: String },
    backgroundCheckFile: { type: String },
    drugTestStatus: { type: String },
    drugTestFile: { type: String },
    offerLetterStatus: { type: String },
    offerLetterFile: { type: String },
    handbookStatus: { type: String },
    handbookFile: { type: String },
    paycomStatus: { type: String },
    i9Status: { type: String },
    i9File: { type: String },
    classroomTrainingDate: { type: Date },
    sexualHarassmentFile: { type: String },
    workOpportunityTaxCredit: { type: String },
    finalInterviewDate: { type: Date },
    finalInterviewTime: { type: String },
    finalInterviewBy: { type: String },
    finalInterviewStatus: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true, collection: "symxinterviews" }
);

SymxInterviewSchema.index({ fullName: 1 });
SymxInterviewSchema.index({ status: 1 });

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxInterviewSchema.plugin(siteOwned, { sortField: "createdAt", modelName: "SymxInterview" });

const SymxInterview =
  mongoose.models.SymxInterview ||
  mongoose.model<ISymxInterview>("SymxInterview", SymxInterviewSchema);

export default SymxInterview;
