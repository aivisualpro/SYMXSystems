"use client";

// ═══════════════════════════════════════════════════════════════════════
//  EFFICIENCY — PROTOTYPE (efficiency-v2)
// ═══════════════════════════════════════════════════════════════════════
//
// Reachable only by direct URL (/dispatching/efficiency-v2); not in the tab
// bar. Reads the same shared route data as the live page and saves through
// the same PUT endpoint — only the DCT field is editable here. Nothing on
// the live /dispatching/efficiency page is touched.
//
// Dispatcher questions this answers, in order:
//   1. How is the station doing?                  -> summary strip
//   2. Who do I need to call / coach right now?   -> "Needs attention" queue
//   3. Where exactly did a driver lose time?      -> driver drawer timeline
//   4. I still need every number                  -> "Full table" tab
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDispatching } from "../_components/dispatching-context";
import { parseTime, fmtDur, fmtTime } from "../routes/_components/routes-utils";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { Loader2, AlertTriangle, CheckCircle2, Clock, Gauge, LifeBuoy, Users, Truck, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

// ── Thresholds (minutes / percent). Tune here. ──
const T = {
    depAmber: 6, depRed: 15,
    lastAmber: 45, lastRed: 105,      // red matches the live page's 1:45 alert
    dctRed: 5,
    effRed: 85, effAmber: 100,
};

interface Row {
    id: string; name: string; route: string; stops: number; duration: string;
    wave: string; appIn: string; plannedEnd: string;
    actDep: string; depDelay: string; planOB: string; actOB: string; obDelay: string;
    planFirst: string; actFirst: string; firstDelay: string;
    planLast: string; actLast: string; lastDelay: string;
    planRTS: string; estRTS: string; planIB: string;
    plan1L: string; act1L: string; sph: number;
    dct: string; dctDelay: string; rescued: number; eff: number; type: string; date: string;
    conflicts: number;
}

type Level = "ok" | "warn" | "bad" | "none";
interface Flag { label: string; level: Exclude<Level, "ok" | "none">; weight: number }

const mins = (s: string) => parseTime(s || "");
const clock = (s: string) => { const m = mins(s); return m === null ? "—" : fmtTime(m); };
const dur = (s: string) => (s ? s : "—");

function depLevel(r: Row): Level { const m = mins(r.depDelay); if (m === null) return "none"; return m >= T.depRed ? "bad" : m >= T.depAmber ? "warn" : "ok"; }
function lastLevel(r: Row): Level { const m = mins(r.lastDelay); if (m === null) return "none"; return m >= T.lastRed ? "bad" : m >= T.lastAmber ? "warn" : "ok"; }
function effLevel(r: Row): Level { if (!r.eff) return "none"; return r.eff < T.effRed ? "bad" : r.eff < T.effAmber ? "warn" : "ok"; }

function status(r: Row): { label: string; tone: string } {
    if (r.actLast && r.dct) return { label: "Finished", tone: "bg-emerald-500/15 text-emerald-400" };
    if (r.actLast) return { label: "Last stop done", tone: "bg-sky-500/15 text-sky-400" };
    if (r.actFirst) return { label: "Delivering", tone: "bg-blue-500/15 text-blue-400" };
    if (r.actDep) return { label: "Departed", tone: "bg-indigo-500/15 text-indigo-400" };
    return { label: "Not departed", tone: "bg-zinc-500/15 text-zinc-400" };
}

function flagsFor(r: Row): Flag[] {
    const f: Flag[] = [];
    const d = mins(r.depDelay);
    if (d !== null && d >= T.depRed) f.push({ label: `Left ${fmtDur(d)} late`, level: "bad", weight: 3 });
    else if (d !== null && d >= T.depAmber) f.push({ label: `Left ${fmtDur(d)} late`, level: "warn", weight: 1 });
    const l = mins(r.lastDelay);
    if (l !== null && l >= T.lastRed) f.push({ label: `Last stop ${fmtDur(l)} behind`, level: "bad", weight: 4 });
    else if (l !== null && l >= T.lastAmber) f.push({ label: `Last stop ${fmtDur(l)} behind`, level: "warn", weight: 2 });
    const dc = mins(r.dctDelay);
    if (dc !== null && dc >= T.dctRed) f.push({ label: `Called in ${fmtDur(dc)} after last stop`, level: "bad", weight: 2 });
    if (r.eff && r.eff < T.effRed) f.push({ label: `Efficiency ${r.eff}%`, level: "bad", weight: 3 });
    if (r.actLast && !r.dct) f.push({ label: "Needs DCT", level: "warn", weight: 1 });
    if (r.conflicts > 0) f.push({ label: `${r.conflicts} data conflict${r.conflicts > 1 ? "s" : ""}`, level: "warn", weight: 1 });
    return f;
}
const score = (r: Row) => flagsFor(r).reduce((a, f) => a + f.weight, 0);

const chipTone: Record<Level, string> = {
    ok: "text-emerald-400", warn: "text-amber-400", bad: "text-red-400", none: "text-muted-foreground/50",
};
const barTone: Record<Level, string> = {
    ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", none: "bg-zinc-600",
};

function Delta({ v, level }: { v: string; level: Level }) {
    if (!v) return <span className="text-muted-foreground/40">—</span>;
    const m = mins(v) ?? 0;
    return <span className={cn("font-semibold tabular-nums", chipTone[level])}>{m > 0 ? "+" : ""}{v}</span>;
}

export default function EfficiencyV2Page() {
    const queryClient = useQueryClient();
    const { selectedDate, searchQuery, rawRouteData, rawRouteDataLoading } = useDispatching();
    const [rows, setRows] = useState<Row[]>([]);
    const [tab, setTab] = useState<"overview" | "table">("overview");
    const [filter, setFilter] = useState<"all" | "attention">("all");
    const [selected, setSelected] = useState<Row | null>(null);
    const [sortBy, setSortBy] = useState<"attention" | "eff" | "name" | "route">("attention");

    useEffect(() => {
        if (!rawRouteData?.routes) { setRows([]); return; }
        const out: Row[] = rawRouteData.routes.map((rec: any) => {
            const emp = rawRouteData.employees?.[rec.transporterId];
            const waveM = mins(rec.waveTime), durM = mins(rec.routeDuration);
            const actDepM = mins(rec.actualDepartureTime), planOBM = mins(rec.plannedOutboundStem), actOBM = mins(rec.actualOutboundStem);
            const planFirstM = mins(rec.plannedFirstStop), actFirstM = mins(rec.actualFirstStop);
            const planLastM = mins(rec.plannedLastStop), actLastM = mins(rec.actualLastStop), dctM = mins(rec.deliveryCompletionTime);
            const planRTSM = waveM !== null && durM !== null ? waveM + durM + 20 : null;
            const plan1L = planLastM !== null && planFirstM !== null ? planLastM - planFirstM : null;
            const act1L = actLastM !== null && actFirstM !== null ? actLastM - actFirstM : null;
            const planIB = planRTSM !== null && planLastM !== null ? planRTSM - planLastM : null;
            const stops = rec.stopCount || 0;
            const sph = plan1L && plan1L > 0 && stops > 0 ? Math.round((stops / (plan1L / 60)) * 10) / 10 : 0;
            let eff = rec.driverEfficiency || 0;
            if (plan1L && plan1L > 0 && act1L && act1L > 0) {
                const resc = sph > 0 ? (rec.stopsRescued || 0) * (60 / sph) : 0;
                const e = (plan1L / (act1L + resc)) * 100;
                if (isFinite(e)) eff = Math.round(e);
            }
            return {
                id: rec._id, name: emp?.name || rec.transporterId, route: rec.routeNumber || "", stops, duration: rec.routeDuration || "",
                wave: rec.waveTime || "", appIn: rec.appSignIn || "", plannedEnd: rec.plannedEndTime || "",
                actDep: rec.actualDepartureTime || "",
                depDelay: actDepM !== null && waveM !== null ? fmtDur(actDepM - (waveM + 20)) : "",
                planOB: rec.plannedOutboundStem || "", actOB: rec.actualOutboundStem || "",
                obDelay: actOBM !== null && planOBM !== null ? fmtDur(actOBM - planOBM) : "",
                planFirst: rec.plannedFirstStop || "", actFirst: rec.actualFirstStop || "",
                firstDelay: actFirstM !== null && planFirstM !== null ? fmtDur(actFirstM - planFirstM) : "",
                planLast: rec.plannedLastStop || "", actLast: rec.actualLastStop || "",
                lastDelay: actLastM !== null && planLastM !== null ? fmtDur(actLastM - planLastM) : "",
                planRTS: fmtTime(planRTSM), planIB: fmtDur(planIB),
                estRTS: dctM !== null && planIB !== null ? fmtTime(dctM + planIB) : "",
                plan1L: fmtDur(plan1L), act1L: fmtDur(act1L), sph,
                dct: rec.deliveryCompletionTime || "",
                dctDelay: dctM !== null && actLastM !== null ? fmtDur(dctM - actLastM) : "",
                rescued: rec.stopsRescued || 0, eff, type: rec.type || "", date: rec.date || "",
                conflicts: Array.isArray(rec.cortexConflicts) ? rec.cortexConflicts.length : 0,
            };
        });
        setRows(out);
    }, [rawRouteData]);

    const dayRows = useMemo(() => {
        let r = rows.filter((x) => (x.type || "").trim().toLowerCase() === "route");
        if (selectedDate) r = r.filter((x) => (x.date ? toPacificDate(x.date) === selectedDate : false));
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            r = r.filter((x) => x.name.toLowerCase().includes(q) || x.route.toLowerCase().includes(q));
        }
        return r;
    }, [rows, selectedDate, searchQuery]);

    const summary = useMemo(() => {
        const withEff = dayRows.filter((r) => r.eff > 0);
        const avgEff = withEff.length ? Math.round(withEff.reduce((a, r) => a + r.eff, 0) / withEff.length) : 0;
        const dep = dayRows.filter((r) => r.actDep);
        const onTime = dep.filter((r) => (mins(r.depDelay) ?? 0) < T.depAmber).length;
        const lasts = dayRows.map((r) => mins(r.lastDelay)).filter((v): v is number => v !== null);
        const avgLast = lasts.length ? Math.round(lasts.reduce((a, b) => a + b, 0) / lasts.length) : null;
        const finished = dayRows.filter((r) => r.actLast).length;
        return {
            avgEff, onTime, departed: dep.length, avgLast, finished,
            rescued: dayRows.reduce((a, r) => a + r.rescued, 0),
            attention: dayRows.filter((r) => score(r) >= 2).length,
            stops: dayRows.reduce((a, r) => a + r.stops, 0),
        };
    }, [dayRows]);

    const list = useMemo(() => {
        let r = [...dayRows];
        if (filter === "attention") r = r.filter((x) => score(x) >= 2);
        r.sort((a, b) => {
            if (sortBy === "name") return a.name.localeCompare(b.name);
            if (sortBy === "route") return a.route.localeCompare(b.route, undefined, { numeric: true });
            if (sortBy === "eff") return (a.eff || 999) - (b.eff || 999);
            return score(b) - score(a) || a.name.localeCompare(b.name);
        });
        return r;
    }, [dayRows, filter, sortBy]);

    const saveDct = useCallback(async (row: Row, raw: string) => {
        let v = raw.trim();
        const digits = v.replace(/[^\d]/g, "");
        if (!v) v = "";
        else if (digits.length === 3 || digits.length === 4) {
            const d = digits.padStart(4, "0");
            v = `${d.slice(0, 2)}:${d.slice(2)}`;
        } else if (!/^\d{1,2}:\d{2}$/.test(v)) { notify.error("Use a time like 1830 or 18:30"); return; }
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId: row.id, updates: { deliveryCompletionTime: v } }),
            });
            if (!res.ok) throw new Error();
            notify.success(`DCT saved for ${row.name}`);
            queryClient.invalidateQueries({ queryKey: ["dispatching"], refetchType: "all" });
        } catch { notify.error("Could not save DCT"); }
    }, [queryClient]);

    if (rawRouteDataLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="flex h-full flex-col gap-4 overflow-auto p-1">
            {/* ── 1. Station summary ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi icon={Gauge} label="Avg efficiency" value={summary.avgEff ? `${summary.avgEff}%` : "—"}
                    level={summary.avgEff ? (summary.avgEff < T.effRed ? "bad" : summary.avgEff < T.effAmber ? "warn" : "ok") : "none"} hint="Planned vs actual 1st→last stop" />
                <Kpi icon={Truck} label="On-time departures" value={`${summary.onTime}/${summary.departed}`}
                    level={summary.departed ? (summary.onTime / summary.departed >= 0.8 ? "ok" : summary.onTime / summary.departed >= 0.5 ? "warn" : "bad") : "none"} hint={`within ${T.depAmber - 1} min of plan`} />
                <Kpi icon={Clock} label="Avg last-stop delay" value={summary.avgLast === null ? "—" : fmtDur(summary.avgLast)}
                    level={summary.avgLast === null ? "none" : summary.avgLast >= T.lastRed ? "bad" : summary.avgLast >= T.lastAmber ? "warn" : "ok"} hint={`${summary.finished}/${dayRows.length} drivers done`} />
                <Kpi icon={LifeBuoy} label="Stops rescued" value={String(summary.rescued)} level="none" hint="across all routes" />
                <Kpi icon={Users} label="Drivers" value={String(dayRows.length)} level="none" hint={`${summary.stops.toLocaleString()} stops`} />
                <Kpi icon={AlertTriangle} label="Need attention" value={String(summary.attention)} level={summary.attention ? "bad" : "ok"} hint="see queue below" />
            </div>

            {/* ── controls ── */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/50 p-0.5 text-sm">
                    {([["overview", "Overview"], ["table", "Full table"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-4 py-2 text-sm font-medium transition", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                    ))}
                </div>
                {tab === "overview" && (
                    <>
                        <div className="inline-flex rounded-lg border border-border/50 p-0.5 text-sm">
                            {([["all", `All drivers (${dayRows.length})`], ["attention", `Needs attention (${summary.attention})`]] as const).map(([k, l]) => (
                                <button key={k} onClick={() => setFilter(k)} className={cn("rounded-md px-4 py-2 text-sm font-medium transition", filter === k ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                            ))}
                        </div>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm">
                            <option value="attention">Sort: most urgent</option>
                            <option value="eff">Sort: lowest efficiency</option>
                            <option value="route">Sort: route #</option>
                            <option value="name">Sort: name</option>
                        </select>
                    </>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Prototype · click a driver for the timeline · only DCT is editable here</span>
            </div>

            {/* ── 2. Driver list ── */}
            {tab === "overview" ? (
                <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                    <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(70px,.5fr)_minmax(110px,.8fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_minmax(130px,.9fr)_minmax(110px,.8fr)_minmax(240px,2.6fr)_20px] gap-3 border-b border-border/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <div>Driver</div><div>Stops</div><div>Status</div><div>Departure</div><div>Last stop</div><div>Return (RTS)</div><div>Efficiency</div><div>Flags</div><div />
                    </div>
                    {list.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">{filter === "attention" ? "Nobody needs attention right now." : "No routes for this day."}</div>}
                    {list.map((r) => {
                        const st = status(r), fl = flagsFor(r), dl = depLevel(r), ll = lastLevel(r), el = effLevel(r);
                        return (
                            <button key={r.id} onClick={() => setSelected(r)} className="grid w-full grid-cols-[minmax(180px,1.5fr)_minmax(70px,.5fr)_minmax(110px,.8fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_minmax(130px,.9fr)_minmax(110px,.8fr)_minmax(240px,2.6fr)_20px] items-center gap-3 border-b border-border/30 px-4 py-3 text-left text-sm transition hover:bg-secondary/40">
                                <div>
                                    <div className="text-base font-semibold text-foreground">{r.name}</div>
                                    <div className="text-xs text-muted-foreground">{r.route || "—"}{r.appIn ? ` · in ${clock(r.appIn)}` : ""}</div>
                                </div>
                                <div className="tabular-nums">{r.stops || "—"}<div className="text-xs text-muted-foreground">{r.sph ? `${r.sph}/hr plan` : ""}</div></div>
                                <div><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></div>
                                <div className="tabular-nums">{clock(r.actDep)}<div className="text-xs"><span className="text-muted-foreground">plan {mins(r.wave) !== null ? fmtTime((mins(r.wave) as number) + 20) : "—"} </span><Delta v={r.depDelay} level={dl} /></div></div>
                                <div className="tabular-nums">{clock(r.actLast)}<div className="text-xs"><span className="text-muted-foreground">plan {clock(r.planLast)} </span><Delta v={r.lastDelay} level={ll} /></div></div>
                                <div className="tabular-nums">{r.estRTS || r.planRTS || "—"}<div className="text-xs text-muted-foreground">{r.estRTS ? `plan ${r.planRTS}` : "planned"}</div></div>
                                <div>
                                    <div className={cn("text-lg font-bold tabular-nums", chipTone[el])}>{r.eff ? `${r.eff}%` : "—"}</div>
                                    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800"><div className={cn("h-full rounded-full", barTone[el])} style={{ width: `${Math.min(100, r.eff || 0)}%` }} /></div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {fl.length === 0 ? <span className="inline-flex items-center gap-1 text-xs text-emerald-500/80"><CheckCircle2 className="h-3 w-3" />On track</span>
                                        : fl.map((f, i) => <span key={i} className={cn("rounded px-2 py-1 text-xs font-medium", f.level === "bad" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>{f.label}</span>)}
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                        );
                    })}
                </div>
            ) : (
                <FullTable rows={dayRows} onOpen={setSelected} />
            )}

            {/* ── 3. Driver drawer ── */}
            <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {selected && <Drawer row={rows.find((x) => x.id === selected.id) || selected} onSaveDct={saveDct} />}
                </SheetContent>
            </Sheet>
        </div>
    );
}

function Kpi({ icon: Icon, label, value, hint, level }: { icon: any; label: string; value: string; hint?: string; level: Level }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
            <div className={cn("mt-1 text-3xl font-bold tabular-nums", level === "none" ? "text-foreground" : chipTone[level])}>{value}</div>
            {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
    );
}

function TimelineRow({ label, plan, act, delta, level }: { label: string; plan: string; act: string; delta?: string; level?: Level }) {
    const done = !!act && act !== "—";
    return (
        <div className="grid grid-cols-[18px_1fr_90px_90px_70px] items-center gap-2 py-2.5 text-sm">
            <span className={cn("h-2.5 w-2.5 rounded-full", done ? "bg-emerald-500" : "bg-zinc-700")} />
            <span className="font-medium">{label}</span>
            <span className="text-right tabular-nums text-muted-foreground">{plan || "—"}</span>
            <span className="text-right font-semibold tabular-nums">{act || "—"}</span>
            <span className="text-right">{delta !== undefined ? <Delta v={delta} level={level || "none"} /> : null}</span>
        </div>
    );
}

function Drawer({ row: r, onSaveDct }: { row: Row; onSaveDct: (r: Row, v: string) => void }) {
    const [dct, setDct] = useState(r.dct ? clock(r.dct) : "");
    useEffect(() => { setDct(r.dct ? clock(r.dct) : ""); }, [r.id, r.dct]);
    const fl = flagsFor(r);
    const planDep = mins(r.wave) !== null ? fmtTime((mins(r.wave) as number) + 20) : "";
    return (
        <>
            <SheetHeader>
                <SheetTitle>{r.name}</SheetTitle>
                <SheetDescription>{r.route} · {r.stops} stops · block {dur(r.duration)} · {status(r).label}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
                {fl.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {fl.map((f, i) => <span key={i} className={cn("rounded px-2 py-1 text-xs font-medium", f.level === "bad" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>{f.label}</span>)}
                    </div>
                )}
                <div>
                    <div className="mb-1 grid grid-cols-[18px_1fr_90px_90px_70px] gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <span /><span>Timeline</span><span className="text-right">Plan</span><span className="text-right">Actual</span><span className="text-right">Δ</span>
                    </div>
                    <div className="divide-y divide-border/30">
                        <TimelineRow label="Wave / app sign-in" plan={clock(r.wave)} act={clock(r.appIn)} />
                        <TimelineRow label="Departed station" plan={planDep} act={clock(r.actDep)} delta={r.depDelay} level={depLevel(r)} />
                        <TimelineRow label="Outbound stem" plan={dur(r.planOB)} act={dur(r.actOB)} delta={r.obDelay} level={(mins(r.obDelay) ?? 0) >= 15 ? "bad" : (mins(r.obDelay) ?? 0) >= 6 ? "warn" : r.obDelay ? "ok" : "none"} />
                        <TimelineRow label="First stop" plan={clock(r.planFirst)} act={clock(r.actFirst)} delta={r.firstDelay} level={(mins(r.firstDelay) ?? 0) >= 30 ? "bad" : (mins(r.firstDelay) ?? 0) >= 10 ? "warn" : r.firstDelay ? "ok" : "none"} />
                        <TimelineRow label="Last stop" plan={clock(r.planLast)} act={clock(r.actLast)} delta={r.lastDelay} level={lastLevel(r)} />
                        <TimelineRow label="Called in finished (DCT)" plan={clock(r.actLast)} act={r.dct ? clock(r.dct) : ""} delta={r.dctDelay} level={(mins(r.dctDelay) ?? 0) >= T.dctRed ? "bad" : r.dctDelay ? "ok" : "none"} />
                        <TimelineRow label="Return to station" plan={r.planRTS} act={r.estRTS} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Return "actual" is an estimate: DCT + planned inbound stem ({dur(r.planIB)}).</div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <Mini label="Efficiency" value={r.eff ? `${r.eff}%` : "—"} level={effLevel(r)} />
                    <Mini label="1st→last (plan / act)" value={`${dur(r.plan1L)} / ${dur(r.act1L)}`} />
                    <Mini label="Rescued" value={String(r.rescued)} />
                    <Mini label="Stops / hr (plan)" value={r.sph ? String(r.sph) : "—"} />
                    <Mini label="Planned end" value={clock(r.plannedEnd)} />
                    <Mini label="Block" value={dur(r.duration)} />
                </div>

                <div className="rounded-lg border border-border/50 p-3">
                    <div className="mb-1.5 text-xs font-semibold">Delivery completion time (DCT)</div>
                    <div className="mb-2 text-xs text-muted-foreground">When the driver called in finished. Type 1830 or 18:30.</div>
                    <div className="flex gap-2">
                        <Input value={dct} onChange={(e) => setDct(e.target.value)} placeholder="e.g. 1830" className="h-8" />
                        <Button size="sm" onClick={() => onSaveDct(r, dct)}>Save</Button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Mini({ label, value, level }: { label: string; value: string; level?: Level }) {
    return (
        <div className="rounded-lg border border-border/50 p-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={cn("text-base font-bold tabular-nums", level ? chipTone[level] : "")}>{value}</div>
        </div>
    );
}

// ── 4. Full table: every column, grouped under phase headers, read-only ──
function FullTable({ rows, onOpen }: { rows: Row[]; onOpen: (r: Row) => void }) {
    const groups: { title: string; cols: { label: string; get: (r: Row) => React.ReactNode }[] }[] = [
        { title: "Route", cols: [{ label: "Stops", get: (r) => r.stops || "—" }, { label: "Block", get: (r) => dur(r.duration) }, { label: "Wave", get: (r) => clock(r.wave) }, { label: "App in", get: (r) => clock(r.appIn) }] },
        { title: "Departure", cols: [{ label: "Actual", get: (r) => clock(r.actDep) }, { label: "Δ", get: (r) => <Delta v={r.depDelay} level={depLevel(r)} /> }, { label: "Pln stem", get: (r) => dur(r.planOB) }, { label: "Act stem", get: (r) => dur(r.actOB) }, { label: "Δ", get: (r) => <Delta v={r.obDelay} level={(mins(r.obDelay) ?? 0) >= 15 ? "bad" : (mins(r.obDelay) ?? 0) >= 6 ? "warn" : r.obDelay ? "ok" : "none"} /> }] },
        { title: "First stop", cols: [{ label: "Plan", get: (r) => clock(r.planFirst) }, { label: "Actual", get: (r) => clock(r.actFirst) }, { label: "Δ", get: (r) => <Delta v={r.firstDelay} level="none" /> }] },
        { title: "Last stop", cols: [{ label: "Plan", get: (r) => clock(r.planLast) }, { label: "Actual", get: (r) => clock(r.actLast) }, { label: "Δ", get: (r) => <Delta v={r.lastDelay} level={lastLevel(r)} /> }] },
        { title: "Return", cols: [{ label: "Pln end", get: (r) => clock(r.plannedEnd) }, { label: "Pln RTS", get: (r) => r.planRTS || "—" }, { label: "Est RTS", get: (r) => r.estRTS || "—" }, { label: "Pln IB", get: (r) => dur(r.planIB) }] },
        { title: "Pace", cols: [{ label: "Pln 1-L", get: (r) => dur(r.plan1L) }, { label: "Act 1-L", get: (r) => dur(r.act1L) }, { label: "Stp/hr", get: (r) => r.sph || "—" }, { label: "Rescued", get: (r) => r.rescued || "—" }, { label: "Eff %", get: (r) => <span className={cn("font-bold", chipTone[effLevel(r)])}>{r.eff ? `${r.eff}%` : "—"}</span> }] },
        { title: "Close-out", cols: [{ label: "DCT", get: (r) => (r.dct ? clock(r.dct) : "—") }, { label: "DCT Δ", get: (r) => <Delta v={r.dctDelay} level={(mins(r.dctDelay) ?? 0) >= T.dctRed ? "bad" : r.dctDelay ? "ok" : "none"} /> }] },
    ];
    return (
        <div className="overflow-auto rounded-xl border border-border/50 bg-card">
            <table className="w-max min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border/50">
                        <th rowSpan={2} className="sticky left-0 z-20 bg-card px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Driver</th>
                        <th rowSpan={2} className="px-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Route</th>
                        {groups.map((g, i) => <th key={g.title} colSpan={g.cols.length} className={cn("border-l border-border/40 px-2 py-1 text-center text-xs font-semibold uppercase tracking-wider text-foreground/80", i % 2 ? "bg-secondary/30" : "")}>{g.title}</th>)}
                    </tr>
                    <tr className="border-b border-border/50">
                        {groups.map((g, gi) => g.cols.map((c, ci) => <th key={g.title + c.label + ci} className={cn("px-2 py-1.5 text-right text-xs font-medium text-muted-foreground", ci === 0 && "border-l border-border/40", gi % 2 ? "bg-secondary/30" : "")}>{c.label}</th>))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer border-b border-border/20 hover:bg-secondary/40">
                            <td className="sticky left-0 bg-card px-3 py-2 font-semibold">{r.name}</td>
                            <td className="px-2 text-muted-foreground">{r.route}</td>
                            {groups.map((g, gi) => g.cols.map((c, ci) => <td key={g.title + c.label + ci} className={cn("px-3 py-2.5 text-right tabular-nums", ci === 0 && "border-l border-border/40", gi % 2 ? "bg-secondary/20" : "")}>{c.get(r)}</td>))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
