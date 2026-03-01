"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort,
  IconPhoto, IconClipboardCheck, IconLoader2, IconExternalLink,
} from "@tabler/icons-react";
import { useFleet } from "../layout";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { StatusBadge } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtDate = (d: string | Date | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return "—"; }
};

const fmtDateTime = (d: string | Date | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return "—"; }
};

/* ── Thumbnail helper ────────────────────────────────────────────── */
function PhotoThumb({ url, label }: { url?: string; label?: string }) {
  if (!url) return (
    <div className="w-9 h-6 rounded bg-muted/40 border border-border/20 flex items-center justify-center">
      <IconPhoto size={10} className="text-muted-foreground/30" />
    </div>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={label}>
      <img src={url} alt={label ?? "photo"} className="w-9 h-6 object-cover rounded border border-border/40 hover:scale-110 transition-transform shadow-sm" />
    </a>
  );
}

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
  { key: "routeId", label: "Route ID", accessor: r => r.routeId || "", className: "font-mono text-[11px]" },
  { key: "driver", label: "Driver", accessor: r => r.driver || "" },
  { key: "routeDate", label: "Route Date", accessor: r => r.routeDate || "", render: r => <>{fmtDate(r.routeDate)}</> },
  { key: "vin", label: "VIN", accessor: r => r.vin || "", className: "font-mono text-[11px]" },
  {
    key: "photos", label: "Photos", sortable: false,
    accessor: r => [r.vehiclePicture1, r.vehiclePicture2, r.vehiclePicture3, r.vehiclePicture4].filter(Boolean).length,
    render: r => (
      <div className="flex gap-0.5">
        <PhotoThumb url={r.vehiclePicture1} label="Photo 1" />
        <PhotoThumb url={r.vehiclePicture2} label="Photo 2" />
        <PhotoThumb url={r.vehiclePicture3} label="Photo 3" />
        <PhotoThumb url={r.vehiclePicture4} label="Photo 4" />
      </div>
    ),
  },
  {
    key: "mileage", label: "Mileage", accessor: r => r.mileage ?? 0,
    render: r => r.mileage ? <>{r.mileage.toLocaleString()}</> : <span className="text-muted-foreground/30">—</span>,
  },
  {
    key: "dashboardImage", label: "Dash", sortable: false,
    accessor: r => r.dashboardImage || "",
    render: r => <PhotoThumb url={r.dashboardImage} label="Dashboard" />,
  },
  {
    key: "comments", label: "Comments", accessor: r => r.comments || "",
    className: "max-w-[180px] truncate",
  },
  {
    key: "additionalPicture", label: "Extra Photo", sortable: false,
    accessor: r => r.additionalPicture || "",
    render: r => <PhotoThumb url={r.additionalPicture} label="Extra" />,
  },
  { key: "inspectedBy", label: "Inspected By", accessor: r => r.inspectedBy || "" },
  {
    key: "timeStamp", label: "Timestamp", accessor: r => r.timeStamp || "",
    render: r => <>{fmtDateTime(r.timeStamp)}</>,
  },
  { key: "anyRepairs", label: "Any Repairs", accessor: r => r.anyRepairs || "" },
  {
    key: "repairDescription", label: "Description", accessor: r => r.repairDescription || "",
    className: "max-w-[180px] truncate",
  },
  {
    key: "repairCurrentStatus", label: "Status", accessor: r => r.repairCurrentStatus || "",
    render: r => r.repairCurrentStatus
      ? <StatusBadge status={r.repairCurrentStatus} />
      : <span className="text-muted-foreground/30">—</span>,
  },
  {
    key: "repairEstimatedDate", label: "Est. Date", accessor: r => r.repairEstimatedDate || "",
    render: r => <>{fmtDate(r.repairEstimatedDate)}</>,
  },
  {
    key: "repairImage", label: "Repair Photo", sortable: false,
    accessor: r => r.repairImage || "",
    render: r => r.repairImage ? (
      <a href={r.repairImage} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
        <IconExternalLink size={10} /> View
      </a>
    ) : <span className="text-muted-foreground/30">—</span>,
  },
  {
    key: "isCompared", label: "Compared?", accessor: r => r.isCompared,
    render: r => (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${r.isCompared ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/40 text-muted-foreground/50"
        }`}>
        {r.isCompared ? "Yes" : "No"}
      </span>
    ),
  },
];

const DATE_KEYS = new Set(["routeDate", "timeStamp", "repairEstimatedDate"]);
const PAGE_SIZE = 50;

/* ── Skeleton widths ─────────────────────────────────────────────── */
const SK_WIDTHS = [60, 75, 55, 72, 80, 35, 30, 85, 30, 65, 70, 50, 80, 55, 45, 30, 40];

function SkeletonRows({ count = 15 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className={`border-b border-border/20 ${i % 2 === 0 ? "" : "bg-muted/[0.015]"}`}>
          {columns.map((col, j) => (
            <td key={col.key} className="px-3 py-[11px]">
              <div
                className="h-3 rounded-md bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                style={{ width: `${SK_WIDTHS[j] ?? 60}%`, animationDelay: `${(i * columns.length + j) * 25}ms` }}
              />
            </td>
          ))}
          <td className="px-3 py-[11px] w-16" />
        </tr>
      ))}
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function FleetInspectionsPage() {
  const { search, openEditModal, handleDelete, inspectionsSeed } = useFleet();
  const { setLeftContent } = useHeaderActions();
  const router = useRouter();

  // Start with seed data if already prefetched by the layout — instant first paint
  const [inspections, setInspections] = useState<any[]>(() => inspectionsSeed?.data ?? []);
  const [total, setTotal] = useState<number | null>(() => inspectionsSeed?.total ?? null);
  const [hasMore, setHasMore] = useState(() => inspectionsSeed?.hasMore ?? true);
  const [isFetching, setIsFetching] = useState(() => !inspectionsSeed); // skip skeleton if seeded
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const skipRef = useRef(inspectionsSeed?.data.length ?? 0);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search 300ms → server-side
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Client-side sort
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else { setSortKey(key); setSortDir("asc"); }
  };

  /* ── Fetch ──────────────────────────────────────────────────── */
  const fetchPage = useCallback(async (skip: number, q: string, append: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (skip === 0) { setIsFetching(true); setIsLoadingMore(false); }
    else setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ section: "inspections", skip: String(skip), limit: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      const res = await fetch(`/api/fleet?${params}`, { signal: ctrl.signal });
      if (!res.ok) return;
      const json = await res.json();
      const incoming: any[] = json.inspections ?? [];
      setInspections(prev => append ? [...prev, ...incoming] : incoming);
      setTotal(json.total ?? null);
      setHasMore(json.hasMore ?? false);
      skipRef.current = skip + incoming.length;
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("Inspections fetch:", err);
    } finally { setIsFetching(false); setIsLoadingMore(false); }
  }, []);

  useEffect(() => {
    skipRef.current = 0;
    setHasMore(true);
    setInspections([]);
    setTotal(null);
    fetchPage(0, debouncedSearch, false);
  }, [debouncedSearch, fetchPage]);

  /* ── Infinite scroll ─────────────────────────────────────── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isFetching)
          fetchPage(skipRef.current, debouncedSearch, true);
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isFetching, debouncedSearch, fetchPage]);

  /* ── Sort ────────────────────────────────────────────────── */
  const sortedInspections = useMemo(() => {
    if (!sortKey || !sortDir) return inspections;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return inspections;
    return [...inspections].sort((a, b) => {
      let aVal = col.accessor(a); let bVal = col.accessor(b);
      if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
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
  }, [inspections, sortKey, sortDir]);

  /* ── Header left content ─────────────────────────────────── */
  useEffect(() => {
    const knownTotal = total;
    const isSearching = debouncedSearch.trim().length > 0;
    setLeftContent(
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Fleet - Inspections
        </h1>
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {knownTotal !== null
            ? (isSearching ? `${knownTotal.toLocaleString()} found` : knownTotal.toLocaleString())
            : isFetching ? "…" : inspections.length.toLocaleString()
          }
        </span>
      </div>
    );
    return () => setLeftContent(null);
  }, [inspections.length, total, debouncedSearch, isFetching, setLeftContent]);

  return (
    <>
      <div className="h-full overflow-auto rounded-xl border border-border/60 shadow-sm bg-card">
        <table className="w-full border-collapse">

          {/* Sticky header */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-card/95 backdrop-blur-sm border-b border-border/80">
              {columns.map(col => {
                const isActive = sortKey === col.key;
                const isSortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={isSortable ? () => handleSort(col.key) : undefined}
                    className={`px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap select-none transition-colors
                      ${isSortable ? "cursor-pointer hover:text-foreground hover:bg-muted/60 group/th" : ""}
                      ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground/70"}`}
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
            <tr><td colSpan={columns.length + 1} className="p-0">
              <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            </td></tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-border/40">
            {isFetching && <SkeletonRows count={18} />}
            {!isFetching && sortedInspections.map((r: any, idx: number) => (
              <tr key={r._id}
                onClick={() => router.push(`/fleet/inspections/${r._id}`)}
                className={`relative group cursor-pointer transition-all duration-150
                  hover:bg-primary/[0.035] hover:shadow-[inset_3px_0_0_hsl(var(--primary))]
                  ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/[0.015]"}`}
              >
                {columns.map(col => {
                  const val = col.accessor(r);
                  const display = col.render ? col.render(r) : (val || "—");
                  const isTruncated = ["comments", "repairDescription"].includes(col.key);
                  return (
                    <td key={col.key}
                      className={`px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap ${col.className || ""}`}
                      title={isTruncated ? (val || "") : undefined}
                    >
                      {display}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/fleet/inspections/${r._id}`); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-primary/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all shadow-sm"
                      title="View detail">
                      <IconExternalLink size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEditModal("inspection", r); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-500 transition-all shadow-sm">
                      <IconEdit size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete("inspection", r._id); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-500 transition-all shadow-sm">
                      <IconTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {isLoadingMore && <SkeletonRows count={8} />}
          </tbody>
        </table>

        {/* Sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex items-center justify-center py-3 gap-2 text-xs text-muted-foreground/50">
            <IconLoader2 size={13} className="animate-spin" /> Loading more…
          </div>
        )}

        {!hasMore && !isFetching && inspections.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/30">
              <div className="h-px w-12 bg-border/40" />
              All {(total ?? inspections.length).toLocaleString()} inspections loaded
              <div className="h-px w-12 bg-border/40" />
            </div>
          </div>
        )}

        {!isFetching && inspections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <IconClipboardCheck size={20} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50 font-medium">
              {debouncedSearch ? "No inspections match your search." : "No inspection records found."}
            </p>
          </div>
        )}
      </div>
      <FleetFormModal />
    </>
  );
}
