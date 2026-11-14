"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useSiteContext } from "@/components/providers/site-context-provider";
import { buildFuelClaimPDF } from "@/lib/fuel-claim-pdf";
import { Loader2, Plus, FileText, Trash2, Pencil, ImagePlus, X, Search, Fuel, Zap, ClipboardCheck } from "lucide-react";

type Status = "needs_submission" | "submitted" | "approved" | "denied";

interface Claim {
  _id: string;
  claimNumber: string;
  date: string;
  expenseType: "Fuel" | "EV Charging";
  driverName: string;
  transporterId?: string;
  tripType: "Route" | "Rescue";
  routeNumber?: string;
  vendor?: string;
  amount: number;
  paidWith?: string;
  driverRepaid?: "yes" | "no" | "not_needed";
  notes?: string;
  receipts: string[];
  status: Status;
  submittedDate?: string;
  amazonReference?: string;
  approvedAmount?: number;
  decidedDate?: string;
  denialReason?: string;
  pdfUrl?: string;
  pdfPublicId?: string;
  activity?: { text: string; byName?: string; createdAt: string }[];
}

const STATUS: Record<Status, { label: string; chip: string; card: string }> = {
  needs_submission: { label: "Needs submission", chip: "bg-amber-500/15 text-amber-500 ring-amber-500/30", card: "border-amber-500/40" },
  submitted: { label: "Submitted to Amazon", chip: "bg-blue-500/15 text-blue-500 ring-blue-500/30", card: "border-blue-500/40" },
  approved: { label: "Approved", chip: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30", card: "border-emerald-500/40" },
  denied: { label: "Denied", chip: "bg-red-500/15 text-red-500 ring-red-500/30", card: "border-red-500/40" },
};
const ORDER: Status[] = ["needs_submission", "submitted", "approved", "denied"];
const PAID_WITH = ["Driver's own card", "Driver's cash", "Company card (not gas card)", "Other"];

const money = (n?: number) => (typeof n === "number" ? `$${n.toFixed(2)}` : "—");
const fmtDate = (d?: string) =>
  d ? new Date(String(d).slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const dateInput = (d?: string) => (d ? String(d).slice(0, 10) : "");

interface FormState {
  id?: string;
  date: string;
  expenseType: "Fuel" | "EV Charging";
  driverName: string;
  transporterId: string;
  employeeId: string;
  tripType: "Route" | "Rescue";
  routeNumber: string;
  vendor: string;
  amount: string;
  paidWith: string;
  driverRepaid: "yes" | "no" | "not_needed";
  notes: string;
  receipts: string[];
}
const emptyForm = (): FormState => ({
  date: todayStr(), expenseType: "Fuel", driverName: "", transporterId: "", employeeId: "", tripType: "Route", routeNumber: "",
  vendor: "", amount: "", paidWith: PAID_WITH[0], driverRepaid: "no", notes: "", receipts: [],
});

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function FuelClaimsPage() {
  const { activeLabel } = useSiteContext();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summary, setSummary] = useState<Record<string, { count: number; amount: number; approved: number }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; name: string; transporterId: string }[]>([]);
  const [driverOpen, setDriverOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [statusTarget, setStatusTarget] = useState<Claim | null>(null);
  const [statusForm, setStatusForm] = useState({ status: "submitted" as Status, submittedDate: "", amazonReference: "", approvedAmount: "", decidedDate: "", denialReason: "" });
  const [detail, setDetail] = useState<Claim | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet/fuel-claims");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setClaims(j.claims || []);
      setSummary(j.summary || {});
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/admin/employees?skip=0&limit=500&terminated=false")
      .then((r) => r.json())
      .then((raw) => {
        const list = raw?.records ?? raw ?? [];
        setEmployees(
          (Array.isArray(list) ? list : []).map((e: any) => ({
            id: String(e._id),
            name: e.name || `${e.firstName || ""} ${e.lastName || ""}`.trim(),
            transporterId: e.transporterId || "",
          })).filter((e) => e.name)
        );
      })
      .catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return [c.driverName, c.claimNumber, c.routeNumber, c.vendor, c.amazonReference].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [claims, filter, search]);

  const driverMatches = useMemo(() => {
    const q = (form?.driverName || "").trim().toLowerCase();
    if (!q) return [];
    return employees.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [employees, form?.driverName]);

  // ── PDF: build, save to the cloud, download ──
  const makePdf = async (c: Claim, download: boolean) => {
    setPdfBusy(c._id);
    try {
      const blob = await buildFuelClaimPDF(c as any, activeLabel || "");
      const file = new File([blob], `${c.claimNumber}.pdf`, { type: "application/pdf" });
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/admin/upload?folder=symx-systems/fuel-claims", { method: "POST", body: fd });
      const uj = await up.json();
      if (!up.ok) throw new Error(uj.error || "Could not save the PDF");
      await fetch("/api/fleet/fuel-claims", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c._id, pdfUrl: uj.secure_url, pdfPublicId: uj.public_id }),
      });
      if (download) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${c.claimNumber}.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      await load();
      return true;
    } catch (e: any) {
      notify.error(e.message || "PDF failed");
      return false;
    } finally {
      setPdfBusy(null);
    }
  };

  // ── Upload receipts ──
  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length || !form) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/admin/upload?folder=symx-systems/fuel-claims", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Upload failed");
        urls.push(j.secure_url);
      }
      setForm((p) => (p ? { ...p, receipts: [...p.receipts, ...urls] } : p));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openEdit = (c: Claim) =>
    setForm({
      id: c._id, date: dateInput(c.date), expenseType: c.expenseType, driverName: c.driverName, transporterId: c.transporterId || "",
      employeeId: "", tripType: c.tripType, routeNumber: c.routeNumber || "", vendor: c.vendor || "", amount: String(c.amount),
      paidWith: c.paidWith || PAID_WITH[0], driverRepaid: c.driverRepaid || "no", notes: c.notes || "", receipts: c.receipts || [],
    });

  const save = async () => {
    if (!form) return;
    if (!form.driverName.trim()) return notify.error("Choose the driver");
    if (!(Number(form.amount) > 0)) return notify.error("Enter the amount on the receipt");
    if (form.receipts.length === 0) return notify.error("Attach at least one receipt photo");
    setSaving(true);
    try {
      const res = await fetch("/api/fleet/fuel-claims", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      notify.success(form.id ? "Claim updated" : "Claim saved — creating PDF…");
      setForm(null);
      await load();
      if (j.claim) await makePdf(j.claim, false);
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openStatus = (c: Claim, next?: Status) => {
    setStatusTarget(c);
    setStatusForm({
      status: next || c.status,
      submittedDate: dateInput(c.submittedDate) || todayStr(),
      amazonReference: c.amazonReference || "",
      approvedAmount: c.approvedAmount !== undefined ? String(c.approvedAmount) : String(c.amount),
      decidedDate: dateInput(c.decidedDate) || todayStr(),
      denialReason: c.denialReason || "",
    });
  };

  const saveStatus = async () => {
    if (!statusTarget) return;
    if (statusForm.status === "denied" && !statusForm.denialReason.trim()) return notify.error("Add the reason Amazon gave");
    setSaving(true);
    try {
      const res = await fetch("/api/fleet/fuel-claims", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: statusTarget._id, ...statusForm }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      notify.success("Status updated");
      setStatusTarget(null);
      await load();
      if (j.claim) await makePdf(j.claim, false); // keep the saved PDF current
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Claim) => {
    if (!window.confirm(`Delete claim ${c.claimNumber} for ${c.driverName}? This can't be undone.`)) return;
    const res = await fetch(`/api/fleet/fuel-claims?id=${c._id}`, { method: "DELETE" });
    if (res.ok) { notify.success("Claim deleted"); setDetail(null); load(); } else notify.error("Could not delete");
  };

  const savedPdfHref = (c: Claim) => (c.pdfPublicId ? `/api/proxy/pdf?pid=${encodeURIComponent(c.pdfPublicId)}&rt=raw` : c.pdfUrl || "");

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards (tap to filter) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDER.map((s) => {
          const info = summary[s] || { count: 0, amount: 0, approved: 0 };
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(active ? "all" : s)}
              className={cn("rounded-xl border bg-card p-3 text-left transition-all hover:bg-muted/40", active ? STATUS[s].card + " ring-2 ring-primary/20" : "border-border/50")}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{STATUS[s].label}</div>
              <div className="mt-1 text-2xl font-bold">{info.count}</div>
              <div className="text-xs text-muted-foreground">
                {s === "approved" ? `${money(info.approved)} approved` : `${money(info.amount)} claimed`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search driver, route, vendor…" className="h-9 w-[240px] pl-8 text-sm" />
        </div>
        {filter !== "all" && (
          <button onClick={() => setFilter("all")} className="text-xs font-semibold text-primary hover:underline">Show all</button>
        )}
        <div className="flex-1" />
        <Button onClick={() => setForm(emptyForm())} className="gap-1.5">
          <Plus className="h-4 w-4" /> New claim
        </Button>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-14 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">{claims.length === 0 ? "No fuel claims yet" : "No claims match"}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Add a claim whenever a driver buys fuel or charges outside the gas-card process.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Trip</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Driver repaid</th>
                <th className="px-3 py-2">Amazon status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c._id} className="border-b border-border/20 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2">{fmtDate(c.date)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setDetail(c)} className="flex items-center gap-1.5 text-left font-semibold hover:underline">
                      {c.expenseType === "EV Charging" ? <Zap className="h-3.5 w-3.5 text-emerald-500" /> : <Fuel className="h-3.5 w-3.5 text-orange-500" />}
                      {c.driverName}
                    </button>
                    <div className="text-[11px] text-muted-foreground">{c.claimNumber}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{c.tripType}{c.routeNumber ? ` · ${c.routeNumber}` : ""}</td>
                  <td className="max-w-[200px] truncate px-3 py-2" title={c.vendor}>{c.vendor || "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(c.amount)}</td>
                  <td className="px-3 py-2">{c.driverRepaid === "yes" ? "Yes" : c.driverRepaid === "not_needed" ? "Not needed" : <span className="text-amber-500">No</span>}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => openStatus(c)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold ring-1", STATUS[c.status].chip)}>
                      {STATUS[c.status].label}
                    </button>
                    {c.status === "denied" && c.denialReason && <div className="mt-0.5 max-w-[180px] truncate text-[11px] text-red-400" title={c.denialReason}>{c.denialReason}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-8 gap-1" disabled={pdfBusy === c._id} onClick={() => makePdf(c, true)} title="Print / download PDF">
                        {pdfBusy === c._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => remove(c)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New / edit claim ── */}
      <Dialog open={!!form} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader><DialogTitle>{form?.id ? "Edit claim" : "New fuel / charging claim"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Date purchased</Label>
                  <input type="date" className={field} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Type</Label>
                  <div className="flex gap-1.5">
                    {(["Fuel", "EV Charging"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setForm({ ...form, expenseType: t })}
                        className={cn("flex-1 rounded-md border px-2 py-2 text-xs font-semibold", form.expenseType === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative grid gap-1.5">
                <Label className="text-xs">Driver</Label>
                <input
                  className={field} value={form.driverName} placeholder="Start typing the driver's name"
                  onChange={(e) => { setForm({ ...form, driverName: e.target.value, employeeId: "", transporterId: "" }); setDriverOpen(true); }}
                  onFocus={() => setDriverOpen(true)}
                  onBlur={() => setTimeout(() => setDriverOpen(false), 150)}
                />
                {driverOpen && driverMatches.length > 0 && !form.employeeId && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {driverMatches.map((e) => (
                      <button key={e.id} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onMouseDown={() => { setForm({ ...form, driverName: e.name, employeeId: e.id, transporterId: e.transporterId }); setDriverOpen(false); }}>
                        <span>{e.name}</span><span className="text-xs text-muted-foreground">{e.transporterId}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Route or rescue?</Label>
                  <div className="flex gap-1.5">
                    {(["Route", "Rescue"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setForm({ ...form, tripType: t })}
                        className={cn("flex-1 rounded-md border px-2 py-2 text-xs font-semibold", form.tripType === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Route number</Label>
                  <input className={field} value={form.routeNumber} placeholder="e.g. CX41" onChange={(e) => setForm({ ...form, routeNumber: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Amount on receipt ($)</Label>
                  <input className={field} inputMode="decimal" value={form.amount} placeholder="0.00" onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Paid with</Label>
                  <select className={field} value={form.paidWith} onChange={(e) => setForm({ ...form, paidWith: e.target.value })}>
                    {PAID_WITH.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Gas station / charging network and location</Label>
                <input className={field} value={form.vendor} placeholder="e.g. Shell, 123 Main St, Fontana" onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Driver already repaid?</Label>
                <div className="flex gap-1.5">
                  {([["no", "Not yet"], ["yes", "Yes, repaid"], ["not_needed", "Not needed"]] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setForm({ ...form, driverRepaid: v })}
                      className={cn("flex-1 rounded-md border px-2 py-2 text-xs font-semibold", form.driverRepaid === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Receipt photos</Label>
                <div className="flex flex-wrap gap-2">
                  {form.receipts.map((u, i) => (
                    <div key={u + i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                      <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Receipt ${i + 1}`} className="h-full w-full object-cover" /></a>
                      <button type="button" onClick={() => setForm({ ...form, receipts: form.receipts.filter((_, k) => k !== i) })}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground hover:bg-muted/40">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    {uploading ? "Uploading" : "Add photo"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <textarea className={cn(field, "min-h-[60px]")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Why the gas card couldn't be used, etc." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{form?.id ? "Save changes" : "Save claim & create PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Update Amazon status ── */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => { if (!o) setStatusTarget(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Amazon status — {statusTarget?.driverName}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              {ORDER.map((s) => (
                <button key={s} type="button" onClick={() => setStatusForm({ ...statusForm, status: s })}
                  className={cn("rounded-lg border px-2 py-2 text-xs font-bold", statusForm.status === s ? STATUS[s].chip + " ring-2" : "border-border bg-background text-muted-foreground")}>
                  {STATUS[s].label}
                </button>
              ))}
            </div>
            {(statusForm.status === "submitted" || statusForm.status === "approved") && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Amazon reference / case number (optional)</Label>
                <input className={field} value={statusForm.amazonReference} onChange={(e) => setStatusForm({ ...statusForm, amazonReference: e.target.value })} />
              </div>
            )}
            {statusForm.status === "submitted" && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Date submitted</Label>
                <input type="date" className={field} value={statusForm.submittedDate} onChange={(e) => setStatusForm({ ...statusForm, submittedDate: e.target.value })} />
              </div>
            )}
            {statusForm.status === "approved" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Amount approved ($)</Label>
                  <input className={field} inputMode="decimal" value={statusForm.approvedAmount} onChange={(e) => setStatusForm({ ...statusForm, approvedAmount: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Date approved</Label>
                  <input type="date" className={field} value={statusForm.decidedDate} onChange={(e) => setStatusForm({ ...statusForm, decidedDate: e.target.value })} />
                </div>
              </div>
            )}
            {statusForm.status === "denied" && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Date denied</Label>
                  <input type="date" className={field} value={statusForm.decidedDate} onChange={(e) => setStatusForm({ ...statusForm, decidedDate: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Reason Amazon gave</Label>
                  <textarea className={cn(field, "min-h-[70px]")} value={statusForm.denialReason} onChange={(e) => setStatusForm({ ...statusForm, denialReason: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveStatus} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail ── */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader><DialogTitle>{detail?.claimNumber}</DialogTitle></DialogHeader>
          {detail && (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {([
                  ["Driver", detail.driverName + (detail.transporterId ? ` (${detail.transporterId})` : "")],
                  ["Date", fmtDate(detail.date)],
                  ["Type", detail.expenseType],
                  ["Trip", detail.tripType + (detail.routeNumber ? ` · ${detail.routeNumber}` : "")],
                  ["Vendor", detail.vendor || "—"],
                  ["Amount", money(detail.amount)],
                  ["Paid with", detail.paidWith || "—"],
                  ["Driver repaid", detail.driverRepaid === "yes" ? "Yes" : detail.driverRepaid === "not_needed" ? "Not needed" : "No"],
                  ["Status", STATUS[detail.status].label],
                  ["Submitted", fmtDate(detail.submittedDate)],
                  ["Amazon ref", detail.amazonReference || "—"],
                  ["Approved", detail.status === "approved" ? `${money(detail.approvedAmount)} on ${fmtDate(detail.decidedDate)}` : "—"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>
                ))}
              </div>
              {detail.status === "denied" && detail.denialReason && <div className="rounded-lg bg-red-500/10 p-2 text-red-400">Denied: {detail.denialReason}</div>}
              {detail.notes && <div className="rounded-lg bg-muted/40 p-2">{detail.notes}</div>}
              <div className="flex flex-wrap gap-2">
                {detail.receipts.map((u, i) => (
                  <a key={u + i} href={u} target="_blank" rel="noreferrer" className="h-24 w-24 overflow-hidden rounded-lg border border-border">
                    <img src={u} alt={`Receipt ${i + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
              {savedPdfHref(detail) && (
                <a href={savedPdfHref(detail)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Open saved PDF</a>
              )}
              {(detail.activity || []).length > 0 && (
                <div className="border-t border-border/40 pt-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">History</div>
                  {[...(detail.activity || [])].reverse().map((a, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {a.text}{a.byName ? ` — ${a.byName}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => detail && openStatus(detail)}>Update status</Button>
            <Button onClick={() => detail && makePdf(detail, true)} disabled={!!pdfBusy}><FileText className="mr-1.5 h-4 w-4" />PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
