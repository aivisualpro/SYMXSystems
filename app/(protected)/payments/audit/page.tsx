"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, fmtDay, KIND_LABEL } from "../_lib";

export default function AuditPage() {
    const qc = useQueryClient();
    const [status, setStatus] = useState("open");
    const [kind, setKind] = useState("all");
    const [station, setStation] = useState("all");
    const { data, isLoading } = useQuery({
        queryKey: ["payments", "findings", status],
        queryFn: async () => (await fetch(`/api/payments/findings?status=${status}`)).json(),
    });
    const { data: invs } = useQuery({ queryKey: ["payments", "invoices", "all"], queryFn: async () => (await fetch("/api/payments/invoices")).json() });
    const invByBatch = new Map<string, any>((invs?.rows || []).map((r: any) => [r.batchId, r]));
    const rows: any[] = (data?.rows || []).filter((f: any) => (kind === "all" || f.kind === kind) && (station === "all" || invByBatch.get(f.batchId)?.station === station));
    const stations = [...new Set((invs?.rows || []).map((r: any) => r.station))] as string[];
    const under = rows.filter((f) => f.direction === "under").reduce((a, f) => a + (f.amount || 0), 0);
    const set = async (id: string, s: string) => { await fetch("/api/payments/findings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: s }) }); qc.invalidateQueries({ queryKey: ["payments"] }); };

    return (
        <div className="space-y-4 pb-12">
            <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-card p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Every time an invoice syncs, SYMX compares what Amazon billed against what Cortex and your schedule recorded (routes run, rescues, late departures, packages, pickups) and against past rates. <b>"Possibly underpaid"</b> items are money you may be owed. <b>"FYI"</b> items are informational. These are leads — confirm in the Work Summary Tool before disputing.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/50 bg-card p-0.5">
                    {[["open", "Open"], ["dismissed", "Dismissed"], ["disputed", "Disputed"], ["all", "All"]].map(([v, l]) => <button key={v} onClick={() => setStatus(v)} className={cn("rounded-md px-3 py-1 text-xs", status === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>)}
                </div>
                <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs"><option value="all">All checks</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select value={station} onChange={(e) => setStation(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs"><option value="all">All stations</option>{stations.map((s) => <option key={s}>{s}</option>)}</select>
                <div className="ml-auto text-sm">Possibly underpaid: <b className="text-amber-400">{money(under, true)}</b> <span className="text-xs text-muted-foreground">across {rows.length} items</span></div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    : rows.length === 0 ? <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted-foreground"><ShieldCheck className="h-6 w-6 text-emerald-400" />Nothing here. Either invoices look clean or none have synced yet.</div>
                        : <div className="divide-y divide-border/40">{rows.map((f) => {
                            const inv = invByBatch.get(f.batchId);
                            return (
                                <div key={f._id} className="flex items-start gap-3 px-4 py-3">
                                    <span className={cn("mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", f.direction === "under" ? "bg-amber-500/15 text-amber-400" : f.direction === "over" ? "bg-sky-500/15 text-sky-400" : "bg-muted text-muted-foreground")}>{f.direction === "under" ? "Possibly underpaid" : f.direction === "over" ? "Overpaid" : "FYI"}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium">{f.title} <span className="text-xs font-normal text-muted-foreground">· {KIND_LABEL[f.kind] || f.kind}{f.date ? ` · ${fmtDay(f.date)}` : ""}</span></div>
                                        <p className="text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
                                        {inv && <Link href={`/payments/invoices/${inv.id}`} className="text-xs text-primary hover:underline">{inv.station} · {inv.label} →</Link>}
                                    </div>
                                    <div className="text-right"><div className="font-semibold tabular-nums">{money(f.amount, true)}</div>
                                        <div className="mt-1 flex justify-end gap-2 text-[11px] text-muted-foreground">
                                            {f.status === "open" ? <><button onClick={() => set(f._id, "resolved")} className="hover:text-foreground">Resolved</button><button onClick={() => set(f._id, "dismissed")} className="hover:text-foreground">Dismiss</button></> : <button onClick={() => set(f._id, "open")} className="hover:text-foreground">Reopen ({f.status})</button>}
                                        </div></div>
                                </div>
                            );
                        })}</div>}
            </div>
        </div>
    );
}
