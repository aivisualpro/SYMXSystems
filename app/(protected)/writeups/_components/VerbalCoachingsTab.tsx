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
import { cn } from "@/lib/utils";
import { Loader2, Plus, ArrowUp, ArrowDown, ArrowUpDown, ArrowUpRight } from "lucide-react";

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

type SortDirection = "asc" | "desc";
interface SortConfig { key: string; direction: SortDirection }

function sortByKey<T extends Record<string, any>>(items: T[], sort: SortConfig): T[] {
  const sorted = [...items].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av ?? "").localeCompare(String(bv ?? ""));
  });
  return sort.direction === "asc" ? sorted : sorted.reverse();
}

function SortableHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: string; sort: SortConfig; onSort: (key: string) => void }) {
  const active = sort.key === sortKey;
  return (
    <th className="cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-foreground" onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  unable_to_coach: "Unable to Coach",
  scheduled: "Scheduled",
};
const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500 text-white border-emerald-600",
  unable_to_coach: "bg-slate-400 text-white border-slate-500",
  scheduled: "bg-blue-500 text-white border-blue-600",
};

interface VerbalCoaching {
  _id: string;
  transporterId?: string;
  employeeId?: string;
  employeeName: string;
  categoryIds: string[];
  categoryLabels: string[];
  coachingDate: string;
  coachedBy: string;
  status: string;
  notes: string;
  disputed: boolean;
  disputeNotes?: string;
  isHistorical: boolean;
  linkedWriteupId?: string;
  createdBy?: string;
}

interface EmployeeOption { transporterId: string; firstName: string; lastName: string; _id: string }
interface CategoryOption { _id: string; description: string }

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

const EMPTY_FORM = {
  employeeId: "", transporterId: "", employeeName: "",
  categoryIds: [] as string[],
  coachingDate: new Date().toISOString().split("T")[0],
  coachedBy: "", status: "completed", notes: "", disputed: false, disputeNotes: "",
};

