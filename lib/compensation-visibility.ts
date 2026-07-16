import { isSuperAdmin, hasPermission } from "@/lib/auth/require-permission";

// There is no formal "Admin" role/tier in this app — only the single
// hardcoded Super Admin bypass (see isSuperAdmin). Per the owner's
// instruction (July 2026, after a driver was found able to see everyone's
// pay rate), pay rate should only be visible to Super Admin plus whoever has
// been explicitly trusted with the "Owner" module (App Users, Roles &
// Permissions) — that's the closest existing equivalent to "admin" and,
// unlike most modules, a role gets NO access to it unless someone
// deliberately granted it (no entry for "Owner" = denied, not the usual
// "missing key = allowed" default), so it fails closed for everyone else.
export async function canViewCompensation(session: { id?: string; role?: string } | null | undefined): Promise<boolean> {
  if (isSuperAdmin(session)) return true;
  return hasPermission(session, "Owner", "view");
}

// Strips `rate` from a single lean employee-ish object in place is avoided —
// returns a new object instead so callers can't accidentally mutate a
// Mongoose doc or a shared reference.
export function maskRate<T extends Record<string, any>>(record: T, canView: boolean): T {
  if (canView) return record;
  const { rate, ...rest } = record;
  return rest as T;
}

export function maskRateInList<T extends Record<string, any>>(records: T[], canView: boolean): T[] {
  if (canView) return records;
  return records.map((r) => maskRate(r, canView));
}
