// Shared constant — safe to import from both server (Mongoose model) and
// client components, since it has no server-only dependencies.
export const INSURANCE_POLICY_TYPES = ["Auto", "Workers Comp", "General Liability", "Other"] as const;
export type InsurancePolicyType = typeof INSURANCE_POLICY_TYPES[number];
