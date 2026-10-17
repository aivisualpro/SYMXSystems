#!/usr/bin/env node
/**
 * Builds the overrun evidence report from out/data.json (made by fetch.mjs).
 * Pure offline analysis — no database access, nothing is modified.
 * Output: out/report.html, routes.csv, weekly.csv, areas.csv, coverage.csv, escalation.md
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");
const D = JSON.parse(fs.readFileSync(path.join(OUT, "data.json"), "utf-8"));
const APP = "https://symx-systems.vercel.app";
const SALT = process.env.OTR_SALT || crypto.randomBytes(8).toString("hex");

// ── parsing ───────────────────────────────────────────────────────────────
const clock = (s) => { // "3:10 PM" | "15:10" | "15:10:00" → minutes since midnight
  const m = String(s ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = +m[1]; const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0;
  return h * 60 + +m[2];
};
const dur = (s) => { const m = String(s ?? "").trim().match(/^(-?)(\d+):(\d{2})/); return m ? (m[1] ? -1 : 1) * (+m[2] * 60 + +m[3]) : null; };
const ymd = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const hm = (m) => { if (m === null || m === undefined || isNaN(m)) return ""; const t = Math.round(Math.abs(m)); return `${m < 0 && t > 0 ? "-" : ""}${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const num = (v) => (v === null || v === undefined || isNaN(v) ? null : v);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
function spearman(x, y) {
  const pairs = x.map((v, i) => [v, y[i]]).filter(([a, b]) => a !== null && b !== null && isFinite(a) && isFinite(b));
  if (pairs.length < 8) return { rho: null, n: pairs.length };
  const rank = (arr) => { const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = Array(arr.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
  const rx = rank(pairs.map((p) => p[0])), ry = rank(pairs.map((p) => p[1]));
  const mx = avg(rx), my = avg(ry); let sxy = 0, sxx = 0, syy = 0;
  rx.forEach((v, i) => { sxy += (v - mx) * (ry[i] - my); sxx += (v - mx) ** 2; syy += (ry[i] - my) ** 2; });
  return { rho: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, n: pairs.length };
}
const anon = (id) => "D-" + crypto.createHash("sha256").update(SALT + id).digest("hex").slice(0, 6).toUpperCase();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Advance a chain of clock times so each event is not earlier than the previous (midnight roll-over).
function chain(vals) {
  const out = []; let prev = null;
  for (const v of vals) {
    if (v === null) { out.push(null); continue; }
    let t = v; if (prev !== null) while (t < prev - 1) t += 1440; // allow 1-min jitter
    out.push(t); prev = t;
  }
  return out;
}

const NOTE_TAGS = [
  ["traffic", /traffic|accident|crash|backed up|gridlock/i],
  ["road closure / detour", /clos(ed|ure)|detour|road ?work|construction|landslide|downed|flood|fire/i],
  ["access", /gate|driveway|steep|narrow|locked|no access|hard to find|dead ?end|private road|switchback/i],
  ["unpaved", /unpaved|dirt|gravel|washboard|mud/i],
  ["app issue", /app (issue|crash|froze|down|glitch)|phone|gps|navigation|offline|no signal|no service|cell/i],
  ["station delay", /late load|late truck|loading|staging|wave|station delay|late pull|held up/i],
];
const redact = (s) => String(s || "").replace(/\d{3,}/g, "#").replace(/\b\d+\s+[A-Za-z]+(\s+(st|street|rd|road|ave|avenue|dr|drive|ln|lane|ct|court|way|blvd))\b/gi, "[addr]").replace(/\S+@\S+/g, "[email]").slice(0, 160);

// ── join data ─────────────────────────────────────────────────────────────
const typeName = new Map(D.types.map((t) => [t.id, t.name]));
const siteCode = new Map(D.sites.map((s) => [s.id, s.code]));
const contribBy = new Map(); // date|routeCode -> rows
for (const c of D.contributions) { const k = `${c.date}|${c.routeCode}`; (contribBy.get(k) || contribBy.set(k, []).get(k)).push(c); }
const providedBy = new Map(); // date|transporter -> rows
for (const c of D.contributions) { const k = `${c.date}|${c.transporterId}`; (providedBy.get(k) || providedBy.set(k, []).get(k)).push(c); }
const statsBy = new Map(D.dayStats.map((s) => [`${s.date}|${s.transporterId}`, s]));

const NON_ROUTE = /\b(off|call ?out|stand ?by|no ?show|request off|close|dnr|vacation)\b/i;
const NON_COHORT = /train|shadow|trainer/i;
const weeks = []; { const s = new Date(D.window.start + "T12:00:00Z"); for (let i = 0; i < 4; i++) { const a = new Date(s); a.setUTCDate(a.getUTCDate() + i * 7); const b = new Date(a); b.setUTCDate(b.getUTCDate() + 6); weeks.push({ label: `Wk ${i + 1}`, start: a.toISOString().slice(0, 10), end: b.toISOString().slice(0, 10) }); } }
const weekOf = (d) => weeks.find((w) => d >= w.start && d <= w.end)?.label || "";

const rows = [];
let excludedNonRoute = 0, excludedTraining = 0;
for (const r of D.routes) {
  const tname = typeName.get(String(r.typeId)) || "";
  const date = ymd(r.date);
  const hasData = (r.routeNumber || "").trim() || r.actualFirstStop || r.actualDepartureTime;
  if (!hasData || NON_ROUTE.test(tname)) { excludedNonRoute++; continue; }
  const training = NON_COHORT.test(tname);
  if (training) excludedTraining++;

  const sign = clock(r.appSignIn), pEndRaw = clock(r.plannedEndTime), dep = clock(r.actualDepartureTime);
  const fs_ = clock(r.actualFirstStop), ls = clock(r.actualLastStop), ret = clock(r.actualReturnTime), logout = clock(r.amazonAppLogout);
  const [cSign, cDep, cFs, cLs, cRet] = chain([sign, dep, fs_, ls, ret]);
  const cLogout = logout !== null && cSign !== null ? (() => { let t = logout; while (t < cSign) t += 1440; return t; })() : null;
  const cPEnd = pEndRaw !== null && cSign !== null ? (() => { let t = pEndRaw; while (t < cSign) t += 1440; return t; })() : null;

  const routeComplete = cLs !== null; // actualLastStop is only written once the route is complete
  const endSource = cLogout !== null ? "app logout" : cRet !== null ? "return to station" : "";
  const end = cLogout !== null ? cLogout : cRet;

  const plannedBlock = cSign !== null && cPEnd !== null ? cPEnd - cSign : null;
  const elapsed = cSign !== null && end !== null ? end - cSign : null;
  const overPlanned = cPEnd !== null && end !== null ? end - cPEnd : null;       // vs Cortex planned end
  const over10 = elapsed !== null ? elapsed - 600 : null;                         // vs a flat 10-hour block

  // breaks: Amazon app meal (documented) → Paycom lunch → DayStats
  const st = statsBy.get(`${date}|${r.transporterId}`);
  let breakMin = null, breakSrc = "";
  const aOut = clock(r.amazonOutLunch), aIn = clock(r.amazonInLunch);
  if (aOut !== null && aIn !== null) { breakMin = (aIn - aOut + 1440) % 1440; breakSrc = "Amazon app meal"; }
  else { const pOut = clock(r.paycomOutLunch), pIn = clock(r.paycomInLunch); if (pOut !== null && pIn !== null) { breakMin = (pIn - pOut + 1440) % 1440; breakSrc = "Paycom lunch"; } else if (st?.mealMinutes) { breakMin = st.mealMinutes; breakSrc = "Cortex break log"; } }

  // paid work time (Paycom) — separate from elapsed shift time
  let paidMin = dur(r.totalHours), paidSrc = paidMin ? "payroll total" : "";
  if (!paidMin) { const pi = clock(r.paycomInDay), po = clock(r.paycomOutDay); if (pi !== null && po !== null) { paidMin = (po - pi + 1440) % 1440 - (breakSrc === "Paycom lunch" ? breakMin : 0); paidSrc = "Paycom in/out"; } }
  const otMin = dur(r.otHrs);

  // phases (clock-derived, labelled)
  const outboundCortex = dur(r.actualOutboundStem);
  const outboundProxy = cDep !== null && cFs !== null ? cFs - cDep : null; // first delivery = proxy for arrival in area
  const outbound = outboundCortex ?? outboundProxy;
  const outboundSrc = outboundCortex !== null ? "Cortex stem" : outboundProxy !== null ? "dep→1st delivery (proxy)" : "";
  const delivery = cFs !== null && cLs !== null ? cLs - cFs : null;
  const deliveryNet = delivery !== null && breakMin !== null && aOut !== null && cFs !== null && cLs !== null && (() => { let o = aOut; while (o < cFs) o += 1440; return o <= cLs; })() ? delivery - breakMin : delivery;
  const returnLeg = cLs !== null && cRet !== null ? cRet - cLs : null;

  const pOut = dur(r.plannedOutboundStem), pIn = dur(r.plannedInboundStem);
  const pFs = clock(r.plannedFirstStop), pLs = clock(r.plannedLastStop);
  const planDelivery = pFs !== null && pLs !== null ? ((pLs - pFs) + 1440) % 1440 : null;

  // rescues
  const route = (r.routeNumber || "").trim();
  const here = (contribBy.get(`${date}|${route}`) || []);
  const others = here.filter((c) => c.transporterId !== r.transporterId);
  const stopsFromOthers = others.reduce((a, c) => a + (c.completedStops || 0), 0);
  const routeTotalStops = Math.max(...here.map((c) => c.totalStops || 0), r.stopCount || 0, 0);
  const given = (providedBy.get(`${date}|${r.transporterId}`) || []).filter((c) => c.routeCode !== route);
  const stopsGiven = given.reduce((a, c) => a + (c.completedStops || 0), 0);
  const contribCovered = here.length > 0;
  const assisted = stopsFromOthers > 0 || (r.stopsRescued || 0) > 0;
  const assistSrc = stopsFromOthers > 0 ? "contribution records" : (r.stopsRescued || 0) > 0 ? "route.stopsRescued field" : "";

  // area
  const areas = (st?.areas || []).slice().sort((a, b) => (b.stops || 0) - (a.stops || 0));
  const area = areas[0] ? `${areas[0].city || ""} ${areas[0].zip || ""}`.trim() : "";

  // notes
  const tags = NOTE_TAGS.filter(([, re]) => re.test(r.notes || "")).map(([t]) => t);

  rows.push({
    date, week: weekOf(date), station: siteCode.get(String(r.siteId)) || "", routeId: route, driver: anon(r.transporterId), area, type: tname, training,
    wave: r.waveTime || "", plannedBlockMin: plannedBlock,
    signIn: r.appSignIn || "", plannedEnd: r.plannedEndTime || "", actDep: r.actualDepartureTime || "", plannedFirst: r.plannedFirstStop || "", actFirst: r.actualFirstStop || "",
    plannedLast: r.plannedLastStop || "", actLast: r.actualLastStop || "", actReturn: r.actualReturnTime || "", appLogout: r.amazonAppLogout || "",
    routeComplete, endSource, elapsedMin: elapsed, overPlannedMin: overPlanned, over10Min: over10,
    paidMin, paidSrc, otMin, breakMin, breakSrc,
    outboundMin: outbound, outboundSrc, plannedOutboundMin: pOut, deliveryMin: delivery, deliveryNetMin: deliveryNet, plannedDeliveryMin: planDelivery, returnMin: returnLeg, plannedInboundMin: pIn,
    stops: r.stopCount || 0, packages: r.packageCount || 0, stopsPerHour: r.stopsPerHour || 0,
    pickups: r.onRoadPickups || 0,
    contribCovered, assisted, assistSrc, stopsFromOthers, stopsGiven, routeTotalStops,
    stopsRescuedField: r.stopsRescued || 0, notDelivered: st?.notDelivered ?? "", pickupFailed: st?.pickupFailed ?? "",
    noteTags: tags.join("; "), noteExcerpt: tags.length ? redact(r.notes) : "",
    ref: `SYMXRoutes/${r._id}`, link: `${APP}/dispatching/efficiency (date ${date}, route ${route})`,
  });
}

const cohort = rows.filter((r) => !r.training);
const measurable = cohort.filter((r) => r.overPlannedMin !== null);
const measurable10 = cohort.filter((r) => r.over10Min !== null);

// ── aggregates ────────────────────────────────────────────────────────────
const overCount = (arr, key, thr = 0) => arr.filter((r) => r[key] > thr).length;
const weekly = weeks.map((w) => {
  const a = cohort.filter((r) => r.week === w.label), m = a.filter((r) => r.overPlannedMin !== null), m10 = a.filter((r) => r.over10Min !== null);
  const done = a.filter((r) => r.routeComplete);
  const asst = a.filter((r) => r.contribCovered || r.stopsRescuedField);
  return {
    week: w.label, start: w.start, end: w.end, routes: a.length, withEnd: m.length, over: overCount(m, "overPlannedMin"), overPct: pct(overCount(m, "overPlannedMin"), m.length),
    avgOver: avg(m.filter((r) => r.overPlannedMin > 0).map((r) => r.overPlannedMin)), over10: overCount(m10, "over10Min"), over10Pct: pct(overCount(m10, "over10Min"), m10.length), measurable10: m10.length,
    avgOutbound: avg(a.map((r) => r.outboundMin).filter((v) => v !== null)), avgDelivery: avg(a.map((r) => r.deliveryNetMin).filter((v) => v !== null)),
    avgReturn: avg(a.map((r) => r.returnMin).filter((v) => v !== null)), avgBreak: avg(a.map((r) => r.breakMin).filter((v) => v !== null)),
    assisted: a.filter((r) => r.assisted).length, assistedPct: pct(a.filter((r) => r.assisted).length, done.length), completeRoutes: done.length,
    stopsMoved: a.reduce((s, r) => s + r.stopsFromOthers, 0),
  };
});

const byArea = {};
for (const r of cohort) { if (!r.area) continue; (byArea[r.area] ||= []).push(r); }
const areaRows = Object.entries(byArea).map(([area, a]) => {
  const m = a.filter((r) => r.overPlannedMin !== null);
  const drivers = new Set(a.map((r) => r.driver)), overDrivers = new Set(m.filter((r) => r.overPlannedMin > 0).map((r) => r.driver));
  return { area, routes: a.length, measured: m.length, over: overCount(m, "overPlannedMin"), overPct: pct(overCount(m, "overPlannedMin"), m.length), drivers: drivers.size, driversOver: overDrivers.size, avgOutbound: avg(a.map((r) => r.outboundMin).filter((v) => v !== null)), avgOver: avg(m.map((r) => r.overPlannedMin)), assisted: a.filter((r) => r.assisted).length };
}).sort((a, b) => b.routes - a.routes);

const byWave = {};
for (const r of cohort) { if (r.wave) (byWave[r.wave] ||= []).push(r); }
const waveRows = Object.entries(byWave).map(([wave, a]) => { const m = a.filter((r) => r.overPlannedMin !== null); return { wave, routes: a.length, measured: m.length, overPct: pct(overCount(m, "overPlannedMin"), m.length), avgOver: avg(m.map((r) => r.overPlannedMin)), avgOutbound: avg(a.map((r) => r.outboundMin).filter((v) => v !== null)), avgStops: avg(a.map((r) => r.stops)) }; }).sort((a, b) => (clock(a.wave) ?? 0) - (clock(b.wave) ?? 0));

const waveMin = (r) => clock(r.wave);
const corr = {
  outbound: spearman(measurable.map((r) => r.overPlannedMin), measurable.map((r) => r.outboundMin)),
  wave: spearman(measurable.map((r) => r.overPlannedMin), measurable.map(waveMin)),
  stops: spearman(measurable.map((r) => r.overPlannedMin), measurable.map((r) => r.stops)),
  packages: spearman(measurable.map((r) => r.overPlannedMin), measurable.map((r) => r.packages)),
  plannedBlock: spearman(measurable.map((r) => r.overPlannedMin), measurable.map((r) => r.plannedBlockMin)),
};
const strength = (rho) => (rho === null ? "not computable" : Math.abs(rho) >= 0.5 ? "moderate-to-strong" : Math.abs(rho) >= 0.3 ? "moderate" : Math.abs(rho) >= 0.1 ? "weak" : "negligible");

const assistedM = measurable.filter((r) => r.assisted), unassistedM = measurable.filter((r) => !r.assisted);
const noteFlagged = cohort.filter((r) => r.noteTags);

// coverage
const nz = (arr, f) => arr.filter(f).length;
const coverage = [
  ["Routes in window (all types)", D.routes.length], ["Excluded: off / no data", excludedNonRoute], ["Excluded from analysis: training/shadow types", excludedTraining], ["Routes analysed (cohort)", cohort.length],
  ["…with planned end time", nz(cohort, (r) => r.plannedEnd)], ["…with app sign-in", nz(cohort, (r) => r.signIn)], ["…with end-of-shift (logout or return)", nz(cohort, (r) => r.endSource)],
  ["…measurable vs planned end", measurable.length], ["…measurable vs flat 10h", measurable10.length],
  ["…with actual departure", nz(cohort, (r) => r.actDep)], ["…with first delivery", nz(cohort, (r) => r.actFirst)], ["…with last delivery (route complete)", nz(cohort, (r) => r.routeComplete)], ["…with return to station", nz(cohort, (r) => r.actReturn)],
  ["…with Cortex outbound stem", nz(cohort, (r) => r.outboundSrc === "Cortex stem")], ["…with planned outbound stem", nz(cohort, (r) => r.plannedOutboundMin !== null)], ["…with planned inbound stem", nz(cohort, (r) => r.plannedInboundMin !== null)],
  ["…with break duration", nz(cohort, (r) => r.breakMin !== null)], ["…with paid time (payroll)", nz(cohort, (r) => r.paidMin)],
  ["…with rescue/contribution records (Cortex)", nz(cohort, (r) => r.contribCovered)], ["…with delivery-area data", nz(cohort, (r) => r.area)], ["…with undelivered counts", nz(cohort, (r) => r.notDelivered !== "")], ["…with any note keyword", noteFlagged.length],
  ["Contribution rows in window", D.contributions.length], ["Day-stat rows in window", D.dayStats.length],
];
const dayCoverage = {}; for (const r of cohort) { const d = (dayCoverage[r.date] ||= { n: 0, end: 0, contrib: 0, area: 0 }); d.n++; if (r.endSource) d.end++; if (r.contribCovered) d.contrib++; if (r.area) d.area++; }
const firstCortexDay = Object.keys(dayCoverage).filter((d) => dayCoverage[d].contrib || dayCoverage[d].area).sort()[0] || "none";

// ── five representative examples ──────────────────────────────────────────
const ex = [];
const ranked = [...measurable].filter((r) => r.outboundMin !== null && r.deliveryNetMin !== null).sort((a, b) => a.overPlannedMin - b.overPlannedMin);
const pick = (q, label) => { if (!ranked.length) return; const t = quant(ranked.map((r) => r.overPlannedMin), q); const r = ranked.reduce((b, x) => (Math.abs(x.overPlannedMin - t) < Math.abs(b.overPlannedMin - t) ? x : b), ranked[0]); if (!ex.find((e) => e.r === r)) ex.push({ label, r }); };
pick(0.1, "Finished early / on time (≈10th percentile)"); pick(0.25, "Lower-middle (≈25th percentile)"); pick(0.5, "Typical (median)"); pick(0.75, "Upper-middle (≈75th percentile)");
const worstAssist = [...ranked].filter((r) => r.assisted).sort((a, b) => b.overPlannedMin - a.overPlannedMin)[0] || ranked[ranked.length - 1];
if (worstAssist && !ex.find((e) => e.r === worstAssist)) ex.push({ label: "Longest overrun that still needed rescue help", r: worstAssist });
if (ex.length < 5 && ranked.length) { const w = ranked[ranked.length - 1]; if (!ex.find((e) => e.r === w)) ex.push({ label: "Longest overrun in window (shown for completeness)", r: w }); }

// ── charts (inline SVG) ───────────────────────────────────────────────────
const C = { blue: "#3b82f6", violet: "#8b5cf6", green: "#10b981", amber: "#f59e0b", red: "#ef4444", slate: "#64748b" };
function barChart({ title, subtitle, labels, series, unit = "", max, stacked = false }) {
  const W = 640, H = 280, L = 52, B = 40, T = 46, Rr = 16, pw = W - L - Rr, ph = H - T - B;
  const totals = labels.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map((s) => s.values[i] || 0))));
  const m = max || Math.max(1, ...totals) * 1.15; const gw = pw / labels.length;
  let g = `<text x="${L}" y="18" font-size="14" font-weight="700" fill="#e5e7eb">${esc(title)}</text><text x="${L}" y="34" font-size="10.5" fill="#94a3b8">${esc(subtitle)}</text>`;
  for (let k = 0; k <= 4; k++) { const y = T + ph - (ph * k) / 4; g += `<line x1="${L}" x2="${W - Rr}" y1="${y}" y2="${y}" stroke="#334155" stroke-opacity=".5"/><text x="${L - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${Math.round((m * k) / 4)}${unit}</text>`; }
  labels.forEach((lb, i) => {
    const x0 = L + i * gw + gw * 0.15, bw = stacked ? gw * 0.7 : (gw * 0.7) / series.length; let acc = 0;
    series.forEach((s, j) => { const v = s.values[i] || 0, h = (v / m) * ph; const x = stacked ? x0 : x0 + j * bw; const y = stacked ? T + ph - ((acc + v) / m) * ph : T + ph - h; g += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${Math.max(0, h)}" rx="3" fill="${s.color}"><title>${esc(s.name)} ${esc(lb)}: ${Math.round(v * 10) / 10}${unit}</title></rect>`; if (!stacked && v) g += `<text x="${x + (bw - 2) / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#e5e7eb">${Math.round(v)}${unit}</text>`; acc += v; });
    g += `<text x="${L + i * gw + gw / 2}" y="${H - 20}" text-anchor="middle" font-size="11" fill="#cbd5e1">${esc(lb)}</text>`;
  });
  g += series.map((s, j) => `<rect x="${L + j * 128}" y="${H - 11}" width="9" height="9" rx="2" fill="${s.color}"/><text x="${L + j * 128 + 13}" y="${H - 3}" font-size="10" fill="#94a3b8">${esc(s.name)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">${g}</svg>`;
}
const wl = weekly.map((w) => `${w.week}\n${w.start.slice(5)}`).map((s) => s.split("\n")[0] + " " + s.split("\n")[1]);
const chart1 = barChart({ title: "Routes finishing after their planned end", subtitle: "% of routes with a measurable end time (denominator shown in table)", labels: wl, unit: "%", max: 100, series: [{ name: "After planned end", color: C.red, values: weekly.map((w) => w.overPct || 0) }, { name: "Over flat 10h elapsed", color: C.amber, values: weekly.map((w) => w.over10Pct || 0) }] });
const chart2 = barChart({ title: "Where the time goes (average minutes per route)", subtitle: "Outbound (to first delivery) · delivery 1st→last net of break · return · break", labels: wl, unit: "m", stacked: true, series: [{ name: "Outbound", color: C.violet, values: weekly.map((w) => w.avgOutbound || 0) }, { name: "Delivery (net)", color: C.blue, values: weekly.map((w) => w.avgDelivery || 0) }, { name: "Return", color: C.green, values: weekly.map((w) => w.avgReturn || 0) }, { name: "Break", color: C.slate, values: weekly.map((w) => w.avgBreak || 0) }] });
const chart3 = barChart({ title: "Rescue dependence", subtitle: "% of completed routes that received help (where rescue data exists)", labels: wl, unit: "%", max: 100, series: [{ name: "Routes assisted", color: C.amber, values: weekly.map((w) => w.assistedPct || 0) }] });
const buckets = [["<0", -1e9, 0], ["0–15", 0, 15], ["15–30", 15, 30], ["30–60", 30, 60], ["60–90", 60, 90], ["90+", 90, 1e9]];
const hist = buckets.map(([l, a, b]) => ({ l, n: measurable.filter((r) => (l === "<0" ? r.overPlannedMin < 0 : r.overPlannedMin > a && r.overPlannedMin <= b)).length }));
const chart4 = barChart({ title: "How far past planned end (minutes)", subtitle: `Routes by overrun size · n=${measurable.length}`, labels: hist.map((h) => h.l), series: [{ name: "Routes", color: C.red, values: hist.map((h) => h.n) }] });

// ── text ─────────────────────────────────────────────────────────────────
const f1 = (v) => (v === null || v === undefined ? "n/a" : (Math.round(v * 10) / 10).toString());
const overAll = overCount(measurable, "overPlannedMin"), over10All = overCount(measurable10, "over10Min");
const overs = measurable.filter((r) => r.overPlannedMin > 0).map((r) => r.overPlannedMin);
const rescueRoutes = cohort.filter((r) => r.assisted);
const done = cohort.filter((r) => r.routeComplete);
const multiDriverAreas = areaRows.filter((a) => a.driversOver >= 2);
const stationName = D.station;
const windowTxt = `${D.window.start} to ${D.window.end} (4 complete Sun–Sat weeks)`;

const findings = [];
findings.push(`${overAll} of ${measurable.length} routes (${f1(pct(overAll, measurable.length))}%) ended after their Cortex planned end time; median overrun among those ${hm(quant(overs, 0.5))}, 90th percentile ${hm(quant(overs, 0.9))}. Denominator: analysed routes with both a planned end and an end-of-shift time (${measurable.length} of ${cohort.length}).`);
findings.push(`Against a flat 10-hour block (elapsed sign-in→end), ${over10All} of ${measurable10.length} routes (${f1(pct(over10All, measurable10.length))}%) ran over; median elapsed shift ${hm(quant(measurable10.map((r) => r.elapsedMin), 0.5))}.`);
const ob = avg(cohort.map((r) => r.outboundMin).filter((v) => v !== null)), pob = avg(cohort.map((r) => r.plannedOutboundMin).filter((v) => v !== null)), obBoth = cohort.filter((r) => r.outboundMin !== null && r.plannedOutboundMin !== null);
findings.push(`Outbound travel averaged ${hm(ob)} per route${obBoth.length ? `; where both exist (n=${obBoth.length}) actual outbound averaged ${hm(avg(obBoth.map((r) => r.outboundMin)))} versus ${hm(avg(obBoth.map((r) => r.plannedOutboundMin)))} planned (${hm(avg(obBoth.map((r) => r.outboundMin - r.plannedOutboundMin)))} difference).` : "; planned outbound data was missing for most routes, so it can't be compared to plan."}`);
const ibBoth = cohort.filter((r) => r.returnMin !== null && r.plannedInboundMin !== null);
if (ibBoth.length) findings.push(`Return travel (last delivery→back at station) averaged ${hm(avg(ibBoth.map((r) => r.returnMin)))} vs ${hm(avg(ibBoth.map((r) => r.plannedInboundMin)))} planned (n=${ibBoth.length}).`);
findings.push(rescueRoutes.length || D.contributions.length ? `${rescueRoutes.length} of ${done.length} completed routes (${f1(pct(rescueRoutes.length, done.length))}%) show help from another driver (${stats_contribNote()}); ${assistedM.length} of those are measurable and ${overCount(assistedM, "overPlannedMin")} (${f1(pct(overCount(assistedM, "overPlannedMin"), assistedM.length))}%) still ended after planned end, versus ${overCount(unassistedM, "overPlannedMin")} of ${unassistedM.length} (${f1(pct(overCount(unassistedM, "overPlannedMin"), unassistedM.length))}%) of routes without recorded help.` : "No rescue records were available in this window.");
function stats_contribNote() { return `${cohort.filter((r) => r.stopsFromOthers > 0).length} from Cortex contribution records, ${cohort.filter((r) => !r.stopsFromOthers && r.stopsRescuedField > 0).length} from the route's stopsRescued field only`; }
findings.push(`Association with overrun (Spearman, n=${corr.outbound.n}): outbound time ρ=${f1(corr.outbound.rho)} (${strength(corr.outbound.rho)}), wave time ρ=${f1(corr.wave.rho)} (${strength(corr.wave.rho)}), stops ρ=${f1(corr.stops.rho)} (${strength(corr.stops.rho)}), packages ρ=${f1(corr.packages.rho)} (${strength(corr.packages.rho)}). These are associations, not proof of cause. No mileage is stored, so distance is represented only by outbound time.`);
findings.push(multiDriverAreas.length ? `${multiDriverAreas.length} delivery area(s) had overruns from 2 or more different drivers (largest: ${multiDriverAreas.slice(0, 3).map((a) => `${a.area}: ${a.driversOver}/${a.drivers} drivers, ${a.over}/${a.measured} routes`).join("; ")}).` : `Delivery-area data exists only from ${firstCortexDay}; ${areaRows.length ? "no area showed overruns across 2+ drivers in that subset." : "area recurrence could not be tested."}`);
findings.push(`${noteFlagged.length} routes carry a note mentioning traffic, closures, access, unpaved roads, app or station delays (${NOTE_TAGS.map(([t]) => `${t}: ${cohort.filter((r) => r.noteTags.includes(t)).length}`).join(", ")}). Notes are dispatcher/driver free text and are driver-reported, not verified.`);

const limits = [
  "Mileage and per-stop locations are not stored in the app, so distance can't be measured directly; outbound time is used as a proxy.",
  "Undelivered-package reasons are not stored (only counts, where Cortex data exists).",
  `Rescue/contribution and delivery-area data only exist from ${firstCortexDay}; earlier days rely on the route's stopsRescued field.`,
  "Actual last stop is only recorded once a route is complete; routes still open or with missing logout/return times are excluded from overrun calculations.",
  "First delivery is used as a proxy for arrival in the delivery area (it may include loading/prep before the first stop).",
  "Elapsed shift time includes breaks; paid work time comes from payroll and excludes the lunch.",
  "Overtime or overrun does not by itself qualify for UPD — that depends on Amazon-caused delay and documented authorization.",
];
const missing = [
  "Odometer or GPS mileage per route (to test the claim of furthest travel distance).",
  "Per-stop timestamps and anonymised stop coordinates (to measure time in the delivery area and drive time between stops).",
  "Undelivered/attempted-not-delivered packages with Amazon reason codes.",
  "Documented delay reasons per route (traffic, closures, wildfire/landslide detours, station load delays) with timestamps and who reported them.",
  "Wave start times and station load-out completion times for every wave, to compare against closer areas and earlier waves.",
  "Amazon's planned route duration/block assumptions per route and any route-plan changes made after dispatch.",
  "Rescue authorisation (Amazon rep name/time) and the stops/packages each rescue moved.",
  "Earlier weeks of Cortex contribution and area data (the app only started storing these recently).",
];

// ── write files ───────────────────────────────────────────────────────────
const csv = (arr, cols) => [cols.join(","), ...arr.map((r) => cols.map((c) => { const v = r[c]; const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))].join("\n");
const routeCols = Object.keys(rows[0] || { date: 1 });
fs.writeFileSync(path.join(OUT, "routes.csv"), csv(rows, routeCols));
fs.writeFileSync(path.join(OUT, "weekly.csv"), csv(weekly, Object.keys(weekly[0])));
fs.writeFileSync(path.join(OUT, "areas.csv"), csv(areaRows, Object.keys(areaRows[0] || { area: 1 })));
fs.writeFileSync(path.join(OUT, "coverage.csv"), csv(coverage.map(([k, v]) => ({ metric: k, value: v })), ["metric", "value"]));

const pctOverArea = areaRows.filter((a) => a.measured >= 3).sort((a, b) => (b.overPct ?? 0) - (a.overPct ?? 0)).slice(0, 5);
const escalation = `Subject: Request to review dispatch timing, travel-time assumptions and route workload — ${stationName}, ${D.window.start} to ${D.window.end}

Hi [OTR contact] and [Business Coach],

I'd like to ask for a review of dispatch timing, planned travel time and route workload for our ${stationName} routes in the Santa Cruz Mountains. I reviewed our own delivery records for ${windowTxt} so this request rests on data rather than impressions. Definitions and limitations are in the attached report.

What the records show (calculated from our app's Cortex-synced records):
• ${overAll} of ${measurable.length} analysed routes (${f1(pct(overAll, measurable.length))}%) finished after the Cortex planned end time; the median overrun among those was ${hm(quant(overs, 0.5))} and the 90th percentile ${hm(quant(overs, 0.9))}. ${measurable.length < cohort.length ? `${cohort.length - measurable.length} routes lacked a planned end or end-of-shift time and are excluded.` : ""}
• Measured against a flat 10-hour block, ${over10All} of ${measurable10.length} routes (${f1(pct(over10All, measurable10.length))}%) exceeded it.
${obBoth.length ? `• Where both exist (n=${obBoth.length}), outbound travel averaged ${hm(avg(obBoth.map((r) => r.outboundMin)))} versus ${hm(avg(obBoth.map((r) => r.plannedOutboundMin)))} planned.` : "• Planned outbound times were not available for most routes, so I can't yet compare travel to plan."}
${rescueRoutes.length ? `• ${rescueRoutes.length} of ${done.length} completed routes (${f1(pct(rescueRoutes.length, done.length))}%) were completed with help from another driver.` : ""}
${multiDriverAreas.length ? `• Overruns recurred across different drivers in ${multiDriverAreas.length} delivery area(s), which points toward the route/area rather than individual drivers — see the area table.` : ""}
• Associations (not proof of cause): overrun vs outbound time ρ=${f1(corr.outbound.rho)}, vs wave time ρ=${f1(corr.wave.rho)}, vs stop count ρ=${f1(corr.stops.rho)} (n=${corr.outbound.n}).

What I'm asking for:
1. A review of whether the planned outbound/return travel time and the 10-hour block assumption fit these routes, using the attached route-by-route evidence.
2. A review of whether our dispatch wave and station departure timing contribute, compared with closer areas / earlier waves if you have that data.
3. A review of route workload (stops/packages per block) for the areas listed.
4. Guidance on what additional documentation would help (e.g. mileage, delay reasons, rescue authorisations).

I'm not asserting that any delay was Amazon-caused, and I understand overtime alone doesn't establish UPD; I'm asking that the planning assumptions be reviewed against the data. Limitations: mileage and per-stop locations aren't in our records, first delivery is a proxy for arrival in the area, and rescue/area data only covers recent days.

Happy to walk through the examples on a call.

Thank you,
[Name]
[DSP]
`;
fs.writeFileSync(path.join(OUT, "escalation.md"), escalation);

const tbl = (head, body) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Route overrun evidence — ${esc(stationName)}</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,Inter,sans-serif;background:#0b1220;color:#e5e7eb;max-width:1100px;margin:32px auto;padding:0 20px}h1{font-size:26px}h2{margin-top:34px;border-bottom:1px solid #1f2a44;padding-bottom:6px}h3{margin-top:18px}.card{background:#111a2e;border:1px solid #1f2a44;border-radius:12px;padding:16px;margin:12px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}svg{width:100%;height:auto;background:#111a2e;border:1px solid #1f2a44;border-radius:12px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:5px 8px;border-bottom:1px solid #1f2a44;text-align:left;white-space:nowrap}th{color:#94a3b8;font-size:10.5px;text-transform:uppercase;position:sticky;top:0;background:#0b1220}.sc{overflow:auto;max-height:560px;border:1px solid #1f2a44;border-radius:10px}.tag{font-size:10.5px;padding:1px 7px;border-radius:99px;margin-right:4px}.fact{background:#10b98122;color:#6ee7b7}.calc{background:#3b82f622;color:#93c5fd}.drv{background:#f59e0b22;color:#fcd34d}.hyp{background:#8b5cf622;color:#c4b5fd}.red{color:#f87171}.muted{color:#94a3b8}li{margin:4px 0}code{background:#1f2a44;padding:1px 5px;border-radius:4px}@media print{body{background:#fff;color:#111}.card,svg{background:#fff}}</style></head><body>
<h1>Route overrun evidence report — ${esc(stationName)}</h1>
<p class="muted">Window: ${esc(windowTxt)}. Generated from read-only exports of the SYMX app. Driver IDs are anonymised (salt kept local). No customer names, addresses or phone numbers are included.</p>

<h2>Executive summary</h2><div class="card"><ul>${findings.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<p><b>Strongest limitations:</b></p><ul>${limits.slice(0, 4).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p class="muted">Evidence labels: <span class="tag fact">documented</span> recorded by Cortex/Paycom/the app · <span class="tag calc">calculated</span> derived here · <span class="tag drv">driver-reported</span> free-text notes · <span class="tag hyp">hypothesis</span> not tested by these records.</p></div>

<h2>Definitions</h2><div class="card"><ul>
<li><span class="tag fact">documented</span><b>Planned end</b> = Cortex <code>scheduleEndTime</code> (plannedEndTime). <b>Planned block</b> = planned end − app sign-in.</li>
<li><span class="tag calc">calculated</span><b>End of shift</b> = Amazon app logout if present, else return to station (source shown per route). <b>Elapsed shift time</b> = end of shift − app sign-in, <u>includes breaks</u>.</li>
<li><b>Overrun vs planned end</b> = end of shift − planned end (positive = late). % = routes with overrun &gt; 0 ÷ routes with both timestamps. <b>Over 10h</b> = elapsed &gt; 10:00, same style denominator.</li>
<li><b>Paid work time</b> = payroll total hours (or Paycom in/out minus lunch) — separate from elapsed time and from delivery time. Shown where payroll data exists.</li>
<li><b>Delivery time</b> = first delivery → last delivery, with the Amazon-app meal break subtracted when it falls inside that span. Breaks are otherwise part of elapsed time.</li>
<li><b>Outbound</b> = Cortex outbound stem when present; otherwise departure → first delivery (<b>proxy</b> for arrival in the area). <b>Return</b> = last delivery → back at station.</li>
<li><b>Assisted</b> = another driver completed stops on this route (Cortex contribution records) or the route's <code>stopsRescued</code> field &gt; 0 (source shown). Assisted and unassisted routes are always reported separately.</li>
<li>Overlapping delay periods are never summed: phases are consecutive clock segments and overrun is a single end-vs-plan difference.</li>
<li>Training/shadow types (${excludedTraining} routes) are excluded from the analysis cohort; off/no-data records (${excludedNonRoute}) are excluded.</li></ul></div>

<h2>Weekly totals</h2><div class="grid">${chart1}${chart2}${chart3}${chart4}</div>
<div class="sc" style="margin-top:12px">${tbl(["Week", "Dates", "Routes", "Measurable", "After planned end", "% (of measurable)", "Avg overrun of late (min)", "Over 10h", "% (of measurable)", "Avg outbound", "Avg delivery net", "Avg return", "Assisted", "% of completed", "Stops moved"], weekly.map((w) => [w.week, `${w.start} → ${w.end}`, w.routes, w.withEnd, w.over, f1(w.overPct), f1(w.avgOver), w.over10, f1(w.over10Pct), hm(w.avgOutbound), hm(w.avgDelivery), hm(w.avgReturn), w.assisted, f1(w.assistedPct), w.stopsMoved]))}</div>

<h2>Recurrence by delivery area</h2><p class="muted">Area = highest-stop ZIP/city per route (Cortex address data; available from ${esc(firstCortexDay)}). Distinct drivers shown to test whether overruns follow the area rather than the person. Small counts — treat as indicative.</p>
<div class="sc">${tbl(["Area", "Routes", "Measured", "Over", "% over", "Drivers", "Drivers with overrun", "Avg outbound", "Avg overrun (min)", "Assisted"], areaRows.map((a) => [esc(a.area), a.routes, a.measured, a.over, f1(a.overPct), a.drivers, a.driversOver, hm(a.avgOutbound), f1(a.avgOver), a.assisted]))}</div>

<h2>Dispatch wave comparison</h2><p class="muted">Only valid if waves served comparable areas; comparison alone cannot show wave causes overruns.</p>
<div class="sc">${tbl(["Wave", "Routes", "Measured", "% after planned end", "Avg overrun (min)", "Avg outbound", "Avg stops"], waveRows.map((w) => [esc(w.wave), w.routes, w.measured, f1(w.overPct), f1(w.avgOver), hm(w.avgOutbound), f1(w.avgStops)]))}</div>

<h2>Assisted vs unassisted routes</h2><div class="card">${tbl(["Group", "Routes measurable", "After planned end", "%", "Median overrun (min)"], [["Received help", assistedM.length, overCount(assistedM, "overPlannedMin"), f1(pct(overCount(assistedM, "overPlannedMin"), assistedM.length)), f1(quant(assistedM.map((r) => r.overPlannedMin), 0.5))], ["No recorded help", unassistedM.length, overCount(unassistedM, "overPlannedMin"), f1(pct(overCount(unassistedM, "overPlannedMin"), unassistedM.length)), f1(quant(unassistedM.map((r) => r.overPlannedMin), 0.5))]])}<p class="muted">Routes where the help was recorded only after the fact (or not synced) count as "no recorded help" — this may understate assistance before ${esc(firstCortexDay)}.</p></div>

<h2>Five representative examples</h2>${ex.map(({ label, r }) => `<div class="card"><h3>${esc(label)}</h3><p><b>${r.date}</b> · route ${esc(r.routeId)} · ${r.driver} · ${esc(r.area || "area n/a")} · wave ${esc(r.wave)} · ${r.stops} stops / ${r.packages} packages · <span class="${r.overPlannedMin > 0 ? "red" : ""}">${hm(r.overPlannedMin)} vs planned end</span></p>
<p class="muted">Sign-in ${esc(r.signIn)} → depart ${esc(r.actDep)} → 1st ${esc(r.actFirst)} → last ${esc(r.actLast)} → return ${esc(r.actReturn)}${r.appLogout ? ` → logout ${esc(r.appLogout)}` : ""} (planned end ${esc(r.plannedEnd)}).</p>
<p>Outbound ${hm(r.outboundMin)} (${esc(r.outboundSrc)}; planned ${hm(r.plannedOutboundMin) || "n/a"}) · delivery ${hm(r.deliveryNetMin)} · return ${hm(r.returnMin)} · break ${hm(r.breakMin) || "n/a"} (${esc(r.breakSrc || "n/a")}) · elapsed ${hm(r.elapsedMin)} · paid ${hm(r.paidMin) || "n/a"}. ${r.assisted ? `<b>Received help</b> (${esc(r.assistSrc)}; ${r.stopsFromOthers} stops by others).` : "No recorded help."} ${r.noteTags ? `Notes mention: ${esc(r.noteTags)}.` : ""}</p><p class="muted">Record: ${esc(r.ref)}</p></div>`).join("")}

<h2>Route-by-route evidence</h2><p class="muted">${cohort.length} routes. Full detail, including all timestamps, is in <code>routes.csv</code>. Record reference = SYMXRoutes document id.</p>
<div class="sc">${tbl(["Date", "Route", "Driver", "Area", "Wave", "Planned block", "Elapsed", "vs planned end", "vs 10h", "Outbound (planned)", "Delivery", "Return", "Break", "Paid", "Stops/Pkgs", "Help", "Notes", "Record"], cohort.sort((a, b) => a.date.localeCompare(b.date) || a.routeId.localeCompare(b.routeId, undefined, { numeric: true })).map((r) => [r.date, esc(r.routeId), r.driver, esc(r.area), esc(r.wave), hm(r.plannedBlockMin), hm(r.elapsedMin), `<span class="${r.overPlannedMin > 0 ? "red" : ""}">${hm(r.overPlannedMin)}</span>`, hm(r.over10Min), `${hm(r.outboundMin)} (${hm(r.plannedOutboundMin) || "–"})${r.outboundSrc.includes("proxy") ? "*" : ""}`, hm(r.deliveryNetMin), hm(r.returnMin), hm(r.breakMin), hm(r.paidMin), `${r.stops}/${r.packages}`, r.assisted ? `Yes (${r.stopsFromOthers})` : r.contribCovered ? "No" : "n/a", esc(r.noteTags), esc(r.ref)]))}</div><p class="muted">* proxy: departure → first delivery.</p>

<h2>Data coverage</h2><div class="card">${tbl(["Metric", "Count"], coverage.map(([k, v]) => [esc(k), v]))}</div>
<h2>Limitations</h2><ul>${limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<h2>Missing information that would strengthen the analysis</h2><ul>${missing.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<h2>Draft escalation</h2><div class="card"><pre style="white-space:pre-wrap;font:13px/1.55 inherit">${esc(escalation)}</pre></div>
</body></html>`;
fs.writeFileSync(path.join(OUT, "report.html"), html);
console.log(`Cohort ${cohort.length} routes · measurable ${measurable.length} · over planned end ${overAll}`);
console.log("Wrote: report.html, routes.csv, weekly.csv, areas.csv, coverage.csv, escalation.md in scripts/otr-report/out/");
