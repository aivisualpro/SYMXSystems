
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPermission {
  module: string;
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    download: boolean;
    // Governs marking a reimbursement paid / queuing it for payroll (see
    // app/api/admin/reimbursements/[id]/pay/route.ts). Defaults to false
    // (unlike every other action here) so payroll access has to be
    // deliberately granted per role rather than inherited for free —
    // existing roles need scripts/backfill-hr-pay-permission.mjs run once
    // to get an explicit `pay: false` written into their stored HR
    // permission entry, since requirePermission() treats a genuinely
    // missing key as allowed.
    pay: boolean;
  };
  fieldScope?: Record<string, boolean>;
}

export interface ISymxAppRole extends Document {
  name: string;
  description?: string;
  // Role-level trait, independent of the per-module permissions matrix.
  // Marks accounts with this role as reviewers: they see the Write-Ups
  // Manager Review Workbench and are treated as "manager" for review
  // assignment, not because of the role's name (e.g. "Admin"), but because
  // this flag was explicitly set. Toggling it on also grants the Write-Ups
  // "approve" action, which is what actually gates the review endpoint.
  isManager?: boolean;
  permissions: IPermission[];
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema({
  module: { type: String, required: true },
  actions: {
    view: { type: Boolean, default: true },
    create: { type: Boolean, default: true },
    edit: { type: Boolean, default: true },
    delete: { type: Boolean, default: true },
    approve: { type: Boolean, default: true },
    download: { type: Boolean, default: true },
    pay: { type: Boolean, default: false },
  },
  fieldScope: { type: Map, of: Boolean }
}, { _id: false });

const SymxAppRoleSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: { type: [PermissionSchema], default: [] },
}, {
  timestamps: true,
  bufferCommands: true,
});

const SymxAppRole: Model<ISymxAppRole> = mongoose.models.SymxAppRole || mongoose.model<ISymxAppRole>('SymxAppRole', SymxAppRoleSchema);

export default SymxAppRole;
