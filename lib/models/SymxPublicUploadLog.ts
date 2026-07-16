import mongoose, { Schema, Document } from "mongoose";

// Lightweight abuse-throttling log for unauthenticated upload endpoints
// (currently just the public reimbursement receipt uploader). Each
// successful upload writes one row keyed by submitter IP; the upload route
// counts rows for that IP within a sliding window to rate-limit before
// touching Cloudinary. `createdAt` has a TTL index so rows self-expire and
// this collection never needs manual cleanup.
export interface ISymxPublicUploadLog extends Document {
  ip: string;
  purpose: string; // e.g. "reimbursement-receipt" — lets one log serve multiple public upload endpoints later
  createdAt: Date;
}

const SymxPublicUploadLogSchema = new Schema<ISymxPublicUploadLog>(
  {
    ip: { type: String, required: true, index: true },
    purpose: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, expires: "60m" },
  },
  { collection: "symxpublicuploadlogs" }
);

const SymxPublicUploadLog =
  mongoose.models.SymxPublicUploadLog ||
  mongoose.model<ISymxPublicUploadLog>("SymxPublicUploadLog", SymxPublicUploadLogSchema);

export default SymxPublicUploadLog;
