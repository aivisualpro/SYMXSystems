import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";
import { getGuardViolations, clearGuardViolations } from "@/lib/models/plugins/site-guard";

// Reads the site guard's findings for this server process.
//
// The payoff of running the guard in log-only mode: instead of auditing
// ~130 route files by hand and hoping, click through the app and read the
// list of everything that queried site-owned data without a station filter.
//
// Process-local and in-memory by design — it reflects what THIS server has
// served since it started. Restarting clears it, which is what you want
// between audit passes.

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (!isSuperAdmin(session)) return null;
  return session;
}

export async function GET(_req: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const violations = getGuardViolations();
  const broad = violations.filter((v) => v.kind === "broad");
  const byId = violations.filter((v) => v.kind === "byId");

  return NextResponse.json({
    mode: process.env.SITE_GUARD_MODE || (process.env.NODE_ENV === "production" ? "off" : "log"),
    summary: {
      unscoped: broad.length,
      unscopedCalls: broad.reduce((n, v) => n + v.count, 0),
      byIdNeedingReview: byId.length,
      modelsAffected: [...new Set(broad.map((v) => v.model))].sort(),
    },
    // Worst first: these read across every station.
    unscoped: broad,
    // Fetch-then-check candidates. The guard cannot see whether the caller
    // verifies ownership afterwards, so each still needs a human to look.
    byId,
  });
}

export async function DELETE(_req: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  clearGuardViolations();
  return NextResponse.json({ ok: true });
}
