export type PerformanceState = "top" | "good" | "attention" | "missing" | "neutral";

export const performanceValueClass: Record<PerformanceState, string> = {
  top: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  attention: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  missing: "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400",
  neutral: "border-transparent bg-transparent text-foreground",
};

export function getWeeklyMetricPerformanceState(value: number | null | undefined, tier: string | null | undefined): PerformanceState {
  if (value === null || value === undefined || !tier?.trim()) return "missing";
  const normalized = tier.trim().toLowerCase();
  if (normalized === "platinum") return "top";
  if (normalized === "gold" || normalized === "silver") return "good";
  if (normalized === "bronze") return "attention";
  return "missing";
}

export type EfficiencyDistribution = { lowerQuartile: number; upperQuartile: number } | null;

function quantile(sorted: number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

export function efficiencyDistribution(values: Array<number | null | undefined>): EfficiencyDistribution {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  return valid.length ? { lowerQuartile: quantile(valid, 0.25), upperQuartile: quantile(valid, 0.75) } : null;
}

export function getEfficiencyPerformanceState(value: number | null | undefined, distribution: EfficiencyDistribution): PerformanceState {
  if (value === null || value === undefined || !Number.isFinite(value) || !distribution) return "missing";
  if (distribution.lowerQuartile === distribution.upperQuartile) return "good";
  if (value >= distribution.upperQuartile) return "top";
  if (value <= distribution.lowerQuartile) return "attention";
  return "good";
}

export function getOperationalPerformanceState(value: number | null | undefined): PerformanceState {
  if (value === null || value === undefined || !Number.isFinite(value)) return "missing";
  return value === 0 ? "top" : "attention";
}
