"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "../_lib";

const ST: Record<string, string> = { filed: "bg-amber-500/15 text-amber-400", won: "bg-emerald-500/15 text-emerald-400", partial: "bg-sky-500/15 text-sky-400", lost: "bg-red-500/15 text-red-400" };

export default function DisputesPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["payments", "disputes"], queryFn: async () => (await fetch("/api/payments/disputes")).json() });
    const { data: invs } = useQuery({ queryKey: ["payments", "invoices", "all"], queryFn: async () => (await fetch("/api/payments/invoices")).json() });
    const idByBatch = new Map<string, string>((invs?.rows || []).map((r: any) => [r.batchId, r.id]));
    const [edit, setEdit] = useState<Record<string, string>>({});
    const rows: any[] = data?.rows || [];
    const sum = (f: (d: any) => number) => rows.reduce((a, d) => a + f(d), 0);
    const outstanding = sum((d) => (d.status === "filed" ? d.amountClaimed : 0));
    const recovered = sum((d) => d.amountRecovered || 0);
    const decided = rows.filter((d) => d.status !== "filed");
    const winRate = decided.length ? Math.round((decided.filter((d) => d.status === "won" || d.status === "partial").length / decided.length) * 100) : null;
    const save = async (d: any, status: string) => {
        await fetch("/api/payments/disputes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d._id, status, amountRecovered: status === "won" ? (edit[d._id] ? Number(edit[d._id]) : d.amountClaimed) : status === "lost" ? 0 : Number(edit[d._id]) || 0, notes: d.notes }) });
        qc.invalidateQueries({ queryKey: ["payments"] });
    };

    return (
        <div className="space-y-4 pb-12">
            <div className="grid gap-3 sm:grid-cols-4">
                {[
                    { l: "Waiting on Amazon", v: money(outstanding, true), h: "Claimed on disputes with no answer yet" },
                    { l: "Recovered", v: money(recovered, true), h: "Extra money paid via adjustment invoices" },
                    { l: "Win rate", v: winRate === null ? "—" : `${winRate}%`, h: "Won or partly won, of disputes decided" },
                    { l: "Disputes filed", v: String(rows.length), h: "All time in SYMX" },
                ].map((k) => <div key={k.l} className="rounded-xl border border-border/50 bg-card p-4"><div className="text-xs text-muted-foreground">{k.l}</div><div className="mt-1 text-2xl font-bold tabular-nums">{k.v}</div><div className="mt-1 text-[11px] text-muted-foreground">{k.h}</div></div>)}
            </div>
            <p className="text-xs text-muted-foreground">Amazon answers a dispute by issuing an <b>adjustment invoice</b> (positive = they pay you more). When it syncs, find it on the Invoices tab, then mark the dispute here as won / partial / lost. Disputes are logged from an invoice's page after you file them in Amazon.</p>
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : rows.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No disputes logged yet.</div> : (
                    <table className="w-full text-sm"><thead className="border-b border-border/50 text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">Filed</th><th className="px-4 py-2 text-left font-medium">Invoice</th><th className="px-4 py-2 text-left font-medium">Category</th><th className="px-4 py-2 text-right font-medium">Claimed</th><th className="px-4 py-2 text-right font-medium">Recovered</th><th className="px-4 py-2 text-left font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
                        <tbody className="divide-y divide-border/40">{rows.map((d) => (
                            <tr key={d._id}>
                                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(d.filedAt).toLocaleDateString()}</td>
                                <td className="px-4 py-2">{idByBatch.get(d.batchId) ? <Link className="text-primary hover:underline" href={`/payments/invoices/${idByBatch.get(d.batchId)}`}>{d.stationCode} · {d.invoiceLabel}</Link> : `${d.stationCode} · ${d.invoiceLabel}`}</td>
                                <td className="px-4 py-2 capitalize">{d.category}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{money(d.amountClaimed, true)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{money(d.amountRecovered, true)}</td>
                                <td className="px-4 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs capitalize", ST[d.status])}>{d.status}</span></td>
                                <td className="px-4 py-2 text-right"><div className="flex items-center justify-end gap-1.5 text-xs">
                                    <input placeholder="$ back" value={edit[d._id] || ""} onChange={(e) => setEdit({ ...edit, [d._id]: e.target.value })} className="h-7 w-20 rounded border border-border bg-background px-1.5" inputMode="decimal" />
                                    <button onClick={() => save(d, "won")} className="rounded border border-border px-2 py-1 hover:bg-emerald-500/10">Won</button>
                                    <button onClick={() => save(d, "partial")} className="rounded border border-border px-2 py-1 hover:bg-sky-500/10">Partial</button>
                                    <button onClick={() => save(d, "lost")} className="rounded border border-border px-2 py-1 hover:bg-red-500/10">Lost</button>
                                </div></td>
                            </tr>))}</tbody></table>)}
            </div>
        </div>
    );
}
