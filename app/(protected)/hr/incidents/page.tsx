"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Shield, AlertTriangle, CheckCircle2, DollarSign, Trash2, Search, FileSpreadsheet, ArrowRight, CheckCircle, AlertCircle, RotateCw, FileUp, Table2, Upload, X, ExternalLink } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useHrClaims } from "@/lib/query/hooks/useHr";
import Papa from "papaparse";

interface ClaimRow {
  _id: string;
  transporterId: string;
  employeeName?: string;
  reportedDate?: string;
  incidentDate?: string;
  claimType?: string;
  van?: string;
  claimantName?: string;
  shortDescription?: string;
  claimNumber?: string;
  claimantLawyer?: string;
  claimStatus?: string;
  statusDetail?: string;
  coverageDescription?: string;
  claimIncurred?: string;
  employeeNotes?: string;
  supervisorNotes?: string;
  thirdPartyName?: string;
  thirdPartyPhone?: string;
  thirdPartyEmail?: string;
  withInsurance?: boolean;
  insurancePolicy?: string;
  paid?: number;
  reserved?: number;
  incidentUploadFile?: string;
  createdBy?: string;
}

interface KpiData {
  totalRecords: number;
  totalPaid: number;
  totalReserved: number;
  openCount: number;
  closedCount: number;
  injuryCount: number;
  autoCount: number;
  propertyDamageCount: number;
}

const statusColors: Record<string, string> = {
  New: "bg-blue-500 text-white border-blue-600",
  Open: "bg-amber-500 text-white border-amber-600",
  Close: "bg-emerald-500 text-white border-emerald-600",
};

const claimStatuses = ["New", "Open", "Close"];

interface ClaimTypeOption {
  _id: string;
  description: string;
  icon?: string;
  color?: string;
}

const PAGE_SIZE = 50;
const IMPORT_CHUNK_SIZE = 500;

const EXPECTED_CSV_FIELDS = [
  "ReportedDate", "IncidentDate", "Transporter ID", "ClaimType", "Van",
  "ClaimantName", "ShortDescription", "ClaimNumber", "ClaimantLawyer",
  "ClaimStatus", "Employee Notes", "Supervisor Notes",
  "With Insurance", "Insurance Policy", "Paid", "Reserved",
  "createdBy", "createdAt", "IncidentUploadFile",
];

interface EmployeeOption {
  _id: string;
  transporterId: string;
  firstName: string;
  lastName: string;
}

