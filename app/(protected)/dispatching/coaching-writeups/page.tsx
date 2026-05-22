"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
  Search,
  Eye,
  FileText,
  User,
  AlertTriangle,
  Target,
  Loader2,
  X,
  Plus,
  ChevronsUpDown,
  Check,
  Paperclip,
  Upload,
  Trash2,
  RefreshCw,
  Download,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CoachingWriteUp {
  _id: string;
  employeeId?: string;
  employeeName?: string;
  supervisorName?: string;
  durationOfIncident?: string;
  incidentDate?: string;
  incidentWeek?: string;
  type?: string;
  metric?: string;
  metricName?: string;
  metricIcon?: string;
  metricColor?: string;
  correctiveActionNumber?: string;
  metricNoticeNumber?: string;
  correctiveAction?: string;
  correctiveActionDate?: string;
  supervisor?: string;
  metricValue?: string;
  seatbeltOffRate?: string;
  speedingEventRate?: string;
  distractionsRate?: string;
  signSignalViolationsRate?: string;
  followingDistanceRate?: string;
  DAMishandledPackage?: string;
  DAWasUnprofessional?: string;
  DADidNotFollowMyDeliveryInstructions?: string;
  deliveredToWrongAddress?: string;
  neverReceivedDelivery?: string;
  receivedWrongItem?: string;
  improvedByDate?: string;
  suggestion?: string;
  totalNegativeFeedbacks?: string;
  priorDiscussionOrWarningsOnThisSubject?: string;
  goal?: string;
  files?: { name: string; url: string }[];
  unSignedPdf?: string;
  signedPdf?: string;
  createdBy?: string;
  createdAt?: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Searchable Select component
function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { _id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, search]);
  const selectedName = options.find((o) => o._id === value)?.name || "";

  return (
    <div className="min-w-0">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-8 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-xs",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate">{selectedName || `Select ${label.toLowerCase()}`}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b border-border">
            <Input
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">No results</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt._id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors text-left",
                    value === opt._id && "bg-muted"
                  )}
                  onClick={() => {
                    onChange(opt._id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", value === opt._id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt.name}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function CoachingWriteupsPage() {
  const { searchQuery, setOnCoachingAdd, availableWeeks, coachingSignedFilter } = useDispatching();
  const [data, setData] = useState<CoachingWriteUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [localSearch, setLocalSearch] = useState("");
  const [metricOptions, setMetricOptions] = useState<{ _id: string; description: string; metricTypeGoal?: string }[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<{ _id: string; name: string }[]>([]);
  const [supervisorOptions, setSupervisorOptions] = useState<{ _id: string; name: string }[]>([]);
  const [filesPopover, setFilesPopover] = useState<{ rowId: string; files: { name: string; url: string }[] } | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Unified Modal State ──
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [modalForm, setModalForm] = useState<Record<string, any>>({});
  const [modalRecord, setModalRecord] = useState<CoachingWriteUp | null>(null); // original record for edit
  // Track records whose PDF is being generated in the background
  const [pendingPdf, setPendingPdf] = useState<Set<string>>(new Set());

  const openAddModal = () => {
    setModalMode("add");
    setModalForm({});
    setModalRecord(null);
    (window as any).__pendingUploadFiles = [];
  };

  const openEditModal = (row: CoachingWriteUp) => {
    setModalMode("edit");
    setModalForm({ ...row });
    setModalRecord(row);
    (window as any).__pendingUploadFiles = [];
  };

  const closeModal = () => {
    setModalMode(null);
    setModalForm({});
    setModalRecord(null);
    (window as any).__pendingUploadFiles = [];
  };

  // Fetch metric dropdown options
  useEffect(() => {
    fetch("/api/admin/settings/dropdowns?type=metric")
      .then(r => r.json())
      .then(d => setMetricOptions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (pageNum = 1, search = "") => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", "50");
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/coaching-writeups?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      if (pageNum === 1) {
        setData(result.records || []);
        // Clear pendingPdf for any records that now have a valid PDF
        setPendingPdf(prev => {
          const next = new Set(prev);
          for (const r of (result.records || [])) {
            if (r.unSignedPdf && r.unSignedPdf.startsWith("/pdfs/")) {
              // Valid new-style URL — clear spinner
              next.delete(r._id?.toString());
            } else if (r.unSignedPdf && !r.unSignedPdf.startsWith("/pdfs/")) {
              // Old broken proxy URL — show spinner so it gets regenerated on next edit
              // Don't auto-add to pending (user must re-save), just ignore so it shows "—"
            }
          }
          return next;
        });
      } else {
        setData(prev => [...prev, ...(result.records || [])]);
      }
      setTotalCount(result.totalCount || 0);
      setHasMore(result.hasMore || false);
      if (result.employees) setEmployeeOptions(result.employees);
      if (result.supervisors) setSupervisorOptions(result.supervisors);
    } catch (err) {
      console.error("Failed to fetch coaching writeups:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const query = searchQuery || localSearch;
    setPage(1);
    fetchData(1, query);
  }, [searchQuery, localSearch, fetchData]);

  // Load more when page increments
  useEffect(() => {
    if (page > 1) fetchData(page, searchQuery || localSearch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Infinite scroll handler
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loadingMore || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        setPage(prev => prev + 1);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadingMore, hasMore]);

  // Register add handler with layout
  useEffect(() => {
    setOnCoachingAdd(() => () => openAddModal());
    return () => setOnCoachingAdd(null);
  }, [setOnCoachingAdd]);

  // Poll every 5s while PDF generation is in progress — fetch only pending records, not the full list
  useEffect(() => {
    if (pendingPdf.size === 0) return;
    const interval = setInterval(async () => {
      const resolved = new Set<string>();
      await Promise.all(
        Array.from(pendingPdf).map(async (id) => {
          try {
            const res = await fetch(`/api/admin/coaching-writeups/${id}`);
            if (!res.ok) return;
            const updated = await res.json();
            if (updated.unSignedPdf && updated.unSignedPdf.startsWith("/pdfs/")) {
              // Silently patch just this row — no full table refresh
              setData(prev => prev.map(r => r._id?.toString() === id ? { ...r, unSignedPdf: updated.unSignedPdf } : r));
              resolved.add(id);
            }
          } catch { /* ignore */ }
        })
      );
      if (resolved.size > 0) {
        setPendingPdf(prev => { const next = new Set(prev); resolved.forEach(id => next.delete(id)); return next; });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pendingPdf.size]);

  // Live-calculate correctiveActionNumber and metricNoticeNumber (Add mode only)
  useEffect(() => {
    if (modalMode !== "add") return;
    if (!modalForm.employeeId) {
      setModalForm(prev => ({ ...prev, correctiveActionNumber: "", metricNoticeNumber: "" }));
      return;
    }
    const params = new URLSearchParams({ action: "counts", employeeId: modalForm.employeeId });
    if (modalForm.metric) params.set("metric", modalForm.metric);
    fetch(`/api/admin/coaching-writeups?${params}`)
      .then(r => r.json())
      .then(d => {
        setModalForm(prev => ({
          ...prev,
          correctiveActionNumber: String((d.correctiveActionCount || 0) + 1),
          metricNoticeNumber: modalForm.metric ? String((d.metricNoticeCount || 0) + 1) : "",
        }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalForm.employeeId, modalForm.metric, modalMode]);

  // Auto-calculate improvedByDate
  useEffect(() => {
    if (!modalMode) return;
    const dur = modalForm.durationOfIncident;
    if (dur === "Day" && modalForm.incidentDate) {
      const d = new Date(modalForm.incidentDate);
      d.setDate(d.getDate() + 3);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setModalForm(prev => ({ ...prev, improvedByDate: `${yyyy}-${mm}-${dd}` }));
    } else if (dur === "Week" && modalForm.incidentWeek) {
      // Parse ISO week like "2026-W21" or "2026-W021"
      const match = modalForm.incidentWeek.match(/(\d{4})-W0*(\d+)/);
      if (match) {
        const year = parseInt(match[1]);
        const week = parseInt(match[2]);
        // Get Monday of the ISO week
        const jan4 = new Date(year, 0, 4);
        const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
        const mondayW1 = new Date(jan4);
        mondayW1.setDate(jan4.getDate() - dayOfWeek + 1);
        const monday = new Date(mondayW1);
        monday.setDate(mondayW1.getDate() + (week - 1) * 7);
        // First day of next week (Sunday = Monday + 6)
        const nextWeekStart = new Date(monday);
        nextWeekStart.setDate(monday.getDate() + 6);
        const yyyy = nextWeekStart.getFullYear();
        const mm = String(nextWeekStart.getMonth() + 1).padStart(2, "0");
        const dd = String(nextWeekStart.getDate()).padStart(2, "0");
        setModalForm(prev => ({ ...prev, improvedByDate: `${yyyy}-${mm}-${dd}` }));
      }
    } else {
      setModalForm(prev => ({ ...prev, improvedByDate: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalForm.durationOfIncident, modalForm.incidentDate, modalForm.incidentWeek, modalMode]);

  // ── Unified Save Handler — closes modal instantly, everything else in background ──
  const handleModalSave = () => {
    // Snapshot everything synchronously before closing
    const body: any = { ...modalForm };
    delete body._id;
    delete body.employeeName;
    delete body.supervisorName;
    delete body.metricName;
    delete body.metricIcon;
    delete body.metricColor;
    delete body.__v;
    delete body.createdAt;
    delete body.updatedAt;
    delete body._pendingFiles;

    // Snap the pending files list and clear the global before modal closes
    const pendingFiles: File[] = [...((window as any).__pendingUploadFiles || [])];
    (window as any).__pendingUploadFiles = [];

    const savedMode = modalMode;
    const savedRecord = modalRecord;

    // For edit: optimistically clear unSignedPdf in the row so the spinner shows immediately
    if (savedMode === "edit" && savedRecord?._id) {
      const id = String(savedRecord._id);
      setPendingPdf(prev => new Set(prev).add(id));
      setData(prev => prev.map(r => r._id?.toString() === id ? { ...r, unSignedPdf: undefined } : r));
    }

    // Close the modal RIGHT NOW — everything else is async in the background
    closeModal();

    // Fire-and-forget background work
    (async () => {
      try {
        // Upload pending files in parallel
        if (pendingFiles.length > 0) {
          const uploaded = await Promise.all(
            pendingFiles.map(async (file) => {
              const fd = new FormData();
              fd.append("file", file);
              const r = await fetch("/api/upload/cloudinary", { method: "POST", body: fd });
              if (r.ok) { const { url } = await r.json(); return { name: file.name, url }; }
              return null;
            })
          );
          const existing: { name: string; url: string }[] = body.files || [];
          body.files = [...existing, ...(uploaded.filter(Boolean) as any)];
        }

        // Convert dates
        if (body.incidentDate?.length === 10) body.incidentDate = new Date(body.incidentDate).toISOString();
        if (body.correctiveActionDate?.length === 10) body.correctiveActionDate = new Date(body.correctiveActionDate).toISOString();
        if (body.improvedByDate?.length === 10) body.improvedByDate = new Date(body.improvedByDate).toISOString();

        // Auto-set goal
        if (body.metric) {
          const selMetric = metricOptions.find((o: any) => o._id === body.metric);
          if (selMetric?.metricTypeGoal) body.goal = selMetric.metricTypeGoal;
        }

        if (savedMode === "add") {
          const res = await fetch("/api/admin/coaching-writeups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error("Failed to create");
          const created = await res.json();
          // Prepend the new record and mark as pending PDF
          setData(prev => [created, ...prev]);
          setPendingPdf(prev => new Set(prev).add(String(created._id)));
        } else if (savedMode === "edit" && savedRecord) {
          const res = await fetch(`/api/admin/coaching-writeups/${savedRecord._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error("Failed to update");
          const updated = await res.json();
          // Patch just this row's data (files etc.) without touching unSignedPdf — that arrives via poll
          setData(prev => prev.map(r =>
            r._id?.toString() === String(savedRecord._id)
              ? { ...r, ...updated, unSignedPdf: undefined } // keep undefined so spinner stays
              : r
          ));
        }
      } catch (err) {
        console.error("Background save failed:", err);
        // On error, remove from pendingPdf so spinner doesn't hang
        if (savedRecord?._id) {
          setPendingPdf(prev => { const n = new Set(prev); n.delete(String(savedRecord._id)); return n; });
        }
      }
    })();
  };


  // Filter locally by the dispatching layout's search + signed filter
  const filteredData = useMemo(() => {
    let result = data;
    // Apply signed filter
    if (coachingSignedFilter === "signed") {
      result = result.filter(r => r.signedPdf && r.signedPdf.trim() !== "");
    } else {
      result = result.filter(r => !r.signedPdf || r.signedPdf.trim() === "");
    }
    if (!searchQuery && !localSearch) return result;
    const q = (searchQuery || localSearch).toLowerCase();
    return result.filter(
      (r) =>
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q) ||
        (r.metricName || "").toLowerCase().includes(q) ||
        (r.supervisorName || "").toLowerCase().includes(q)
    );
  }, [data, searchQuery, localSearch, coachingSignedFilter]);

  const getTypeBadgeColor = (type?: string) => {
    if (!type) return "bg-muted text-muted-foreground";
    const t = type.toLowerCase();
    if (t.includes("coaching")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (t.includes("corrective")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    if (t.includes("writeup") || t.includes("write up")) return "bg-red-500/15 text-red-400 border-red-500/30";
    if (t.includes("termination")) return "bg-rose-600/15 text-rose-400 border-rose-600/30";
    return "bg-primary/10 text-primary border-primary/30";
  };
  // Group by type
  const groupedData = useMemo(() => {
    const groups: { type: string; rows: CoachingWriteUp[] }[] = [];
    const groupMap = new Map<string, CoachingWriteUp[]>();

    for (const row of filteredData) {
      const t = row.type || "Uncategorized";
      if (!groupMap.has(t)) {
        groupMap.set(t, []);
      }
      groupMap.get(t)!.push(row);
    }

    // Sort groups alphabetically
    const sortedKeys = Array.from(groupMap.keys()).sort();
    for (const key of sortedKeys) {
      groups.push({ type: key, rows: groupMap.get(key)! });
    }
    return groups;
  }, [filteredData]);

  const toDateInputValue = (v?: string) => {
    if (!v) return "";
    try { return new Date(v).toISOString().split("T")[0]; } catch { return ""; }
  };

  return (
    <div className="flex flex-col h-full gap-3 px-1">

      {/* ── Table ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Improved By</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Duration</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Week</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Metric</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Supervisor</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-[50px]">Files</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-[70px]">Unsigned</th>
              <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-[70px]">Signed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : groupedData.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted-foreground">
                  No coaching writeups found
                </td>
              </tr>
            ) : (
              groupedData.map((group) => (
                <React.Fragment key={group.type}>
                  {/* ── Group header ── */}
                  <tr className="bg-muted/40 border-t border-border">
                    <td colSpan={10} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border", getTypeBadgeColor(group.type))}>
                          {group.type}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {group.rows.length}
                        </Badge>
                      </div>
                    </td>
                  </tr>

                  {/* ── Group rows ── */}
                  {group.rows.map((row) => (
                    <tr
                      key={row._id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEditModal(row)}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-foreground">{row.employeeName || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.incidentDate)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.improvedByDate)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.durationOfIncident || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{row.incidentWeek || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[180px]">
                        {row.metricName ? (
                          <span className="inline-flex items-center gap-1.5 truncate">
                            {row.metricIcon && (() => {
                              const IconComp = (LucideIcons as any)[row.metricIcon];
                              return IconComp ? <IconComp className="h-3.5 w-3.5 shrink-0" style={row.metricColor ? { color: row.metricColor } : undefined} /> : null;
                            })()}
                            <span className="truncate">{row.metricName}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.supervisorName || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {(row.files?.length || 0) > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setFilesPopover({ rowId: row._id, files: row.files || [] }); }}
                            className="inline-flex items-center justify-center gap-0.5 h-7 px-1.5 rounded-md hover:bg-primary/10 transition-colors relative"
                            title={`${row.files?.length} file(s)`}
                          >
                            <Paperclip className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-bold text-primary">{row.files?.length}</span>
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.unSignedPdf && row.unSignedPdf.startsWith("/pdfs/") ? (
                          <a
                            href={row.unSignedPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-amber-500/20 transition-colors"
                            title="View Unsigned PDF"
                          >
                            <FileText className="h-4 w-4 text-amber-400" />
                          </a>
                        ) : pendingPdf.has(row._id?.toString()) ? (
                          <span className="inline-flex items-center justify-center h-7 w-7" title="Generating PDF…">
                            <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.signedPdf ? (
                          <a
                            href={row.signedPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-emerald-500/20 transition-colors"
                            title="View Signed PDF"
                          >
                            <FileText className="h-4 w-4 text-emerald-400" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
            {loadingMore && (
              <tr>
                <td colSpan={10} className="text-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Files Management Dialog ── */}
      <Dialog open={!!filesPopover} onOpenChange={() => setFilesPopover(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              Files ({filesPopover?.files.length || 0})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {filesPopover?.files.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No files attached</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {filesPopover?.files.map((file, idx) => {
                // Detect file type from name, URL path, or fileName query param
                const detectName = file.name || (() => { try { const u = new URL(file.url); return u.searchParams.get("fileName") || u.pathname; } catch { return file.url; } })();
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(detectName);
                const isPdf = /\.pdf/i.test(detectName);
                const isCloudinary = file.url?.includes("res.cloudinary.com");
                // For Cloudinary PDFs: show page 1 as a JPEG thumbnail
                const thumbUrl = (isPdf && isCloudinary)
                  ? file.url.replace("/upload/", "/upload/w_200,h_200,c_fill,pg_1,f_jpg/")
                  : isImage ? file.url : null;
                return (
                  <div key={idx} className="group relative rounded-xl border border-border overflow-hidden bg-muted/30">
                    <button
                      onClick={() => setFilePreview({ url: file.url, name: detectName })}
                      className="block w-full aspect-[4/3]"
                    >
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                          <FileText className="h-10 w-10 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate w-full text-center">{file.name || detectName.split("/").pop()}</span>
                        </div>
                      )}
                    </button>
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setFilePreview({ url: file.url, name: detectName })}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4 text-white" />
                      </button>
                      <a
                        href={file.url}
                        download={file.name || detectName.split("/").pop()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="Download"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-4 w-4 text-white" />
                      </a>
                      <button
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.onchange = async (e) => {
                            const f = (e.target as HTMLInputElement).files?.[0];
                            if (!f || !filesPopover) return;
                            const newFiles = [...filesPopover.files];
                            newFiles[idx] = { name: f.name, url: URL.createObjectURL(f) };
                            setFilesPopover({ ...filesPopover, files: newFiles });
                          };
                          input.click();
                        }}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="Replace"
                      >
                        <RefreshCw className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={() => {
                          if (!filesPopover) return;
                          const newFiles = filesPopover.files.filter((_, i) => i !== idx);
                          setFilesPopover({ ...filesPopover, files: newFiles });
                        }}
                        className="p-2 rounded-lg bg-red-500/40 hover:bg-red-500/60 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Upload more */}
            <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload more files</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (!filesPopover || files.length === 0) return;
                  const newEntries = files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
                  setFilesPopover({ ...filesPopover, files: [...filesPopover.files, ...newEntries] });
                  e.target.value = "";
                  // TODO: persist upload via API
                }}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── File Preview Dialog ── */}
      <Dialog open={!!filePreview} onOpenChange={() => setFilePreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-2">
          <DialogHeader className="shrink-0 px-2 pt-2">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-primary" />
              File Preview
            </DialogTitle>
          </DialogHeader>
          {filePreview && (() => {
            const detectName = filePreview.name || (() => { try { const u = new URL(filePreview.url); return u.searchParams.get("fileName") || u.pathname; } catch { return filePreview.url; } })();
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(detectName);
            const isPdf = /\.pdf/i.test(detectName);
            if (isImage) {
              return <img src={filePreview.url} alt="Preview" className="w-full max-h-[75vh] object-contain rounded-lg" />;
            } else if (isPdf) {
              return <iframe src={filePreview.url} className="w-full h-[75vh] rounded-lg border-0" />;
            } else {
              return (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <a href={filePreview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open file in new tab</a>
                </div>
              );
            }
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Unified Add/Edit Modal ── */}
      <Dialog open={!!modalMode} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {modalMode === "edit" ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <Plus className="h-5 w-5 text-amber-500" />}
              {modalMode === "edit" ? "Edit" : "Add"} Coaching &amp; Writeup
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 text-sm pr-1">
            {/* Row 1: Type, Duration, Date/Week, Improved By Date */}
            <div className="grid grid-cols-4 gap-3">
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
                <Select value={modalForm.type || ""} onValueChange={(v) => setModalForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger size="sm" className="text-xs w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coaching">Coaching</SelectItem>
                    <SelectItem value="Write Up">Write Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Duration</label>
                <Select value={modalForm.durationOfIncident || ""} onValueChange={(v) => setModalForm(prev => ({ ...prev, durationOfIncident: v, incidentDate: "", incidentWeek: "" }))}>
                  <SelectTrigger size="sm" className="text-xs w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Day">Day</SelectItem>
                    <SelectItem value="Week">Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modalForm.durationOfIncident === "Week" ? (
                <div className="min-w-0">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Incident Week</label>
                  <Select value={modalForm.incidentWeek || ""} onValueChange={(v) => setModalForm(prev => ({ ...prev, incidentWeek: v }))}>
                    <SelectTrigger size="sm" className="text-xs w-full"><SelectValue placeholder="Select week" /></SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {(availableWeeks || []).map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="min-w-0">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Incident Date</label>
                  <Input type="date" value={modalMode === "edit" ? toDateInputValue(modalForm.incidentDate) : (modalForm.incidentDate || "")} onChange={(e) => setModalForm(prev => ({ ...prev, incidentDate: e.target.value }))} className="h-8 text-xs w-full" disabled={!modalForm.durationOfIncident} />
                </div>
              )}
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Improved By Date</label>
                <Input type="text" disabled placeholder="Auto-calculated" value={modalMode === "edit" ? toDateInputValue(modalForm.improvedByDate) : (modalForm.improvedByDate || "")} className="h-8 text-xs w-full" />
              </div>
            </div>

            {/* Row 2: Metric, Employee, Supervisor */}
            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Metric</label>
                <Select value={modalForm.metric?.toString() || ""} onValueChange={(v) => setModalForm(prev => ({ ...prev, metric: v }))}>
                  <SelectTrigger size="sm" className="text-xs w-full"><SelectValue placeholder="Select metric" /></SelectTrigger>
                  <SelectContent className="max-h-[240px]">
                    {metricOptions.map((opt) => (
                      <SelectItem key={opt._id} value={opt._id}>{opt.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SearchableSelect
                label="Employee"
                placeholder="Search employee..."
                options={employeeOptions}
                value={modalForm.employeeId || ""}
                onChange={(v) => setModalForm(prev => ({ ...prev, employeeId: v }))}
              />
              <SearchableSelect
                label="Supervisor"
                placeholder="Search supervisor..."
                options={supervisorOptions}
                value={modalForm.supervisor || ""}
                onChange={(v) => setModalForm(prev => ({ ...prev, supervisor: v }))}
              />
            </div>

            {/* Row 3: Metric Notice #, Corrective Action #, Corrective Action, Goal */}
            <div className="grid grid-cols-4 gap-3">
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Metric Notice #</label>
                <Input type="text" disabled value={modalForm.metricNoticeNumber || ""} className="h-8 text-xs w-full" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Corrective Action #</label>
                <Input type="text" disabled value={modalForm.correctiveActionNumber || ""} className="h-8 text-xs w-full" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Corrective Action</label>
                <Input type="text" value={modalForm.correctiveAction || ""} onChange={(e) => setModalForm(prev => ({ ...prev, correctiveAction: e.target.value }))} className="h-8 text-xs w-full" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Goal</label>
                <Input type="text" disabled value={metricOptions.find(o => o._id === (modalForm.metric?.toString() || ""))?.metricTypeGoal || modalForm.goal || ""} className="h-8 text-xs w-full" />
              </div>
            </div>

            {/* Conditional metric section */}
            {(() => {
              const selMetricDesc = metricOptions.find(o => o._id === (modalForm.metric?.toString() || ""))?.description || "";
              const isSafety = selMetricDesc === "Safety Infraction";
              const isCDF = selMetricDesc === "Customer Delivery Feedback";

              if (!isSafety && !isCDF) return null;

              const fields: { key: string; label: string }[] = isSafety
                ? [
                    { key: "seatbeltOffRate", label: "Seatbelt Off Rate" },
                    { key: "speedingEventRate", label: "Speeding Event Rate" },
                    { key: "distractionsRate", label: "Distractions Rate" },
                    { key: "signSignalViolationsRate", label: "Sign/Signal Violations" },
                    { key: "followingDistanceRate", label: "Following Distance" },
                  ]
                : [
                    { key: "DAMishandledPackage", label: "Mishandled Package" },
                    { key: "DAWasUnprofessional", label: "Unprofessional" },
                    { key: "DADidNotFollowMyDeliveryInstructions", label: "Didn't Follow Instructions" },
                    { key: "deliveredToWrongAddress", label: "Wrong Address" },
                    { key: "neverReceivedDelivery", label: "Never Received" },
                    { key: "receivedWrongItem", label: "Received Wrong Item" },
                  ];

              const rows: typeof fields[] = [];
              for (let i = 0; i < fields.length; i += 3) {
                rows.push(fields.slice(i, i + 3));
              }

              return (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                  <span className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">{selMetricDesc}</span>
                  {rows.map((row, ri) => (
                    <div key={ri} className={`grid gap-3 ${row.length === 3 ? "grid-cols-3" : row.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {row.map((f) => (
                        <div key={f.key} className="min-w-0">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                          <Input type={isCDF ? "number" : "text"} min={isCDF ? 0 : undefined} value={modalForm[f.key] || ""} onChange={(e) => setModalForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="h-8 text-xs w-full" />
                        </div>
                      ))}
                    </div>
                  ))}
                  {isCDF && (() => {
                    const total = ["DAMishandledPackage", "DAWasUnprofessional", "DADidNotFollowMyDeliveryInstructions", "deliveredToWrongAddress", "neverReceivedDelivery", "receivedWrongItem"]
                      .reduce((sum, k) => sum + (parseFloat(modalForm[k] || "0") || 0), 0);
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="min-w-0">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Total Neg. Feedbacks</label>
                          <Input type="text" disabled value={String(total)} className="h-8 text-xs w-full" />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Prior Discussions */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prior Discussions / Warnings</label>
              <textarea
                value={modalForm.priorDiscussionOrWarningsOnThisSubject || ""}
                onChange={(e) => setModalForm(prev => ({ ...prev, priorDiscussionOrWarningsOnThisSubject: e.target.value }))}
                className="w-full h-16 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none"
              />
            </div>

            {/* File Upload — full-width thumbnail grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Attachments</label>
                <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground">
                  <Plus className="h-3 w-3" /> Add Files
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []);
                      if (!newFiles.length) return;
                      // Store names in form state for re-render
                      const existing = modalForm._pendingFiles ? JSON.parse(modalForm._pendingFiles) : [];
                      setModalForm(prev => ({ ...prev, _pendingFiles: JSON.stringify([...existing, ...newFiles.map(f => f.name)]) }));
                      // Store File objects for upload
                      const existingUploads = (window as any).__pendingUploadFiles || [];
                      (window as any).__pendingUploadFiles = [...existingUploads, ...newFiles];
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Grid box */}
              <div
                className="relative min-h-[110px] rounded-xl border-2 border-dashed border-border/50 bg-muted/10 p-3 transition-colors"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary/60", "bg-primary/5"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary/60", "bg-primary/5"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-primary/60", "bg-primary/5");
                  const droppedFiles = Array.from(e.dataTransfer.files);
                  if (!droppedFiles.length) return;
                  const existing = modalForm._pendingFiles ? JSON.parse(modalForm._pendingFiles) : [];
                  setModalForm(prev => ({ ...prev, _pendingFiles: JSON.stringify([...existing, ...droppedFiles.map(f => f.name)]) }));
                  const existingUploads = (window as any).__pendingUploadFiles || [];
                  (window as any).__pendingUploadFiles = [...existingUploads, ...droppedFiles];
                }}
              >
                {/* Empty state */}
                {(!modalForm._pendingFiles || JSON.parse(modalForm._pendingFiles).length === 0) &&
                  (!modalForm.files || modalForm.files.length === 0) && (
                  <label className="cursor-pointer absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <div className="h-10 w-10 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="text-[10px]">Drop files or click to upload</span>
                    <input
                      type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden"
                      onChange={(e) => {
                        const newFiles = Array.from(e.target.files || []);
                        if (!newFiles.length) return;
                        const existing = modalForm._pendingFiles ? JSON.parse(modalForm._pendingFiles) : [];
                        setModalForm(prev => ({ ...prev, _pendingFiles: JSON.stringify([...existing, ...newFiles.map(f => f.name)]) }));
                        const existingUploads = (window as any).__pendingUploadFiles || [];
                        (window as any).__pendingUploadFiles = [...existingUploads, ...newFiles];
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}

                {/* Thumbnails grid */}
                <div className="flex flex-wrap gap-2">
                  {/* Existing saved files */}
                  {(modalForm.files || []).map((f: { name: string; url: string }, i: number) => {
                    const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(f.name);
                    const isPdf = /\.pdf$/i.test(f.name);
                    const isCloudinary = f.url?.includes("res.cloudinary.com");
                    // For Cloudinary PDFs: generate a visual thumbnail of page 1
                    const thumbUrl = (isPdf && isCloudinary)
                      ? f.url.replace("/upload/", "/upload/w_160,h_192,c_fill,pg_1,f_jpg/")
                      : isImg ? f.url : null;
                    return (
                      <div key={`saved-${i}`} className={`relative group w-20 h-24 rounded-lg overflow-hidden border ${thumbUrl ? "border-border/60 bg-muted/20" : isPdf ? "bg-red-950/40 border-red-800/40" : "bg-blue-950/40 border-blue-800/40"} flex-shrink-0`}>
                        {thumbUrl ? (
                          <img src={thumbUrl} alt={f.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2">
                            <div className={`h-9 w-9 rounded-lg ${isPdf ? "bg-red-500/20" : "bg-blue-500/20"} flex items-center justify-center`}>
                              <FileText className={`h-5 w-5 ${isPdf ? "text-red-400" : "text-blue-400"}`} />
                            </div>
                            <span className={`text-[8px] uppercase font-bold tracking-wider ${isPdf ? "text-red-400" : "text-blue-400"}`}>{f.name.split(".").pop()?.toLowerCase()}</span>
                            <span className="text-[8px] text-muted-foreground text-center leading-tight line-clamp-2 w-full px-1">{f.name.replace(/\.[^.]+$/, "")}</span>
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <a href={f.url} target="_blank" rel="noopener noreferrer"
                            className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()} title="View">
                            <Eye className="h-3.5 w-3.5 text-white" />
                          </a>
                          <button type="button" title="Remove"
                            className="h-7 w-7 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center"
                            onClick={() => {
                              const updated = (modalForm.files || []).filter((_: any, fi: number) => fi !== i);
                              setModalForm(prev => ({ ...prev, files: updated }));
                            }}>
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pending (not yet uploaded) files */}
                  {(modalForm._pendingFiles ? JSON.parse(modalForm._pendingFiles) : []).map((name: string, i: number) => {
                    const pendingFile = ((window as any).__pendingUploadFiles || [])[i] as File | undefined;
                    const isImg = pendingFile ? pendingFile.type.startsWith("image/") : /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
                    const isPdf = /\.pdf$/i.test(name);
                    const ext = name.split(".").pop()?.toLowerCase() || "file";
                    const previewUrl = pendingFile && isImg ? URL.createObjectURL(pendingFile) : null;
                    return (
                      <div key={`pending-${i}`} className={`relative group w-20 h-24 rounded-lg overflow-hidden border ${isPdf ? "border-red-700/50 bg-red-950/30" : isImg ? "border-primary/40 bg-muted/30" : "border-blue-700/50 bg-blue-950/30"} flex-shrink-0`}>
                        {previewUrl ? (
                          <img src={previewUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2">
                            <div className={`h-9 w-9 rounded-lg ${isPdf ? "bg-red-500/20" : "bg-blue-500/20"} flex items-center justify-center`}>
                              <FileText className={`h-5 w-5 ${isPdf ? "text-red-400" : "text-blue-400"}`} />
                            </div>
                            <span className={`text-[8px] uppercase font-bold tracking-wider ${isPdf ? "text-red-400" : "text-blue-400"}`}>{ext}</span>
                            <span className="text-[8px] text-muted-foreground text-center leading-tight line-clamp-2 w-full px-1">{name.replace(/\.[^.]+$/, "")}</span>
                          </div>
                        )}
                        {/* New badge */}
                        <div className="absolute top-1 left-1">
                          <span className="text-[8px] bg-primary/80 text-white px-1 rounded">new</span>
                        </div>
                        {/* Delete button (always visible) */}
                        <button type="button" title="Remove"
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center"
                          onClick={() => {
                            const files: string[] = JSON.parse(modalForm._pendingFiles || "[]");
                            files.splice(i, 1);
                            setModalForm(prev => ({ ...prev, _pendingFiles: JSON.stringify(files) }));
                            const pending = (window as any).__pendingUploadFiles || [];
                            pending.splice(i, 1);
                            (window as any).__pendingUploadFiles = pending;
                          }}>
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PDF Documents — unSignedPdf & signedPdf (edit mode) */}
              {modalMode === "edit" && (modalRecord?.unSignedPdf || modalRecord?.signedPdf) && (
                <div className="mt-3">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">Generated PDFs</label>
                  <div className="flex gap-3">
                    {modalRecord?.unSignedPdf && modalRecord.unSignedPdf.startsWith("/pdfs/") && !modalForm.unSignedPdf?.toString().startsWith("") === false && modalForm.unSignedPdf !== "" && (
                      <div
                        className="group relative w-24 h-28 rounded-lg overflow-hidden border border-amber-700/50 bg-white flex-shrink-0 hover:border-amber-500 transition-colors cursor-pointer">
                        {/* Scaled PDF preview */}
                        <div className="w-full h-full overflow-hidden pointer-events-none">
                          <iframe
                            src={`${modalRecord.unSignedPdf}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="border-0 pointer-events-none"
                            style={{ width: "480px", height: "560px", transform: "scale(0.2)", transformOrigin: "top left" }}
                            tabIndex={-1}
                          />
                        </div>
                        {/* Label overlay */}
                        <div className="absolute bottom-0 inset-x-0 bg-amber-900/90 py-1 px-2 flex items-center justify-center gap-1">
                          <FileText className="h-3 w-3 text-amber-300" />
                          <span className="text-[9px] font-semibold text-amber-200">Unsigned</span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a href={modalRecord.unSignedPdf} target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/40 transition-colors" title="View">
                            <Eye className="h-4 w-4 text-white" />
                          </a>
                          <button type="button" title="Delete"
                            className="p-2 rounded-lg bg-red-500/60 hover:bg-red-600 transition-colors"
                            onClick={() => setModalForm(prev => ({ ...prev, unSignedPdf: "" }))}>
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                    {modalRecord?.signedPdf && (
                      <a href={modalRecord.signedPdf} target="_blank" rel="noopener noreferrer"
                        className="group relative w-24 h-28 rounded-lg overflow-hidden border border-emerald-700/50 bg-white flex-shrink-0 hover:border-emerald-500 transition-colors">
                        {/* Scaled PDF preview */}
                        <div className="w-full h-full overflow-hidden pointer-events-none">
                          <iframe
                            src={`${modalRecord.signedPdf}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="border-0 pointer-events-none"
                            style={{ width: "480px", height: "560px", transform: "scale(0.2)", transformOrigin: "top left" }}
                            tabIndex={-1}
                          />
                        </div>
                        {/* Label overlay */}
                        <div className="absolute bottom-0 inset-x-0 bg-emerald-900/90 py-1 px-2 flex items-center justify-center gap-1">
                          <FileText className="h-3 w-3 text-emerald-300" />
                          <span className="text-[9px] font-semibold text-emerald-200">Signed</span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="h-5 w-5 text-white" />
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
          <div className="shrink-0 flex items-center pt-3 border-t border-border">
            {modalMode === "edit" && (
              <Button variant="ghost" size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={async () => {
                  if (!modalRecord?._id) return;
                  if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return;
                  try {
                    const res = await fetch(`/api/admin/coaching-writeups/${modalRecord._id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error("Delete failed");
                    closeModal();
                    fetchData();
                  } catch (err) {
                    console.error("Delete error:", err);
                    alert("Failed to delete record");
                  }
                }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => closeModal()}>Cancel</Button>
              <Button size="sm" onClick={handleModalSave} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                {modalMode === "edit" ? <Eye className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {modalMode === "edit" ? "Save Changes" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
