import SymxEmployee from "@/lib/models/SymxEmployee";

// ── Station scope for driver-facing (mobile) endpoints ────────────────
//
// These routes authenticate a DRIVER via a JWT carrying a transporterId,
// not an app user with a station picker. So the station cannot come from
// getRequestScope() — there is no session and no site-context cookie to
// intersect against.
//
// It comes from the employee record instead: a driver belongs to a
// primary station, and that is the configuration their app should see —
// their station's start times, route types and settings. Showing DFO2's
// start time to a DXC8 driver is a wrong answer, not a cosmetic one.
//
// Returns null when the employee has no station yet.

export interface DriverScope {
  transporterId: string;
  siteId: string | null;
  /** Filter for site-owned collections; {} when the driver has no station. */
  filter: Record<string, any>;
}

export async function resolveDriverScope(transporterId: string): Promise<DriverScope> {
  const employee: any = await SymxEmployee.findOne(
    { transporterId },
    { primarySiteId: 1 }
  ).lean();

  const siteId = employee?.primarySiteId ? String(employee.primarySiteId) : null;

  return {
    transporterId,
    siteId,
    // Deliberately {} rather than the match-nothing filter used elsewhere.
    // A driver whose employee record predates the migration must still be
    // able to open the app and see their own routes; those queries are
    // already restricted to their own transporterId, so the blast radius
    // is their own data either way. Failing closed here would lock a
    // driver out of their shift over a missing backfill.
    filter: siteId ? { siteId } : {},
  };
}
