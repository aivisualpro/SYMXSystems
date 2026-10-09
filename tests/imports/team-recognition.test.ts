import { describe, expect, it } from "vitest";
import { recognitionCandidates, recognitionPeriodWeeks, recognitionWinner, type RankedWeek } from "@/lib/driver-ranking/team-recognition";
import type { DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";

const driver = (id: string, score: number, rank: number, safety = 40, quality = 30, efficiency = 100): DriverRankingRow => ({
  driverId: id, name: id, efficiency: { average: efficiency },
  score: { finalScore: score, rank, safetySubtotal: safety, qualitySubtotal: quality },
} as DriverRankingRow);
const week = (value: string, ...drivers: DriverRankingRow[]): RankedWeek => ({ week: value, drivers });

describe("team recognition from ranked weekly history", () => {
  it("separates current and last completed calendar periods by selected week", () => {
    const ends = [
      { week: "2026-W25", end: "2026-06-20" }, { week: "2026-W26", end: "2026-06-27" },
      { week: "2026-W30", end: "2026-07-25" }, { week: "2026-W31", end: "2026-08-01" },
      { week: "2026-W35", end: "2026-08-29" }, { week: "2026-W36", end: "2026-09-05" },
      { week: "2026-W37", end: "2026-09-12" }, { week: "2026-W38", end: "2026-09-19" },
    ];
    expect(recognitionPeriodWeeks("2026-09-12", ends)).toEqual({
      currentMonth: ["2026-W36", "2026-W37"], lastMonth: ["2026-W31", "2026-W35"],
      currentQuarter: ["2026-W30", "2026-W31", "2026-W35", "2026-W36", "2026-W37"],
      lastQuarter: ["2026-W25", "2026-W26"],
    });
    expect(recognitionPeriodWeeks("2027-01-09", [
      { week: "2026-W52", end: "2026-12-26" }, { week: "2027-W01", end: "2027-01-09" },
    ])).toEqual({ currentMonth: ["2027-W01"], lastMonth: ["2026-W52"], currentQuarter: ["2027-W01"], lastQuarter: ["2026-W52"] });
  });

  it("returns only qualified candidates in sorted order for a live Top 5", () => {
    const ids = ["A", "B", "C", "D", "E", "F"];
    const history = [week("2026-W36", ...ids.map((id, index) => driver(id, 99 - index, index + 1))), week("2026-W37", ...ids.map((id, index) => driver(id, 99 - index, index + 1)))];
    const list = recognitionCandidates(history, ["2026-W36", "2026-W37"], "2026-W37", "2026-W36", 2).slice(0, 5);
    expect(list.map(row => row.name)).toEqual(["A", "B", "C", "D", "E"]);
    expect(list.every(row => row.eligibleWeeks === 2)).toBe(true);
    expect(recognitionCandidates(history, ["2026-W36"], "2026-W37", "2026-W36", 2)).toEqual([]);
  });
  it("requires actual eligible weeks and does not fill a missing week", () => {
    const history = [week("2026-W35", driver("A", 98, 3)), week("2026-W37", driver("A", 96, 1))];
    const winner = recognitionWinner(history, ["2026-W35", "2026-W36", "2026-W37"], "2026-W37", "2026-W36", 2);
    expect(winner).toMatchObject({ name: "A", averageScore: 97, eligibleWeeks: 2, currentRank: 1, rankMovement: null });
    expect(recognitionWinner(history, ["2026-W35", "2026-W36", "2026-W37"], "2026-W37", "2026-W36", 6)).toBeNull();
  });

  it("uses average score, then safety, quality, efficiency, and stable name for ties", () => {
    const history = [week("2026-W36", driver("Zed", 98, 2, 40), driver("Amy", 97, 1, 42)), week("2026-W37", driver("Zed", 96, 3, 40), driver("Amy", 97, 2, 42))];
    expect(recognitionWinner(history, ["2026-W36", "2026-W37"], "2026-W37", "2026-W36", 2)?.name).toBe("Amy");
    const tied = [week("2026-W36", driver("Zed", 97, 5), driver("Amy", 97, 4)), week("2026-W37", driver("Zed", 97, 2), driver("Amy", 97, 3))];
    expect(recognitionWinner(tied, ["2026-W36", "2026-W37"], "2026-W37", "2026-W36", 2)).toMatchObject({ name: "Amy", rankMovement: 1 });
    const quality = [week("2026-W36", driver("Amy", 97, 2, 40, 30), driver("Zed", 97, 1, 40, 31)), week("2026-W37", driver("Amy", 97, 2, 40, 30), driver("Zed", 97, 1, 40, 31))];
    expect(recognitionWinner(quality, ["2026-W36", "2026-W37"], "2026-W37", "2026-W36", 2)?.name).toBe("Zed");
    const efficiency = [week("2026-W36", driver("Amy", 97, 2, 40, 30, 100), driver("Zed", 97, 1, 40, 30, 101)), week("2026-W37", driver("Amy", 97, 2, 40, 30, 100), driver("Zed", 97, 1, 40, 30, 101))];
    expect(recognitionWinner(efficiency, ["2026-W36", "2026-W37"], "2026-W37", "2026-W36", 2)?.name).toBe("Zed");
  });

  it("reports a downward whole-rank move and meets the six-week quarter minimum", () => {
    const history = Array.from({ length: 6 }, (_, index) => week(`2026-W${32 + index}`, driver("A", 97.84, index === 4 ? 3 : index === 5 ? 6 : 4)));
    expect(recognitionWinner(history, history.map(row => row.week), "2026-W37", "2026-W36", 6)).toMatchObject({ averageScore: 97.84, eligibleWeeks: 6, currentRank: 6, rankMovement: -3 });
  });
});
