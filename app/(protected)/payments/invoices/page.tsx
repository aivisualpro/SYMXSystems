"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, typeInfo, timeLeft, MY_STATUS, TYPE_LABEL } from "../_lib";

const FILTERS = [
    { id: "pending", label: "Needs action" },
    { id: "", label: "All" },
    { id: "reviewing", label: "Reviewing" },
    { id: "disputed", label: "Disputed" },
    { id: "accepted", label: "Accepted" },
];

function Inner() {
    const sp = useSearchParams();
    const [status, setStatus] = useState(sp.get("status") ?? "pending");
    const [type, setType] = useState("");
    const { data, isLoading } = useQuery({
        queryKey: ["payments", "invoices", status, type],
        queryFn: async () => { const r = await fetch(`/api/payments/invoices?days=180&status=${status}&type=${type}`); if (!r.ok) throw new Error("Failed"); return r.json(); },
    });
    const rows: any[] = data?.rows || [];
    const total = rows.reduce((a, r) => a + r.amount, 0);

    return (
        <div className="space-y-3 pb-10">
            <div className="rounded-xl border border-border/50 bg-card p-3 text-xs text-muted-foreground">
                Open an invoice to review it. <b>Accept</b> means "this is correct" and ends your right to dispute; <b>dispute</b> asks Amazon to add missing money. The original invoice is paid on normal terms either way. Window to dispute: 14 days.
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                    <button key={f.id} onClick={() => setStatus(f.id)} className={cn("rounded-lg px-3 py-1.5 text-sm", status === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{f.label}</button>
                ))}
                <select value={type} onChange={(e) => setType(e.target.value)} className="ml-auto h-9 rounded-lg border border-border bg-background px-2 text-sm">
                    <option value="">All types</option>
                    {Object.entries(TYPE_LABEL).filter(([k]) => k !== "VEHICLE_PAYMENT").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <span className="text-sm text-muted-foreground">{rows.length} invoices · <b>{money(total)}</b></span>
            </div>
            {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
                <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr><th className="px-3 py-2 text-left">Station</th><th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Period</th><th className="px-2 py-2 text-left">Invoice</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-left">Pay date</th><th className="px-2 py-2 text-left">Deadline</th><th className="px-2 py-2 text-left">Your status</th><th className="px-2 py-2 text-left">Audit</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {rows.map((r) => {
                                const ti = typeInfo(r.type); const tl = timeLeft(r.hoursLeft);
                                return (
                                    <tr key={r.id} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-mono font-semibold"><Link href={`/payments/invoices/${r.id}`}>{r.station}</Link></td>
                                        <td className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs", ti.color)}>{ti.label}</span>{r.flow === "ADJUSTMENT" && <span className="ml-1 text-[10px] text-amber-400">adjustment</span>}</td>
                                        <td className="px-2 py-2"><Link href={`/payments/invoices/${r.id}`} className="hover:underline">{r.label}</Link></td>
                                        <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{r.number}</td>
                                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{money(r.amount, true)}</td>
                                        <td className="px-2 py-2 text-xs">{r.paymentDate || "—"}</td>
                                        <td className={cn("px-2 py-2 text-xs", tl.cls)}>{r.windowOpen ? tl.text : "—"}</td>
                                        <td className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs", MY_STATUS[r.myStatus]?.color)}>{MY_STATUS[r.myStatus]?.label}</span></td>
                                        <td className="px-2 py-2 text-xs">{r.findings > 0 ? <span className="flex items-center gap-1 text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{r.findings} · {money(r.atStake)}</span> : r.hasDetail ? <span className="text-muted-foreground">clean</span> : <span className="text-muted-foreground">pending</span>}</td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No invoices match.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function InvoicesPage() { return <Suspense fallback={null}><Inner /></Suspense>; }
