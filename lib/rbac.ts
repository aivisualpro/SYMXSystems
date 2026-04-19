import { getSession } from "@/lib/auth";
import SymxAppRole from "@/lib/models/SymxAppRole";
import SymxUser from "@/lib/models/SymxUser";
import { NextResponse } from "next/server";

export type RbacAction = "view" | "create" | "edit" | "delete" | "approve" | "download";

/**
 * Checks if the current authenticated user has permission to perform the requested action 
 * against the specific module inside their SymxAppRole configuration.
 * 
 * Includes bypass logic for "Super Admin" and defaults to OPEN if the explicit configuration
 * for a specific module doesn't exist yet, mirroring the UI structure.
 */
export async function authorizeAction(moduleName: string, actionKey: RbacAction) {
    const session = await getSession();
    if (!session || !session.id) {
        return { 
            authorized: false, 
            response: NextResponse.json({ error: "Unauthorized: Missing active session" }, { status: 401 }) 
        };
    }

    let roleName = session.role;
    
    // Super Admin direct bypass
    if (session.id === "super-admin" || roleName === "Super Admin") {
        return { authorized: true, session };
    }

    // Refresh database role lookup (avoid token staleness)
    const user = await SymxUser.findById(session.id).select('AppRole').lean();
    if (user && user.AppRole) {
         roleName = user.AppRole;
    }

    if (roleName === "Super Admin") {
         return { authorized: true, session };
    }

    const roleData = await SymxAppRole.findOne({ name: roleName }).lean();
    
    // If no role logic defined, default to open according to project legacy rules
    if (!roleData || !roleData.permissions) {
         return { authorized: true, session };
    }

    const perm = roleData.permissions.find((p: any) => p.module === moduleName);
    
    // The previous frontend gating standard: const isEnabled = perm ? perm.actions[action.key] : true;
    const isEnabled = perm && perm.actions && typeof perm.actions[actionKey] === "boolean" 
        ? perm.actions[actionKey] 
        : true;

    if (!isEnabled) {
       return { 
           authorized: false, 
           response: NextResponse.json({ error: `Forbidden: Lack ${actionKey} permission for ${moduleName}` }, { status: 403 }) 
       };
    }

    return { authorized: true, session };
}
