import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import connectToDatabase from "@/lib/db";
import { getRequestScope } from "@/lib/scoped-query";
import { loadDriverRankingData } from "@/lib/driver-ranking/driver-ranking-data";
import { datesForPerformanceWeek, weekFromDate } from "@/lib/driver-ranking/reporting-week";
import { teamMetricValue, teamSummary, type TeamMetricKey } from "@/lib/driver-ranking/team-performance";
import { recognitionCandidates, recognitionPeriodWeeks, recognitionWinner } from "@/lib/driver-ranking/team-recognition";

const mean = (values: Array<number | null>) => { const valid = values.filter((value): value is number => value !== null && Number.isFinite(value)); return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length * 100) / 100 : null; };
function previousWeeks(week: string, count: number) { const first = datesForPerformanceWeek(week)[0]; if (!first) return []; const anchor = new Date(`${first}T12:00:00Z`); return Array.from({ length: count }, (_, index) => { const date = new Date(anchor); date.setUTCDate(date.getUTCDate() - (count - 1 - index) * 7); return weekFromDate(date.toISOString().slice(0, 10))!; }); }

export async function GET(req: NextRequest) {
  try { await requirePermission("Driver Dashboard", "view"); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 }); }
  try {
    await connectToDatabase(); const scope = await getRequestScope();
    if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site." }, { status: 400 });
    const week = req.nextUrl.searchParams.get("week") || "";
    if (!/^\d{4}-W\d{2}$/.test(week)) return NextResponse.json({ error: "Choose a valid reporting week." }, { status: 400 });
    const weeks = previousWeeks(week, 6);
    const results = await Promise.all(weeks.map(value => loadDriverRankingData(scope.activeSiteIds[0], { week: value })));
    const selectedEnd = datesForPerformanceWeek(week).at(-1)!;
    const weekEnds = results.at(-1)!.availableWeeks.map(value => ({ week: value, end: datesForPerformanceWeek(value).at(-1) || "" })).filter(row => row.end);
    const periods = recognitionPeriodWeeks(selectedEnd, weekEnds);
    const history = weeks.map((value, index) => ({ week: value, drivers: results[index].drivers }));
    const needed = new Set([...periods.currentMonth, ...periods.lastMonth, ...periods.currentQuarter, ...periods.lastQuarter]);
    const missing = [...needed].filter(value => !weeks.includes(value));
    for (let index = 0; index < missing.length; index += 3) {
      const batch = missing.slice(index, index + 3);
      const ranked = await Promise.all(batch.map(value => loadDriverRankingData(scope.activeSiteIds[0], { week: value })));
      history.push(...batch.map((value, offset) => ({ week: value, drivers: ranked[offset].drivers })));
    }
    history.sort((a, b) => a.week.localeCompare(b.week));
    const recognition = {
      currentMonth: recognitionCandidates(history, periods.currentMonth, week, weeks.at(-2)!, 2).slice(0, 5),
      lastMonth: recognitionWinner(history, periods.lastMonth, week, weeks.at(-2)!, 2),
      currentQuarter: recognitionCandidates(history, periods.currentQuarter, week, weeks.at(-2)!, 4).slice(0, 5),
      lastQuarter: recognitionWinner(history, periods.lastQuarter, week, weeks.at(-2)!, 6),
    };
    const summaries = results.map(result => teamSummary(result));
    const metrics: TeamMetricKey[] = ["finalScore", "efficiency", "averageRoute", "cdf", "dsb", "deliveryCompletion", "pod", "psb", "safety", "quality", "speeding", "seatbelt", "distractions", "signSignal", "followingDistance"];
    const trend = weeks.map((value, index) => ({ week: value, driversRanked: results[index].drivers.length, ...Object.fromEntries(metrics.map(metric => [metric, mean(results[index].drivers.map(driver => teamMetricValue(driver, metric)))])) }));
    return NextResponse.json({ selectedWeek: week, current: summaries.at(-1), previous: summaries.at(-2) || null, trend, recognition });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not load team performance." }, { status: 400 }); }
}
