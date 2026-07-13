"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { Loader2, Plus, ShieldCheck, FileText, Upload, Trash2, AlertTriangle } from "lucide-react";
import { INSURANCE_POLICY_TYPES } from "@/lib/constants/insurance";

interface LossRun {
  url: string;
  filename: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface Policy {
  _id: string;
  policyNumber: string;
  startDate?: string;
  endDate?: string;
  company: string;
  type: string;
  lossRatio?: number;
  claimsIncurred?: number;
  claimsPaid?: number;
  premiumPaid?: number;
  totalClaims?: number;
  openClaims?: number;
  policyLimit?: number;
  lossRuns?: LossRun[];
  notes?: string;
  computedTotalClaims: number;
  computedOpenClaims: number;
  computedClaimsPaid: number;
  computedClaimsIncurred: number;
}

const EMPTY_FORM = {
  policyNumber: "", startDate: "", endDate: "", company: "", type: "Auto",
  lossRatio: "", claimsIncurred: "", claimsPaid: "", premiumPaid: "",
  totalClaims: "", openClaims: "", policyLimit: "", notes: "",
  lossRunFile: "", lossRunFilename: "",
};

// Most recently uploaded loss run, by uploadedAt — every prior upload stays
// in the array (never deleted) as an audit trail across years/renewals.
function sortedLossRuns(runs?: LossRun[]) {
  return [...(runs || [])].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

function money(n?: number) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function isExpired(endDate?: string) {
  if (!endDate) return false;
  return new Date(endDate) < new Date();
}

function isExpiringSoon(endDate?: string) {
  if (!endDate) return false;
  const days = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 30;
}

export default function InsurancePoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("All");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insurance/policies");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load policies");
      setPolicies(json.policies || []);
    } catch (err: any) {
      notify.error(err.message || "Failed to load policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (typeFilter === "All") return policies;
    return policies.filter((p) => p.type === typeFilter);
  }, [policies, typeFilter]);

  const summary = useMemo(() => {
    const active = policies.filter((p) => !isExpired(p.endDate));
    const expiringSoon = policies.filter((p) => isExpiringSoon(p.endDate));
    const totalPremium = policies.reduce((s, p) => s + (p.premiumPaid || 0), 0);
    return { total: policies.length, active: active.length, expiringSoon: expiringSoon.length, totalPremium };
  }, [policies]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Policy) => {
    setEditingId(p._id);
    setForm({
      policyNumber: p.policyNumber || "",
      startDate: p.startDate ? p.startDate.split("T")[0] : "",
      endDate: p.endDate ? p.endDate.split("T")[0] : "",
      company: p.company || "",
      type: p.type || "Auto",
      lossRatio: p.lossRatio ?? "",
      claimsIncurred: p.claimsIncurred ?? "",
      claimsPaid: p.claimsPaid ?? "",
      premiumPaid: p.premiumPaid ?? "",
      totalClaims: p.totalClaims ?? "",
      openClaims: p.openClaims ?? "",
      policyLimit: p.policyLimit ?? "",
      notes: p.notes || "",
      lossRunFile: "",
      lossRunFilename: "",
    });
    setDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", "Insurance");
      const res = await fetch("/api/upload/cloudinary", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      // Staged for this save — appended to the policy's loss-run history on
      // submit, never overwriting prior uploads.
      setForm((f: any) => ({ ...f, lossRunFile: json.url, lossRunFilename: file.name }));
      notify.success("Loss run file staged — save the policy to attach it");
    } catch (err: any) {
      notify.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.policyNumber.trim()) {
      notify.error("Policy number is required");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/insurance/policies/${editingId}` : "/api/insurance/policies";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save policy");
      notify.success(editingId ? "Policy updated" : "Policy created");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      notify.error(err.message || "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/insurance/policies/${editingId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete policy");
      }
      notify.success("Policy deleted");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete policy");
    }
  };

  const editingPolicy = policies.find((p) => p._id === editingId);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Insurance Policies</h1>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add Policy
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold">{summary.total}</div><div className="text-xs text-muted-foreground">Total policies</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold">{summary.active}</div><div className="text-xs text-muted-foreground">Currently active</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold text-amber-600">{summary.expiringSoon}</div><div className="text-xs text-muted-foreground">Expiring in 30 days</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold">{money(summary.totalPremium)}</div><div className="text-xs text-muted-foreground">Total premium paid</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Type:</Label>
        <div className="flex gap-1">
          {["All", ...INSURANCE_POLICY_TYPES].map((t) => (
            <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} onClick={() => setTypeFilter(t)}>
              {t}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Policy #</th>
              <th className="px-3 py-2 text-left font-medium">Company</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Coverage Period</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Premium Paid</th>
              <th className="px-3 py-2 text-left font-medium">Policy Limit</th>
              <th className="px-3 py-2 text-left font-medium">Loss Runs</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No policies found.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p._id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => openEdit(p)}>
                <td className="px-3 py-2 font-medium">{p.policyNumber}</td>
                <td className="px-3 py-2">{p.company}</td>
                <td className="px-3 py-2"><Badge variant="outline">{p.type}</Badge></td>
                <td className="px-3 py-2">
                  {p.startDate ? p.startDate.split("T")[0] : "—"} → {p.endDate ? p.endDate.split("T")[0] : "—"}
                </td>
                <td className="px-3 py-2">
                  {isExpired(p.endDate) ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : isExpiringSoon(p.endDate) ? (
                    <Badge variant="outline" className="gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> Expiring soon</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </td>
                <td className="px-3 py-2">{money(p.premiumPaid)}</td>
                <td className="px-3 py-2">{money(p.policyLimit)}</td>
                <td className="px-3 py-2">
                  {p.lossRuns && p.lossRuns.length > 0 ? (
                    (() => {
                      const runs = sortedLossRuns(p.lossRuns);
                      const latest = runs[0];
                      return (
                        <a href={latest.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          <FileText className="h-3.5 w-3.5" /> {new Date(latest.uploadedAt).toLocaleDateString()}
                          {runs.length > 1 && <span className="text-muted-foreground">(+{runs.length - 1} more)</span>}
                        </a>
                      );
                    })()
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Policy" : "Add Policy"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Policy Number *</Label>
              <Input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSURANCE_POLICY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Policy Limit ($)</Label>
              <Input type="number" value={form.policyLimit} onChange={(e) => setForm({ ...form, policyLimit: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Premium Paid ($)</Label>
              <Input type="number" value={form.premiumPaid} onChange={(e) => setForm({ ...form, premiumPaid: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Loss Ratio (%)</Label>
              <Input type="number" value={form.lossRatio} onChange={(e) => setForm({ ...form, lossRatio: e.target.value })} />
            </div>
          </div>

          <div className="mt-2 rounded-md border p-3">
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Official numbers (from insurer's Loss Run)</div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Total Claims</Label>
                <Input type="number" value={form.totalClaims} onChange={(e) => setForm({ ...form, totalClaims: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Open Claims</Label>
                <Input type="number" value={form.openClaims} onChange={(e) => setForm({ ...form, openClaims: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Claims Paid ($)</Label>
                <Input type="number" value={form.claimsPaid} onChange={(e) => setForm({ ...form, claimsPaid: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Claims Incurred ($)</Label>
                <Input type="number" value={form.claimsIncurred} onChange={(e) => setForm({ ...form, claimsIncurred: e.target.value })} />
              </div>
            </div>
          </div>

          {editingPolicy && (
            <div className="rounded-md border border-dashed p-3">
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Computed from incidents linked to this policy in SYMX</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                <div><div className="text-muted-foreground">Total Claims</div><div className="font-medium">{editingPolicy.computedTotalClaims}</div></div>
                <div><div className="text-muted-foreground">Open Claims</div><div className="font-medium">{editingPolicy.computedOpenClaims}</div></div>
                <div><div className="text-muted-foreground">Claims Paid</div><div className="font-medium">{money(editingPolicy.computedClaimsPaid)}</div></div>
                <div><div className="text-muted-foreground">Claims Incurred</div><div className="font-medium">{money(editingPolicy.computedClaimsIncurred)}</div></div>
              </div>
              {(editingPolicy.totalClaims !== undefined && editingPolicy.totalClaims !== editingPolicy.computedTotalClaims) && (
                <p className="mt-2 text-xs text-amber-600">Official and computed claim counts don't match — worth reconciling.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Loss Run Upload</Label>
            <p className="text-xs text-muted-foreground">
              Upload a new loss-run report any time — for renewals, or a mid-year refresh. Every upload is kept; nothing is
              overwritten or archived away, so the full history stays available for audit.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {form.lossRunFile && (
              <div className="flex items-center gap-1 text-sm text-emerald-600">
                <FileText className="h-3.5 w-3.5" /> "{form.lossRunFilename}" staged — will attach when you save
              </div>
            )}

            {editingPolicy && sortedLossRuns(editingPolicy.lossRuns).length > 0 && (
              <div className="mt-1 flex flex-col gap-1 rounded-md border p-2">
                <div className="text-xs font-medium uppercase text-muted-foreground">Upload history</div>
                {sortedLossRuns(editingPolicy.lossRuns).map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-muted/50"
                  >
                    <span className="inline-flex items-center gap-1 text-primary hover:underline">
                      <FileText className="h-3.5 w-3.5" /> {r.filename || "Loss run file"}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {i === 0 && <Badge variant="secondary">Current</Badge>}
                      {new Date(r.uploadedAt).toLocaleDateString()} {r.uploadedBy ? `· ${r.uploadedBy}` : ""}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <div className="flex items-center justify-between pt-2">
            {editingId ? (
              <Button variant="outline" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {editingId ? "Save Changes" : "Create Policy"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
