"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const shift = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const label = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const hm = (m: number | null) => (m === null || m === undefined ? "—" : `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`);
const delta = (m: number) => (m > 0 ? `+${m}` : `${m}`);

export default function DayDetailPage() {
    const [date, setDate] = useState(today());
    const { data, isLoading, error } = useQuery({
        queryKey: ["performance", "day", date],
        queryFn: async () => {
            const r = await fetch(`/api/performance/day?date=${date}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
            return r.json();
        },
    });

    const k = data?.kpi;
    return (
        <div className="space-y-3 pb-8">
            <div className="flex items-center gap-2">
                <button onClick={() => setDate(shift(date, -1))} className="rounded-lg bg-muted px-3 py-1.5 text-sm">←</button>
                <div className="min-w-[140px] text-center text-sm font-semibold">{label(date)}</div>
                <button onClick={() => setDate(shift(date, 1))} disabled={date >= today()} className="rounded-lg bg-muted px-3 py-1.5 text-sm disabled:opacity-40">→</button>
                <button onClick={() => setDate(today())} className="rounded-lg bg-muted px-3 py-1.5 text-sm">Today</button>
            </div>

            {k && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {[
                        { l: "Drivers captured", v: k.drivers },
                        { l: "Avg stops / hr", v: k.avgStopsPerHour },
                        { l: "Behind plan >15m at end", v: k.behindAtEnd },
                        { l: "Meal issues", v: k.mealIssues },
                        { l: "Rest issues", v: k.restIssues },
                    ].map((c) => (
                        <div key={c.l} className="rounded-xl border border-border/50 bg-card p-3">
                            <div className="text-xs text-muted-foreground">{c.l}</div>
                            <div className="text-2xl font-bold">{c.v}</div>
                        </div>
                    ))}
                </div>
            )}

            {isLoading && <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {error && <div className="p-4 text-sm text-red-500">{(error as Error).message}</div>}
            {data && data.rows.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground">
                    No driver detail for this day yet. It fills in when the extension's capture visits each driver's itinerary (reload the extension, then Run capture now).
                </div>
            )}

            {data && data.rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left">Driver</th>
                                <th className="px-2 py-2 text-left">Route</th>
                                <th className="px-2 py-2 text-right">Stops</th>
                                <th className="px-2 py-2 text-right" title="Stops per active hour, breaks excluded">Stops/hr</th>
                                <th className="px-2 py-2 text-right" title="Average minutes between stops, breaks excluded">Gap</th>
                                <th className="px-2 py-2 text-right" title="Average minutes vs Amazon's planned time at each stop">Avg vs plan</th>
                                <th className="px-2 py-2 text-right" title="Minutes behind/ahead at the last stop">End vs plan</th>
                                <th className="px-2 py-2 text-right" title="Stops no more than 5 min behind plan">On pace</th>
                                <th className="px-2 py-2 text-left">Meal</th>
                                <th className="px-2 py-2 text-left">Rest</th>
                                <th className="px-2 py-2 text-left" title="Doorstep / receptionist / household member">Delivered</th>
                                <th className="px-2 py-2 text-right">Fails</th>
                                <th className="px-2 py-2 text-right">PU</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {data.rows.map((r: any) => {
                                const mealBad = ["late", "short", "missing"].includes(r.meal.flag);
                                return (
                                    <tr key={r.tid} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-medium">{r.name}</td>
                                        <td className="px-2 py-2 font-mono">{r.routeCode}</td>
                                        <td className="px-2 py-2 text-right">{r.stops}</td>
                                        <td className="px-2 py-2 text-right font-semibold">{r.stopsPerHour}</td>
                                        <td className="px-2 py-2 text-right">{r.avgGapMin}m</td>
                                        <td className={cn("px-2 py-2 text-right", r.avgDeltaMin > 10 ? "text-red-400" : r.avgDeltaMin < 0 ? "text-emerald-400" : "")}>{delta(r.avgDeltaMin)}m</td>
                                        <td className={cn("px-2 py-2 text-right font-semibold", r.endDeltaMin > 15 ? "text-red-400" : r.endDeltaMin < 0 ? "text-emerald-400" : "")}>{delta(r.endDeltaMin)}m</td>
                                        <td className="px-2 py-2 text-right">{r.onTimePct}%</td>
                                        <td className={cn("px-2 py-2", mealBad ? "text-red-400" : "")}>
                                            {r.meal.flag === "n/a" ? "—" : r.meal.flag === "missing" ? "No meal" : `${hm(r.meal.startMin)} in · ${r.meal.minutes}m${r.meal.flag === "late" ? " · LATE" : r.meal.flag === "short" ? " · SHORT" : ""}`}
                                        </td>
                                        <td className={cn("px-2 py-2", r.rest.flag === "missing" ? "text-red-400" : "")}>{r.rest.count}/{r.rest.expected}{r.rest.flag === "missing" ? " ⚠" : ""}</td>
                                        <td className="px-2 py-2 text-xs text-muted-foreground">{r.quality.doorstepPct}/{r.quality.receptionistPct}/{r.quality.householdPct}%</td>
                                        <td className={cn("px-2 py-2 text-right", r.quality.notDelivered + r.quality.pickupFailed > 0 ? "text-amber-400" : "")}>{r.quality.notDelivered + r.quality.pickupFailed || "—"}</td>
                                        <td className="px-2 py-2 text-right">{r.pickups > 0 ? <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-400">{r.pickups}</span> : "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-muted-foreground">Pace compares each stop's actual time with Amazon's planned time (positive = behind). Meal is flagged late if it starts more than 5h after sign-in, short under 30 min; rests expected = 1 per 4h worked.</p>
        </div>
    );
}
