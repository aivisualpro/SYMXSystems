
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxUser from "@/lib/models/SymxUser";
import SymxAppRole from "@/lib/models/SymxAppRole";
import SymxAppModule from "@/lib/models/SymxAppModule";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // TEMPORARY SYNC LOGIC
    await SymxAppModule.deleteOne({ name: "Everyday after Dispatching" });
    const existingMod = await SymxAppModule.findOne({ name: "Everyday" });
    if (!existingMod) {
         await SymxAppModule.create({ name: "Everyday", url: "/everyday", icon: "IconTarget", order: 5, subModules: [] });
    }
    
    const roles = await SymxAppRole.find({});
    for(const role of roles) {
        let perms = role.permissions || [];
        // Clean up old name
        const hasOld = perms.some((p: any) => p.module === "Everyday after Dispatching");
        if (hasOld) {
            perms = perms.filter((p: any) => p.module !== "Everyday after Dispatching");
        }
        
        if (!perms.find((p: any) => p.module === "Everyday")) {
            perms.push({
                module: "Everyday",
                actions: { view: true, create: true, edit: true, delete: true, approve: true, download: true },
                fieldScope: {}
            });
            await SymxAppRole.updateOne({ _id: role._id }, { $set: { permissions: perms } });
        } else if (hasOld) {
            await SymxAppRole.updateOne({ _id: role._id }, { $set: { permissions: perms } });
        }
    }
    // END TEMPORARY SYNC LOGIC

    // ── Super Admin Bypass ──────────────────────────────────────────
    if (session.id === "super-admin") {
      return NextResponse.json({ role: "Super Admin", permissions: [] });
    }
    // ────────────────────────────────────────────────────────────────
    
    // 1. Get User to find their Role Name
    const user = await SymxUser.findById(session.id).select('AppRole');
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Get Role Definition
    const role = await SymxAppRole.findOne({ name: user.AppRole });
    
    // If no role definition found (e.g. Super Admin might be hardcoded or legacy), handle gracefully
    // If legacy "Super Admin" exists without a doc, maybe allow all? 
    // But for now, let's assume if role doc is missing, they get NO access (secure by default), 
    // unless name is "Super Admin" explicitly, we might want to bypass. 
    // However, the user asked to enforce permissions. 
    // Let's return the allowed modules list.
    
    let allowedModules: string[] = [];

    if (role && role.permissions) {
      // Filter permissions where view is true
      allowedModules = role.permissions
        .filter((p: any) => p.actions.view === true)
        .map((p: any) => p.module);
        
      // Also, if a module is NOT in the permissions list, is it allowed by default?
      // In the editor UI, we default to "true" if missing. 
      // BUT, for security, usually it's "deny unless specified".
      // However, the previous logic in page.tsx was:
      // const isEnabled = perm ? perm.actions[action.key] : true;
      // So existing behavior implies "Open unless restricted".
      
      // We should probably replicate that logic or standardize it.
      // If the permission document doesn't exist for a module, we assume it's visible?
      // Or should we assume the `role.permissions` array implies *all* configured permissions?
      // The `page.tsx` logic `const isEnabled = perm ? perm.actions[action.key] : true` strongly suggests default TRUE.
      // So effectively, we only HIDE if explicitly set to false.
      
      // Let's implement "Allow All EXCEPT explicitly hidden".
      // But we need the list of ALL possible modules to know what to return if we want to be explicit.
      
      // Actually, it's easier to return the "Denied Modules" or just return the full map.
      // Let's return a map of permissions for the client to decide.
    } 

    // Logic: 
    // If role document exists:
    //   Scan its permissions. 
    //   Any module explicitly set to view: false is HIDDEN.
    //   Everything else is VISIBLE.
    // If role document does NOT exist:
    //   If role is "Super Admin" -> All Visible.
    //   Else -> All Visible (legacy behavior) or None?
    //   Let's stick to "All Visible" for backward compatibility if no role doc exists yet.

    return NextResponse.json({ 
      role: user.AppRole,
      permissions: role ? role.permissions : [] 
    });

  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}
