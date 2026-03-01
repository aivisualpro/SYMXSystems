"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort,
  IconPhoto, IconTool, IconLoader2,
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
    key: "image", label: "Photo", sortable: false,
    accessor: (r) => r.image || "",
    render: (r) => r.image ? (
      <a href={r.image} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block">
        <img src={r.image} alt="repair" className="w-10 h-7 object-cover rounded-md border border-border/50 hover:scale-110 transition-transform shadow-sm" />
      </a>
    ) : (
      <div className="w-10 h-7 rounded-md bg-muted/60 border border-border/30 flex items-center justify-center">
        <IconPhoto size={12} className="text-muted-foreground/40" />
      </div>
    ),
  },
  { key: "vin", label: "VIN", accessor: (r) => r.vin || "", className: "font-mono text-[11px]" },
  { key: "description", label: "Description", accessor: (r) => r.description || "", className: "max-w-[220px] truncate" },
  {
    key: "currentStatus", label: "Current Status", accessor: (r) => r.currentStatus || "",
    render: (r) => <StatusBadge status={r.currentStatus} />,
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
    key: "repairDuration", label: "Repair Duration", accessor: (r) => r.repairDuration ?? 0,
    render: (r) => r.repairDuration ? (
      <span className="inline-flex items-center gap-1">
        {r.repairDuration}
        <span className="text-muted-foreground/50 text-[10px]">days</span>
      </span>
    ) : <span className="text-muted-foreground/30">—</span>,
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

/* ── Page ────────────────────────────────────────────────────────── */
export default function FleetRepairsPage() {
  const { search, openEditModal, handleDelete, openCreateModal, repairsSeed } = useFleet();
  const { setLeftContent } = useHeaderActions();

  // Start with seed data if already prefetched by the layout — instant first paint
  const [repairs, setRepairs] = useState<any[]>(() => repairsSeed?.data ?? []);
  const [total, setTotal] = useState<number | null>(() => repairsSeed?.total ?? null);
  const [hasMore, setHasMore] = useState(() => repairsSeed?.hasMore ?? true);
  const [isFetching, setIsFetching] = useState(() => !repairsSeed); // skip skeleton if seeded
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const skipRef = useRef(repairsSeed?.data.length ?? 0); // start pagination after seed
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
  }, []);

  // Re-fetch from scratch on search change — but skip initial mount if we have seed data
  const initializedRef = useRef(false);
  useEffect(() => {
    // On first mount with no search and seed data exists → skip fetch, data is already loaded
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (!debouncedSearch && repairsSeed) return;
    }
    skipRef.current = 0;
    setHasMore(true);
    setRepairs([]);
    setTotal(null);
    fetchPage(0, debouncedSearch, false);
  }, [debouncedSearch, fetchPage]);

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
    return () => setLeftContent(null);
  }, [repairs.length, total, debouncedSearch, isFetching, setLeftContent]);

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
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
                className={`
                  relative group cursor-default transition-all duration-150
                  hover:bg-primary/[0.035] hover:shadow-[inset_3px_0_0_hsl(var(--primary))]
                  ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/[0.015]"}
                `}
              >
                {columns.map((col) => {
                  const val = col.accessor(r);
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
                <td className="px-3 py-2.5">
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
