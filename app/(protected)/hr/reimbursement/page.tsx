"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
} from "@tanstack/react-table";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
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
import { Loader2, Plus, DollarSign, TrendingUp, Clock, CheckCircle2, Trash2 } from "lucide-react";
import { ISymxReimbursement } from "@/lib/models/SymxReimbursement";

interface ReimbursementRow extends Omit<ISymxReimbursement, '_id'> {
  _id: string;
}

const statusColors: Record<string, string> = {
  "Pending": "bg-amber-500/15 text-amber-600 border-amber-500/20",
  "Approved": "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  "Rejected": "bg-red-500/15 text-red-600 border-red-500/20",
  "Paid": "bg-blue-500/15 text-blue-600 border-blue-500/20",
};

const categories = [
  "Fuel", "Meals", "Supplies", "Equipment", "Travel", 
  "Phone", "Parking", "Tolls", "Uniform", "Medical", "Other"
];

const statuses = ["Pending", "Approved", "Rejected", "Paid"];

export default function ReimbursementPage() {
  const [data, setData] = useState<ReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReimbursementRow | null>(null);
  const [saving, setSaving] = useState(false);

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

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/reimbursements");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load reimbursements", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = data.reduce((sum, r) => sum + (r.amount || 0), 0);
    const pending = data.filter(r => r.status === "Pending");
    const pendingTotal = pending.reduce((sum, r) => sum + (r.amount || 0), 0);
    const approved = data.filter(r => r.status === "Approved" || r.status === "Paid");
    const approvedTotal = approved.reduce((sum, r) => sum + (r.amount || 0), 0);
    return {
      totalRecords: data.length,
      totalAmount: total,
      pendingCount: pending.length,
      pendingAmount: pendingTotal,
      approvedCount: approved.length,
      approvedAmount: approvedTotal,
    };
  }, [data]);

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
      fetchData();
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
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const columns: ColumnDef<ReimbursementRow>[] = [
    {
      accessorKey: "employeeName",
      header: "Employee",
      cell: ({ row }) => (
        <span className="font-medium text-sm">
          {row.original.employeeName || "—"}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        if (!row.original.date) return "—";
        const d = new Date(row.original.date);
        return <span className="text-xs">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>;
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] font-medium">
          {row.original.category || "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-[200px] truncate block">
          {row.original.description || "—"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-semibold text-sm tabular-nums">
          {row.original.amount != null ? `$${row.original.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
        </span>
      ),
    },

    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status || "Pending";
        return (
          <Badge className={`text-[10px] ${statusColors[status] || "bg-muted text-muted-foreground"}`}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "approvedBy",
      header: "Approved By",
      cell: ({ row }) => (
        <span className="text-xs">{row.original.approvedBy || "—"}</span>
      ),
    },
    {
      accessorKey: "notes",
      header: "Reason",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-[150px] truncate block">
          {row.original.notes || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(row.original._id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <span className="text-xs font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">
            ${kpis.pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">{kpis.pendingCount} requests</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Approved / Paid</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">
            ${kpis.approvedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">{kpis.approvedCount} records</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-blue-500">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Avg per Record</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            ${kpis.totalRecords > 0 ? (kpis.totalAmount / kpis.totalRecords).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
          </p>
          <p className="text-xs text-muted-foreground">average amount</p>
        </div>
      </div>

      {/* ── Data Table ─────────────────────────────────────────── */}
      <SimpleDataTable
        data={data}
        columns={columns}
        enableGlobalFilter={true}
        showColumnToggle={true}
        onRowClick={(row) => openEdit(row)}
        extraActions={
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Reimbursement
          </Button>
        }
      />

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
              <Label>Notes</Label>
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
