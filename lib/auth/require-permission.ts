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

export type ActionType = "view" | "create" | "edit" | "delete" | "approve" | "download";

export async function requirePermission(moduleName: string, action: ActionType = "view") {
  const session = await getSession();
  
  if (!session) {
    throw new ForbiddenError("Not authenticated");
  }

  if (session.id === "super-admin" || session.role === "Super Admin") {
    return session;
  }

  await connectToDatabase();
  
  if (!session.role) {
    throw new ForbiddenError("No role assigned");
  }

  // Find the role either by ID (if it's an ObjectId) or by name
  let roleDoc = await SymxAppRole.findById(session.role).lean().catch(() => null);
  if (!roleDoc) {
    roleDoc = await SymxAppRole.findOne({ name: session.role }).lean();
  }

  if (!roleDoc) {
    throw new ForbiddenError("Role not found");
  }

  const modulePerm = roleDoc.permissions.find((p: any) => p.module === moduleName);
  
  if (!modulePerm || !modulePerm.actions[action]) {
    throw new ForbiddenError(`Missing permission: ${action} on ${moduleName}`);
  }

  return session;
}
