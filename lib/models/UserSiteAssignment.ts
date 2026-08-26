import mongoose, { Schema, Document, Model } from "mongoose";

// ── Multi-site: UserSiteAssignment ────────────────────────────────────
// Grants a user access to ONE site, with a role scoped to that site.
//
// Roles and site access are modeled SEPARATELY and deliberately:
//   • SymxAppRole defines WHAT a role can do (the permissions matrix).
//     Role definitions stay organization-level and reusable.
//   • This collection defines WHERE a user may do it, and as WHICH role.
//
// A user may hold several assignments — the same role at three sites, or
// different roles at different sites (Dispatcher at one, Manager at
// another). Company-wide access is NOT expressed by assigning someone to
// every site; that is a separate, auditable grant (see OrgRoleGrant).
//
// Assignments are effective-dated so history is preserved: when someone
// moves sites you end-date the old assignment and create a new one rather
// than overwriting, which keeps "who had access to what, when" answerable
// during an audit.

export interface IUserSiteAssignment extends Document {
  userId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  roleId?: mongoose.Types.ObjectId;
  roleName: string;
  isPrimary: boolean;
  startDate: Date;
  endDate?: Date | null;
  grantedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSiteAssignmentSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "SymxUser", required: true, index: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true, index: true },
    // Role stored by both id and name. The name mirrors how SymxUser.AppRole
    // already works today (a string), so the backfill is lossless and existing
    // permission lookups keep working unchanged; roleId is the forward-looking
    // reference once roles are consistently addressed by id.
    roleId: { type: Schema.Types.ObjectId, ref: "SymxAppRole" },
    roleName: { type: String, default: "" },
    // The site this user lands on at login when they haven't chosen one.
    isPrimary: { type: Boolean, default: false },
    startDate: { type: Date, default: Date.now },
    // null / absent = currently active. Set to end-date an assignment
    // instead of deleting it, so the access history survives.
    endDate: { type: Date, default: null },
    grantedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "SYMXUserSiteAssignments" }
);

// Hot path: "which sites can this user reach right now?" — resolved on
// every request, so it must be a single indexed lookup.
UserSiteAssignmentSchema.index({ userId: 1, endDate: 1 });
UserSiteAssignmentSchema.index({ siteId: 1, endDate: 1 });
// Prevents duplicate concurrent grants of the same user to the same site.
// Scoped to open assignments only (endDate: null) so a user can legitimately
// be re-assigned to a site they previously left.
UserSiteAssignmentSchema.index(
  { userId: 1, siteId: 1, endDate: 1 },
  { unique: true, partialFilterExpression: { endDate: null } }
);

// ── Deliberately NOT guarded ──────────────────────────────────────────
// This model has a siteId, but it is a POINTER to a station rather than
// ownership by one. It is the table that answers "which stations may this
// user reach", so resolveUserSiteAccess() has to query it by userId alone,
// before any station scope exists. Guarding it would flag — and in enforce
// mode break — the very lookup that establishes scope in the first place.
//
// The site-guard coverage test asserts this exemption explicitly, so it
// stays a decision rather than decaying into an oversight.
const UserSiteAssignment: Model<IUserSiteAssignment> =
  mongoose.models.UserSiteAssignment ||
  mongoose.model<IUserSiteAssignment>("UserSiteAssignment", UserSiteAssignmentSchema);

export default UserSiteAssignment;
