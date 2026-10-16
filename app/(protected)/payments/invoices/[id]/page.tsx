"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, ExternalLink, Copy, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { money, typeInfo, timeLeft, fmtDay, MY_STATUS, KIND_LABEL, AMAZON_INVOICE_URL } from "../../_lib";

const STEPS = ["to_review", "reviewing", "ready_to_accept", "disputed", "accepted"] as const;

// What each checklist item means, per invoice type (plain language).
function checklistFor(type: string): { key: string; label: string; help: string }[] {
    if (type === "SERVICE_PROVIDED") return [
        { key: "wst", label: "Work Summary Tool is correct", help: "Open the Work Summary Tool for each day of this week: routes, cancellations and delay time must match what really happened. Fix mistakes with a Change Request within 2 days of the work (Amazon can edit up to 3 days). If a day is already locked, dispute it here instead." },
        { key: "routes", label: "Route counts match what we ran", help: "Compare the billed routes per day with the routes SYMX saw delivered (see Audit findings below). Different service types are paid different rates, so check the type too." },
        { key: "upd", label: "Late-departure / delay pay reviewed", help: "If a route left 15+ minutes late because of Amazon (late trucks, late loads), you can request delay pay. Amazon must authorize it; without an Amazon rep's name it won't be paid." },
        { key: "rescues", label: "Rescue blocks reviewed", help: "When one driver finishes another driver's route, that can be billed as a rescue block — only if an Amazon rep authorized it. Check each hand-off." },
        { key: "packages", label: "Packages and pickups look right", help: "Per-package pay is about 99.9% accurate and station staff cannot edit it. A gap over 1% against Cortex is worth a trouble ticket. Pickups (customer returns) are paid per piece too." },
    ];
    if (type.startsWith("VEHICLE_PAYMENT")) return [
        { key: "wst", label: "All vehicles registered in Fleet Management", help: "Amazon pays only for vehicles registered in its Fleet Management tool. Check every active van is there before disputing." },
        { key: "routes", label: "Vehicle counts and rates match", help: "Prepayment = days active ÷ days in month × vehicles × monthly rate. The reconciliation corrects last month to the vehicles you actually had; negative amounts are clawbacks. Prepayment disputes under $5,000 are normally rejected." },
    ];
    if (type === "INCENTIVE_PAYMENT" || type === "PROMOTION") return [
        { key: "passThrough", label: "Passed on to drivers", help: "Incentive money is meant for drivers. Amazon audits payroll; if drivers aren't paid in full you get a Corrective Action Plan and must pay the shortfall. Confirm the drivers on Amazon's supplemental report were paid." },
    ];
    return [];
}

