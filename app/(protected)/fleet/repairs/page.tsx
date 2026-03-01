"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort,
  IconPhoto, IconTool,
} from "@tabler/icons-react";
import { useFleet } from "../layout";
import { StatusBadge, FleetLoading } from "../components/fleet-ui";
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

const STATUS_ORDER: Record<string, number> = {
  "Not Started": 0,
  "In Progress": 1,
  "Waiting for Parts": 2,
  "Sent to Repair Shop": 3,
  "Completed": 4,
};
const statusRank = (s: string) => STATUS_ORDER[s] ?? 99;

/* ── Column definition ───────────────────────────────────────────── */
type SortDir = "asc" | "desc" | null;

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  accessor: (r: any) => any;
  render?: (r: any) => React.ReactNode;
  className?: string;
  width?: string;
}

const columns: Column[] = [
  {
    key: "image",
    label: "Photo",
    sortable: false,
    accessor: (r) => r.image || "",
    render: (r) => r.image ? (
      <a
        href={r.image}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <img
          src={r.image}
          alt="repair"
          className="w-10 h-7 object-cover rounded-md border border-border/50 hover:scale-110 transition-transform shadow-sm"
        />
      </a>
    ) : (
      <div className="w-10 h-7 rounded-md bg-muted/60 border border-border/30 flex items-center justify-center">
        <IconPhoto size={12} className="text-muted-foreground/40" />
      </div>
    ),
    width: "w-14",
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

/* ── Page ────────────────────────────────────────────────────────── */
export default function FleetRepairsPage() {
  const { search, openEditModal, handleDelete } = useFleet();

  // Fetch ALL repairs independently
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet?section=repairs");
      if (res.ok) {
        const json = await res.json();
        setRepairs(json.repairs || []);
      }
    } catch (err) {
      console.error("Failed to fetch repairs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRepairs(); }, [fetchRepairs]);

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

  /* ── Sort: default 1st by status rank, 2nd by creationDate desc ── */
  const sortedRepairs = useMemo(() => {
    const list = [...repairs];
    return list.sort((a, b) => {
      if (sortKey && sortDir) {
        const col = columns.find(c => c.key === sortKey);
        if (col) {
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
        }
      }
      // Default: status rank, then creationDate descending
      const sc = statusRank(a.currentStatus || "") - statusRank(b.currentStatus || "");
      if (sc !== 0) return sc;
      const ad = a.creationDate ? new Date(a.creationDate).getTime() : 0;
      const bd = b.creationDate ? new Date(b.creationDate).getTime() : 0;
      return bd - ad;
    });
  }, [repairs, sortKey, sortDir]);

  /* ── Search filter ───────────────────────────────────────────── */
  const filteredRepairs = useMemo(() => {
    if (!search.trim()) return sortedRepairs;
    const q = search.toLowerCase();
    return sortedRepairs.filter((r: any) =>
      columns.some(col => {
        const val = col.accessor(r);
        return val && val.toString().toLowerCase().includes(q);
      })
    );
  }, [sortedRepairs, search]);

  if (loading) return <FleetLoading />;

  return (
    <>
      {/* Record count pill */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] text-muted-foreground/60">
          Showing <span className="font-semibold text-foreground">{filteredRepairs.length.toLocaleString()}</span>
          {search.trim() ? ` of ${repairs.length.toLocaleString()}` : ""} repairs
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="h-[calc(100%-2rem)] overflow-auto rounded-xl border border-border/60 shadow-sm bg-card">
        <table className="w-full border-collapse">
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
                      ${col.width ?? ""}
                    `}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {isSortable && (
                        <span className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground/30 group-hover/th:text-muted-foreground/60"}`}>
                          {isActive && sortDir === "asc" ? (
                            <IconArrowUp size={11} />
                          ) : isActive && sortDir === "desc" ? (
                            <IconArrowDown size={11} />
                          ) : (
                            <IconArrowsSort size={11} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              {/* Actions */}
              <th className="px-3 py-3 sticky right-0 bg-card/95 backdrop-blur-sm w-16" />
            </tr>
            {/* Gradient separator */}
            <tr>
              <td colSpan={columns.length + 1} className="p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </td>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredRepairs.map((r: any, idx: number) => (
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
                      className={`
                        px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap
                        ${col.className || ""}
                        ${col.width ?? ""}
                      `}
                      title={col.key === "description" ? (val || "") : undefined}
                    >
                      {display}
                    </td>
                  );
                })}
                {/* Row actions */}
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <button
                      onClick={() => openEditModal("repair", r)}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-500 transition-all shadow-sm"
                      title="Edit"
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete("repair", r._id)}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-500 transition-all shadow-sm"
                      title="Delete"
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRepairs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <IconTool size={20} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50 font-medium">
              {search.trim() ? "No repairs match your search." : "No repair records found."}
            </p>
          </div>
        )}
      </div>

      <FleetFormModal />
    </>
  );
}