export default function VerbalCoachingsTab() {
  const [coachings, setCoachings] = useState<VerbalCoaching[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [sort, setSort] = useState<SortConfig>({ key: "coachingDate", direction: "desc" });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [escalating, setEscalating] = useState<string | null>(null);
  const [escalateTarget, setEscalateTarget] = useState<VerbalCoaching | null>(null);
  const [escalateCategoryId, setEscalateCategoryId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/verbal-coachings?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load verbal coachings");
      setCoachings(json.coachings || []);
    } catch (err: any) {
      notify.error(err.message || "Failed to load verbal coachings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, searchQuery ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    fetch("/api/admin/employees?terminated=false&export=true&select=firstName,lastName,transporterId,status")
      .then((res) => res.json())
      .then((json) => {
        const list = (json.employees || json || []).map((e: any) => ({ _id: e._id, transporterId: e.transporterId || "", firstName: e.firstName || "", lastName: e.lastName || "" }));
        setEmployees(list.sort((a: EmployeeOption, b: EmployeeOption) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
      })
      .catch(() => {});
    fetch("/api/admin/settings/dropdowns?type=metric")
      .then((res) => res.json())
      .then((d) => setCategories(Array.isArray(d) ? d.filter((c: any) => c.isActive !== false) : []))
      .catch(() => {});
  }, []);

  const toggleSort = (key: string) => {
    setSort((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" }));
  };

  const applyDatePreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    setDateFrom(toISODate(d));
    setDateTo(toISODate(new Date()));
    setActivePreset(days);
  };
  const clearDateRange = () => { setDateFrom(""); setDateTo(""); setActivePreset(null); };

  const filtered = useMemo(() => sortByKey(coachings, sort), [coachings, sort]);

  const summary = useMemo(() => {
    const disputed = coachings.filter((c) => c.disputed).length;
    const unableToCoach = coachings.filter((c) => c.status === "unable_to_coach").length;
    return { total: coachings.length, disputed, unableToCoach };
  }, [coachings]);

  const toggleCategoryInForm = (id: string) => {
    setForm((prev: any) => {
      const has = prev.categoryIds.includes(id);
      return { ...prev, categoryIds: has ? prev.categoryIds.filter((c: string) => c !== id) : [...prev.categoryIds, id] };
    });
  };

  const openCreate = () => { setForm(EMPTY_FORM); setCreateOpen(true); };

  const handleCreate = async () => {
    if (!form.employeeId) { notify.error("Employee is required"); return; }
    if (form.categoryIds.length === 0) { notify.error("At least one category is required"); return; }
    if (form.disputed && !form.disputeNotes.trim()) { notify.error("Dispute notes are required when marked disputed"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/verbal-coachings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to log coaching");
      notify.success("Verbal coaching logged");
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to log coaching");
    } finally {
      setCreating(false);
    }
  };

  const openEscalate = (c: VerbalCoaching) => {
    setEscalateTarget(c);
    setEscalateCategoryId(c.categoryIds[0] || "");
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    if (!escalateCategoryId) { notify.error("Select a category to formalize"); return; }
    setEscalating(escalateTarget._id);
    try {
      const res = await fetch(`/api/verbal-coachings/${escalateTarget._id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: escalateCategoryId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to escalate");
      notify.success("Escalated to a formal Write-Up draft — switch to the Formal Write-Ups tab to sign it");
      setEscalateTarget(null);
      await load();
    } catch (err: any) {
      notify.error(err.message || "Failed to escalate");
    } finally {
      setEscalating(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Log Verbal Coaching
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold">{summary.total}</div><div className="text-xs text-muted-foreground">Total logged</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold text-slate-500">{summary.unableToCoach}</div><div className="text-xs text-muted-foreground">Unable to coach</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold text-amber-600">{summary.disputed}</div><div className="text-xs text-muted-foreground">Disputed</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
          <Button size="sm" variant={statusFilter === "completed" ? "default" : "outline"} onClick={() => setStatusFilter("completed")}>Completed</Button>
          <Button size="sm" variant={statusFilter === "unable_to_coach" ? "default" : "outline"} onClick={() => setStatusFilter("unable_to_coach")}>Unable to Coach</Button>
          <Button size="sm" variant={statusFilter === "scheduled" ? "default" : "outline"} onClick={() => setStatusFilter("scheduled")}>Scheduled</Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c._id} value={c._id}>{c.description}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vc-from-date">From</Label>
          <Input id="vc-from-date" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); }} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vc-to-date">To</Label>
          <Input id="vc-to-date" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); }} className="w-40" />
        </div>
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <Button key={p.label} size="sm" variant={activePreset === p.days ? "default" : "ghost"} onClick={() => applyDatePreset(p.days)}>{p.label}</Button>
          ))}
          {(dateFrom || dateTo) && <Button size="sm" variant="ghost" onClick={clearDateRange}>All time</Button>}
        </div>
        <div className="ml-auto flex flex-col gap-1.5">
          <Label htmlFor="vc-search">Search</Label>
          <Input id="vc-search" placeholder="Employee, category, notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <SortableHeader label="Date" sortKey="coachingDate" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Employee" sortKey="employeeName" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Coached By" sortKey="coachedBy" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2 text-left font-medium">Notes</th>
              <th className="px-3 py-2 text-left font-medium">Disputed</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No verbal coachings found.</td></tr>}
            {filtered.map((c) => (
              <tr key={c._id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">{fmtDate(c.coachingDate)}</td>
                <td className="px-3 py-2 font-medium">{c.employeeName}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.categoryLabels.map((l, i) => <Badge key={i} variant="outline" className="text-xs">{l}</Badge>)}
                  </div>
                </td>
                <td className="px-3 py-2"><Badge className={STATUS_COLORS[c.status] || ""}>{STATUS_LABELS[c.status] || c.status}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{c.coachedBy || "—"}</td>
                <td className="max-w-64 truncate px-3 py-2 text-muted-foreground" title={c.notes}>{c.notes || "—"}</td>
                <td className="px-3 py-2">
                  {c.disputed ? <Badge className="bg-amber-500 text-white border-amber-600 text-xs">Disputed</Badge> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.linkedWriteupId ? (
                    <span className="text-xs italic text-muted-foreground">Escalated</span>
                  ) : c.employeeId ? (
                    <Button size="sm" variant="outline" onClick={() => openEscalate(c)}>
                      <ArrowUpRight className="h-3.5 w-3.5" /> Escalate to Write-Up
                    </Button>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Unmatched employee</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Quick-add dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Log Verbal Coaching</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Employee *</Label>
              <Select
                value={form.employeeId}
                onValueChange={(v) => {
                  const emp = employees.find((e) => e._id === v);
                  setForm({ ...form, employeeId: v, transporterId: emp?.transporterId || "", employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "" });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Categories * (select all that apply)</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
                {categories.map((c) => {
                  const active = form.categoryIds.includes(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleCategoryInForm(c._id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted"
                      )}
                    >
                      {c.description}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Coaching Date</Label>
                <Input type="date" value={form.coachingDate} onChange={(e) => setForm({ ...form, coachingDate: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="unable_to_coach">Unable to Coach</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Coached By</Label>
              <Input value={form.coachedBy} onChange={(e) => setForm({ ...form, coachedBy: e.target.value })} placeholder="Defaults to you if left blank" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="What was discussed..." />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="disputed"
                type="checkbox"
                className="h-4 w-4 accent-primary rounded cursor-pointer"
                checked={form.disputed}
                onChange={(e) => setForm({ ...form, disputed: e.target.checked })}
              />
              <Label htmlFor="disputed" className="text-sm font-normal">Employee disputes the underlying metric</Label>
            </div>
            {form.disputed && (
              <div className="flex flex-col gap-1.5">
                <Label>Dispute Notes *</Label>
                <Textarea value={form.disputeNotes} onChange={(e) => setForm({ ...form, disputeNotes: e.target.value })} rows={2} />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Log Coaching
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Escalate dialog ── */}
      <Dialog open={!!escalateTarget} onOpenChange={(open) => !open && setEscalateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Escalate to Formal Write-Up</DialogTitle></DialogHeader>
          {escalateTarget && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                This creates a formal Write-Up draft for <span className="font-medium text-foreground">{escalateTarget.employeeName}</span>, carrying forward the date and notes. You'll still review, set the warning level, and collect signatures on the Formal Write-Ups tab.
              </p>
              {escalateTarget.categoryLabels.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <Label>This coaching covers multiple categories — formalize which one?</Label>
                  <Select value={escalateCategoryId} onValueChange={setEscalateCategoryId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {escalateTarget.categoryIds.map((id, i) => <SelectItem key={id} value={id}>{escalateTarget.categoryLabels[i]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEscalateTarget(null)}>Cancel</Button>
                <Button onClick={handleEscalate} disabled={escalating === escalateTarget._id}>
                  {escalating === escalateTarget._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  Create Write-Up Draft
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
