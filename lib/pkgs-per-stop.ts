// Packages per stop — a quick read on how hard a route is. More packages per
// stop usually means more carrying and more time at each door.
//
// Graded RELATIVE to the other routes shown (lowest = green, highest = red),
// so the colours always separate easy routes from hard ones for that day.

export function pkgsPerStop(stops?: number | null, pkgs?: number | null): number {
  const s = Number(stops) || 0;
  const p = Number(pkgs) || 0;
  return s > 0 && p > 0 ? Math.round((p / s) * 100) / 100 : 0;
}

export function pkgsPerStopRange(values: number[]): { min: number; max: number } {
  const v = values.filter((x) => x > 0);
  if (!v.length) return { min: 0, max: 0 };
  return { min: Math.min(...v), max: Math.max(...v) };
}

/** Green (easy) → amber → red (hard). */
export function pkgsPerStopStyle(value: number, min: number, max: number): { color: string; background: string } | undefined {
  if (!(value > 0)) return undefined;
  // If every route is about the same, don't pretend there's a difference.
  const t = max - min < 0.05 ? 0.5 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  const hue = Math.round(130 * (1 - t)); // 130 green → 0 red
  return { color: `hsl(${hue} 75% 52%)`, background: `hsl(${hue} 75% 45% / 0.16)` };
}
