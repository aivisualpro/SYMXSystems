"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Clock, TrendingUp, Landmark, Scale, PiggyBank, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, typeInfo, timeLeft, fmtDay, MY_STATUS, KIND_LABEL } from "./_lib";

const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"];

function Card({ icon: Icon, label, value, sub, tone, explain }: { icon: any; label: string; value: string; sub?: string; tone?: "warn" | "good" | "bad"; explain: string }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-4" title={explain}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
            <div className={cn("mt-1 text-2xl font-bold", tone === "warn" && "text-amber-400", tone === "bad" && "text-red-400", tone === "good" && "text-emerald-400")}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
            <div className="mt-2 text-[11px] leading-snug text-muted-foreground/80">{explain}</div>
        </div>
    );
}

function Panel({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card">
            <div className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
                <div><div className="text-sm font-semibold">{title}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div>{right}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

export default function PaymentsOverview() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["payments", "overview"],
        queryFn: async () => { const r = await fetch("/api/payments/overview"); if (!r.ok) throw new Error("Failed to load"); return r.json(); },
    });
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (error) return <div className="p-6 text-sm text-red-500">{(error as Error).message}</div>;
    const k = data.kpi;

    if (!data.hasData) {
        return (
            <div className="max-w-2xl rounded-xl border border-border/50 bg-card p-6 text-sm">
                <div className="mb-2 text-lg font-semibold">No invoices yet</div>
                <p className="text-muted-foreground">Invoices are copied from the Amazon Payments page by the SYMX Chrome extension (read-only — it never accepts or disputes anything).</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Update and reload the extension (version 1.11.0 or later).</li>
                    <li>Make sure you are signed in to logistics.amazon.com.</li>
                    <li>Open the extension and click <b>Sync payments now</b>.</li>
                </ol>
            </div>
        );
    }

    const maxTrend = Math.max(1, ...data.trend.map((w: any) => Object.values(w.stations).reduce((a: number, s: any) => a + s.amount, 0) as number));
    const stationList = [...new Set(data.trend.flatMap((w: any) => Object.keys(w.stations)))].sort() as string[];
    const typeTotal = Object.values(data.byType).reduce((a: number, b: any) => a + b, 0) as number;
    const stTotal = Object.values(data.byStation).reduce((a: number, b: any) => a + b, 0) as number;

    return (
        <div className="space-y-4 pb-10">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <Card icon={Clock} label="Needs your action" value={`${k.pendingCount}`} sub={`${money(k.pendingAmount)} · ${k.soonestHours !== null ? timeLeft(k.soonestHours).text : "no deadline"}`} tone={k.soonestHours !== null && k.soonestHours < 48 ? "bad" : k.pendingCount ? "warn" : "good"}
                    explain="Invoices Amazon is waiting on you to accept or dispute. Do nothing and they still pay, but you lose the chance to dispute after 14 days." />
                <Card icon={ShieldAlert} label="Possible money to recover" value={money(k.atStake)} sub={`${k.openFindings} open audit finding${k.openFindings === 1 ? "" : "s"}`} tone={k.atStake > 0 ? "warn" : "good"}
                    explain="Places where Amazon's invoice looks lower than what we captured. These are leads to check, not guaranteed money." />
                <Card icon={Landmark} label="Billed this month" value={money(k.billedMtd)} sub={`${k.mtdCount} invoices`}
                    explain="Everything Amazon has invoiced you since the 1st (all stations, all types)." />
                <Card icon={PiggyBank} label="Cash arriving in 14 days" value={money(k.cash14)} sub={`${k.cash14Count} invoices · ${money(data.cash.paidRecent)} paid in last 14d`}
                    explain="Invoices with a payment date in the next two weeks. Use it to plan payroll and bills." />
                <Card icon={Scale} label="Disputes outstanding" value={money(k.disputedOutstanding)} sub={`${k.disputesOpen} open`}
                    explain="Money you've asked Amazon to add and are still waiting on. Disputes usually come back as an adjustment invoice within about 3 days." />
                <Card icon={TrendingUp} label="Recovered by disputes" value={money(k.recovered)} sub={k.winRate !== null ? `${k.winRate}% win rate` : "no resolved disputes yet"} tone={k.recovered > 0 ? "good" : undefined}
                    explain="Total extra money Amazon paid after you disputed. Win rate counts full and partial wins." />
            </div>

            <Panel title="Deadline queue" sub="Open every Friday afternoon, soonest deadline first. The clock turns red under 24 hours."
                right={<Link href="/payments/invoices?status=pending" className="text-xs text-primary hover:underline">All pending →</Link>}>
                {data.pending.length === 0 ? <div className="text-sm text-muted-foreground">Nothing is waiting on you.</div> : (
                    <div className="divide-y divide-border/40">
                        {data.pending.slice(0, 10).map((p: any) => {
                            const tl = timeLeft(p.hoursLeft);
                            const ti = typeInfo(p.type);
                            return (
                                <Link key={p.id} href={`/payments/invoices/${p.id}`} className="flex flex-wrap items-center gap-3 py-2.5 text-sm hover:bg-muted/20">
                                    <span className="w-14 font-mono font-semibold">{p.station}</span>
                                    <span className={cn("rounded-full px-2 py-0.5 text-xs", ti.color)}>{ti.label}</span>
                                    <span className="text-muted-foreground">{p.label}</span>
                                    <span className="ml-auto flex items-center gap-4">
                                        {p.findings > 0 && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{p.findings} to check · {money(p.atStake)}</span>}
                                        {!p.hasDetail && <span className="text-xs text-muted-foreground">not audited yet</span>}
                                        <span className={cn("rounded-full px-2 py-0.5 text-xs", MY_STATUS[p.myStatus]?.color)}>{MY_STATUS[p.myStatus]?.label}</span>
                                        <span className="w-24 text-right font-semibold tabular-nums">{money(p.amount)}</span>
                                        <span className={cn("w-24 text-right text-xs", tl.cls)}>{tl.text}</span>
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <Panel title="Weekly variable revenue" sub="Route pay + per-package pay by week, stacked by station. 'Per route' tells you if a week was strong or just busy.">
                    <div className="mb-3 flex flex-wrap gap-3 text-xs">{stationList.map((s, i) => <span key={s} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", COLORS[i % COLORS.length])} />{s}</span>)}</div>
                    <div className="space-y-2">
                        {data.trend.map((w: any) => {
                            const total = Object.values(w.stations).reduce((a: number, s: any) => a + s.amount, 0) as number;
                            const routes = Object.values(w.stations).reduce((a: number, s: any) => a + s.routes, 0) as number;
                            return (
                                <div key={w.end} className="grid grid-cols-[70px_1fr_150px] items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">{w.label}</span>
                                    <div className="flex h-5 overflow-hidden rounded bg-muted/40" style={{ width: `${(total / maxTrend) * 100}%` }}>
                                        {stationList.map((s, i) => { const a = w.stations[s]?.amount || 0; return a ? <div key={s} className={COLORS[i % COLORS.length]} style={{ width: `${(a / total) * 100}%` }} title={`${s}: ${money(a)}`} /> : null; })}
                                    </div>
                                    <span className="text-right tabular-nums"><b>{money(total)}</b>{routes > 0 && <span className="text-muted-foreground"> · {money(total / routes)}/route</span>}</span>
                                </div>
                            );
                        })}
                    </div>
                </Panel>

                <div className="space-y-4">
                    <Panel title="This month by type" sub="Where the money comes from.">
                        <div className="space-y-2">
                            {Object.entries(data.byType).sort((a: any, b: any) => b[1] - a[1]).map(([t, v]: any) => (
                                <div key={t} className="text-xs"><div className="mb-1 flex justify-between"><span>{typeInfo(t).label}</span><b>{money(v)}</b></div>
                                    <div className="h-1.5 rounded bg-muted/40"><div className="h-1.5 rounded bg-primary" style={{ width: `${(v / (typeTotal || 1)) * 100}%` }} /></div></div>
                            ))}
                        </div>
                    </Panel>
                    <Panel title="This month by station" sub="Compare stations on what Amazon has billed.">
                        <div className="space-y-2">
                            {Object.entries(data.byStation).sort((a: any, b: any) => b[1] - a[1]).map(([s, v]: any) => (
                                <div key={s} className="text-xs"><div className="mb-1 flex justify-between"><span className="font-mono">{s}</span><b>{money(v)}</b></div>
                                    <div className="h-1.5 rounded bg-muted/40"><div className="h-1.5 rounded bg-emerald-500" style={{ width: `${(v / (stTotal || 1)) * 100}%` }} /></div></div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="Biggest audit findings" sub="Largest possible shortfalls first." right={<Link href="/payments/audit" className="text-xs text-primary hover:underline">All findings →</Link>}>
                    {data.topFindings.length === 0 ? <div className="text-sm text-muted-foreground">Nothing flagged. Findings appear once invoices have synced with detail and we have matching Cortex data.</div> : (
                        <div className="divide-y divide-border/40">
                            {data.topFindings.map((f: any) => (
                                <div key={f.id} className="flex items-center gap-3 py-2 text-sm">
                                    <span className="w-12 font-mono text-xs">{f.station}</span>
                                    <div className="min-w-0 flex-1"><div className="truncate">{f.title}</div><div className="text-xs text-muted-foreground">{f.date ? fmtDay(f.date) + " · " : ""}{f.invoiceNumber}</div></div>
                                    <span className={cn("font-semibold tabular-nums", f.direction === "under" ? "text-amber-400" : "text-muted-foreground")}>{money(f.amount, true)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
                <Panel title="Cash calendar" sub="When Amazon's money lands, by date.">
                    {data.cash.byDate.length === 0 ? <div className="text-sm text-muted-foreground">No upcoming payment dates yet.</div> : (
                        <div className="divide-y divide-border/40">
                            {data.cash.byDate.slice(0, 8).map((c: any) => (
                                <div key={c.date} className="flex justify-between py-2 text-sm"><span>{fmtDay(c.date)}</span><b className="tabular-nums">{money(c.amount)}</b></div>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
            <div className="text-xs text-muted-foreground">Last synced from Amazon: {data.lastSync ? new Date(data.lastSync).toLocaleString() : "never"}. Types: {Object.keys(KIND_LABEL).length} audit checks run on every weekly invoice.</div>
        </div>
    );
}
