"use client";

// Customer Delivery Feedback queue. Amazon reports negative feedback about a
// day late; each item must be discussed with the driver. An item stays in the
// queue until it has been — drivers who are off today simply wait for their
// next shift. Tabs: Working today (act now), Pending (everything waiting),
// All (history).

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, CheckCircle2, Copy, Undo2, Repeat, Clock, Briefcase, CalendarOff } from "lucide-react";

interface Item {
    _id: string; stationCode: string; trackingId: string; transporterId: string; driverName: string;
    deliveryDate: string; deliveredAt?: string; reasons: string[];
    itineraryId?: string; stopIndex?: number; serviceAreaId?: string;
    status: "open" | "discussed" | "dismissed"; discussedAt?: string; discussedBy?: string; outcome?: string; note?: string;
    driverCount: number;
    today: { working: boolean; type: string; routeNumber: string; waveTime: string; absent: boolean };
}

const OUTCOMES = ["Verbal coaching", "Written warning", "Retraining", "Reviewed — not driver's fault", "Driver disputes"];

const cortexLink = (i: Item) =>
    i.itineraryId
        ? `https://logistics.amazon.com/operations/execution/itineraries/${i.itineraryId}/documentType/Itinerary?provider=ALL_DRIVERS&selectedDay=${i.deliveryDate}&serviceAreaId=${i.serviceAreaId || ""}`
        : "";
const cdfLink = (i: Item) =>
    `https://logistics.amazon.com/performance?pageId=dsp_customer_delivery_feedback_negative&navMenuVariant=external&station=${i.stationCode}&tabId=customer-delivery-feedback-daily-tab&timeFrame=Daily&to=${i.deliveryDate}`;

