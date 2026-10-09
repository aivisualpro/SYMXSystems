"use client";

// ═══════════════════════════════════════════════════════════════════════
//  TIME — PROTOTYPE (time-v3)
// ═══════════════════════════════════════════════════════════════════════
// Direct-URL only (/dispatching/time-v3). Read-only: same data as the live
// Time page, same audit rules (lunch >= 30 min, Paycom lunch matches Amazon,
// Out Day within 15 min after Amazon logout). Edit values on /dispatching/time.
//
// Dispatcher questions: who is still working / on lunch, who has a punch
// problem I must fix before payroll, who is heading into overtime.
// Drop the Paycom Punch Audit Report on the live Time page to import punches.
// ═══════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { useDispatching } from "../_components/dispatching-context";
import { cn } from "@/lib/utils";
import { to24h } from "@/lib/cortex-time";
import { Loader2, AlertTriangle, Clock, Coffee, LogOut, Users, Timer } from "lucide-react";

const BUSINESS_TZ = "America/Los_Angeles";
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

const mins = (t?: string): number | null => {
    const s = to24h(t || "");
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};
const clock = (t?: string) => {
    const m = mins(t);
    if (m === null) return "—";
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const hm = (m: number) => `${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, "0")}`;

interface Row {
    id: string; name: string; type: string; route: string; attendance: string;
    inDay: string; outLunch: string; inLunch: string; outDay: string;
    amzOut: string; amzIn: string; amzLogout: string; inspection: string;
}
type Sev = "bad" | "warn";
interface Flag { label: string; sev: Sev; w: number }

function state(r: Row): { label: string; tone: string } {
    if (r.outDay) return { label: "Punched out", tone: "bg-zinc-500/15 text-zinc-300" };
    if (r.outLunch && !r.inLunch) return { label: "On lunch", tone: "bg-amber-500/15 text-amber-400" };
    if (r.inDay) return { label: "Working", tone: "bg-emerald-500/15 text-emerald-400" };
    return { label: "Not in", tone: "bg-zinc-500/10 text-zinc-500" };
}

function workedMinutes(r: Row): number | null {
    const a = mins(r.inDay), z = mins(r.outDay);
    if (a === null || z === null) return null;
    let total = z - a;
    const o = mins(r.outLunch), i = mins(r.inLunch);
    if (o !== null && i !== null) total -= i - o;
    return total;
}

function flagsFor(r: Row): Flag[] {
    const f: Flag[] = [];
    const isRoute = r.type.trim().toLowerCase() === "route";
    const inD = mins(r.inDay), outL = mins(r.outLunch), inL = mins(r.inLunch), outD = mins(r.outDay), logout = mins(r.amzLogout);
    const amzOut = mins(r.amzOut), amzIn = mins(r.amzIn);

    if (inL !== null && outL !== null && inL - outL < 30) f.push({ label: `Lunch only ${inL - outL} min`, sev: "bad", w: 3 });
    if (outL !== null && inL === null && outD !== null) f.push({ label: "Out Lunch but no In Lunch", sev: "bad", w: 3 });
    if (inD !== null && outD !== null && outL === null && (outD - inD) > 300) f.push({ label: "No lunch punched", sev: "bad", w: 3 });
    if (isRoute) {
        if (logout !== null && outD === null) f.push({ label: "Logged out of Amazon — not punched out", sev: "bad", w: 4 });
        if (logout !== null && outD !== null && outD < logout) f.push({ label: `Punched out ${hm(logout - outD)} before Amazon logout`, sev: "bad", w: 3 });
        if (logout !== null && outD !== null && outD >= logout + 15) f.push({ label: `Punched out ${hm(outD - logout)} after logout`, sev: "warn", w: 2 });
        if (amzIn !== null && inL !== null && inL !== amzIn) f.push({ label: "Paycom lunch ≠ Amazon lunch", sev: "warn", w: 2 });
        if (amzOut !== null && amzIn !== null && amzIn - amzOut < 30) f.push({ label: `Amazon lunch only ${amzIn - amzOut} min`, sev: "bad", w: 3 });
        if (inD === null && (logout !== null || amzOut !== null)) f.push({ label: "No In Day punch", sev: "bad", w: 4 });
    }
    const w = workedMinutes(r);
    if (w !== null && w > 12 * 60) f.push({ label: `${hm(w)} worked — double-time`, sev: "bad", w: 3 });
    else if (w !== null && w > 8 * 60) f.push({ label: `${hm(w - 480)} overtime`, sev: "warn", w: 1 });
    return f;
}
const score = (r: Row) => flagsFor(r).reduce((a, f) => a + f.w, 0);

function Cell({ v, bad }: { v?: string; bad?: boolean }) {
    return <span className={cn("tabular-nums", v ? "text-foreground" : "text-muted-foreground/40", bad && "text-red-400 font-semibold")}>{clock(v)}</span>;
}

export default function TimeV3Page() {
    const { selectedDate, searchQuery, rawRouteData, rawRouteDataLoading } = useDispatching();
    const [filter, setFilter] = useState<"all" | "issues">("all");
    const [sort, setSort] = useState<"urgent" | "name" | "route">("urgent");

    const rows = useMemo<Row[]>(() => {
        if (!rawRouteData?.routes) return [];
        let r = rawRouteData.routes as any[];
        if (selectedDate) r = r.filter((x) => (x.date ? toPacificDate(x.date) === selectedDate : false));
        const out: Row[] = r.map((rec) => ({
            id: rec._id, name: rawRouteData.employees?.[rec.transporterId]?.name || rec.transporterId,
            type: rec.type || "", route: rec.routeNumber || "", attendance: rec.attendance || "",
            inDay: rec.paycomInDay || "", outLunch: rec.paycomOutLunch || "", inLunch: rec.paycomInLunch || "", outDay: rec.paycomOutDay || "",
            amzOut: rec.amazonOutLunch || "", amzIn: rec.amazonInLunch || "", amzLogout: rec.amazonAppLogout || "", inspection: rec.inspectionTime || "",
        }));
        const q = (searchQuery || "").toLowerCase();
        return q ? out.filter((x) => x.name.toLowerCase().includes(q) || x.route.toLowerCase().includes(q)) : out;
    }, [rawRouteData, selectedDate, searchQuery]);

    // Only people who are scheduled to work a route-like day matter here.
    const worked = rows.filter((r) => r.type.trim().toLowerCase() !== "" );

    const summary = useMemo(() => {
        const s = { working: 0, lunch: 0, out: 0, notIn: 0, issues: 0, ot: 0 };
        worked.forEach((r) => {
            const st = state(r).label;
            if (st === "Working") s.working++; else if (st === "On lunch") s.lunch++; else if (st === "Punched out") s.out++; else s.notIn++;
            if (score(r) >= 3) s.issues++;
            const w = workedMinutes(r); if (w !== null && w > 480) s.ot += w - 480;
        });
        return s;
    }, [worked]);

    const list = useMemo(() => {
        let r = [...worked];
        if (filter === "issues") r = r.filter((x) => score(x) >= 3);
        r.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "route" ? a.route.localeCompare(b.route, undefined, { numeric: true }) : score(b) - score(a) || a.name.localeCompare(b.name));
        return r;
    }, [worked, filter, sort]);

    if (rawRouteDataLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

    const COLS = "grid-cols-[minmax(180px,1.5fr)_110px_repeat(4,minmax(86px,.6fr))_repeat(3,minmax(86px,.6fr))_80px_minmax(240px,2.4fr)]";

    return (
        <div className="flex h-full flex-col gap-4 overflow-auto p-1">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi icon={Users} label="Working now" value={summary.working} />
                <Kpi icon={Coffee} label="On lunch" value={summary.lunch} />
                <Kpi icon={LogOut} label="Punched out" value={summary.out} />
                <Kpi icon={Clock} label="Not in yet" value={summary.notIn} />
                <Kpi icon={Timer} label="Overtime so far" value={summary.ot ? hm(summary.ot) : "0:00"} />
                <Kpi icon={AlertTriangle} label="Need a fix" value={summary.issues} tone={summary.issues ? "text-red-400" : "text-emerald-400"} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/50 p-0.5 text-sm">
                    {([["all", `All (${worked.length})`], ["issues", `Need a fix (${summary.issues})`]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setFilter(k)} className={cn("rounded-md px-4 py-2 font-medium transition", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                    ))}
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm">
                    <option value="urgent">Sort: most urgent</option><option value="route">Sort: route #</option><option value="name">Sort: name</option>
                </select>
                <span className="ml-auto text-xs text-muted-foreground">Prototype · read-only · edit on the Time page · drop the Paycom report there to import punches</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <div className="min-w-[1250px]">
                    <div className={cn("grid gap-3 border-b border-border/50 bg-secondary/20 px-4 pt-2 text-xs font-bold uppercase tracking-wider text-foreground/70", COLS)}>
                        <div /><div /><div className="col-span-4 text-center">Paycom punches</div><div className="col-span-3 text-center">Amazon</div><div /><div />
                    </div>
                    <div className={cn("grid gap-3 border-b border-border/50 bg-secondary/20 px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground", COLS)}>
                        <div>Driver</div><div>Status</div><div>In day</div><div>Out lunch</div><div>In lunch</div><div>Out day</div><div>Lunch out</div><div>Lunch in</div><div>Logout</div><div>Worked</div><div>Fix list</div>
                    </div>
                    {list.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">{filter === "issues" ? "No punch problems right now." : "No one scheduled for this day."}</div>}
                    {list.map((r) => {
                        const st = state(r), fl = flagsFor(r), w = workedMinutes(r);
                        const lunchBad = mins(r.inLunch) !== null && mins(r.outLunch) !== null && (mins(r.inLunch) as number) - (mins(r.outLunch) as number) < 30;
                        return (
                            <div key={r.id} className={cn("grid items-center gap-3 border-b border-border/30 px-4 py-3 text-sm", COLS)}>
                                <div>
                                    <div className="text-base font-semibold">{r.name}</div>
                                    <div className="text-xs text-muted-foreground">{r.type || "—"}{r.route ? ` · ${r.route}` : ""}</div>
                                </div>
                                <div><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></div>
                                <Cell v={r.inDay} /><Cell v={r.outLunch} /><Cell v={r.inLunch} bad={lunchBad} /><Cell v={r.outDay} />
                                <Cell v={r.amzOut} /><Cell v={r.amzIn} /><Cell v={r.amzLogout} />
                                <span className={cn("tabular-nums font-semibold", w !== null && w > 480 ? "text-amber-400" : "")}>{w === null ? "—" : hm(w)}</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {fl.length === 0 ? <span className="text-xs text-emerald-500/80">All good</span>
                                        : fl.map((f, i) => <span key={i} className={cn("rounded px-2 py-1 text-xs font-medium", f.sev === "bad" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>{f.label}</span>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone?: string }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
            <div className={cn("mt-1 text-3xl font-bold tabular-nums", tone)}>{value}</div>
        </div>
    );
}
