"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort,
  IconPhoto, IconTool, IconLoader2, IconDownload, IconCheck, IconX
} from "@tabler/icons-react";
import * as LucideIcons from "lucide-react";
import { useFleet } from "../layout";
import { toast } from "sonner";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

import FleetFormModal from "../components/fleet-form-modal";
import { useDropdowns } from "@/lib/query/hooks/useShared";

/* ── fallback repair statuses (used if no dropdown options configured) ── */
const FALLBACK_STATUSES = ["Not Started", "In Progress", "Waiting for Parts", "Sent to Repair Shop", "Completed"];

interface RepairStatusOption {
  description: string;
  color: string;
  icon: string;
}

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtDate = (d: string | Date | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return "—"; }
};

/* ── Column definition ───────────────────────────────────────────── */
type SortDir = "asc" | "desc" | null;
interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  accessor: (r: any) => any;
  render?: (r: any) => React.ReactNode;
  className?: string;
}

const columns: Column[] = [
  {
    key: "images", label: "Photo", sortable: false,
    accessor: (r) => {
      const images = Array.isArray(r.images) ? r.images : [];
      const completedImages = Array.isArray(r.completedImages) ? r.completedImages : [];
      return images.length > 0 ? images[0] : (completedImages.length > 0 ? completedImages[0] : "");
    },
    render: (r) => {
      const images = Array.isArray(r.images) ? r.images : [];
      const completedImages = Array.isArray(r.completedImages) ? r.completedImages : [];
      const hasThumb = images.length > 0 || completedImages.length > 0;
      const firstImage = images.length > 0 ? images[0] : (completedImages.length > 0 ? completedImages[0] : "");
      
      return hasThumb ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("open-repair-gallery", { detail: r })); }} className="block cursor-pointer">
          <img src={firstImage} alt="repair" className="w-10 h-7 object-cover rounded-md border border-border/50 hover:scale-110 transition-transform shadow-sm" />
        </button>
      ) : (
        <div className="w-10 h-7 rounded-md bg-muted/60 border border-border/30 flex items-center justify-center">
          <IconPhoto size={12} className="text-muted-foreground/40" />
        </div>
      );
    },
  },
  { key: "vehicleName", label: "Vehicle", accessor: (r) => r.vehicleName || "", className: "font-semibold text-foreground" },
  { key: "vin", label: "VIN", accessor: (r) => r.vin || "", className: "font-mono text-[11px]" },
  { key: "description", label: "Description", accessor: (r) => r.description || "", className: "max-w-[220px] truncate" },
  {
    key: "currentStatus", label: "Current Status", accessor: (r) => r.currentStatus || "",
    // render handled inline in the table body for dynamic dropdown
  },
  {
    key: "estimatedDate", label: "Estimated Date", accessor: (r) => r.estimatedDate || "",
    render: (r) => <>{fmtDate(r.estimatedDate)}</>,
  },
  {
    key: "creationDate", label: "Creation Date", accessor: (r) => r.creationDate || "",
    render: (r) => <>{fmtDate(r.creationDate)}</>,
  },
  {
    key: "lastEditOn", label: "Last Edit On", accessor: (r) => r.lastEditOn || "",
    render: (r) => <>{fmtDate(r.lastEditOn)}</>,
  },
  {
    key: "repairDuration", label: "Repair Duration", sortable: false,
    accessor: (r) => {
      const start = r.creationDate ? new Date(r.creationDate).getTime() : Date.now();
      const end = (r.currentStatus === "Completed" && r.completionDate) 
        ? new Date(r.completionDate).getTime() 
        : Date.now();
      return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
    },
    render: (r) => {
      const start = r.creationDate ? new Date(r.creationDate).getTime() : Date.now();
      const end = (r.currentStatus === "Completed" && r.completionDate) 
        ? new Date(r.completionDate).getTime() 
        : Date.now();
      const diffDays = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
      
      return diffDays > 0 ? (
        <span className="inline-flex items-center gap-1">
          {diffDays}
          <span className="text-muted-foreground/50 text-[10px]">days</span>
        </span>
      ) : <span className="text-muted-foreground/30 text-[10px] uppercase font-semibold">Today</span>;
    },
  },
];