export default function InvoiceDetail() {
    const { id } = useParams<{ id: string }>();
    const qc = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ["payments", "invoice", id],
        queryFn: async () => { const r = await fetch(`/api/payments/invoices/${id}`); if (!r.ok) throw new Error("Not found"); return r.json(); },
    });
    const [notes, setNotes] = useState("");
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [form, setForm] = useState<{ category: string; reason: string; amount: string } | null>(null);
    useEffect(() => { if (data) { setNotes(data.invoice.notes || ""); setPicked(new Set(data.findings.filter((f: any) => f.status === "open" && f.direction === "under").map((f: any) => f.key))); } }, [data?.invoice?._id]); // eslint-disable-line

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (error || !data) return <div className="p-6 text-sm text-red-500">Invoice not found.</div>;
    const inv = data.invoice; const ti = typeInfo(inv.type); const tl = timeLeft(inv.hoursLeft);
    const checklist = checklistFor(inv.type);
    const refresh = () => qc.invalidateQueries({ queryKey: ["payments"] });
    const patch = async (body: any) => { await fetch(`/api/payments/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); refresh(); };
    const setFinding = async (fid: string, status: string) => { await fetch("/api/payments/findings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fid, status }) }); refresh(); };

    const selected = data.findings.filter((f: any) => picked.has(f.key));
    const claim = selected.reduce((a: number, f: any) => a + (f.amount || 0), 0);
    const packet = () => [
        `Invoice ${inv.invoiceNumber} (${inv.stationCode} · ${inv.label}) — dispute request`,
        "",
        ...selected.map((f: any, i: number) => `${i + 1}. ${f.date ? fmtDay(f.date) + " — " : ""}${f.title}. Billed ${f.billed ?? "?"}, our records show ${f.expected ?? "?"}. Estimated ${money(f.amount, true)}.\n   ${f.detail}`),
        "",
        `Total estimated: ${money(claim, true)}`,
    ].join("\n");
    const copyPacket = async () => { await navigator.clipboard.writeText(packet()); notify.success("Dispute packet copied"); };
    const logDispute = async () => {
        if (!form) return;
        const r = await fetch("/api/payments/disputes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: id, category: form.category, reason: form.reason, amountClaimed: Number(form.amount) || 0, findingKeys: [...picked] }) });
        if (r.ok) { notify.success("Dispute logged"); setForm(null); refresh(); } else notify.error("Could not save");
    };
    const p = data.parsed;
    const openFindings = data.findings.filter((f: any) => f.status === "open");

    return (
        <div className="space-y-4 pb-12">
            <Link href="/payments/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All invoices</Link>

            <div className="rounded-xl border border-border/50 bg-card p-4">
                <div className="flex flex-wrap items-start gap-4">
                    <div>
                        <div className="flex items-center gap-2"><span className="font-mono text-xl font-bold">{inv.stationCode}</span><span className={cn("rounded-full px-2 py-0.5 text-xs", ti.color)}>{ti.label}</span><span className="text-lg font-semibold">{inv.label}</span>{inv.flow === "ADJUSTMENT" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">Adjustment invoice</span>}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{ti.blurb} · {inv.periodStart && `${fmtDay(inv.periodStart)} – ${fmtDay(inv.periodEnd)} · `}{inv.invoiceNumber}</div>
                    </div>
                    <div className="ml-auto text-right">
                        <div className="text-3xl font-bold tabular-nums">{money(inv.amount, true)}</div>
                        <div className="text-xs text-muted-foreground">Amazon status: {inv.amazonStatus?.replace(/_/g, " ").toLowerCase()} {inv.paymentDate && `· pays ${inv.paymentDate}`}</div>
                        <div className={cn("text-sm", tl.cls)}>{inv.disputeWindowStatus === "OPEN" ? `Dispute window: ${tl.text}` : "Dispute window closed"}</div>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {STEPS.map((s) => (
                        <button key={s} onClick={() => patch({ myStatus: s })} title={MY_STATUS[s].hint}
                            className={cn("rounded-lg border px-3 py-1.5 text-xs transition", inv.myStatus === s ? cn(MY_STATUS[s].color, "border-transparent font-semibold") : "border-border text-muted-foreground hover:text-foreground")}>
                            {MY_STATUS[s].label}
                        </button>
                    ))}
                    <a href={AMAZON_INVOICE_URL(inv.batchId)} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Open in Amazon <ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" />These buttons only track your own review. Accepting or disputing still happens in Amazon's portal (use "Open in Amazon").</div>
            </div>

            {!inv.hasDetail && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">This invoice's line items haven't been synced yet. Run <b>Sync payments now</b> from the extension to audit it.</div>}

            {checklist.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card">
                    <div className="border-b border-border/50 px-4 py-3"><div className="text-sm font-semibold">Review checklist</div><div className="text-xs text-muted-foreground">Work top to bottom. Tick each step when you're satisfied; click a step to see what it means.</div></div>
                    <div className="divide-y divide-border/40">
                        {checklist.map((c) => (
                            <details key={c.key} className="group px-4 py-3">
                                <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
                                    <input type="checkbox" checked={!!inv.checklist?.[c.key]} onClick={(e) => e.stopPropagation()} onChange={(e) => patch({ checklist: { [c.key]: e.target.checked } })} className="h-4 w-4" />
                                    <span className={cn(inv.checklist?.[c.key] && "text-muted-foreground line-through")}>{c.label}</span>
                                    <span className="ml-auto text-xs text-muted-foreground group-open:hidden">what's this?</span>
                                </summary>
                                <p className="mt-2 pl-7 text-xs leading-relaxed text-muted-foreground">{c.help}</p>
                            </details>
                        ))}
                    </div>
                    {data.activeVehicles !== null && <div className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">SYMX shows <b>{data.activeVehicles}</b> active vehicles at this station right now — compare with the quantities below.</div>}
                </div>
            )}

            <div className="rounded-xl border border-border/50 bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                    <div><div className="text-sm font-semibold">Audit findings</div><div className="text-xs text-muted-foreground">Places where this invoice differs from what SYMX captured. Each is a lead to check, not a verdict.{inv.coverage?.daysTotal ? ` Cortex data covers ${inv.coverage.daysWithCortex} of ${inv.coverage.daysTotal} days of this period.` : ""}</div></div>
                    {openFindings.some((f: any) => f.direction === "under") && (
                        <div className="flex gap-2">
                            <button onClick={copyPacket} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><Copy className="h-3.5 w-3.5" />Copy dispute packet ({selected.length})</button>
                            <button onClick={() => setForm({ category: "routes", reason: packet(), amount: String(Math.round(claim * 100) / 100) })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">I filed a dispute — log it</button>
                        </div>
                    )}
                </div>
                {data.findings.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-400" />{inv.hasDetail ? "Nothing flagged for this invoice." : "Not audited yet."}</div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {data.findings.map((f: any) => (
                            <div key={f._id} className={cn("flex items-start gap-3 px-4 py-3", f.status !== "open" && "opacity-55")}>
                                {f.direction === "under" && f.status === "open"
                                    ? <input type="checkbox" className="mt-1 h-4 w-4" checked={picked.has(f.key)} onChange={(e) => { const n = new Set(picked); e.target.checked ? n.add(f.key) : n.delete(f.key); setPicked(n); }} title="Include in dispute packet" />
                                    : <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{f.title}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{KIND_LABEL[f.kind] || f.kind}</span>{f.date && <span className="text-xs text-muted-foreground">{fmtDay(f.date)}</span>}{f.status !== "open" && <span className="text-xs text-muted-foreground">· {f.status}</span>}</div>
                                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
                                </div>
                                <div className="text-right"><div className={cn("font-semibold tabular-nums", f.direction === "under" ? "text-amber-400" : "text-muted-foreground")}>{money(f.amount, true)}</div>
                                    <div className="mt-1 flex justify-end gap-2 text-[11px]">{f.status === "open" ? <button className="text-muted-foreground hover:text-foreground" onClick={() => setFinding(f._id, "dismissed")}>Dismiss</button> : <button className="text-muted-foreground hover:text-foreground" onClick={() => setFinding(f._id, "open")}>Reopen</button>}</div></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {form && (
                <div className="rounded-xl border border-primary/40 bg-card p-4">
                    <div className="mb-2 text-sm font-semibold">Log the dispute you filed in Amazon</div>
                    <div className="grid gap-3 md:grid-cols-[160px_160px_1fr]">
                        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                            {["routes", "upd", "rescue", "packages", "pickups", "rate", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount claimed" className="h-9 rounded-lg border border-border bg-background px-2 text-sm" inputMode="decimal" />
                        <button onClick={logDispute} className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Save</button>
                    </div>
                    <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={5} className="mt-3 w-full rounded-lg border border-border bg-background p-2 text-xs" />
                </div>
            )}

            {p && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-border/50 bg-card">
                        <div className="border-b border-border/50 px-4 py-3"><div className="text-sm font-semibold">Routes billed, day by day</div><div className="text-xs text-muted-foreground">Each line is a service type × quantity × rate. Rates depend on the service type and block length.</div></div>
                        <div className="divide-y divide-border/40">
                            {p.days.map((d: any) => (
                                <div key={d.label} className="px-4 py-2">
                                    <div className="flex justify-between text-sm font-medium"><span>{d.label}</span><span className="tabular-nums">{d.count} routes · {money(d.amount, true)}</span></div>
                                    <div className="mt-1 space-y-0.5">{d.lines.map((l: any, i: number) => <div key={i} className="flex justify-between text-xs text-muted-foreground"><span>{l.qty} × {l.serviceType}</span><span className="tabular-nums">{money(l.rate, true)} → {money(l.amount, true)}</span></div>)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {[
                            { t: "Rescue blocks", rows: p.rescue, help: "Paid when one driver finishes another's route and an Amazon rep authorized it." },
                            { t: "Delay pay (unplanned delay)", rows: p.upd, help: "Hours Amazon agreed delayed you. Entered by station staff in the Work Summary Tool." },
                            { t: "Late cancellations", rows: p.lateCancels, help: "Paid when Amazon cancels a route you were scheduled for within 12 hours of its start." },
                            { t: "Training", rows: p.training, help: "Paid training blocks (shadow / on-road experience)." },
                        ].map((s) => (
                            <div key={s.t} className="rounded-xl border border-border/50 bg-card">
                                <div className="border-b border-border/50 px-4 py-2.5"><div className="text-sm font-semibold">{s.t} <span className="font-normal text-muted-foreground">· {money(s.rows.reduce((a: number, r: any) => a + r.amount, 0), true)}</span></div><div className="text-[11px] text-muted-foreground">{s.help}</div></div>
                                <div className="divide-y divide-border/30 text-xs">
                                    {s.rows.length === 0 && <div className="px-4 py-3 text-muted-foreground">None this period.</div>}
                                    {s.rows.map((r: any, i: number) => <div key={i} className="flex justify-between px-4 py-1.5"><span>{r.date ? fmtDay(r.date) + " · " : ""}{r.type}</span><span className="tabular-nums text-muted-foreground">{r.qty} × {money(r.rate, true)} = {money(r.amount, true)}</span></div>)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 text-sm">
                        <b>Packages:</b> {p.deliveries.toLocaleString()} deliveries · {p.pickups} pickups · {money(p.packages.reduce((a: number, x: any) => a + x.amount, 0), true)} <span className="text-xs text-muted-foreground">(includes the branding fee per delivery)</span>
                    </div>
                </div>
            )}

            {!p && inv.tables?.length > 0 && inv.tables.map((t: any) => (
                <div key={t.heading} className="rounded-xl border border-border/50 bg-card">
                    <div className="border-b border-border/50 px-4 py-3 text-sm font-semibold capitalize">{t.heading}</div>
                    <table className="w-full text-sm"><thead className="text-xs text-muted-foreground"><tr>{t.columns.map((c: string) => <th key={c} className="px-4 py-1.5 text-left font-medium">{c}</th>)}</tr></thead>
                        <tbody className="divide-y divide-border/30">{t.rows.flatMap((r: any) => r.lines).map((l: string[], i: number) => <tr key={i}>{l.map((c, j) => <td key={j} className="px-4 py-1.5">{j > 0 && !isNaN(Number(c)) && c !== "" ? Number(c).toLocaleString("en-US", { maximumFractionDigits: 2 }) : c}</td>)}</tr>)}</tbody></table>
                </div>
            ))}

            {data.disputes.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card px-4 py-3 text-sm">
                    <div className="mb-1 font-semibold">Disputes on this invoice</div>
                    {data.disputes.map((d: any) => <div key={d._id} className="flex justify-between text-xs text-muted-foreground"><span>{new Date(d.filedAt).toLocaleDateString()} · {d.category} · {d.status}</span><span>{money(d.amountClaimed, true)} claimed · {money(d.amountRecovered, true)} recovered</span></div>)}
                </div>
            )}

            <div className="rounded-xl border border-border/50 bg-card p-4">
                <div className="mb-1 text-sm font-semibold">Notes</div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (inv.notes || "") && patch({ notes })} rows={3} placeholder="Who you spoke to at the station, what they promised, ticket numbers…" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
            </div>
        </div>
    );
}
