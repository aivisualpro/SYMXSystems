import type { AmazonWeeklyData } from "./driver-ranking-data";
import { getWeeklyMetricPerformanceState, type PerformanceState } from "./performance-colors";

export type WeeklyMetricDisplay = { label: string; value: string; state: PerformanceState };

export function weeklyMetricValue(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined
    ? "N/A"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

export function amazonWeeklyMetrics(weekly: AmazonWeeklyData | null): WeeklyMetricDisplay[] {
  const metric = (label: string, value: number | null | undefined, tier: string | null | undefined, suffix = "") => ({
    label,
    value: weeklyMetricValue(value, suffix),
    state: getWeeklyMetricPerformanceState(value, tier),
  });
  return [
    metric("CDF", weekly?.quality.cdf.value, weekly?.quality.cdf.tier, " DPMO"),
    metric("DSB", weekly?.quality.dsb.value, weekly?.quality.dsb.tier),
    metric("DC", weekly?.quality.deliveryCompletion.value, weekly?.quality.deliveryCompletion.tier, " DPMO"),
    metric("POD", weekly?.quality.pod.value, weekly?.quality.pod.tier, "%"),
    metric("PSB", weekly?.quality.psb.value, weekly?.quality.psb.tier),
    metric("Speeding", weekly?.safety.speeding.value, weekly?.safety.speeding.tier),
    metric("Seatbelt", weekly?.safety.seatbelt.value, weekly?.safety.seatbelt.tier),
    metric("Distractions", weekly?.safety.distractions.value, weekly?.safety.distractions.tier),
    metric("Sign / Signal", weekly?.safety.signSignal.value, weekly?.safety.signSignal.tier),
    metric("Following Distance", weekly?.safety.followingDistance.value, weekly?.safety.followingDistance.tier),
  ];
}