export default function IncidentsPage() {
  const { data: queryClaims } = useHrClaims();
  const [data, setData] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<KpiData>({ totalRecords: 0, totalPaid: 0, totalReserved: 0, openCount: 0, closedCount: 0, injuryCount: 0, autoCount: 0, propertyDamageCount: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClaimRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  // Fetch active employees for the dropdown
  useEffect(() => {
    fetch("/api/admin/employees?terminated=false&export=true&select=firstName,lastName,transporterId,status")
      .then(res => res.json())
      .then(json => {
        const list = (json.employees || json || []).map((e: any) => ({
          _id: e._id,
          transporterId: e.transporterId || "",
          firstName: e.firstName || "",
          lastName: e.lastName || "",
        }));
        setEmployees(list.sort((a: EmployeeOption, b: EmployeeOption) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
      })
      .catch(() => {});
  }, []);

  // Fetch claim types from dropdowns
  const [claimTypeOptions, setClaimTypeOptions] = useState<ClaimTypeOption[]>([]);
  useEffect(() => {
    fetch("/api/admin/settings/dropdowns?type=claim type")
      .then(res => res.json())
      .then((opts: any[]) => {
        setClaimTypeOptions(opts.filter((o: any) => o.isActive !== false).map((o: any) => ({
          _id: o._id,
          description: o.description,
          icon: o.icon || "",
          color: o.color || "",
        })));
      })
      .catch(() => {});
  }, []);

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
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchData = useCallback(async (reset: boolean) => {
    if (reset) { setLoading(true); } else { setLoadingMore(true); }
    try {
      const skip = reset ? 0 : data.length;
      const params = new URLSearchParams({ skip: String(skip), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/claims?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      if (reset) { setData(json.records); } else { setData(prev => [...prev, ...json.records]); }
      setTotalCount(json.totalCount);
      setHasMore(json.hasMore);
      setKpis(json.kpi);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [debouncedSearch, data.length]);

  useEffect(() => { fetchData(true); }, [debouncedSearch]);

  // ── Seed from TanStack Query cache for instant load ──
  useEffect(() => {
    if (!debouncedSearch && queryClaims && queryClaims.records && queryClaims.records.length > 0 && data.length === 0) {
      setData(queryClaims.records);
      setTotalCount(queryClaims.totalCount || queryClaims.records.length);
      setHasMore(queryClaims.hasMore || false);
      if (queryClaims.kpi) setKpis(queryClaims.kpi);
    }
  }, [queryClaims, debouncedSearch, data.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) fetchData(false);
    }, { root: container, rootMargin: "200px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchData]);

  // CSV Import
  const openImportDialog = () => {
    setImportStep("upload"); setParsedRows([]); setCsvHeaders([]); setCsvFileName("");
    setImportResult({ inserted: 0, updated: 0, total: 0, errors: 0 });
    setImportProgress({ current: 0, total: 0, label: "" }); setIsDragging(false);
    setImportDialogOpen(true);
  };

  const handleImportFileParse = (file: File) => {
    if (!file.name.endsWith(".csv")) { toast.error("Please select a CSV file"); return; }
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) { toast.error("CSV is empty"); return; }
        setCsvHeaders(results.meta.fields || []);
        setParsedRows(results.data as any[]);
        setImportStep("preview");
      },
      error: (err) => toast.error(`Parse failed: ${err.message}`),
    });
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleImportFileParse(file); e.target.value = "";
  };
  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) handleImportFileParse(file);
  };

  const handleImportExecute = async () => {
    if (parsedRows.length === 0) return;
    setImportStep("importing");
    const chunks: any[][] = [];
    for (let i = 0; i < parsedRows.length; i += IMPORT_CHUNK_SIZE) chunks.push(parsedRows.slice(i, i + IMPORT_CHUNK_SIZE));
    let ti = 0, tu = 0, tc = 0, te = 0;
    try {
      for (let i = 0; i < chunks.length; i++) {
        setImportProgress({ current: i + 1, total: chunks.length, label: `Batch ${i + 1} of ${chunks.length} (${chunks[i].length} rows)...` });
        const res = await fetch("/api/admin/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "claims", data: chunks[i] }) });
        const result = await res.json();
        if (!res.ok) { te++; continue; }
        ti += result.inserted || 0; tu += result.updated || 0; tc += result.count || 0;
      }
      setImportResult({ inserted: ti, updated: tu, total: tc, errors: te });
      setImportStep("done");
      toast.success(`Imported ${tc} records`);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setImportResult({ inserted: ti, updated: tu, total: tc, errors: te + 1 });
      setImportStep("done");
    }
  };

  const matchedFields = useMemo(() => EXPECTED_CSV_FIELDS.map(f => ({ field: f, found: csvHeaders.includes(f) })), [csvHeaders]);
  const matchedCount = matchedFields.filter(f => f.found).length;

  // Header
  useEffect(() => {
    setRightContent(
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 w-[200px] text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={openImportDialog} className="gap-1.5 h-8">
          <FileSpreadsheet className="h-4 w-4" /> Import Incidents
        </Button>
        <Button size="sm" onClick={() => openNew()} className="gap-1.5 h-8">
          <Plus className="h-4 w-4" /> Add Incident
        </Button>
      </div>
    );
    return () => { setRightContent(null); };
  }, [setLeftContent, setRightContent, searchQuery]);

  const openNew = () => {
    setEditingItem(null);
    setFormData({ transporterId: "", employeeName: "", claimType: "", van: "", claimantName: "", shortDescription: "", claimNumber: "", claimStatus: "New", employeeNotes: "", supervisorNotes: "", paid: "", reserved: "", insurancePolicy: "", withInsurance: false, incidentDate: "", reportedDate: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (row: ClaimRow) => {
    setEditingItem(row);
    setFormData({
      ...row,
      incidentDate: row.incidentDate ? new Date(row.incidentDate).toISOString().split("T")[0] : "",
      reportedDate: row.reportedDate ? new Date(row.reportedDate).toISOString().split("T")[0] : "",
      paid: row.paid?.toString() || "", reserved: row.reserved?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.transporterId) { toast.error("Employee is required"); return; }
    setSaving(true);
    try {
      const payload: any = { ...formData };
      if (payload.paid) payload.paid = parseFloat(payload.paid);
      if (payload.reserved) payload.reserved = parseFloat(payload.reserved);
      if (payload.incidentDate) payload.incidentDate = new Date(payload.incidentDate + "T00:00:00.000Z");
      if (payload.reportedDate) payload.reportedDate = new Date(payload.reportedDate + "T00:00:00.000Z");

      const url = editingItem ? `/api/admin/claims/${editingItem._id}` : "/api/admin/claims";
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Save failed");
      toast.success(editingItem ? "Incident updated" : "Incident created");
      setIsDialogOpen(false); fetchData(true);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this incident?")) return;
    try {
      const res = await fetch(`/api/admin/claims/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deleted"); fetchData(true);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleInlineStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/claims/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimStatus: newStatus }) });
      if (!res.ok) throw new Error("Update failed");
      setData(prev => prev.map(row => row._id === id ? { ...row, claimStatus: newStatus } : row));
      toast.success(`Status → ${newStatus}`);
    } catch (err: any) { toast.error(err.message); }
  };

  const fmt = (d: string | undefined) => { if (!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };
  const fmtCurrency = (n: number | undefined) => n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  if (loading && data.length === 0) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  // Pie chart data
  const pieData = [
    { label: "Injury", count: kpis.injuryCount, color: "#f43f5e" },
    { label: "Auto", count: kpis.autoCount, color: "#3b82f6" },
    { label: "Property Damage", count: kpis.propertyDamageCount, color: "#f59e0b" },
  ];
  const pieTotal = pieData.reduce((s, d) => s + d.count, 0);
  let cumulative = 0;
  const pieSegments = pieData.filter(d => d.count > 0).map(d => {
    const start = cumulative;
    cumulative += d.count;
    return { ...d, start, end: cumulative };
  });
  const PIE_R = 32, PIE_CX = 40, PIE_CY = 40;
  const toArc = (startFrac: number, endFrac: number) => {
    const s = startFrac * 2 * Math.PI - Math.PI / 2;
    const e = endFrac * 2 * Math.PI - Math.PI / 2;
    const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
    return `M ${PIE_CX + PIE_R * Math.cos(s)} ${PIE_CY + PIE_R * Math.sin(s)} A ${PIE_R} ${PIE_R} 0 ${largeArc} 1 ${PIE_CX + PIE_R * Math.cos(e)} ${PIE_CY + PIE_R * Math.sin(e)} L ${PIE_CX} ${PIE_CY} Z`;
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4" /><span className="text-xs font-medium">Total Incidents</span></div>
          <p className="text-2xl font-bold tabular-nums">{kpis.totalRecords}</p>
          <p className="text-xs text-muted-foreground">{kpis.openCount} open · {kpis.closedCount} closed</p>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-500"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Total Paid</span></div>
          <p className="text-2xl font-bold tabular-nums text-red-600">{fmtCurrency(kpis.totalPaid)}</p>
          <p className="text-xs text-muted-foreground">across all incidents</p>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-medium">Reserved</span></div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">{fmtCurrency(kpis.totalReserved)}</p>
          <p className="text-xs text-muted-foreground">pending reserves</p>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-500"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">By Type</span></div>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 80 80" className="w-16 h-16 shrink-0">
              {pieTotal === 0 ? (
                <circle cx={PIE_CX} cy={PIE_CY} r={PIE_R} fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
              ) : pieSegments.length === 1 ? (
                <circle cx={PIE_CX} cy={PIE_CY} r={PIE_R} fill={pieSegments[0].color} />
              ) : (
                pieSegments.map((seg, i) => (
                  <path key={i} d={toArc(seg.start / pieTotal, seg.end / pieTotal)} fill={seg.color} />
                ))
              )}
            </svg>
            <div className="flex flex-col gap-1 min-w-0">
              {pieData.map(d => (
                <div key={d.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-muted-foreground truncate">{d.label}</span>
                  <span className="text-[11px] font-bold ml-auto tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card flex-1 min-h-0 flex flex-col">
        <div ref={scrollRef} className="overflow-auto flex-1">
          {/* Desktop */}
          <table className="w-full text-sm border-collapse hidden md:table">
            <colgroup>
              <col className="w-[14%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[8%]" />
              <col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[33%]" /><col className="w-[5%]" />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted border-b border-border/50">
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Employee</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Incident</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Type</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Claim #</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-right font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Paid</th>
                <th className="text-right font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Reserved</th>
                <th className="text-left font-semibold px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading ? (
                <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">No incidents found.</td></tr>
              ) : data.map((row, idx) => {
                const st = row.claimStatus || "Open";
                return (
                  <tr key={`${row._id}-${idx}`} className="border-b border-border/10 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(row)}>
                    <td className="px-3 py-2"><span className="font-medium text-sm whitespace-nowrap">{row.employeeName || row.claimantName || "—"}</span></td>
                    <td className="px-3 py-2"><span className="text-xs whitespace-nowrap">{fmt(row.incidentDate)}</span></td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{row.claimType || "—"}</Badge></td>
                    <td className="px-3 py-2"><span className="text-xs font-mono">{row.claimNumber || "—"}</span></td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <Select value={st} onValueChange={val => handleInlineStatusChange(row._id, val)}>
                        <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 w-auto [&>svg]:hidden">
                          <Badge className={`text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${statusColors[st] || "bg-muted text-white"}`}>{st}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {claimStatuses.map(s => (<SelectItem key={s} value={s}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${statusColors[s]?.split(' ')[0] || 'bg-muted'}`} />{s}</span></SelectItem>))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right"><span className="font-semibold text-sm tabular-nums whitespace-nowrap">{fmtCurrency(row.paid)}</span></td>
                    <td className="px-3 py-2 text-right"><span className="text-sm tabular-nums whitespace-nowrap">{fmtCurrency(row.reserved)}</span></td>
                    <td className="px-3 py-2"><span className="text-xs text-muted-foreground">{row.shortDescription || "—"}</span></td>
                    <td className="px-2 py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); handleDelete(row._id); }}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/10">
            {data.length === 0 && !loading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No incidents found.</div>
            ) : data.map((row, idx) => {
              const st = row.claimStatus || "Open";
              return (
                <div key={`m-${row._id}-${idx}`} className="p-3 hover:bg-muted/20 transition-colors cursor-pointer active:bg-muted/30" onClick={() => openEdit(row)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{row.employeeName || row.claimantName || "—"}</span>
                    <span className="font-bold text-sm tabular-nums whitespace-nowrap">{fmtCurrency(row.paid)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{fmt(row.incidentDate)}</span>
                      <Badge variant="outline" className="text-[9px]">{row.claimType || "—"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div onClick={e => e.stopPropagation()}>
                        <Select value={st} onValueChange={val => handleInlineStatusChange(row._id, val)}>
                          <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 w-auto [&>svg]:hidden">
                            <Badge className={`text-[10px] cursor-pointer ${statusColors[st] || "bg-muted text-white"}`}>{st}</Badge>
                          </SelectTrigger>
                          <SelectContent>{claimStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); handleDelete(row._id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {row.shortDescription && <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{row.shortDescription}</p>}
                </div>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-4" />
          {loadingMore && <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        </div>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-500" />
              {editingItem ? "Edit Incident" : "New Incident"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2"><Label>Employee *</Label>
              <Select value={formData.transporterId || ""} onValueChange={val => {
                const emp = employees.find(e => e.transporterId === val);
                setFormData((p: any) => ({ ...p, transporterId: val, employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp._id} value={emp.transporterId || emp._id}>
                      {`${emp.firstName} ${emp.lastName}`.trim()}{emp.transporterId ? ` (${emp.transporterId})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Claimant Name</Label><Input value={formData.claimantName || ""} onChange={e => setFormData((p: any) => ({ ...p, claimantName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Incident Date</Label><Input type="date" value={formData.incidentDate || ""} onChange={e => setFormData((p: any) => ({ ...p, incidentDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Reported Date</Label><Input type="date" value={formData.reportedDate || ""} onChange={e => setFormData((p: any) => ({ ...p, reportedDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Claim Type</Label>
              <Select value={formData.claimType || ""} onValueChange={val => setFormData((p: any) => ({ ...p, claimType: val }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {claimTypeOptions.map(ct => {
                    const IconComp = ct.icon ? (LucideIcons as any)[ct.icon] : null;
                    return (
                      <SelectItem key={ct._id} value={ct.description}>
                        <span className="flex items-center gap-2">
                          {IconComp && <IconComp className="h-3.5 w-3.5 shrink-0" style={ct.color ? { color: ct.color } : undefined} />}
                          {ct.color && !IconComp && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />}
                          {ct.description}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={formData.claimStatus || "Open"} onValueChange={val => setFormData((p: any) => ({ ...p, claimStatus: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{claimStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Claim Number</Label><Input value={formData.claimNumber || ""} onChange={e => setFormData((p: any) => ({ ...p, claimNumber: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Van (VIN)</Label><Input value={formData.van || ""} onChange={e => setFormData((p: any) => ({ ...p, van: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Paid ($)</Label><Input type="number" step="0.01" value={formData.paid || ""} onChange={e => setFormData((p: any) => ({ ...p, paid: e.target.value }))} placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Reserved ($)</Label><Input type="number" step="0.01" value={formData.reserved || ""} onChange={e => setFormData((p: any) => ({ ...p, reserved: e.target.value }))} placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Insurance Policy</Label><Input value={formData.insurancePolicy || ""} onChange={e => setFormData((p: any) => ({ ...p, insurancePolicy: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Claimant Lawyer</Label><Input value={formData.claimantLawyer || ""} onChange={e => setFormData((p: any) => ({ ...p, claimantLawyer: e.target.value }))} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Short Description</Label><Textarea value={formData.shortDescription || ""} onChange={e => setFormData((p: any) => ({ ...p, shortDescription: e.target.value }))} rows={2} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Employee Notes</Label><Textarea value={formData.employeeNotes || ""} onChange={e => setFormData((p: any) => ({ ...p, employeeNotes: e.target.value }))} rows={2} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Supervisor Notes</Label><Textarea value={formData.supervisorNotes || ""} onChange={e => setFormData((p: any) => ({ ...p, supervisorNotes: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-rose-600 hover:bg-rose-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editingItem ? "Save Changes" : "Create Incident"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0"><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-rose-500" /> Import Incidents</DialogTitle></DialogHeader>

          {/* Steps */}
          <div className="flex items-center gap-2 px-1 py-3 shrink-0">
            {([["upload","Upload",FileUp],["preview","Preview",Table2],["importing","Importing",RotateCw],["done","Done",CheckCircle]] as const).map(([key, label, Icon], idx) => {
              const order = ["upload","preview","importing","done"];
              const cur = order.indexOf(importStep); const ti = order.indexOf(key);
              const active = importStep === key; const done = ti < cur;
              return (
                <div key={key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${active ? "bg-primary/10 text-primary" : done ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/30 text-muted-foreground"}`}>
                    <Icon className={`h-3.5 w-3.5 ${active && key === "importing" ? "animate-spin" : ""}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
                  </div>
                  {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />}
                </div>
              );
            })}
          </div>

          <input ref={importFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFileSelect} />

          {importStep === "upload" && (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleImportDrop} onClick={() => importFileRef.current?.click()}
                className={`w-full max-w-md flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border/60 bg-muted/10 hover:bg-muted/30 hover:border-primary/40"}`}>
                <div className={`p-4 rounded-2xl ${isDragging ? "bg-primary/10" : "bg-muted/40"}`}><Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} /></div>
                <div className="text-center space-y-1"><p className="text-sm font-semibold">{isDragging ? "Drop your CSV here" : "Drag & drop your CSV file"}</p><p className="text-xs text-muted-foreground">or click to browse</p></div>
              </div>
              <div className="mt-6 w-full max-w-md space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Expected Columns</p>
                <div className="flex flex-wrap gap-1.5">{EXPECTED_CSV_FIELDS.map(f => <span key={f} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-muted/40 text-foreground border border-border/30">{f}</span>)}</div>
              </div>
            </div>
          )}

          {importStep === "preview" && (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-rose-500/10"><FileSpreadsheet className="h-4 w-4 text-rose-500" /></div>
                  <div><p className="text-sm font-semibold truncate">{csvFileName}</p><p className="text-[10px] text-muted-foreground">{parsedRows.length.toLocaleString()} rows</p></div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center"><p className="text-lg font-black text-emerald-500">{matchedCount}</p><p className="text-[9px] text-muted-foreground font-bold uppercase">Matched</p></div>
                  <div className="h-8 w-px bg-border/50" />
                  <div className="text-center"><p className="text-lg font-black">{EXPECTED_CSV_FIELDS.length}</p><p className="text-[9px] text-muted-foreground font-bold uppercase">Expected</p></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">{matchedFields.map(({ field, found }) => (
                <span key={field} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${found ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-amber-500/10 border-amber-500/20 text-amber-600"}`}>
                  {found ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}{field}
                </span>
              ))}</div>
              <div className="flex-1 overflow-auto rounded-xl border border-border/50 min-h-0">
                <table className="w-full text-xs border-collapse"><thead className="sticky top-0 z-10"><tr className="bg-muted">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted-foreground w-[50px]">#</th>
                  {csvHeaders.map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap"><span className={EXPECTED_CSV_FIELDS.includes(h) ? "text-emerald-600" : ""}>{h}</span></th>)}
                </tr></thead><tbody>
                  {parsedRows.slice(0, 50).map((row, i) => <tr key={i} className="border-b border-border/10 hover:bg-muted/20"><td className="px-3 py-1.5 text-muted-foreground font-mono">{i+1}</td>{csvHeaders.map(h => <td key={h} className="px-3 py-1.5 max-w-[200px] truncate">{row[h] || <span className="text-muted-foreground/40">—</span>}</td>)}</tr>)}
                </tbody></table>
                {parsedRows.length > 50 && <div className="text-center py-3 text-[10px] text-muted-foreground bg-muted/10 border-t">Showing first 50 of {parsedRows.length.toLocaleString()} rows</div>}
              </div>
              <div className="flex items-center justify-between shrink-0 pt-2">
                <Button variant="outline" size="sm" onClick={() => setImportStep("upload")} className="gap-1.5"><RotateCw className="h-3.5 w-3.5" /> Different File</Button>
                <Button size="sm" onClick={handleImportExecute} className="gap-1.5 bg-rose-600 hover:bg-rose-700"><Upload className="h-3.5 w-3.5" /> Import {parsedRows.length.toLocaleString()} Records</Button>
              </div>
            </div>
          )}

          {importStep === "importing" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
              <div className="relative"><div className="h-20 w-20 rounded-full border-4 border-muted/30 border-t-rose-500 animate-spin" /><div className="absolute inset-0 flex items-center justify-center"><Shield className="h-7 w-7 text-rose-500" /></div></div>
              <div className="text-center space-y-2"><p className="text-sm font-semibold">Importing incidents...</p><p className="text-xs text-muted-foreground">{importProgress.label}</p></div>
              {importProgress.total > 1 && <div className="w-64 space-y-1.5"><div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} /></div><p className="text-[10px] text-muted-foreground text-center">Batch {importProgress.current} of {importProgress.total}</p></div>}
            </div>
          )}

          {importStep === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
              <div className={`p-4 rounded-full ${importResult.errors > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                {importResult.errors > 0 ? <AlertCircle className="h-10 w-10 text-amber-500" /> : <CheckCircle className="h-10 w-10 text-emerald-500" />}
              </div>
              <div className="text-center space-y-1"><p className="text-lg font-bold">{importResult.errors > 0 ? "Completed with Warnings" : "Import Successful!"}</p><p className="text-xs text-muted-foreground">Incident records processed</p></div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="text-center p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"><p className="text-2xl font-black text-emerald-500">{importResult.inserted}</p><p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">New</p></div>
                <div className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/20"><p className="text-2xl font-black text-blue-500">{importResult.updated}</p><p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Updated</p></div>
                <div className="text-center p-3 rounded-xl bg-primary/5 border border-primary/20"><p className="text-2xl font-black">{importResult.total}</p><p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Total</p></div>
              </div>
              {importResult.errors > 0 && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-4 py-2 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{importResult.errors} batch error(s)</div>}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setImportStep("upload")} className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Import More</Button>
                <Button size="sm" onClick={() => setImportDialogOpen(false)} className="gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
