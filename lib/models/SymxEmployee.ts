
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
  sunday?: boolean;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  
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
  eligibility?: string;
  exitInterviewNotes?: string;
  paycomOffboarded?: boolean;
  amazonOffboarded?: boolean;
  finalCheck?: boolean; // keeping distinct from finalCheckIssued as requested
  lastDateWorked?: Date;
  
  ScheduleNotes?: string;
}

const SymxEmployeeSchema: Schema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  eeCode: { type: String },
  transporterId: { type: String },
  badgeNumber: { type: String },
  gender: { type: String },
  type: { type: String },
  email: { type: String, required: true, unique: true },
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

  sunday: { type: Boolean, default: false },
  monday: { type: Boolean, default: false },
  tuesday: { type: Boolean, default: false },
  wednesday: { type: Boolean, default: false },
  thursday: { type: Boolean, default: false },
  friday: { type: Boolean, default: false },
  saturday: { type: Boolean, default: false },

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
  eligibility: { type: String },
  exitInterviewNotes: { type: String },
  paycomOffboarded: { type: Boolean, default: false },
  amazonOffboarded: { type: Boolean, default: false },
  finalCheck: { type: Boolean, default: false },
  lastDateWorked: { type: Date },

  ScheduleNotes: { type: String },
}, { timestamps: true, collection: 'SYMXEmployees' });

const SymxEmployee: Model<ISymxEmployee> = mongoose.models.SymxEmployee || mongoose.model<ISymxEmployee>('SymxEmployee', SymxEmployeeSchema);

export default SymxEmployee;
