"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const delta = (m: number) => (m > 0 ? `+${m}` : `${m}`);

export default function AreasPage() {
    const [days, setDays] = useState(30);
    const [open, setOpen] = useState<string | null>(null);
    const { data, isLoading, error } = useQuery({
        queryKey: ["performance", "areas", days],
        queryFn: async () => {
            const r = await fetch(`/api/performance/areas?days=${days}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
            return r.json();
        },
    });

    return (
        <div className="space-y-3 pb-8">
            <div className="flex items-center gap-2">
                {[14, 30, 60, 90].map((d) => (
                    <button key={d} onClick={() => setDays(d)} className={cn("rounded-lg px-3 py-1.5 text-sm", days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>Last {d} days</button>
                ))}
            </div>
            {isLoading && <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {error && <div className="p-4 text-sm text-red-500">{(error as Error).message}</div>}
            {data && !data.hasData && (
                <div className="rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground">
                    No area data yet. It builds up as the extension (v1.10.0) captures each driver's itinerary — reload the extension and run a capture.
                </div>
            )}
            {data?.hasData && (
                <div className="rounded-xl border border-border/50 bg-card">
                    <div className="grid grid-cols-[1fr_80px_80px_110px] gap-2 border-b border-border/50 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <div>Area (ZIP)</div><div className="text-right">Stops</div><div className="text-right">Packages</div><div className="text-right" title="Average minutes behind (+) / ahead (−) of plan per stop">Avg vs plan</div>
                    </div>
                    {data.areas.map((a: any) => (
                        <div key={a.zip} className="border-b border-border/30 last:border-0">
                            <button onClick={() => setOpen(open === a.zip ? null : a.zip)} className="grid w-full grid-cols-[1fr_80px_80px_110px] items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/20">
                                <div className="flex items-center gap-2"><ChevronRight className={cn("h-4 w-4 transition", open === a.zip && "rotate-90")} /><span className="font-mono font-semibold">{a.zip}</span><span className="text-muted-foreground">{a.city}</span></div>
                                <div className="text-right">{a.stops}</div>
                                <div className="text-right">{a.packages}</div>
                                <div className={cn("text-right font-semibold", a.avgDeltaMin > 5 ? "text-red-400" : a.avgDeltaMin < 0 ? "text-emerald-400" : "")}>{delta(a.avgDeltaMin)}m</div>
                            </button>
                            {open === a.zip && (
                                <div className="bg-muted/10 px-10 pb-3">
                                    <div className="grid grid-cols-[1fr_70px_60px_90px_110px] gap-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                        <div>Driver</div><div className="text-right">Stops</div><div className="text-right">Days</div><div className="text-right">Avg vs plan</div><div className="text-right" title="vs this driver's own average everywhere — negative means better here than usual">vs their usual</div>
                                    </div>
                                    {a.drivers.map((d: any) => (
                                        <div key={d.tid} className={cn("grid grid-cols-[1fr_70px_60px_90px_110px] gap-2 py-1 text-sm", !d.enough && "opacity-50")}>
                                            <div>{d.name}{!d.enough && <span className="ml-2 text-[10px] text-muted-foreground">too few stops</span>}</div>
                                            <div className="text-right">{d.stops}</div>
                                            <div className="text-right">{d.days}</div>
                                            <div className="text-right">{delta(d.avgDeltaMin)}m</div>
                                            <div className={cn("text-right font-semibold", d.enough && d.vsOwnAvg < -1 ? "text-emerald-400" : d.enough && d.vsOwnAvg > 1 ? "text-red-400" : "")}>{delta(d.vsOwnAvg)}m</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <p className="text-xs text-muted-foreground">Drivers are compared with their own average pace, so a naturally fast or slow driver isn't penalised. Drivers with fewer than {data?.minStops ?? 8} stops in an area are dimmed.</p>
        </div>
    );
}
