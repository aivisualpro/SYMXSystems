/**
 * Shared "never overwrite a dispatcher's value" merge for Amazon-derived
 * Efficiency fields. Used by both the route-summaries sync and the itinerary
 * sync so the two agree on ownership.
 *
 * A field may be written when it is empty, equal, or was itself written by an
 * earlier automated sync (tracked in `cortexSyncedFields`). If a human typed a
 * different value, the Amazon value is recorded as a conflict for the
 * Efficiency screen to surface instead.
 */

export interface CortexConflict {
    field: string;
    cortexValue: string;
    currentValue: string;
    detectedAt: Date;
}

export interface MergeResult {
    setOps: Record<string, any>;
    updated: string[];
    conflicts: string[];
}

export function mergeCortexFields(
    existing: any,
    computed: Record<string, string | number>,
    fields: readonly string[],
): MergeResult {
    const owned = new Set<string>(Array.isArray(existing.cortexSyncedFields) ? existing.cortexSyncedFields : []);
    const existingConflicts: CortexConflict[] = Array.isArray(existing.cortexConflicts) ? existing.cortexConflicts : [];
    const conflictsByField = new Map<string, CortexConflict>(existingConflicts.map((c) => [c.field, c]));

    const setOps: Record<string, any> = {};
    const updated: string[] = [];
    const conflicts: string[] = [];

    for (const field of fields) {
        if (!(field in computed)) continue;
        const cortexValue = computed[field];
        const currentValue = existing[field];
        const isEmpty =
            currentValue === "" || currentValue === undefined || currentValue === null ||
            (typeof currentValue === "number" && currentValue === 0);

        if (String(currentValue) === String(cortexValue)) {
            conflictsByField.delete(field);
            continue;
        }

        if (isEmpty || owned.has(field)) {
            setOps[field] = cortexValue;
            owned.add(field);
            conflictsByField.delete(field);
            updated.push(field);
        } else {
            conflictsByField.set(field, {
                field,
                cortexValue: String(cortexValue),
                currentValue: String(currentValue),
                detectedAt: new Date(),
            });
            conflicts.push(field);
        }
    }

    setOps.cortexSyncedFields = Array.from(owned);
    setOps.cortexConflicts = Array.from(conflictsByField.values());
    return { setOps, updated, conflicts };
}
