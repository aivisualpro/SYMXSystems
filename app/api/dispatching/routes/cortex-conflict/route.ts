import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getRequestScope, findScopedById } from "@/lib/scoped-query";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import { z } from "zod";
import { validateBody } from "@/lib/validations";
import { authorizeAction } from "@/lib/rbac";

/**
 * Resolve a pending Cortex-vs-manual field conflict on the Efficiency
 * screen (see app/api/public/cortex-sync/route.ts for how conflicts get
 * created). Two actions:
 *   - "use":  adopt the Cortex value, mark the field as Cortex-owned again
 *             (future syncs may auto-update it until a human edits it).
 *   - "keep": dismiss the suggestion, leave the existing value untouched.
 * Either way the conflict entry is removed.
 */
const bodySchema = z.object({
    routeId: z.string().min(1),
    field: z.string().min(1),
    action: z.enum(["use", "keep"]),
});

export async function POST(req: NextRequest) {
    try {
        await requirePermission("Dispatching", "edit");
    } catch (e: any) {
        if (e.name === "ForbiddenError") {
            return NextResponse.json({ error: e.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const rawBody = await req.json();
        const validation = validateBody(bodySchema, rawBody);
        if (!validation.success) return validation.response;

        const auth = await authorizeAction("Dispatching", "edit");
        if (!auth.authorized) return auth.response;

        const { routeId, field, action } = validation.data;

        await connectToDatabase();

        const scope = await getRequestScope();
        const existing = await findScopedById<any>(SYMXRoute, routeId, scope) as any;
        if (!existing) {
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        const conflicts: any[] = Array.isArray(existing.cortexConflicts) ? existing.cortexConflicts : [];
        const conflict = conflicts.find((c: any) => c.field === field);
        if (!conflict) {
            return NextResponse.json({ error: "No pending conflict for that field" }, { status: 404 });
        }

        const remainingConflicts = conflicts.filter((c: any) => c.field !== field);
        const setOps: Record<string, any> = { cortexConflicts: remainingConflicts };

        if (action === "use") {
            setOps[field] = conflict.cortexValue;
            const owned = new Set<string>(Array.isArray(existing.cortexSyncedFields) ? existing.cortexSyncedFields : []);
            owned.add(field);
            setOps.cortexSyncedFields = Array.from(owned);
        }
        // "keep" leaves the field value and cortexSyncedFields untouched —
        // it stays a manual value, so a future sync will flag again if
        // Cortex still disagrees.

        const updated = await SYMXRoute.findByIdAndUpdate(routeId, { $set: setOps }, { new: true, lean: true });

        return NextResponse.json({ route: updated });
    } catch (error: any) {
        console.error("Error resolving Cortex conflict:", error);
        return NextResponse.json({ error: error.message || "Failed to resolve conflict" }, { status: 500 });
    }
}
