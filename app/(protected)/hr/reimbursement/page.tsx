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
import { Loader2, Plus, DollarSign, TrendingUp, Clock, CheckCircle2, Trash2, Search, Paperclip, X, Upload, FileSpreadsheet, ArrowRight, CheckCircle, AlertCircle, RotateCw, FileUp, Table2 } from "lucide-react";
import { ISymxReimbursement } from "@/lib/models/SymxReimbursement";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useDataStore } from "@/hooks/use-data-store";
import Papa from "papaparse";

interface ReimbursementRow extends Omit<ISymxReimbursement, '_id'> {
  _id: string;
}

interface ActiveEmployee {
  _id: string;
  firstName: string;
  lastName: string;
  transporterId?: string;
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
  "Pending": "bg-amber-500 text-white border-amber-600",
  "Unpaid": "bg-orange-500 text-white border-orange-600",
  "Approved": "bg-emerald-500 text-white border-emerald-600",
  "Rejected": "bg-red-500 text-white border-red-600",
  "Paid": "bg-blue-500 text-white border-blue-600",
};

const statuses = ["Pending", "Unpaid", "Approved", "Rejected", "Paid"];

const PAGE_SIZE = 50;
const IMPORT_CHUNK_SIZE = 500;

const EXPECTED_CSV_FIELDS = [
  "transporterId", "date", "amount", "reason",
  "attachment", "status", "createdBy", "createdAt",
];

