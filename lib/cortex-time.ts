/**
 * ══════════════════════════════════════════════════════════════
 * Amazon Cortex timestamp/duration normalization
 * ══════════════════════════════════════════════════════════════
 * Confirmed from a real Cortex itinerary payload: sibling fields inside
 * the SAME object (`transporterTimeAttributes`) use at least four
 * different numeric encodings —
 *   - plannedDepartureTime: microseconds epoch   (16 digits, ~1.79e18... no, ~1.79e15)
 *   - actualDepartureTime:  milliseconds epoch   (13 digits, ~1.79e12)
 *   - plannedRtsTime:       seconds epoch        (10 digits, ~1.79e9)
 *   - sessionEndTime / projectedCompletionTime: seconds epoch WITH a
 *     fractional/decimal component (e.g. 1788142696.949)
 * plus duration fields (plannedOutboundStemTime, actualOutboundStemTime,
 * breaksTimeAddedToPlannedRTS) that are plain millisecond DURATIONS, not
 * timestamps at all, despite living in the same object.
 *
 * Field names alone are not a reliable signal (Amazon has been observed
 * to be inconsistent), so absolute timestamps are detected by magnitude
 * rather than by which field they came from.
 */

const BUSINESS_TZ = "America/Los_Angeles";

/**
 * Given a numeric epoch value of unknown unit, return a JS Date.
 * Thresholds (all comfortably clear of "current era" ambiguity):
 *   >= 1e14  → microseconds
 *   >= 1e11  → milliseconds
 *   >= 1e8   → seconds (decimal component, if any, is sub-second precision)
 *   otherwise → not a plausible absolute timestamp (likely a duration)
 */
export function epochToDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "string" ? parseFloat(value) : (value as number);
    if (typeof n !== "number" || isNaN(n) || n <= 0) return null;

    if (n >= 1e14) return new Date(n / 1000);       // microseconds → ms
    if (n >= 1e11) return new Date(n);              // already ms
    if (n >= 1e8) return new Date(n * 1000);        // seconds (+ fractional ms) → ms
    return null;                                     // too small to be an absolute timestamp
}

/** Epoch value (any of the above units) → "H:MM AM/PM" in business timezone. */
export function epochToClockTime(value: unknown): string {
    const d = epochToDate(value);
    if (!d) return "";
    return d.toLocaleString("en-US", {
        timeZone: BUSINESS_TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

/**
 * Epoch → 24-hour "HH:MM" in business timezone. This is the format the Time
 * page, payroll audit and manual entry use for AMZ Out/In/Logout; the page
 * adds AM/PM itself, so storing "3:00 PM" there showed "3:00 PM AM".
 */
export function epochToHHMM(value: unknown): string {
    const d = epochToDate(value);
    if (!d) return "";
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value || "00";
    const m = parts.find((p) => p.type === "minute")?.value || "00";
    return `${h === "24" ? "00" : h}:${m}`;
}

/** Normalize "3:00 PM" / "15:00" / "3:00" → "HH:MM" 24h (leaves unknown text alone). */
export function to24h(t: string | undefined | null): string {
    if (!t) return "";
    const m = String(t).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (!m) return String(t);
    let h = parseInt(m[1], 10);
    const ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Duration in milliseconds → "H:MM". */
export function durationMsToHMM(value: unknown): string {
    if (value === null || value === undefined || value === "") return "";
    const ms = typeof value === "string" ? parseFloat(value) : (value as number);
    if (typeof ms !== "number" || isNaN(ms) || ms <= 0) return "";
    const totalMinutes = Math.round(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, "0")}`;
}

/** Business-day (America/Los_Angeles) "YYYY-MM-DD" for an epoch value, for route-date matching. */
export function epochToBusinessDateString(value: unknown): string {
    const d = epochToDate(value);
    if (!d) return "";
    // en-CA locale gives YYYY-MM-DD directly
    return d.toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}
