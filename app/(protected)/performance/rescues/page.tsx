"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LifeBuoy, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Cover { tid: string; name: string; delivered: number; stops: number }
interface Handoff {
    pickups?: number;
    date: string; routeCode: string; total: number; covered: number; coveredPct: number;
    owner: { tid: string; name: string; delivered: number; ranRoute: boolean; scheduled: boolean };
    coveredBy: Cover[];
}
interface Leader { tid: string; name: string; packages: number; stops: number; routes: number; days: number }

const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default function RescuesPage() {
    const [days, setDays] = useState(14);
    const { data, isLoading, error } = useQuery({
        queryKey: ["performance", "rescues", days],
        queryFn: async () => {
            const r = await fetch(`/api/performance/rescues?days=${days}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
            return r.json();
        },
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (error) return <div className="p-6 text-sm text-red-500">{(error as Error).message}</div>;
    const kpi = data.kpi;
    const handoffs: Handoff[] = data.handoffs;
    const leaders: Leader[] = data.leaderboard;

    const byDay = new Map<string, Handoff[]>();
    handoffs.forEach((h) => (byDay.get(h.date) || byDay.set(h.date, []).get(h.date)!).push(h));

    return (
        <div className="space-y-4 pb-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                    { label: "Routes with hand-offs", value: kpi.handoffRoutes, sub: `of ${kpi.routes} routes` },
                    { label: "Packages covered", value: kpi.rescuedPackages, sub: `${kpi.rescuedPct}% of all deliveries` },
                    { label: "Original DA never ran it", value: kpi.ownerDidNotRun, sub: "route fully re-covered" },
                    { label: "Top rescuer", value: leaders[0]?.name?.split(" ")[0] || "—", sub: leaders[0] ? `${leaders[0].packages} pkgs · ${leaders[0].routes} routes` : "no data yet" },
                ].map((k) => (
                    <div key={k.label} className="rounded-xl border border-border/50 bg-card p-4">
                        <div className="text-xs text-muted-foreground">{k.label}</div>
                        <div className="text-3xl font-bold">{k.value}</div>
                        <div className="text-xs text-muted-foreground">{k.sub}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2">
                {[7, 14, 30, 60].map((d) => (
                    <button key={d} onClick={() => setDays(d)} className={cn("rounded-lg px-3 py-1.5 text-sm", days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>Last {d} days</button>
                ))}
            </div>

            {!data.hasData && (
                <div className="rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground">
                    No route data yet. It fills in as the Cortex extension syncs each day (reload the extension, then run a capture).
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    {[...byDay.entries()].map(([day, list]) => (
                        <div key={day} className="rounded-xl border border-border/50 bg-card">
                            <div className="border-b border-border/50 px-4 py-2 text-sm font-semibold">{fmtDay(day)} <span className="ml-2 text-xs font-normal text-muted-foreground">{list.length} route{list.length > 1 ? "s" : ""} covered</span></div>
                            <div className="divide-y divide-border/40">
                                {list.map((h) => (
                                    <div key={h.routeCode} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                                        <span className="w-16 font-mono font-semibold">{h.routeCode}</span>
                                        {(h.pickups || 0) > 0 && <span title="customer pickups on this route — stickers" className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">PU {h.pickups}</span>}
                                        <div className="min-w-[200px] flex-1">
                                            <div>
                                                <span className="text-muted-foreground">Assigned: </span>{h.owner.name}
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {h.owner.ranRoute ? `delivered ${h.owner.delivered}/${h.total}` : "did not run it"}
                                                    {!h.owner.scheduled && " · not on schedule"}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                {h.coveredBy.map((c) => (
                                                    <span key={c.tid} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                                                        <LifeBuoy className="h-3 w-3" />{c.name} · {c.delivered} pkgs / {c.stops} stops
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn("text-lg font-bold", h.coveredPct >= 50 ? "text-amber-400" : "")}>{h.coveredPct}%</div>
                                            <div className="text-[11px] text-muted-foreground">{h.covered}/{h.total} covered</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {data.hasData && handoffs.length === 0 && <div className="rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground">No hand-offs in this period.</div>}
                </div>

                <div className="h-fit rounded-xl border border-border/50 bg-card">
                    <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-amber-400" />Rescue leaderboard</div>
                    <div className="divide-y divide-border/40">
                        {leaders.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nobody yet.</div>}
                        {leaders.map((l, i) => (
                            <div key={l.tid} className="flex items-center gap-3 px-4 py-2 text-sm">
                                <span className="w-5 text-muted-foreground">{i + 1}</span>
                                <div className="flex-1">
                                    <div className="font-medium">{l.name}</div>
                                    <div className="text-xs text-muted-foreground">{l.routes} route{l.routes > 1 ? "s" : ""} · {l.days} day{l.days > 1 ? "s" : ""}</div>
                                </div>
                                <div className="text-right"><div className="font-bold">{l.packages}</div><div className="text-[11px] text-muted-foreground">pkgs</div></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