export default function ReimbursementPage() {
  const store = useDataStore();
  const [data, setData] = useState<ReimbursementRow[]>([]);
  const [loading, setLoading] = useState(false);
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

  // CSV Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, label: "" });
  const [importResult, setImportResult] = useState({ inserted: 0, updated: 0, total: 0, errors: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { setLeftContent, setRightContent } = useHeaderActions();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Active employees for dropdown
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    transporterId: "",
    employeeName: "",
    selectedEmployeeId: "",
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

  // Fetch active employees for the dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("/api/admin/employees");
        if (res.ok) {
          const data = await res.json();
          // Filter only active employees and sort by name
          const active = data
            .filter((e: any) => e.status === "Active" || !e.status || !["Terminated", "Resigned", "Inactive"].includes(e.status))
            .sort((a: any, b: any) => {
              const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
              const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
              return nameA.localeCompare(nameB);
            });
          setActiveEmployees(active);
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      }
    };
    fetchEmployees();
  }, []);

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

  // ── Seed from store for instant load ──
  const storeReimbursements = store.hrReimbursements as any;
  useEffect(() => {
    if (!debouncedSearch && storeReimbursements?.records?.length > 0 && data.length === 0) {
      setData(storeReimbursements.records);
      setTotalCount(storeReimbursements.totalCount || storeReimbursements.records.length);
      setHasMore(storeReimbursements.hasMore || false);
      if (storeReimbursements.kpi) setKpis(storeReimbursements.kpi);
    }
  }, [storeReimbursements]);

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

  // ── CSV Import handlers ──
  const openImportDialog = () => {
    setImportStep("upload");
    setParsedRows([]);
    setCsvHeaders([]);
    setCsvFileName("");
    setImportResult({ inserted: 0, updated: 0, total: 0, errors: 0 });
    setImportProgress({ current: 0, total: 0, label: "" });
    setIsDragging(false);
    setImportDialogOpen(true);
  };

  const handleImportFileParse = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          toast.error("CSV file is empty or has no valid rows");
          return;
        }
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setParsedRows(results.data as any[]);
        setImportStep("preview");
      },
      error: (err) => {
        toast.error(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImportFileParse(file);
    e.target.value = "";
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImportFileParse(file);
  };

  const handleImportExecute = async () => {
    if (parsedRows.length === 0) return;
    setImportStep("importing");

    const chunks: any[][] = [];
    for (let i = 0; i < parsedRows.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(parsedRows.slice(i, i + IMPORT_CHUNK_SIZE));
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalCount = 0;
    let totalErrors = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        setImportProgress({
          current: i + 1,
          total: chunks.length,
          label: `Uploading batch ${i + 1} of ${chunks.length} (${chunks[i].length} rows)...`,
        });

        const res = await fetch("/api/admin/imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "reimbursement", data: chunks[i] }),
        });

        const result = await res.json();
        if (!res.ok) {
          totalErrors++;
          continue;
        }

        totalInserted += result.inserted || 0;
        totalUpdated += result.updated || 0;
        totalCount += result.count || 0;
      }

      setImportResult({ inserted: totalInserted, updated: totalUpdated, total: totalCount, errors: totalErrors });
      setImportStep("done");
      toast.success(`Imported ${totalCount} records (${totalInserted} new, ${totalUpdated} updated)`);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setImportResult({ inserted: totalInserted, updated: totalUpdated, total: totalCount, errors: totalErrors + 1 });
      setImportStep("done");
    }
  };

  // Compute matched fields for preview
  const matchedFields = useMemo(() => {
    return EXPECTED_CSV_FIELDS.map(field => ({
      field,
      found: csvHeaders.includes(field),
    }));
  }, [csvHeaders]);

  const matchedCount = matchedFields.filter(f => f.found).length;

  // Header actions — search + Import + Add button
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
        <Button size="sm" variant="outline" onClick={openImportDialog} className="gap-1.5 h-8">
          <FileSpreadsheet className="h-4 w-4" />
          Import CSV
        </Button>
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
      transporterId: "", employeeName: "", selectedEmployeeId: "", date: "", category: "",
      description: "", amount: "", receiptNumber: "", status: "Pending",
      approvedBy: "", notes: "",
    });
    setSelectedFile(null);
    setEmployeeSearchQuery("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsDialogOpen(true);
  };

  const openEdit = (row: ReimbursementRow) => {
    setEditingItem(row);
    setFormData({
      transporterId: row.transporterId || "",
      employeeName: row.employeeName || "",
      selectedEmployeeId: "",
      date: row.date ? new Date(row.date).toISOString().split("T")[0] : "",
      category: row.category || "",
      description: row.description || "",
      amount: row.amount?.toString() || "",
      receiptNumber: row.receiptNumber || "",
      status: row.status || "Pending",
      approvedBy: row.approvedBy || "",
      notes: row.notes || "",
    });
    setSelectedFile(null);
    setEmployeeSearchQuery("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsDialogOpen(true);
  };

  // Handle employee selection from the dropdown
  const handleEmployeeSelect = (employeeId: string) => {
    const emp = activeEmployees.find(e => e._id === employeeId);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        selectedEmployeeId: employeeId,
        transporterId: emp.transporterId || "",
        employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      }));
    }
  };

  // Filtered employees for search in dropdown
  const filteredEmployees = useMemo(() => {
    if (!employeeSearchQuery) return activeEmployees;
    const q = employeeSearchQuery.toLowerCase();
    return activeEmployees.filter(e => {
      const name = `${e.firstName || ""} ${e.lastName || ""}`.trim().toLowerCase();
      return name.includes(q) || (e.transporterId || "").toLowerCase().includes(q);
    });
  }, [activeEmployees, employeeSearchQuery]);

  const handleSave = async () => {
    if (!formData.transporterId) {
      toast.error("Please select an employee");
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        // Edit uses JSON as before
        const payload: any = { ...formData };
        delete payload.selectedEmployeeId;
        if (payload.amount) payload.amount = parseFloat(payload.amount);
        if (payload.date) payload.date = new Date(payload.date + "T00:00:00.000Z");

        const res = await fetch(`/api/admin/reimbursements/${editingItem._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Save failed");
      } else {
        // Create uses FormData for file upload support
        const fd = new FormData();
        fd.append("transporterId", formData.transporterId);
        fd.append("employeeName", formData.employeeName);
        if (formData.date) fd.append("date", formData.date + "T00:00:00.000Z");
        if (formData.amount) fd.append("amount", formData.amount);
        if (formData.notes) fd.append("notes", formData.notes);
        fd.append("status", "Pending");
        if (selectedFile) fd.append("file", selectedFile);

        const res = await fetch("/api/admin/reimbursements", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("Save failed");
      }

      toast.success(editingItem ? "Reimbursement updated" : "Reimbursement created");
      setIsDialogOpen(false);
      setSelectedFile(null);
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

  const handleInlineStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/reimbursements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      // Optimistic update
      setData(prev => prev.map(row => row._id === id ? { ...row, status: newStatus } : row));
      toast.success(`Status updated to ${newStatus}`);
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

          {/* ── Desktop Table (md+) ── */}
          <table className="w-full text-sm border-collapse hidden md:table">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[50%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted border-b border-border/50">
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Employee</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-right font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Amount</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Reason</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
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
                        <span className="font-medium text-sm whitespace-nowrap">{row.employeeName || "—"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs whitespace-nowrap">{formatDate(row.date)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-semibold text-sm tabular-nums whitespace-nowrap">
                          {row.amount != null ? `$${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Select value={status} onValueChange={(val) => handleInlineStatusChange(row._id, val)}>
                          <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 w-auto [&>svg]:hidden">
                            <Badge className={`text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${statusColors[status] || "bg-muted text-white"}`}>
                              {status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map(s => (
                              <SelectItem key={s} value={s}>
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${statusColors[s]?.split(' ')[0] || 'bg-muted'}`} />
                                  {s}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted-foreground">
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

          {/* ── Mobile / Tablet Card View (<md) ── */}
          <div className="md:hidden divide-y divide-border/10">
            {data.length === 0 && !loading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No reimbursement records found.
              </div>
            ) : (
              data.map((row, idx) => {
                const status = row.status || "Pending";
                return (
                  <div
                    key={`m-${row._id}-${idx}`}
                    className="p-3 hover:bg-muted/20 transition-colors cursor-pointer active:bg-muted/30"
                    onClick={() => openEdit(row)}
                  >
                    {/* Row 1: Name + Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{row.employeeName || "—"}</span>
                      <span className="font-bold text-sm tabular-nums whitespace-nowrap">
                        {row.amount != null ? `$${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>
                    {/* Row 2: Date + Status + Delete */}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[11px] text-muted-foreground">{formatDate(row.date)}</span>
                      <div className="flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select value={status} onValueChange={(val) => handleInlineStatusChange(row._id, val)}>
                            <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 w-auto [&>svg]:hidden">
                              <Badge className={`text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${statusColors[status] || "bg-muted text-white"}`}>
                                {status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {statuses.map(s => (
                                <SelectItem key={s} value={s}>
                                  <span className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${statusColors[s]?.split(' ')[0] || 'bg-muted'}`} />
                                    {s}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row._id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Row 3: Reason (full width) */}
                    {row.notes && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                        {row.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-4" />
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

          {/* ── CREATE MODE: Simplified form ── */}
          {!editingItem ? (
            <div className="space-y-4 py-4">
              {/* Employee Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Employee *</Label>
                <Select
                  value={formData.selectedEmployeeId}
                  onValueChange={handleEmployeeSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-popover">
                      <Input
                        placeholder="Search employees..."
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        className="h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {filteredEmployees.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {`${emp.firstName || ""} ${emp.lastName || ""}`.trim()}
                          {emp.transporterId && (
                            <span className="text-muted-foreground ml-1 text-[10px]">({emp.transporterId})</span>
                          )}
                        </SelectItem>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-3">No employees found</div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
                {formData.employeeName && (
                  <p className="text-[11px] text-muted-foreground">Selected: <span className="font-semibold text-foreground">{formData.employeeName}</span></p>
                )}
              </div>

              {/* Date of Expense */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Date of Expense *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Reason *</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  placeholder="Describe the reason for this reimbursement..."
                />
              </div>

              {/* Attachment Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Attachment</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                  }}
                />
                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 cursor-pointer transition-all hover:bg-muted/40 hover:border-primary/30 active:scale-[0.99]"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Click to upload receipt or document</span>
                    <span className="text-[10px] text-muted-foreground">Images, PDF, DOC (max 10MB)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                    <Paperclip className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── EDIT MODE: Full form ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
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

              <div className="sm:col-span-2 space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingItem ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── CSV Import Dialog ────────────────────────────────── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              Import Reimbursements
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-1 py-3 shrink-0">
            {[
              { key: "upload" as const, label: "Upload", icon: FileUp },
              { key: "preview" as const, label: "Preview", icon: Table2 },
              { key: "importing" as const, label: "Importing", icon: RotateCw },
              { key: "done" as const, label: "Done", icon: CheckCircle },
            ].map((s, idx) => {
              const stepOrder = ["upload", "preview", "importing", "done"];
              const currentIdx = stepOrder.indexOf(importStep);
              const thisIdx = stepOrder.indexOf(s.key);
              const isActive = importStep === s.key;
              const isDone = thisIdx < currentIdx;

              return (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                    isActive ? "bg-primary/10 text-primary" :
                    isDone ? "bg-emerald-500/10 text-emerald-500" :
                    "bg-muted/30 text-muted-foreground"
                  }`}>
                    <s.icon className={`h-3.5 w-3.5 ${isActive && s.key === "importing" ? "animate-spin" : ""}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{s.label}</span>
                  </div>
                  {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Hidden file input */}
          <input
            ref={importFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportFileSelect}
          />

          {/* ── Step: Upload ── */}
          {importStep === "upload" && (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleImportDrop}
                onClick={() => importFileRef.current?.click()}
                className={`w-full max-w-md flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-border/60 bg-muted/10 hover:bg-muted/30 hover:border-primary/40"
                }`}
              >
                <div className={`p-4 rounded-2xl transition-colors ${
                  isDragging ? "bg-primary/10" : "bg-muted/40"
                }`}>
                  <Upload className={`h-8 w-8 transition-colors ${
                    isDragging ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {isDragging ? "Drop your CSV file here" : "Drag & drop your CSV file"}
                  </p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
                <div className="text-[10px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
                  CSV format • Max 10,000 rows per import
                </div>
              </div>

              {/* Expected fields */}
              <div className="mt-6 w-full max-w-md space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Expected CSV Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPECTED_CSV_FIELDS.map(field => (
                    <span key={field} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-muted/40 text-foreground border border-border/30">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {importStep === "preview" && (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* File info + stats */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{csvFileName}</p>
                    <p className="text-[10px] text-muted-foreground">{parsedRows.length.toLocaleString()} rows found</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-500">{matchedCount}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Matched</p>
                  </div>
                  <div className="h-8 w-px bg-border/50" />
                  <div className="text-center">
                    <p className="text-lg font-black text-foreground">{EXPECTED_CSV_FIELDS.length}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Expected</p>
                  </div>
                </div>
              </div>

              {/* Field mapping status */}
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {matchedFields.map(({ field, found }) => (
                  <span key={field} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                    found
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                  }`}>
                    {found ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                    {field}
                  </span>
                ))}
              </div>

              {/* Data preview table */}
              <div className="flex-1 overflow-auto rounded-xl border border-border/50 min-h-0">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted">
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[50px]">#</th>
                      {csvHeaders.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                          <span className={EXPECTED_CSV_FIELDS.includes(h) ? "text-emerald-600" : "text-muted-foreground"}>{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 100).map((row, idx) => (
                      <tr key={idx} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">{idx + 1}</td>
                        {csvHeaders.map(h => (
                          <td key={h} className="px-3 py-1.5 text-foreground max-w-[200px] truncate">
                            {row[h] || <span className="text-muted-foreground/40">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 100 && (
                  <div className="text-center py-3 text-[10px] text-muted-foreground bg-muted/10 border-t">
                    Showing first 100 of {parsedRows.length.toLocaleString()} rows
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between shrink-0 pt-2">
                <Button variant="outline" size="sm" onClick={() => setImportStep("upload")} className="gap-1.5">
                  <RotateCw className="h-3.5 w-3.5" />
                  Choose Different File
                </Button>
                <Button size="sm" onClick={handleImportExecute} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <Upload className="h-3.5 w-3.5" />
                  Import {parsedRows.length.toLocaleString()} Records
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Importing ── */}
          {importStep === "importing" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
              <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-muted/30 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileSpreadsheet className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-foreground">Importing records...</p>
                <p className="text-xs text-muted-foreground">{importProgress.label}</p>
              </div>
              {importProgress.total > 1 && (
                <div className="w-64 space-y-1.5">
                  <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Batch {importProgress.current} of {importProgress.total}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step: Done ── */}
          {importStep === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
              <div className={`p-4 rounded-full ${
                importResult.errors > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"
              }`}>
                {importResult.errors > 0 ? (
                  <AlertCircle className="h-10 w-10 text-amber-500" />
                ) : (
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold text-foreground">
                  {importResult.errors > 0 ? "Import Completed with Warnings" : "Import Successful!"}
                </p>
                <p className="text-xs text-muted-foreground">Your reimbursement records have been processed</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="text-center p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-2xl font-black text-emerald-500">{importResult.inserted}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">New</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <p className="text-2xl font-black text-blue-500">{importResult.updated}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Updated</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-2xl font-black text-foreground">{importResult.total}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Total</p>
                </div>
              </div>

              {importResult.errors > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-4 py-2 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {importResult.errors} batch(es) encountered errors
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setImportStep("upload")} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Import More
                </Button>
                <Button size="sm" onClick={() => setImportDialogOpen(false)} className="gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
