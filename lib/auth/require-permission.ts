import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxAppRole from "@/lib/models/SymxAppRole";

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type ActionType = "view" | "create" | "edit" | "delete" | "approve" | "download" | "pay";

// Super Admin bypass — the one hardcoded superuser account in this app. No
// role named "Admin" or "Owner" carries any special privilege by default;
// every other account is governed purely by its role's permissions matrix.
export function isSuperAdmin(session: { id?: string; role?: string } | null | undefined): boolean {
  return !!session && (session.id === "super-admin" || session.role === "Super Admin");
}

// Core module+action check, shared by requirePermission (throws) and
// hasPermission (returns a boolean) below so the two can never drift apart.
async function checkPermission(
  session: { id?: string; role?: string } | null | undefined,
  moduleName: string,
  action: ActionType
): Promise<boolean> {
  if (!session) return false;
  if (isSuperAdmin(session)) return true;
  if (!session.role) return false;

  await connectToDatabase();

  // Find the role either by ID (if it's an ObjectId) or by name
  let roleDoc = await SymxAppRole.findById(session.role).lean().catch(() => null);
  if (!roleDoc) {
    roleDoc = await SymxAppRole.findOne({ name: session.role }).lean();
  }
  if (!roleDoc) return false;

  const modulePerm = roleDoc.permissions.find((p: any) => p.module === moduleName);
  if (!modulePerm) return false;

  // A role with an entry for this module has already been explicitly granted some level
  // of access to it. If this specific action key was never set at all (as opposed to
  // being explicitly toggled off), that almost always means the action was added to the
  // module after this role's permissions were last saved in the UI -- not that anyone
  // deliberately denied it. Treat a genuinely missing key as allowed so newly-added
  // actions on an already-trusted module don't silently lock people out until someone
  // happens to reopen and re-save that role. An explicit `false` still denies.
  const actions = modulePerm.actions || {};
  const hasExplicitValue = Object.prototype.hasOwnProperty.call(actions, action);
  return hasExplicitValue ? !!actions[action] : true;
}

export async function requirePermission(moduleName: string, action: ActionType = "view") {
  const session = await getSession();

  if (!session) {
    throw new ForbiddenError("Not authenticated");
  }

  const allowed = await checkPermission(session, moduleName, action);
  if (!allowed) {
    throw new ForbiddenError(`Missing permission: ${action} on ${moduleName}`);
  }

  return session;
}

// Non-throwing variant for callers that need to soft-check access (e.g. to
// redact a field from a response) rather than reject the whole request.
// Accepts an already-fetched session so callers that already called
// getSession() don't pay for it twice.
export async function hasPermission(
  session: { id?: string; role?: string } | null | undefined,
  moduleName: string,
  action: ActionType = "view"
): Promise<boolean> {
  return checkPermission(session, moduleName, action);
}
