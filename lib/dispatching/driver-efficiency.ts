export type DriverEfficiencyInput = {
  plannedFirstStop?: string | null;
  plannedLastStop?: string | null;
  actualFirstStop?: string | null;
  actualLastStop?: string | null;
  stopCount?: number | null;
  stopsRescued?: number | null;
  driverEfficiency?: number | null;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value || !value.trim()) return null;
  const input = value.trim();
  const duration = input.match(/^(-?)(\d{1,2}):(\d{2})$/);
  if (duration) {
    const minutes = Number(duration[2]) * 60 + Number(duration[3]);
    return duration[1] === "-" ? -minutes : minutes;
  }
  const clock = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!clock) return null;
  let hours = Number(clock[1]);
  const minutes = Number(clock[2]);
  const afternoon = clock[3].toUpperCase() === "PM";
  if (afternoon && hours < 12) hours += 12;
  if (!afternoon && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function effectiveDriverEfficiency(route: DriverEfficiencyInput): number | null {
  const stored = typeof route.driverEfficiency === "number" && Number.isFinite(route.driverEfficiency) && route.driverEfficiency > 0
    ? route.driverEfficiency : null;
  const plannedFirst = parseTime(route.plannedFirstStop);
  const plannedLast = parseTime(route.plannedLastStop);
  const actualFirst = parseTime(route.actualFirstStop);
  const actualLast = parseTime(route.actualLastStop);
  if (plannedFirst === null || plannedLast === null || actualFirst === null || actualLast === null) return stored;
  const plannedDuration = plannedLast - plannedFirst;
  const actualDuration = actualLast - actualFirst;
  if (plannedDuration <= 0 || actualDuration <= 0) return stored;
  const stopCount = typeof route.stopCount === "number" && Number.isFinite(route.stopCount) ? route.stopCount : 0;
  const stopsPerHour = stopCount > 0 ? Math.round((stopCount / (plannedDuration / 60)) * 10) / 10 : 0;
  const rescuedMinutes = stopsPerHour > 0 ? ((route.stopsRescued || 0) * (60 / stopsPerHour)) : 0;
  const calculated = (plannedDuration / (actualDuration + rescuedMinutes)) * 100;
  return Number.isFinite(calculated) ? Math.round(calculated) : stored;
}
