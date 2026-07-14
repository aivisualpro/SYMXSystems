
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxEmployee extends Document {
  firstName: string;
  lastName: string;
  eeCode?: string;
  transporterId?: string;
  badgeNumber?: string;
  gender?: string;
  type?: string;
  email: string;
  phoneNumber?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  hiredDate?: Date;
  dob?: Date;
  hourlyStatus?: string;
  rate?: number;
  gasCardPin?: string;
  dlExpiration?: Date;
  motorVehicleReportDate?: Date;
  profileImage?: string;

  // Schedule availability (ObjectId ref to RouteType, null = OFF)
  sunday?: mongoose.Types.ObjectId;
  monday?: mongoose.Types.ObjectId;
  tuesday?: mongoose.Types.ObjectId;
  wednesday?: mongoose.Types.ObjectId;
  thursday?: mongoose.Types.ObjectId;
  friday?: mongoose.Types.ObjectId;
  saturday?: mongoose.Types.ObjectId;

  defaultVan1?: string;
  defaultVan2?: string;
  defaultVan3?: string;

  finalCheckIssued?: boolean;
  status: string;

  // Files
  offerLetterFile?: string;
  handbookFile?: string;
  driversLicenseFile?: string;
  i9File?: string;
  drugTestFile?: string;
  // CA labor law: a 2nd 30-min meal period is required past 10 hrs worked in a day, but can
  // be voluntarily waived (signed waiver) if total hours worked that day don't exceed 12.
  // The timecard audit soft-flags (waiver on file) vs hard-flags (no waiver) shifts over 10
  // hours with no recorded 2nd meal period, based on whether this file is uploaded.
  mealWaiverFile?: string;

  routesComp?: string;

  // Offboarding
  terminationDate?: Date;
  terminationLetter?: string;
  resignationDate?: Date;
  resignationLetter?: string;
  resignationType?: string;
  terminationReason?: string;
  eligibility?: boolean;
  exitInterviewNotes?: string;
  paycomOffboarded?: boolean;
  amazonOffboarded?: boolean;
  finalCheck?: string; // changed from boolean to string
  lastDateWorked?: Date;

  ScheduleNotes?: string;
}

const SymxEmployeeSchema: Schema = new Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  // Paycom EE Code — required: the Punch Audit Report importer (and anything else that
  // needs to cross-reference Paycom data) matches employees by this field. A blank
  // eeCode means that employee's punches can never be auto-matched.
  eeCode: { type: String, required: [true, "EE Code is required"] },
  transporterId: { type: String, index: true },
  badgeNumber: { type: String },
  gender: { type: String },
  type: { type: String },
  email: { type: String },
  phoneNumber: { type: String },
  streetAddress: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  hiredDate: { type: Date },
  dob: { type: Date },
  hourlyStatus: { type: String },
  rate: { type: Number, required: [true, "Pay rate is required"] },
  gasCardPin: { type: String },
  dlExpiration: { type: Date },
  motorVehicleReportDate: { type: Date },
  profileImage: { type: String },

  sunday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },
  monday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },
  tuesday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },
  wednesday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },
  thursday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },
  friday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },
  saturday: { type: Schema.Types.ObjectId, ref: 'RouteType', default: null },

  defaultVan1: { type: String },
  defaultVan2: { type: String },
  defaultVan3: { type: String },

  finalCheckIssued: { type: Boolean, default: false },
  status: { type: String, default: 'Active' },

  offerLetterFile: { type: String },
  handbookFile: { type: String },
  mealWaiverFile: { type: String },
  driversLicenseFile: { type: String },
  i9File: { type: String },
  drugTestFile: { type: String },

  routesComp: { type: String },

  terminationDate: { type: Date },
  terminationLetter: { type: String },
  resignationDate: { type: Date },
  resignationLetter: { type: String },
  resignationType: { type: String },
  terminationReason: { type: String },
  eligibility: { type: Boolean, default: false },
  exitInterviewNotes: { type: String },
  paycomOffboarded: { type: Boolean, default: false },
  amazonOffboarded: { type: Boolean, default: false },
  finalCheck: { type: String },
  lastDateWorked: { type: Date },

  ScheduleNotes: { type: String },
}, { timestamps: true, collection: 'SYMXEmployees' });

// Compound index for messaging employees query (status: Active + phoneNumber exists)
SymxEmployeeSchema.index({ status: 1, phoneNumber: 1 });
SymxEmployeeSchema.index({ email: 1 });
SymxEmployeeSchema.index({ phoneNumber: 1 });

const SymxEmployee: Model<ISymxEmployee> = mongoose.models.SymxEmployee || mongoose.model<ISymxEmployee>('SymxEmployee', SymxEmployeeSchema);

export default SymxEmployee;
