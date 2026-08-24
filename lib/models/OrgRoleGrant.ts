import mongoose, { Schema, Document, Model } from "mongoose";

// ── Multi-site: OrgRoleGrant ──────────────────────────────────────────
// Company-wide access, modeled as its own explicit, auditable grant.
//
// Why this is separate from UserSiteAssignment rather than "assign the
// user to every site":
//   • Intent is explicit. Seeing all sites' HR data is a deliberate
//     executive decision, not an accident of having three assignment rows.
//   • It stays correct when a site is added. An exec with an org grant
//     automatically covers site #4; someone assigned to three sites
//     individually would silently miss it.
//   • Consolidated reporting can require this grant, which satisfies the
//     rule that company-wide views must be intentional rather than the
//     result of a missing filter.
//   • It gives read-only auditor access a clean home: `read_only_all_sites`
//     grants visibility everywhere while writing nothing.
//
// Grants are effective-dated for the same reason assignments are: an audit
// needs to answer who could see everything, and when.

export type OrgGrantScope = "all_sites" | "read_only_all_sites";

export interface IOrgRoleGrant extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  roleId?: mongoose.Types.ObjectId;
  roleName: string;
  scope: OrgGrantScope;
  startDate: Date;
  endDate?: Date | null;
  grantedBy: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrgRoleGrantSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "SymxUser", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: "SymxAppRole" },
    roleName: { type: String, default: "" },
    scope: {
      type: String,
      enum: ["all_sites", "read_only_all_sites"],
      default: "all_sites",
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    grantedBy: { type: String, default: "" },
    // Free-text justification. Org-wide access to HR records across every
    // site is the most sensitive grant in the system; requiring a reason
    // makes the audit trail meaningful rather than just a list of names.
    reason: { type: String, default: "" },
  },
  { timestamps: true, collection: "SYMXOrgRoleGrants" }
);

OrgRoleGrantSchema.index({ userId: 1, endDate: 1 });
OrgRoleGrantSchema.index(
  { userId: 1, organizationId: 1, endDate: 1 },
  { unique: true, partialFilterExpression: { endDate: null } }
);

const OrgRoleGrant: Model<IOrgRoleGrant> =
  mongoose.models.OrgRoleGrant ||
  mongoose.model<IOrgRoleGrant>("OrgRoleGrant", OrgRoleGrantSchema);

export default OrgRoleGrant;
