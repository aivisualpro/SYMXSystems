/**
 * Invoice audit: compares what Amazon BILLED with what SYMX CAPTURED.
 * Every finding is a "possible" issue — a prompt to look, never an automatic dispute.
 *
 *  route_count     billed route blocks per day  vs  distinct routes Cortex shows delivered
 *  rescue_unbilled hand-offs (a route covered by other drivers) vs rescue blocks billed
 *  upd_candidate   departures 15+ min late vs delay hours billed (only paid if Amazon caused it)
 *  package_count   billed deliveries for the week vs Cortex completed deliveries
 *  pickup_count    billed pickups vs on-road pickups captured
 *  rate_change     a service type billed at a different rate than usual at that station
 */
import mongoose from "mongoose";
import RouteContribution from "@/lib/models/RouteContribution";
import SYMXRoute from "@/lib/models/SYMXRoute";
import PaymentInvoice from "@/lib/models/PaymentInvoice";

export interface AuditFinding {
  key: string; kind: string; direction: "under" | "over" | "info"; severity: "high" | "review" | "info";
  date: string; title: string; detail: string; billed?: number; expected?: number; unitRate?: number; amount: number;
}

const num = (v: any): number => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "Sep 27, 2026" or "Thu, Oct 01" -> YYYY-MM-DD (year inferred from the invoice period). */
export function labelToIso(label: string, periodStart: string): string {
  const m = String(label || "").match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2})(?:,\s*(\d{4}))?/);
  if (!m) return "";
  const mon = MONTHS[m[1].toLowerCase()];
  if (!mon) return "";
  let year = m[3] ? Number(m[3]) : Number(periodStart.slice(0, 4)) || new Date().getFullYear();
  if (!m[3] && periodStart) {
    const startMon = Number(periodStart.slice(5, 7));
    if (mon < startMon - 6) year += 1; // period crosses new year
  }
  return `${year}-${String(mon).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

const table = (tables: any[], heading: string) => (tables || []).find((t) => t.heading === heading);
const allLines = (t: any): string[][] => (t?.rows || []).flatMap((r: any) => r.lines || []);

/** Parsed view of a variable (weekly) invoice — also used by the UI. */
export function parseVariable(inv: any) {
  const start = inv.periodStart || "";
  const routesT = table(inv.tables, "routes");
  const days = (routesT?.rows || []).map((r: any) => {
    const g = r.group || [];
    const date = labelToIso(g[0], start);
    const lines = (r.lines || []).map((c: string[]) => ({ serviceType: c[0], qty: num(c[1]), rate: num(c[2]), amount: num(c[3]) }));
    return { date, label: g[0], count: num(g[1]) || lines.reduce((a: number, l: any) => a + l.qty, 0), amount: num(g[3]) || lines.reduce((a: number, l: any) => a + l.amount, 0), lines };
  });
  const dated = (heading: string) => allLines(table(inv.tables, heading)).map((c) => ({ type: c[0], date: labelToIso(c[1], start), qty: num(c[2]), rate: num(c[3]), amount: num(c[4]) }));
  const pk = allLines(table(inv.tables, "packages")).map((c) => ({ desc: c[0], qty: num(c[1]), rate: num(c[2]), amount: num(c[3]) }));
  return {
    days,
    training: dated("training sessions"),
    lateCancels: dated("late cancellations"),
    upd: dated("unplanned delay"),
    rescue: dated("rescue"),
    packages: pk,
    deliveries: pk.filter((p) => /per piece payment - deliveries/i.test(p.desc)).reduce((a, p) => a + p.qty, 0),
    pickups: pk.filter((p) => /pickups/i.test(p.desc)).reduce((a, p) => a + p.qty, 0),
    pickupAmount: pk.filter((p) => /pickups/i.test(p.desc)).reduce((a, p) => a + p.amount, 0),
    deliveryRate: (pk.find((p) => /per piece payment - deliveries/i.test(p.desc))?.rate) || 0,
  };
}

const parseMin = (s: any): number | null => {
  const m = String(s ?? "").trim().match(/^(-)?(\d+):(\d{2})/);
  if (!m) return null;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] ? -v : v;
};

export async function auditInvoice(inv: any): Promise<{ findings: AuditFinding[]; coverage: any }> {
  const findings: AuditFinding[] = [];
  const coverage: any = {};
  const push = (f: Omit<AuditFinding, "key"> & { suffix?: string }) => {
    const { suffix, ...rest } = f as any;
    findings.push({ key: `${inv.batchId}|${f.kind}|${f.date || "all"}${suffix ? "|" + suffix : ""}`, ...rest });
  };

  // ── Rate drift applies to every invoice that lists rates ──
  try {
    const mine = parseVariable(inv);
    const recent = await PaymentInvoice.find({ siteId: inv.siteId, type: inv.type, batchId: { $ne: inv.batchId }, hasDetail: true }, { tables: 1, periodStart: 1 }).sort({ invoiceDate: -1 }).limit(12).lean() as any[];
    const history = new Map<string, number[]>();
    recent.forEach((r) => parseVariable(r).days.forEach((d: any) => d.lines.forEach((l: any) => { if (l.rate > 0) (history.get(l.serviceType) || history.set(l.serviceType, []).get(l.serviceType)!).push(l.rate); })));
    const seen = new Set<string>();
    mine.days.forEach((d: any) => d.lines.forEach((l: any) => {
      const h = history.get(l.serviceType);
      if (!h || h.length < 3 || seen.has(l.serviceType) || l.rate <= 0) return;
      const mode = [...h].sort((a, b) => h.filter((x) => x === b).length - h.filter((x) => x === a).length)[0];
      if (Math.abs(mode - l.rate) > 0.009) {
        seen.add(l.serviceType);
        const qty = mine.days.reduce((a: number, dd: any) => a + dd.lines.filter((x: any) => x.serviceType === l.serviceType && x.rate === l.rate).reduce((q: number, x: any) => q + x.qty, 0), 0);
        const diff = round2((mode - l.rate) * qty);
        push({ kind: "rate_change", direction: diff > 0 ? "under" : "info", severity: diff > 0 ? "high" : "info", date: "", suffix: l.serviceType,
          title: `Rate changed: ${l.serviceType}`,
          detail: `Billed at $${l.rate.toFixed(2)} but this station is usually billed $${mode.toFixed(2)} for this service. Check your rate card / contract before accepting.`,
          billed: l.rate, expected: mode, unitRate: mode, amount: Math.abs(diff) });
      }
    }));
  } catch { /* history is best-effort */ }

  if (inv.type !== "SERVICE_PROVIDED" || !inv.periodStart || !inv.periodEnd) return { findings, coverage };

  const v = parseVariable(inv);
  const siteId = new mongoose.Types.ObjectId(String(inv.siteId));
  const dates: string[] = [];
  for (let d = new Date(inv.periodStart + "T12:00:00Z"); d.toISOString().slice(0, 10) <= inv.periodEnd; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));

  const contrib = await RouteContribution.find({ siteId, date: { $gte: inv.periodStart, $lte: inv.periodEnd } }).lean() as any[];
  const routeDocs = await SYMXRoute.find(
    { siteId, date: { $gte: new Date(inv.periodStart + "T00:00:00.000Z"), $lte: new Date(inv.periodEnd + "T00:00:00.000Z") } },
    { date: 1, routeNumber: 1, transporterId: 1, departureDelay: 1, onRoadPickupsDone: 1, employeeName: 1, stopCount: 1 }
  ).lean() as any[];

  const byDay = new Map<string, any[]>();
  contrib.forEach((c) => (byDay.get(c.date) || byDay.set(c.date, []).get(c.date)!).push(c));
  const daysWithCortex = dates.filter((d) => (byDay.get(d) || []).length > 0);
  coverage.daysTotal = dates.length;
  coverage.daysWithCortex = daysWithCortex.length;
  coverage.complete = daysWithCortex.length === dates.length;

  // ── 1. Route counts ──
  for (const day of v.days) {
    if (!day.date || !byDay.has(day.date)) continue;
    const ours = new Set((byDay.get(day.date) || []).filter((c) => (c.completedDeliveries || 0) > 0 || (c.completedStops || 0) > 0).map((c) => String(c.routeCode).toUpperCase())).size;
    const billed = day.count;
    if (ours === billed) continue;
    const avg = billed ? day.amount / billed : (v.days[0]?.lines[0]?.rate || 0);
    const diff = ours - billed;
    push({ kind: "route_count", direction: diff > 0 ? "under" : "over", severity: diff > 0 ? "high" : "info", date: day.date,
      title: diff > 0 ? `${diff} route${diff > 1 ? "s" : ""} may be unbilled` : `Billed ${-diff} more route${-diff > 1 ? "s" : ""} than Cortex shows`,
      detail: diff > 0
        ? `Cortex shows ${ours} routes delivered but the invoice bills ${billed}. If these were real services, request a change in the Work Summary Tool (within 2–3 days) or dispute within the 14-day window.`
        : `The invoice bills ${billed} routes but Cortex shows ${ours}. Usually harmless (e.g. a cancelled route paid as a late cancel), but confirm so it isn't clawed back later.`,
      billed, expected: ours, unitRate: round2(avg), amount: round2(Math.abs(diff) * avg) });
  }

  // ── 2. Rescues: routes finished by more than one driver vs rescue blocks billed ──
  const owner = new Map<string, string>();
  routeDocs.forEach((r) => { if (r.routeNumber && r.transporterId) owner.set(`${new Date(r.date).toISOString().slice(0, 10)}|${String(r.routeNumber).toUpperCase()}`, String(r.transporterId).toUpperCase()); });
  const rescueRate = v.rescue.find((r) => r.rate > 0)?.rate || 0;
  for (const date of daysWithCortex) {
    const rows = byDay.get(date) || [];
    const byRoute = new Map<string, any[]>();
    rows.forEach((c) => (byRoute.get(String(c.routeCode).toUpperCase()) || byRoute.set(String(c.routeCode).toUpperCase(), []).get(String(c.routeCode).toUpperCase())!).push(c));
    let handoffs = 0;
    for (const [code, list] of byRoute) {
      const own = owner.get(`${date}|${code}`) || String([...list].sort((a, b) => (b.completedDeliveries || 0) - (a.completedDeliveries || 0))[0].transporterId).toUpperCase();
      if (list.some((c) => String(c.transporterId).toUpperCase() !== own && (c.completedDeliveries || 0) > 0)) handoffs++;
    }
    const billed = v.rescue.filter((r) => r.date === date).reduce((a, r) => a + r.qty, 0);
    if (handoffs > billed) {
      const diff = handoffs - billed;
      push({ kind: "rescue_unbilled", direction: "under", severity: "review", date,
        title: `${diff} possible unbilled rescue${diff > 1 ? "s" : ""}`,
        detail: `${handoffs} route${handoffs > 1 ? "s were" : " was"} finished by more than one driver, but only ${billed} rescue block${billed === 1 ? " is" : "s are"} billed. Rescues are only paid when an Amazon rep authorized them — confirm with the station before disputing.`,
        billed, expected: handoffs, unitRate: rescueRate, amount: round2(diff * rescueRate) });
    }
  }

  // ── 3. Late departures (delay payment candidates) ──
  const lateByDay = new Map<string, { n: number; minutes: number }>();
  routeDocs.forEach((r) => {
    const m = parseMin(r.departureDelay);
    if (m === null || m < 15) return;
    const d = new Date(r.date).toISOString().slice(0, 10);
    const cur = lateByDay.get(d) || { n: 0, minutes: 0 };
    cur.n++; cur.minutes += m; lateByDay.set(d, cur);
  });
  const updRate = v.upd.find((u) => u.rate > 0)?.rate || 0;
  const updBilledHours = v.upd.reduce((a, u) => a + u.qty, 0);
  const lateTotal = [...lateByDay.values()].reduce((a, x) => a + x.minutes, 0);
  if (lateByDay.size && lateTotal / 60 > updBilledHours + 0.25) {
    const cand = lateTotal / 60;
    push({ kind: "upd_candidate", direction: "under", severity: "review", date: "",
      title: `${[...lateByDay.values()].reduce((a, x) => a + x.n, 0)} departures were 15+ minutes late`,
      detail: `Together they were ${(cand).toFixed(1)} hours late; only ${updBilledHours.toFixed(2)} hours of delay are billed. A delay payment is owed only when Amazon caused it (e.g. late trucks, late loads). Check why each left late; for eligible ones request a delay payment with the route ID and reason code.`,
      billed: round2(updBilledHours), expected: round2(cand), unitRate: updRate, amount: round2((cand - updBilledHours) * updRate) });
  }

  // ── 4. Package counts (weekly) ──
  const cortexDeliveries = contrib.reduce((a, c) => a + (c.completedDeliveries || 0), 0);
  if (v.deliveries > 0 && coverage.complete && cortexDeliveries > 0) {
    const diff = cortexDeliveries - v.deliveries;
    const pct = Math.abs(diff) / v.deliveries;
    if (pct > 0.01) {
      push({ kind: "package_count", direction: diff > 0 ? "under" : "over", severity: diff > 0 && pct > 0.02 ? "review" : "info", date: "",
        title: diff > 0 ? `Billed ${diff} fewer deliveries than Cortex shows` : `Billed ${-diff} more deliveries than Cortex shows`,
        detail: `Amazon says per-piece deliveries are about 99.9% accurate, so a gap over 1% (${(pct * 100).toFixed(1)}%) is worth a look. Station operations cannot edit this number; they can file a trouble ticket.`,
        billed: v.deliveries, expected: cortexDeliveries, unitRate: v.deliveryRate, amount: round2(Math.abs(diff) * v.deliveryRate) });
    }
  }

  // ── 5. Pickups ──
  const ourPickups = routeDocs.reduce((a, r) => a + (r.onRoadPickupsDone || 0), 0);
  if (ourPickups > 0 && ourPickups !== v.pickups) {
    const diff = ourPickups - v.pickups;
    const rate = v.pickups ? v.pickupAmount / v.pickups : 0.1;
    push({ kind: "pickup_count", direction: diff > 0 ? "under" : "over", severity: diff > 0 ? "review" : "info", date: "",
      title: `Pickups: billed ${v.pickups}, captured ${ourPickups}`,
      detail: "Customer pickups (returns) are paid per piece. Our count only includes pickups captured since the extension started recording them.",
      billed: v.pickups, expected: ourPickups, unitRate: round2(rate), amount: round2(Math.abs(diff) * rate) });
  }

  return { findings, coverage };
}
