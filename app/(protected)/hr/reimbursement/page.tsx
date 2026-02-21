"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, DollarSign, TrendingUp, Clock, CheckCircle2, Trash2, Search } from "lucide-react";
import { ISymxReimbursement } from "@/lib/models/SymxReimbursement";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

interface ReimbursementRow extends Omit<ISymxReimbursement, '_id'> {
  _id: string;
}

interface KpiData {
  totalRecords: number;
  totalAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  paidCount: number;
  paidAmount: number;
}

const statusColors: Record<string, string> = {
  "Pending": "bg-amber-500/15 text-amber-600 border-amber-500/20",
  "Unpaid": "bg-amber-500/15 text-amber-600 border-amber-500/20",
  "Approved": "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  "Rejected": "bg-red-500/15 text-red-600 border-red-500/20",
  "Paid": "bg-blue-500/15 text-blue-600 border-blue-500/20",
};

const categories = [
  "Fuel", "Meals", "Supplies", "Equipment", "Travel",
  "Phone", "Parking", "Tolls", "Uniform", "Medical", "Other"
];

const statuses = ["Pending", "Unpaid", "Approved", "Rejected", "Paid"];

const PAGE_SIZE = 50;

export default function ReimbursementPage() {
  const [data, setData] = useState<ReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<KpiData>({
    totalRecords: 0, totalAmount: 0,
    unpaidCount: 0, unpaidAmount: 0,
    paidCount: 0, paidAmount: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReimbursementRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { setLeftContent, setRightContent } = useHeaderActions();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    transporterId: "",
    employeeName: "",
    date: "",
    category: "",
    description: "",
    amount: "",
    receiptNumber: "",
    status: "Pending",
    approvedBy: "",
    notes: "",
  });

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch data (initial or search change)
  const fetchData = useCallback(async (reset = true) => {
    const skip = reset ? 0 : data.length;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/reimbursements?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();

      if (reset) {
        setData(json.records);
      } else {
        setData(prev => [...prev, ...json.records]);
      }
      setTotalCount(json.totalCount);
      setHasMore(json.hasMore);
      setKpis(json.kpi);
    } catch (err) {
      console.error("Failed to load reimbursements", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, data.length]);

  // Initial load + search changes trigger reset
  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchData(false);
        }
      },
      { root: container, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchData]);

  // Header actions — search + Add button
  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 w-[200px] text-sm"
          />
        </div>
        <Button size="sm" onClick={() => openNew()} className="gap-1.5 h-8">
          <Plus className="h-4 w-4" />
          Add Reimbursement
        </Button>
      </div>
    );
    return () => {
      setRightContent(null);
    };
  }, [setLeftContent, setRightContent, searchQuery]);

  const openNew = () => {
    setEditingItem(null);
    setFormData({
      transporterId: "", employeeName: "", date: "", category: "",
      description: "", amount: "", receiptNumber: "", status: "Pending",
      approvedBy: "", notes: "",
    });
    setIsDialogOpen(true);
  };

  const openEdit = (row: ReimbursementRow) => {
    setEditingItem(row);
    setFormData({
      transporterId: row.transporterId || "",
      employeeName: row.employeeName || "",
      date: row.date ? new Date(row.date).toISOString().split("T")[0] : "",
      category: row.category || "",
      description: row.description || "",
      amount: row.amount?.toString() || "",
      receiptNumber: row.receiptNumber || "",
      status: row.status || "Pending",
      approvedBy: row.approvedBy || "",
      notes: row.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.transporterId) {
      toast.error("Transporter ID is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...formData };
      if (payload.amount) payload.amount = parseFloat(payload.amount);
      if (payload.date) payload.date = new Date(payload.date + "T00:00:00.000Z");

      const url = editingItem
        ? `/api/admin/reimbursements/${editingItem._id}`
        : "/api/admin/reimbursements";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Save failed");

      toast.success(editingItem ? "Reimbursement updated" : "Reimbursement created");
      setIsDialogOpen(false);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reimbursement record?")) return;
    try {
      const res = await fetch(`/api/admin/reimbursements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deleted");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  };

  const avgAmount = kpis.totalRecords > 0 ? kpis.totalAmount / kpis.totalRecords : 0;

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Total Amount</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            ${kpis.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">{kpis.totalRecords} records</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Unpaid</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">
            ${kpis.unpaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">{kpis.unpaidCount} records</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Paid</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">
            ${kpis.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">{kpis.paidCount} records</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-blue-500">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Avg per Record</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            ${avgAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">average amount</p>
        </div>
      </div>

      {/* ── Inline Table with Sticky Header & Infinite Scroll ─── */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card flex-1 min-h-0 flex flex-col">
        <div ref={scrollRef} className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted border-b border-border/50">
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Employee</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="text-right font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Approved By</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Reason</th>
                <th className="px-2 py-2.5 w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    No reimbursement records found.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const status = row.status || "Pending";
                  return (
                    <tr
                      key={`${row._id}-${idx}`}
                      className="border-b border-border/10 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEdit(row)}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-sm">{row.employeeName || "—"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs">{formatDate(row.date)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {row.category || "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted-foreground max-w-[200px] truncate block">
                          {row.description || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-semibold text-sm tabular-nums">
                          {row.amount != null ? `$${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`text-[10px] ${statusColors[status] || "bg-muted text-muted-foreground"}`}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs">{row.approvedBy || "—"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted-foreground max-w-[150px] truncate block">
                          {row.notes || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Loading more...</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Reimbursement" : "New Reimbursement"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Transporter ID *</Label>
              <Input
                value={formData.transporterId}
                onChange={(e) => setFormData(prev => ({ ...prev, transporterId: e.target.value }))}
                placeholder="e.g. A1B2C3"
              />
            </div>

            <div className="space-y-2">
              <Label>Employee Name</Label>
              <Input
                value={formData.employeeName}
                onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt Number</Label>
              <Input
                value={formData.receiptNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Approved By</Label>
              <Input
                value={formData.approvedBy}
                onChange={(e) => setFormData(prev => ({ ...prev, approvedBy: e.target.value }))}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingItem ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
