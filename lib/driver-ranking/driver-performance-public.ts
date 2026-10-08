import "server-only";
import { orgWide } from "@/lib/scoped-query";
import DriverPerformanceLink from "@/lib/models/DriverPerformanceLink";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import { loadDriverRankingData, type DriverRankingRow } from "./driver-ranking-data";
import { driverHistoryWeek, driverMetricRanks, summarizeDriverHistory, type MetricRank } from "./driver-history-review";
import { loadDriverWeeklyQualityDetails, toDriverSafeQualityDetails } from "./driver-weekly-quality-events";
import { publicDriverPerformanceSiteEnabled } from "./driver-performance-public-config";

const shown = (value: number | null | undefined, suffix = "") => value === null || value === undefined ? "N/A" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
const rank = (value: MetricRank | undefined) => !value || value.rank === null ? "N/A" : `#${value.rank}${value.tied ? "T" : ""}`;
const streak = (value: number) => value ? `${value >= 6 ? "6+" : value} wk streak` : "Opportunity to Start";

export type PublicDriverPerformance = {
  driverName: string;
  selectedWeek: string;
  availableWeeks: string[];
  summary: { finalScore: string; overallRank: string; trend: string; rankMovement: string; status: string; mainFocus: string };
  history: Array<{ week: string; finalScore: number; rank: number }>;
  momentum: string[];
  nextFocus: string[];
  metrics: Array<{ label: string; current: string; teamRank: string; streak: string }>;
  qualityDetails: ReturnType<typeof toDriverSafeQualityDetails>;
  qualityDetailState: "available" | "unavailable" | "clean";
};

function metricRows(driver: DriverRankingRow, ranks: ReturnType<typeof driverMetricRanks>, streaks: Record<string, number>) {
  return [
    ["Final Score", shown(ranks?.finalScore.value, "%"), rank(ranks?.finalScore), streak(streaks.top5)],
    ["Safety", shown(ranks?.safety.value, "%"), rank(ranks?.safety), streak(streaks.safety)],
    ["Quality", shown(ranks?.quality.value, "%"), rank(ranks?.quality), streak(streaks.quality95)],
    ["Efficiency", shown(ranks?.efficiency.value, "%"), rank(ranks?.efficiency), streak(streaks.efficiency100)],
    ["Workload", shown(ranks?.workload.value), rank(ranks?.workload), "—"],
    ["Packages / Day", shown(ranks?.packagesPerDay.value), rank(ranks?.packagesPerDay), streak(streaks.packagesAboveAverage)],
    ["Delivery Days", shown(driver.deliveryDays), "—", streak(streaks.fiveDays)],
    ["CDF", shown(ranks?.cdf.value), rank(ranks?.cdf), streak(streaks.cdf)],
    ["DSB", shown(ranks?.dsb.value), rank(ranks?.dsb), streak(streaks.dsb)],
    ["Delivery Completion", shown(ranks?.deliveryCompletion.value), rank(ranks?.deliveryCompletion), streak(streaks.deliveryCompletion)],
    ["POD", shown(ranks?.pod.value, "%"), rank(ranks?.pod), streak(streaks.pod)],
    ["PSB", shown(ranks?.psb.value), rank(ranks?.psb), streak(streaks.psb)],
  ].map(([label, current, teamRank, value]) => ({ label, current, teamRank, streak: value }));
}

export async function loadPublicDriverPerformance(token: string, requestedWeek?: string): Promise<PublicDriverPerformance | null> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const link = await orgWide(
    DriverPerformanceLink.findOne({ token, active: true }).select("siteId employeeId active"),
    "a private driver-performance bearer token must be resolved before its station is known",
  ).lean() as any;
  if (!link) return null;
  const siteId = String(link.siteId);
  if (!(await publicDriverPerformanceSiteEnabled(siteId))) return null;
  const employee = await SymxEmployee.findOne({ _id: link.employeeId, primarySiteId: link.siteId }, { firstName: 1, lastName: 1, transporterId: 1 }).lean() as any;
  if (!employee?.transporterId) return null;
  const transporterId = String(employee.transporterId).trim().toUpperCase();
  const overviewWeeks = await SymxDeliveryExcellence.distinct("week", { siteId: link.siteId, transporterId });
  const candidateWeeks = [...new Set(overviewWeeks.map(String).filter(week => /^\d{4}-W\d{2}$/.test(week)))].sort().reverse();
  const ranked = new Map<string, Awaited<ReturnType<typeof loadDriverRankingData>>>();
  for (const week of candidateWeeks) {
    const result = await loadDriverRankingData(siteId, { week });
    if (result.drivers.some(driver => driver.transporterId === transporterId)) ranked.set(week, result);
  }
  const availableWeeks = [...ranked.keys()];
  if (!availableWeeks.length) return null;
  const selectedWeek = requestedWeek || availableWeeks[0];
  if (!ranked.has(selectedWeek)) throw new Error("That reporting week is not available for this driver.");
  const selected = ranked.get(selectedWeek)!;
  const selectedDriver = selected.drivers.find(driver => driver.transporterId === transporterId)!;
  const windowWeeks = availableWeeks.filter(week => week <= selectedWeek).sort().slice(-6);
  const history = windowWeeks.flatMap(week => {
    const result = ranked.get(week)!;
    const driver = result.drivers.find(item => item.transporterId === transporterId);
    if (!driver?.score) return [];
    const packageValues = result.drivers.map(item => item.score?.packagesPerDeliveryDay).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const teamPackages = packageValues.length ? packageValues.reduce((sum, value) => sum + value, 0) / packageValues.length : null;
    return [driverHistoryWeek(driver, teamPackages)];
  });
  const review = summarizeDriverHistory(history, windowWeeks);
  const ranks = driverMetricRanks(selected.drivers, transporterId);
  const quality = toDriverSafeQualityDetails(await loadDriverWeeklyQualityDetails(siteId, selectedWeek, transporterId));
  const hasDetails = quality.cdf.length > 0 || quality.dsb.length > 0;
  const hasWeeklyImpact = [selectedDriver.amazonWeekly?.quality.cdf.value, selectedDriver.amazonWeekly?.quality.dsb.value].some(value => typeof value === "number" && value > 0);
  const status = review.managerStatus === "Strong" ? "Top Performer" : review.trend === "Improving" ? "Building Momentum" : review.managerStatus === "Watch" ? "On Track" : "Focus Area";
  const rankMovement = review.rankMovement === null ? "—" : review.rankMovement > 0 ? `↑ ${review.rankMovement}` : review.rankMovement < 0 ? `↓ ${Math.abs(review.rankMovement)}` : "→ 0";
  return {
    driverName: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
    selectedWeek,
    availableWeeks,
    summary: { finalScore: shown(ranks?.finalScore.value, "%"), overallRank: rank(ranks?.finalScore), trend: `${review.trend === "Improving" ? "↑ " : review.trend === "Declining" ? "↓ " : review.trend === "Stable" ? "→ " : ""}${review.trend}`, rankMovement, status, mainFocus: review.mainFocus },
    history: history.map(item => ({ week: item.week, finalScore: item.finalScore, rank: item.rank })),
    momentum: review.improvingAreas,
    nextFocus: review.recurringIssues.map(issue => issue.label),
    metrics: metricRows(selectedDriver, ranks, review.streaks),
    qualityDetails: quality,
    qualityDetailState: hasDetails ? "available" : hasWeeklyImpact ? "unavailable" : "clean",
  };
}
