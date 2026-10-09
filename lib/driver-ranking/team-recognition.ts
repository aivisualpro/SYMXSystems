import type { DriverRankingRow } from "./driver-ranking-data";

export type RankedWeek = { week: string; drivers: DriverRankingRow[] };
export type RecognitionWinner = {
  driverId: string;
  name: string;
  averageScore: number;
  eligibleWeeks: number;
  currentRank: number | null;
  rankMovement: number | null;
};

const average = (values: Array<number | null | undefined>) => {
  const available = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
};

export function recognitionCandidates(
  history: RankedWeek[], periodWeeks: string[], selectedWeek: string, comparisonWeek: string, minimumWeeks: number,
): RecognitionWinner[] {
  const included = new Set(periodWeeks);
  const byDriver = new Map<string, DriverRankingRow[]>();
  for (const { week, drivers } of history) {
    if (!included.has(week)) continue;
    for (const driver of drivers) {
      if (!driver.score || !Number.isFinite(driver.score.finalScore)) continue;
      byDriver.set(driver.driverId, [...(byDriver.get(driver.driverId) || []), driver]);
    }
  }
  const candidates = [...byDriver].filter(([, rows]) => rows.length >= minimumWeeks).map(([driverId, rows]) => ({
    driverId, name: rows.at(-1)!.name, rows,
    score: average(rows.map(row => row.score!.finalScore))!,
    safety: average(rows.map(row => row.score!.safetySubtotal)) ?? -Infinity,
    quality: average(rows.map(row => row.score!.qualitySubtotal)) ?? -Infinity,
    efficiency: average(rows.map(row => row.efficiency.average)) ?? -Infinity,
  }));
  candidates.sort((a, b) => b.score - a.score || b.safety - a.safety || b.quality - a.quality || b.efficiency - a.efficiency || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.driverId.localeCompare(b.driverId));
  const currentRanks = new Map(history.find(row => row.week === selectedWeek)?.drivers.map(row => [row.driverId, row.score?.rank ?? null]));
  const previousRanks = new Map(history.find(row => row.week === comparisonWeek)?.drivers.map(row => [row.driverId, row.score?.rank ?? null]));
  return candidates.map(candidate => {
    const currentRank = currentRanks.get(candidate.driverId) ?? null;
    const previousRank = previousRanks.get(candidate.driverId) ?? null;
    return {
      driverId: candidate.driverId, name: candidate.name, averageScore: Math.round(candidate.score * 100) / 100,
      eligibleWeeks: candidate.rows.length, currentRank,
      rankMovement: currentRank === null || previousRank === null ? null : previousRank - currentRank,
    };
  });
}

export function recognitionWinner(
  history: RankedWeek[], periodWeeks: string[], selectedWeek: string, comparisonWeek: string, minimumWeeks: number,
): RecognitionWinner | null {
  return recognitionCandidates(history, periodWeeks, selectedWeek, comparisonWeek, minimumWeeks)[0] ?? null;
}

export function recognitionPeriodWeeks(selectedEnd: string, weekEnds: Array<{ week: string; end: string }>) {
  const year = Number(selectedEnd.slice(0, 4));
  const month = Number(selectedEnd.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3);
  const lastMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const lastQuarterDate = new Date(Date.UTC(year, quarter * 3 - 3, 1));
  const lastQuarter = `${lastQuarterDate.getUTCFullYear()}-Q${Math.floor(lastQuarterDate.getUTCMonth() / 3) + 1}`;
  const currentMonth = selectedEnd.slice(0, 7);
  const currentQuarter = `${year}-Q${quarter + 1}`;
  const quarterOf = (end: string) => `${end.slice(0, 4)}-Q${Math.floor((Number(end.slice(5, 7)) - 1) / 3) + 1}`;
  return {
    currentMonth: weekEnds.filter(row => row.end <= selectedEnd && row.end.slice(0, 7) === currentMonth).map(row => row.week),
    lastMonth: weekEnds.filter(row => row.end.slice(0, 7) === lastMonth).map(row => row.week),
    currentQuarter: weekEnds.filter(row => row.end <= selectedEnd && quarterOf(row.end) === currentQuarter).map(row => row.week),
    lastQuarter: weekEnds.filter(row => quarterOf(row.end) === lastQuarter).map(row => row.week),
  };
}
