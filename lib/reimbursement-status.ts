// Pure status-normalization helper — deliberately has zero imports (no db,
// no mongoose) so it's safe to use from both server routes and "use client"
// components. Needed because the July 2026 redesign (see
// lib/models/SymxReimbursement.ts) switched from a flat, unenforced 5-value
// string ("Pending"/"Unpaid"/"Approved"/"Rejected"/"Paid") to a proper
// lowercase enum, and scripts/migrate-reimbursement-status.mjs is opt-in
// (dry-run by default) — so plenty of real records can still carry the old
// values indefinitely until someone runs it. Every place that reads
// `status` off a reimbursement record (KPI aggregation, the admin
// workbench, the pay-action transition checks) normalizes through this
// first rather than assuming the migration has already run, so the app
// never crashes or silently misclassifies old data.
export type ReimbursementStatus = "pending" | "approved" | "denied" | "queued_for_payroll" | "paid";

export const REIMBURSEMENT_STATUSES: ReimbursementStatus[] = [
  "pending", "approved", "denied", "queued_for_payroll", "paid",
];

const LEGACY_STATUS_MAP: Record<string, ReimbursementStatus> = {
  Pending: "pending",
  // "Unpaid" was used inconsistently in the old flat status list to mean
  // "reviewed but not yet paid" — the closest new-model equivalent is
  // "approved" (reviewed, awaiting payment resolution).
  Unpaid: "approved",
  Approved: "approved",
  Rejected: "denied",
  Paid: "paid",
};

export function normalizeReimbursementStatus(raw?: string | null): ReimbursementStatus {
  if (!raw) return "pending";
  if ((REIMBURSEMENT_STATUSES as string[]).includes(raw)) return raw as ReimbursementStatus;
  return LEGACY_STATUS_MAP[raw] || "pending";
}