const DATE_KEYS = new Set(["estimatedDate", "creationDate", "lastEditOn"]);

/* ── Skeleton row ────────────────────────────────────────────────── */
// Fixed widths per column so they don't change on re-render
const SKELETON_WIDTHS = [
  [40, 42, 44, 38, 41, 43, 39, 42, 40, 43, 41, 38, 44, 42, 39],  // photo
  [70, 80, 72, 78, 68, 82, 75, 71, 79, 73, 77, 69, 83, 74, 76],  // vin
  [85, 92, 78, 88, 95, 82, 90, 87, 93, 80, 86, 91, 84, 89, 94],  // description
  [65, 70, 75, 62, 68, 72, 66, 71, 64, 73, 67, 74, 63, 69, 76],  // status
  [55, 58, 52, 60, 54, 57, 56, 53, 59, 51, 61, 55, 58, 50, 62],  // est date
  [55, 53, 57, 54, 56, 52, 58, 55, 51, 59, 53, 57, 54, 60, 52],  // creation
  [55, 57, 53, 56, 54, 58, 52, 59, 55, 51, 57, 53, 60, 54, 56],  // lastEdit
  [35, 38, 32, 40, 34, 37, 36, 33, 39, 31, 41, 35, 38, 30, 42],  // duration
];

function SkeletonRows({ count = 15 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className={`border-b border-border/20 ${i % 2 === 0 ? "" : "bg-muted/[0.015]"}`}>
          {columns.map((col, j) => (
            <td key={col.key} className="px-3 py-[11px]">
              <div
                className="h-3 rounded-md bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                style={{
                  width: `${SKELETON_WIDTHS[j]?.[i] ?? 60}%`,
                  animationDelay: `${(i * columns.length + j) * 30}ms`,
                }}
              />
            </td>
          ))}
          <td className="px-3 py-[11px] w-16" />
        </tr>
      ))}
    </>
  );
}

const PAGE_SIZE = 50;

