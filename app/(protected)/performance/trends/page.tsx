"use client";

// Driver trends: how often each driver gets negative customer feedback and
// whether it improves after the conversation with them.

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

type Verdict = "not-discussed" | "too-early" | "improving" | "no-change" | "worse" | "clean";
interface Driver {
    transporterId: string; name: string; total: number; neg30: number; neg30prev: number; responses30: number; rate30: number | null;
    spark: number[]; lastDiscussed: string | null; discussions: number; open: number;
    verdict: Verdict; before: number; after: number; daysAfter: number;
    timeline: { date: string; tba: string; reasons: string[]; status: string; discussedAt?: string; discussedBy?: string; outcome?: string }[];
}
interface Resp { today: string; series: { week: string; negatives: number; responses: number; discussed: number }[]; drivers: Driver[] }

const VERDICT: Record<Verdict, { label: string; tone: string }> = {
    "not-discussed": { label: "Not discussed yet", tone: "bg-red-500/15 text-red-400" },
    "too-early": { label: "Too early to tell", tone: "bg-zinc-500/15 text-zinc-400" },
    improving: { label: "Improving", tone: "bg-emerald-500/15 text-emerald-400" },
    clean: { label: "Clean since discussion", tone: "bg-emerald-500/15 text-emerald-400" },
    "no-change": { label: "No change", tone: "bg-amber-500/15 text-amber-400" },
    worse: { label: "Getting worse", tone: "bg-red-500/15 text-red-400" },
};
const wk = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dd = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function TrendsPage() {
    const [weeks, setWeeks] = useState(8);
    const [filter, setFilter] = useState<"all" | "attention">("all");
    const [openRow, setOpenRow] = useState<string | null>(null);
    const { data, isLoading, error } = useQuery({
        queryKey: ["performance", "cdf-trends", weeks],
        queryFn: async () => {
            const r = await fetch(`/api/performance/cdf/trends?weeks=${weeks}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load");
            return (await r.json()) as Resp;
        },
        staleTime: 60_000,
    });

    const s = data?.series || [];
    const maxNeg = Math.max(1, ...s.map((x) => x.negatives));
    const thisWeek = s[s.length - 1], lastWeek = s[s.length - 2];
    const counts = useMemo(() => {
        const d = data?.drivers || [];
        return {
            improving: d.filter((x) => x.verdict === "improving" || x.verdict === "clean").length,
            worse: d.filter((x) => x.verdict === "worse").length,
            nodisc: d.filter((x) => x.verdict === "not-discussed" && x.neg30 > 0).length,
            repeat: d.filter((x) => x.neg30 >= 3).length,
        };
    }, [data]);
    const drivers = (data?.drivers || []).filter((x) => filter === "all" || x.verdict === "worse" || x.verdict === "not-discussed" || x.neg30 >= 3);

    if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (error) return <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">{(error as Error).message}</div>;

    return (
        <div className="flex h-full flex-col gap-4 overflow-auto">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Kpi label="Negative this week" value={thisWeek?.negatives ?? 0} hint={lastWeek ? `${lastWeek.negatives} last week` : ""} tone={thisWeek && lastWeek && thisWeek.negatives > lastWeek.negatives ? "text-red-400" : "text-emerald-400"} />
                <Kpi label="Improving after talk" value={counts.improving} tone="text-emerald-400" />
                <Kpi label="Getting worse" value={counts.worse} tone={counts.worse ? "text-red-400" : undefined} />
                <Kpi label="Not discussed yet" value={counts.nodisc} tone={counts.nodisc ? "text-amber-400" : undefined} />
                <Kpi label="3+ in 30 days" value={counts.repeat} tone={counts.repeat ? "text-amber-400" : undefined} />
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">Negative feedback per week</div>
                    <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="rounded-lg border border-border/50 bg-background px-2 py-1 text-xs">
                        {[8, 12, 26].map((w) => <option key={w} value={w}>Last {w} weeks</option>)}
                    </select>
                </div>
                <div className="flex h-36 items-end gap-2">
                    {s.map((x) => (
                        <div key={x.week} className="flex flex-1 flex-col items-center gap-1">
                            <div className="text-xs font-semibold tabular-nums">{x.negatives}</div>
                            <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-red-500/70" style={{ height: `${(x.negatives / maxNeg) * 100}%`, minHeight: x.negatives ? 4 : 0 }} /></div>
                            <div className="text-[11px] text-muted-foreground">{wk(x.week)}</div>
                            {x.responses > 0 && <div className="text-[10px] text-muted-foreground">{Math.round((x.negatives / x.responses) * 100)}% of {x.responses}</div>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/50 p-0.5 text-sm">
                    {([["all", "All drivers"], ["attention", "Needs attention"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setFilter(k)} className={cn("rounded-md px-4 py-2 font-medium transition", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                    ))}
                </div>
                <span className="text-xs text-muted-foreground">Improvement compares the 14 days before the last conversation with the days since.</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <div className="min-w-[980px]">
                    <div className="grid grid-cols-[minmax(180px,1.4fr)_80px_80px_100px_minmax(130px,1fr)_minmax(150px,1fr)_minmax(180px,1.2fr)_24px] gap-3 border-b border-border/50 bg-secondary/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <div>Driver</div><div>30 days</div><div>Prior 30</div><div>Rate</div><div>Weekly</div><div>Last talk</div><div>After the talk</div><div />
                    </div>
                    {drivers.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No drivers match.</div>}
                    {drivers.map((d) => {
                        const v = VERDICT[d.verdict]; const mx = Math.max(1, ...d.spark); const exp = openRow === d.transporterId;
                        return (
                            <Fragment key={d.transporterId}>
                                <button onClick={() => setOpenRow(exp ? null : d.transporterId)} className="grid w-full grid-cols-[minmax(180px,1.4fr)_80px_80px_100px_minmax(130px,1fr)_minmax(150px,1fr)_minmax(180px,1.2fr)_24px] items-center gap-3 border-b border-border/30 px-4 py-3 text-left text-sm hover:bg-secondary/40">
                                    <div><div className="text-base font-semibold">{d.name}</div><div className="text-xs text-muted-foreground">{d.open ? `${d.open} open` : "none open"}</div></div>
                                    <div className={cn("text-lg font-bold tabular-nums", d.neg30 >= 3 ? "text-red-400" : "")}>{d.neg30}</div>
                                    <div className="tabular-nums text-muted-foreground">{d.neg30prev}</div>
                                    <div className="tabular-nums">{d.rate30 === null ? "—" : `${d.rate30}%`}</div>
                                    <div className="flex h-7 items-end gap-0.5">{d.spark.map((n, i) => <div key={i} title={`${n}`} className="flex-1 rounded-sm bg-red-500/60" style={{ height: `${Math.max(n ? 18 : 4, (n / mx) * 100)}%`, opacity: n ? 1 : 0.25 }} />)}</div>
                                    <div className="text-xs">{d.lastDiscussed ? <>{dd(d.lastDiscussed)}<div className="text-muted-foreground">{d.discussions} talk{d.discussions > 1 ? "s" : ""}</div></> : <span className="text-muted-foreground">—</span>}</div>
                                    <div><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", v.tone)}>{v.label}</span>
                                        {d.lastDiscussed && d.verdict !== "too-early" && <div className="mt-1 text-xs text-muted-foreground">{d.before} before → {d.after} after ({d.daysAfter}d)</div>}</div>
                                    {exp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                {exp && (
                                    <div className="border-b border-border/30 bg-secondary/10 px-6 py-3">
                                        {d.timeline.map((t, i) => (
                                            <div key={i} className="flex flex-wrap items-center gap-3 py-1.5 text-sm">
                                                <span className="w-16 font-medium">{dd(t.date)}</span>
                                                <span className="font-mono text-xs text-muted-foreground">{t.tba}</span>
                                                <span className="flex flex-wrap gap-1">{t.reasons.map((r, k) => <span key={k} className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">{r}</span>)}</span>
                                                <span className={cn("ml-auto text-xs", t.status === "open" ? "text-red-400" : "text-emerald-400")}>{t.status === "open" ? "Not discussed" : `Discussed ${t.discussedAt ? dd(t.discussedAt.slice(0, 10)) : ""}${t.outcome ? " · " + t.outcome : ""}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Kpi({ label, value, tone, hint }: { label: string; value: number; tone?: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className={cn("mt-1 text-3xl font-bold tabular-nums", tone)}>{value}</div>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
    );
}
