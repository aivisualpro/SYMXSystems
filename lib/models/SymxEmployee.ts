
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

  // Schedule availability
  sunday?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;

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
  eeCode: { type: String },
  transporterId: { type: String, index: true },
  badgeNumber: { type: String },
  gender: { type: String },
  type: { type: String },
  email: { type: String, sparse: true, index: true },
  phoneNumber: { type: String },
  streetAddress: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  hiredDate: { type: Date },
  dob: { type: Date },
  hourlyStatus: { type: String },
  rate: { type: Number },
  gasCardPin: { type: String },
  dlExpiration: { type: Date },
  motorVehicleReportDate: { type: Date },
  profileImage: { type: String },

  sunday: { type: String, default: 'OFF' },
  monday: { type: String, default: 'OFF' },
  tuesday: { type: String, default: 'OFF' },
  wednesday: { type: String, default: 'OFF' },
  thursday: { type: String, default: 'OFF' },
  friday: { type: String, default: 'OFF' },
  saturday: { type: String, default: 'OFF' },

  defaultVan1: { type: String },
  defaultVan2: { type: String },
  defaultVan3: { type: String },

  finalCheckIssued: { type: Boolean, default: false },
  status: { type: String, default: 'Active' },

  offerLetterFile: { type: String },
  handbookFile: { type: String },
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

const SymxEmployee: Model<ISymxEmployee> = mongoose.models.SymxEmployee || mongoose.model<ISymxEmployee>('SymxEmployee', SymxEmployeeSchema);

export default SymxEmployee;