/* ── Gallery Modal ────────────────────────────────────────────────── */
function PhotoGalleryModal() {
  const [record, setRecord] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => setRecord(e.detail);
    window.addEventListener("open-repair-gallery", handler);
    return () => window.removeEventListener("open-repair-gallery", handler);
  }, []);

  if (!record) return null;

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `repair_image_${Math.floor(Date.now() / 1000)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed", error);
      window.open(url, "_blank");
    }
  };

  const images = Array.isArray(record.images) ? record.images : [];
  const completedImages = Array.isArray(record.completedImages) ? record.completedImages : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300" onClick={() => setRecord(null)}>
      <div className="w-full max-w-4xl mx-4 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10 zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight">Photo Gallery</h3>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{record.vehicleName} • {record.vin}</p>
          </div>
          <button onClick={() => setRecord(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><IconX size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-10">
          {images.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                <IconTool size={14} className="opacity-70" /> Repair Images
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((url: string, i: number) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border/50 group bg-muted/20">
                    <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={`Repair ${i}`} />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                      <button type="button" onClick={() => handleDownload(url)} className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors shadow-xl transform translate-y-2 group-hover:translate-y-0" title="Download">
                        <IconDownload size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedImages.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-green-500/80 flex items-center gap-2">
                <IconCheck size={14} /> Completion Images
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {completedImages.map((url: string, i: number) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-green-500/20 group bg-muted/20">
                    <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={`Completed ${i}`} />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                      <button type="button" onClick={() => handleDownload(url)} className="p-2.5 rounded-full bg-white/20 text-white hover:bg-green-500/80 transition-colors shadow-xl transform translate-y-2 group-hover:translate-y-0" title="Download">
                        <IconDownload size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
             <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 flex items-center justify-center">
               <p className="text-xs text-muted-foreground/50 font-medium">No completion images available</p>
             </div>
          )}
          
          {(images.length === 0 && completedImages.length === 0) && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 flex flex-col items-center justify-center gap-2">
               <IconPhoto size={32} className="text-muted-foreground/30" />
               <p className="text-sm text-muted-foreground/50 font-medium">No images uploaded for this repair</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FleetRepairsTable({ vin, isTab }: { vin?: string; isTab?: boolean; }) {
  const { search, openEditModal, handleDelete, openCreateModal, repairsSeed, showCompleted } = useFleet();
  const { setLeftContent } = useHeaderActions();
  const { data: queryDropdowns } = useDropdowns();

  // Build repair status options from admin dropdowns
  const repairStatusOptions = useMemo(() => {
    const allDropdowns = Array.isArray(queryDropdowns) ? queryDropdowns as any[] : [];
    const opts = allDropdowns.filter(
      (d: any) => d.type === "fleet repair status" && d.isActive !== false
    );
    if (opts.length === 0) {
      return FALLBACK_STATUSES.map(s => ({ description: s, color: "", icon: "" }));
    }
    return opts.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((d: any) => ({
      description: d.description,
      color: d.color || "",
      icon: d.icon || "",
    }));
  }, [queryDropdowns]);

  // Build a lookup map for quick color/icon access by status name
  const statusMap = useMemo(() => {
    const map: Record<string, RepairStatusOption> = {};
    repairStatusOptions.forEach(opt => { map[opt.description] = opt; });
    return map;
  }, [repairStatusOptions]);

  // Start with seed data if already prefetched by the layout — instant first paint
  const [repairs, setRepairs] = useState<any[]>(() => (!isTab && repairsSeed) ? repairsSeed.data : []);
  const [total, setTotal] = useState<number | null>(() => (!isTab && repairsSeed) ? repairsSeed.total : null);
  const [hasMore, setHasMore] = useState(() => (!isTab && repairsSeed) ? repairsSeed.hasMore : true);
  const [isFetching, setIsFetching] = useState(() => isTab || !repairsSeed); // skip skeleton if seeded
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const skipRef = useRef((!isTab && repairsSeed) ? repairsSeed.data.length : 0); // start pagination after seed
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounced search (300ms) → server-side filtering
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sort state (client-side on loaded rows)
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ── Fetch one page ──────────────────────────────────────────── */
  const fetchPage = useCallback(async (skip: number, q: string, append: boolean) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (skip === 0) { setIsFetching(true); setIsLoadingMore(false); }
    else { setIsLoadingMore(true); }

    try {
      const params = new URLSearchParams({ section: "repairs", skip: String(skip), limit: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (vin) params.set("vin", vin);
      if (!isTab && !showCompleted) params.set("excludeCompleted", "true");
      params.set("_t", Date.now().toString());
      const res = await fetch(`/api/fleet?${params}`, { signal: ctrl.signal });
      if (!res.ok) return;
      const json = await res.json();
      const incoming: any[] = json.repairs ?? [];
      setRepairs(prev => append ? [...prev, ...incoming] : incoming);
      setTotal(json.total ?? null);
      setHasMore(json.hasMore ?? false);
      skipRef.current = skip + incoming.length;
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("Repairs fetch error:", err);
    } finally {
      setIsFetching(false);
      setIsLoadingMore(false);
    }
  }, [showCompleted, vin, isTab]);

  // Re-fetch from scratch on search change — but skip initial mount if we have seed data
  const initializedRef = useRef(false);
  useEffect(() => {
    // On first mount with no search and seed data exists → skip fetch, data is already loaded
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (!debouncedSearch && !isTab && repairsSeed) return;
    }
    skipRef.current = 0;
    setHasMore(true);
    setRepairs([]);
    setTotal(null);
    fetchPage(0, debouncedSearch, false);
  }, [debouncedSearch, fetchPage, showCompleted]);

  // Sync with layout updates (e.g., after saving a record)
  const prevFetchedAt = useRef(repairsSeed?.fetchedAt);
  useEffect(() => {
    if (isTab) return; // Skip layout seed sync if in a specific tab
    if (repairsSeed && repairsSeed.fetchedAt !== prevFetchedAt.current) {
      prevFetchedAt.current = repairsSeed.fetchedAt;
      if (!debouncedSearch) {
        setRepairs(repairsSeed.data);
        setTotal(repairsSeed.total);
        setHasMore(repairsSeed.hasMore);
        skipRef.current = repairsSeed.data.length;
      } else {
        skipRef.current = 0;
        setRepairs([]);
        fetchPage(0, debouncedSearch, false);
      }
    }
  }, [repairsSeed, debouncedSearch, fetchPage, isTab]);

  /* ── Infinite scroll via IntersectionObserver ────────────────── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isFetching) {
          fetchPage(skipRef.current, debouncedSearch, true);
        }
      },
      { rootMargin: "200px" }   // start loading 200px before hitting bottom
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isFetching, debouncedSearch, fetchPage]);

  /* ── Client-side sort on loaded rows ────────────────────────── */
  const sortedRepairs = useMemo(() => {
    if (!sortKey || !sortDir) return repairs;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return repairs;
    return [...repairs].sort((a, b) => {
      let aVal = col.accessor(a);
      let bVal = col.accessor(b);
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (DATE_KEYS.has(sortKey)) {
        const ad = aVal ? new Date(aVal).getTime() : 0;
        const bd = bVal ? new Date(bVal).getTime() : 0;
        return sortDir === "asc" ? ad - bd : bd - ad;
      }
      aVal = (aVal || "").toString().toLowerCase();
      bVal = (bVal || "").toString().toLowerCase();
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [repairs, sortKey, sortDir]);

  /* ── Header left: live count ─────────────────────────────────── */
  useEffect(() => {
    if (isTab) return; // Skip modifying global header if embedded

    const loaded = repairs.length;
    const knownTotal = total;
    const isSearching = debouncedSearch.trim().length > 0;
    setLeftContent(
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Fleet - Repairs
        </h1>
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {knownTotal !== null
            ? (isSearching ? `${knownTotal.toLocaleString()} found` : knownTotal.toLocaleString())
            : isFetching ? "…" : loaded.toLocaleString()
          }
        </span>
      </div>
    );
    return () => { setLeftContent(null); };
  }, [repairs.length, total, debouncedSearch, isFetching, setLeftContent, isTab]);

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <PhotoGalleryModal />
      <div className="h-full overflow-auto rounded-xl border border-border/60 shadow-sm bg-card" id="repairs-scroll-container">
        <table className="w-full border-collapse">

          {/* ── Sticky header ─────────────────────────── */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-card/95 backdrop-blur-sm border-b border-border/80">
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                const isSortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={isSortable ? () => handleSort(col.key) : undefined}
                    className={`
                      px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest
                      whitespace-nowrap select-none transition-colors
                      ${isSortable ? "cursor-pointer hover:text-foreground hover:bg-muted/60 group/th" : ""}
                      ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground/70"}
                    `}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {isSortable && (
                        <span className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground/30 group-hover/th:text-muted-foreground/60"}`}>
                          {isActive && sortDir === "asc" ? <IconArrowUp size={11} />
                            : isActive && sortDir === "desc" ? <IconArrowDown size={11} />
                              : <IconArrowsSort size={11} />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-3 bg-card/95 backdrop-blur-sm w-16" />
            </tr>
            {/* Gradient separator */}
            <tr>
              <td colSpan={columns.length + 1} className="p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </td>
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────── */}
          <tbody className="divide-y divide-border/40">
            {/* Skeleton rows while first-time loading */}
            {isFetching && <SkeletonRows count={18} />}

            {/* Real rows */}
            {!isFetching && sortedRepairs.map((r: any, idx: number) => (
              <tr
                key={r._id}
                onClick={() => openEditModal("repair", r)}
                className={`
                  relative group cursor-pointer transition-all duration-150
                  hover:bg-primary/[0.035] hover:shadow-[inset_3px_0_0_hsl(var(--primary))]
                  ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/[0.015]"}
                `}
              >
                {columns.map((col) => {
                  const val = col.accessor(r);

                  // Status column — clickable dropdown with dynamic config
                  if (col.key === "currentStatus") {
                    const statusOpt = statusMap[r.currentStatus];
                    const statusColor = statusOpt?.color || "";
                    const StatusIcon = statusOpt?.icon ? (LucideIcons as any)[statusOpt.icon] : null;
                    return (
                      <td key={col.key} className="px-3 py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-flex items-center">
                          {StatusIcon && (
                            <StatusIcon
                              className="h-3 w-3 absolute left-1.5 pointer-events-none z-10"
                              style={{ color: statusColor || undefined }}
                            />
                          )}
                          <select
                            value={r.currentStatus || "Not Started"}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              
                              // Check validation for completed status directly from the table UI
                              if (newStatus === "Completed" && (!r.completedImages || r.completedImages.length === 0)) {
                                toast.error("Completion images required", { 
                                  description: "Please upload completion images to close this repair." 
                                });
                                // Force the record edit form open, defaulting to Completed status (unsaved) manually here?
                                // r is readonly, but we can pass it as-is, the user can change status inside the form.
                                openEditModal("repair", { ...r, currentStatus: "Completed" });
                                return;
                              }

                              try {
                                const res = await fetch("/api/fleet", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    type: "repair",
                                    id: r._id,
                                    data: { currentStatus: newStatus, lastEditOn: new Date() },
                                  }),
                                });
                                if (!res.ok) throw new Error("Failed to update");
                                setRepairs(prev => prev.map(item =>
                                  item._id === r._id ? { ...item, currentStatus: newStatus, lastEditOn: new Date().toISOString() } : item
                                ));
                              } catch {
                                // revert will happen on next fetch
                              }
                            }}
                            className="rounded-md text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                            style={{
                              appearance: "none",
                              WebkitAppearance: "none",
                              paddingLeft: StatusIcon ? "22px" : "8px",
                              paddingRight: "18px",
                              paddingTop: "2px",
                              paddingBottom: "2px",
                              backgroundColor: statusColor ? `${statusColor}15` : undefined,
                              color: statusColor || undefined,
                              borderColor: statusColor ? `${statusColor}50` : undefined,
                              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 4px center",
                            }}
                          >
                            {repairStatusOptions.map((opt) => (
                              <option key={opt.description} value={opt.description}>
                                {opt.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    );
                  }

                  const display = col.render ? col.render(r) : (val || "—");
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap ${col.className || ""}`}
                      title={col.key === "description" ? (val || "") : undefined}
                    >
                      {display}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <button
                      onClick={() => openEditModal("repair", r)}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-500 transition-all shadow-sm"
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete("repair", r._id)}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-500 transition-all shadow-sm"
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Skeleton rows appended during load-more */}
            {isLoadingMore && <SkeletonRows count={8} />}
          </tbody>
        </table>

        {/* Sentinel – IntersectionObserver target */}
        <div ref={sentinelRef} className="h-1" />

        {/* Load-more spinner (subtle) */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-3 gap-2 text-xs text-muted-foreground/50">
            <IconLoader2 size={13} className="animate-spin" />
            Loading more…
          </div>
        )}

        {/* End of results */}
        {!hasMore && !isFetching && repairs.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/30">
              <div className="h-px w-12 bg-border/40" />
              All {(total ?? repairs.length).toLocaleString()} records loaded
              <div className="h-px w-12 bg-border/40" />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isFetching && repairs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <IconTool size={20} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50 font-medium">
              {debouncedSearch ? "No repairs match your search." : "No repair records found."}
            </p>
          </div>
        )}
      </div>

      <FleetFormModal />
    </>
  );
}
