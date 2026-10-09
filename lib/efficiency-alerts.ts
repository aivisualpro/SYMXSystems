/**
 * Efficiency alert rules, evaluated server-side from stored route data.
 * Mirrors the delay/efficiency math on the Efficiency screen so a Slack
 * alert and the screen never disagree.
 */
import { parseTime, fmtDur, fmtTime } from "@/app/(protected)/dispatching/routes/_components/routes-utils";

export const ALERT_T = {
    depRed: 15,       // minutes late leaving (after wave + 20 grace)
    notDepartedGrace: 15,
    lastRed: 105,     // 1:45 behind planned last stop
    effRed: 85,       // percent
};

export interface AlertRow {
    id: string;
    transporterId: string;
    name: string;
    route: string;
    stops: number;
    depDelayMin: number | null;
    actDep: boolean;
    waveMin: number | null;
    lastDelayMin: number | null;
    actLast: boolean;
    eff: number;
    rescued: number;
    alertsSent: string[];
    returned: boolean;
    loggedOut: boolean;
}

export function toAlertRow(rec: any, name: string): AlertRow {
    const wave = parseTime(rec.waveTime || "");
    const actDep = parseTime(rec.actualDepartureTime || "");
    const planFirst = parseTime(rec.plannedFirstStop || "");
    const actFirst = parseTime(rec.actualFirstStop || "");
    const planLast = parseTime(rec.plannedLastStop || "");
    const actLast = parseTime(rec.actualLastStop || "");
    const plan1L = planLast !== null && planFirst !== null ? planLast - planFirst : null;
    const act1L = actLast !== null && actFirst !== null ? actLast - actFirst : null;
    const stops = rec.stopCount || 0;
    const sph = plan1L && plan1L > 0 && stops > 0 ? stops / (plan1L / 60) : 0;
    let eff = 0;
    if (plan1L && plan1L > 0 && act1L && act1L > 0) {
        const resc = sph > 0 ? (rec.stopsRescued || 0) * (60 / sph) : 0;
        const e = (plan1L / (act1L + resc)) * 100;
        if (isFinite(e)) eff = Math.round(e);
    }
    return {
        id: String(rec._id),
        transporterId: rec.transporterId,
        name,
        route: rec.routeNumber || "",
        stops,
        waveMin: wave,
        actDep: actDep !== null,
        depDelayMin: actDep !== null && wave !== null ? actDep - (wave + 20) : null,
        actLast: actLast !== null,
        lastDelayMin: actLast !== null && planLast !== null ? actLast - planLast : null,
        eff,
        rescued: rec.stopsRescued || 0,
        alertsSent: Array.isArray(rec.alertsSent) ? rec.alertsSent : [],
        returned: !!(rec.actualReturnTime && String(rec.actualReturnTime).trim()),
        loggedOut: !!(rec.amazonAppLogout && String(rec.amazonAppLogout).trim()),
    };
}

export interface NewAlert { rowId: string; key: string; text: string }

/** nowMin = station-local minutes since midnight; final = end-of-day pass. */
export function evaluateAlerts(rows: AlertRow[], nowMin: number, final: boolean): NewAlert[] {
    const out: NewAlert[] = [];
    for (const r of rows) {
        const who = `*${r.name}* (${r.route || r.transporterId})`;
        const add = (key: string, text: string) => {
            if (!r.alertsSent.includes(key)) out.push({ rowId: r.id, key, text });
        };
        if (!r.actDep && r.waveMin !== null && nowMin >= r.waveMin + 20 + ALERT_T.notDepartedGrace) {
            add("not-departed", `:rotating_light: ${who} has not departed — planned ${fmtTime(r.waveMin + 20)}`);
        }
        if (r.depDelayMin !== null && r.depDelayMin >= ALERT_T.depRed) {
            add("late-departure", `:alarm_clock: ${who} left *${fmtDur(r.depDelayMin)} late*`);
        }
        if (r.lastDelayMin !== null && r.lastDelayMin >= ALERT_T.lastRed) {
            add("last-stop-late", `:warning: ${who} last stop was *${fmtDur(r.lastDelayMin)} behind* plan`);
        }
        if (final && r.eff > 0 && r.eff < ALERT_T.effRed) {
            add("low-eff", `:chart_with_downwards_trend: ${who} efficiency *${r.eff}%* (${r.rescued} rescued)`);
        }
    }
    return out;
}

export function buildSummary(siteCode: string, date: string, rows: AlertRow[]): string {
    const withEff = rows.filter((r) => r.eff > 0);
    const avgEff = withEff.length ? Math.round(withEff.reduce((a, r) => a + r.eff, 0) / withEff.length) : null;
    const dep = rows.filter((r) => r.depDelayMin !== null);
    const onTime = dep.filter((r) => (r.depDelayMin as number) < 6).length;
    const lasts = rows.map((r) => r.lastDelayMin).filter((v): v is number => v !== null);
    const avgLast = lasts.length ? Math.round(lasts.reduce((a, b) => a + b, 0) / lasts.length) : null;
    const rescued = rows.reduce((a, r) => a + r.rescued, 0);
    const worst = [...withEff].sort((a, b) => a.eff - b.eff).slice(0, 3);
    const lines = [
        `*${siteCode} — efficiency summary for ${date}*`,
        `• Drivers: ${rows.length} · Stops: ${rows.reduce((a, r) => a + r.stops, 0).toLocaleString()}`,
        `• Avg efficiency: ${avgEff === null ? "—" : avgEff + "%"}`,
        `• On-time departures: ${onTime}/${dep.length}`,
        `• Avg last-stop delay: ${avgLast === null ? "—" : fmtDur(avgLast)}`,
        `• Stops rescued: ${rescued}`,
    ];
    if (worst.length) lines.push(`• Lowest: ${worst.map((r) => `${r.name} ${r.eff}%`).join(", ")}`);
    return lines.join("\n");
}

/**
 * Close-out check (10 PM onward): drivers who left the station but are not
 * back yet, and drivers who have not logged out of the Amazon app. These
 * repeat at every close-out run until resolved, so they are not de-duplicated.
 */
export function buildCloseout(siteCode: string, rows: AlertRow[], slot: string, last: boolean): string | null {
    const out = rows.filter((r) => r.actDep);
    const notBack = out.filter((r) => !r.returned);
    const notOut = out.filter((r) => !r.loggedOut);
    const fmt = (r: AlertRow) => `${r.name} (${r.route || r.transporterId})`;
    if (notBack.length === 0 && notOut.length === 0) {
        return last ? `:white_check_mark: *${siteCode} ${slot}* — all drivers are back and logged out.` : null;
    }
    const lines = [`*${siteCode} — ${slot} close-out check*`];
    if (notBack.length) lines.push(`:house: *Not back at the station (${notBack.length}):* ${notBack.map(fmt).join(", ")}`);
    if (notOut.length) lines.push(`:no_entry: *Not logged out of the app (${notOut.length}):* ${notOut.map(fmt).join(", ")}`);
    return lines.join("\n");
}