const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) : "");
const ageDays = (d: string, today: string) => Math.max(0, Math.round((new Date(today + "T12:00:00").getTime() - new Date(d + "T12:00:00").getTime()) / 86400000));
const waveLabel = (w: string) => { const m = w.match(/^(\d{1,2}):(\d{2})$/); if (!m) return w; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`; };

export default function CdfQueuePage() {
    const qc = useQueryClient();
    const [days, setDays] = useState(30);
    const [tab, setTab] = useState<"working" | "pending" | "all">("working");
    const [form, setForm] = useState<{ ids: string[]; name: string; outcome: string; note: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["performance", "cdf", days],
        queryFn: async () => {
            const r = await fetch(`/api/performance/cdf?days=${days}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load");
            return (await r.json()) as { today: string; items: Item[] };
        },
        staleTime: 60_000,
    });
    const items = data?.items || [];
    const today = data?.today || "";

    const stats = useMemo(() => {
        const open = items.filter((i) => i.status === "open");
        const workingOpen = open.filter((i) => i.today.working);
        const wk = Date.now() - 7 * 86400000;
        return {
            workingDrivers: new Set(workingOpen.map((i) => i.transporterId)).size,
            workingItems: workingOpen.length,
            pending: open.length,
            pendingDrivers: new Set(open.map((i) => i.transporterId)).size,
            discussedWeek: items.filter((i) => i.status !== "open" && i.discussedAt && new Date(i.discussedAt).getTime() > wk).length,
            oldest: open.length ? Math.max(...open.map((i) => ageDays(i.deliveryDate, today))) : 0,
        };
    }, [items, today]);

    const groups = useMemo(() => {
        const shown = items.filter((i) =>
            tab === "all" ? true : tab === "pending" ? i.status === "open" : i.status === "open" && i.today.working);
        const m = new Map<string, Item[]>();
        shown.forEach((i) => { const k = i.transporterId || i.driverName; (m.get(k) || m.set(k, []).get(k)!).push(i); });
        return [...m.entries()].map(([k, list]) => ({
            key: k, name: list[0].driverName || k, list, today: list[0].today,
            open: list.filter((x) => x.status === "open"),
            oldest: Math.max(...list.filter((x) => x.status === "open").map((x) => ageDays(x.deliveryDate, today)), 0),
        })).sort((a, b) => Number(b.today.working) - Number(a.today.working) || b.oldest - a.oldest || b.open.length - a.open.length);
    }, [items, tab, today]);

    const save = async (ids: string[], status: "discussed" | "open", outcome = "", note = "") => {
        setSaving(true);
        try {
            const res = await Promise.all(ids.map((id) => fetch("/api/performance/cdf", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, outcome, note }) })));
            if (res.some((r) => !r.ok)) throw new Error();
            notify.success(status === "open" ? "Reopened" : "Recorded as discussed");
            setForm(null);
            qc.invalidateQueries({ queryKey: ["performance"] });
        } catch { notify.error("Could not save"); } finally { setSaving(false); }
    };

    if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (error) return <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">{(error as Error).message}</div>;

    const TABS: { k: typeof tab; label: string; n: number }[] = [
        { k: "working", label: "Working today", n: stats.workingItems },
        { k: "pending", label: "Pending discussion", n: stats.pending },
        { k: "all", label: "All", n: items.length },
    ];

    return (
        <div className="flex h-full flex-col gap-4 overflow-auto">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="Talk to today" value={stats.workingDrivers} hint={`${stats.workingItems} item${stats.workingItems === 1 ? "" : "s"} · driver${stats.workingDrivers === 1 ? "" : "s"} on shift`} tone={stats.workingDrivers ? "text-red-400" : "text-emerald-400"} />
                <Kpi label="Waiting for next shift" value={Math.max(0, stats.pendingDrivers - stats.workingDrivers)} hint="not working today — stays queued" />
                <Kpi label="Oldest waiting" value={stats.oldest} hint="days since delivery" tone={stats.oldest >= 5 ? "text-amber-400" : undefined} />
                <Kpi label="Discussed, last 7 days" value={stats.discussedWeek} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border/50 p-0.5 text-sm">
                    {TABS.map((t) => (
                        <button key={t.k} onClick={() => setTab(t.k)} className={cn("rounded-md px-4 py-2 font-medium transition", tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                            {t.label} <span className="opacity-70">({t.n})</span>
                        </button>
                    ))}
                </div>
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm">
                    {[14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
                </select>
                <span className="ml-auto text-xs text-muted-foreground">Pulled from Amazon every morning · feedback arrives about a day late</span>
            </div>

            {groups.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-10 text-center text-sm text-muted-foreground">
                    {tab === "working" ? "Nobody working today has feedback waiting." : tab === "pending" ? "Nothing waiting to be discussed." : "No feedback in this range."}
                </div>
            )}

            {groups.map((g) => (
                <div key={g.key} className="overflow-hidden rounded-xl border border-border/50 bg-card">
                    <div className="flex flex-wrap items-center gap-3 border-b border-border/40 bg-secondary/20 px-4 py-3">
                        <div className="text-lg font-semibold">{g.name}</div>
                        {g.today.working ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400"><Briefcase className="h-3.5 w-3.5" />Working today{g.today.routeNumber ? ` · ${g.today.routeNumber}` : ""}{g.today.waveTime ? ` · wave ${waveLabel(g.today.waveTime)}` : ""}</span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/15 px-2.5 py-1 text-xs font-medium text-zinc-400"><CalendarOff className="h-3.5 w-3.5" />{g.today.absent ? "Absent today" : g.today.type ? g.today.type + " today" : "Not scheduled today"}</span>
                        )}
                        {g.open.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />waiting {g.oldest}d</span>}
                        {g.list[0].driverCount >= 2 && <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-400"><Repeat className="h-3 w-3" />{g.list[0].driverCount} in {days}d</span>}
                        {g.open.length > 0 && (
                            <Button size="sm" className="ml-auto" onClick={() => setForm({ ids: g.open.map((x) => x._id), name: g.name, outcome: OUTCOMES[0], note: "" })}>
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />Discussed with driver ({g.open.length})
                            </Button>
                        )}
                    </div>
                    {g.list.map((i) => (
                        <div key={i._id} className="grid grid-cols-1 gap-3 border-b border-border/30 px-4 py-3 text-sm md:grid-cols-[150px_minmax(220px,1.6fr)_minmax(260px,1.4fr)_minmax(150px,auto)] md:items-center">
                            <div>
                                <div className="font-semibold">{fmtDate(i.deliveryDate)}</div>
                                <div className="text-xs text-muted-foreground">{fmtTime(i.deliveredAt)}{i.stationCode ? ` · ${i.stationCode}` : ""}</div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {i.reasons.length ? i.reasons.map((r, k) => <span key={k} className="rounded bg-red-500/15 px-2 py-1 text-xs font-medium text-red-400">{r}</span>) : <span className="text-xs text-muted-foreground">No reason given</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <button onClick={() => { navigator.clipboard?.writeText(i.trackingId); notify.success("TBA copied"); }} className="inline-flex items-center gap-1 rounded border border-border/50 px-2 py-1 font-mono hover:bg-secondary/50"><Copy className="h-3 w-3" />{i.trackingId}</button>
                                {cortexLink(i) && <a href={cortexLink(i)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-border/50 px-2 py-1 hover:bg-secondary/50"><ExternalLink className="h-3 w-3" />Stop in Cortex{typeof i.stopIndex === "number" ? ` (#${i.stopIndex})` : ""}</a>}
                                <a href={cdfLink(i)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-border/50 px-2 py-1 hover:bg-secondary/50"><ExternalLink className="h-3 w-3" />CDF page</a>
                            </div>
                            <div className="text-xs md:text-right">
                                {i.status === "open" ? (
                                    <span className="text-red-400">Not discussed</span>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="text-emerald-400">Discussed {i.discussedAt ? new Date(i.discussedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} · {i.discussedBy || "—"}</div>
                                        {i.outcome && <div className="text-muted-foreground">{i.outcome}</div>}
                                        {i.note && <div className="text-muted-foreground md:ml-auto">“{i.note}”</div>}
                                        <button onClick={() => save([i._id], "open")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Undo2 className="h-3 w-3" />Reopen</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {form && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setForm(null)}>
                    <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-base font-semibold">Record the conversation with {form.name}</div>
                        <div className="mb-3 text-xs text-muted-foreground">Applies to {form.ids.length} feedback item{form.ids.length > 1 ? "s" : ""}.</div>
                        <label className="text-xs font-medium">Outcome</label>
                        <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className="mb-3 mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm">
                            {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                        </select>
                        <label className="text-xs font-medium">Notes (optional)</label>
                        <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What was discussed, what the driver said…" className="mb-4 mt-1" />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
                            <Button size="sm" onClick={() => save(form.ids, "discussed", form.outcome, form.note)} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                        </div>
                    </div>
                </div>
            )}
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
