"use client";

import React, { useState, useMemo } from "react";
import {
  IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort,
  IconPaperclip, IconX, IconUpload, IconFileText, IconExternalLink,
  IconFileInvoice,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useFleet } from "../layout";
import FleetFormModal from "../components/fleet-form-modal";

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtDate = (d: string | Date | undefined) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM dd, yyyy");
  } catch { return "—"; }
};

const fmtCurrency = (n: number | undefined) =>
  n ? `$${n.toLocaleString()}` : "—";

/* ── Files Modal ─────────────────────────────────────────────────── */
function FilesModal({
  files,
  rentalId,
  onClose,
}: {
  files: string[];
  rentalId: string;
  onClose: () => void;
}) {
  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
  const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-[92vw] max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconPaperclip size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Attached Files</h3>
              <p className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""} attached</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Files list */}
        {files.length > 0 ? (
          <div className="space-y-4">
            {files.map((url, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/60 overflow-hidden bg-muted/20 hover:border-primary/30 transition-all"
              >
                {/* Preview area */}
                {isImage(url) ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
                    <img
                      src={url}
                      alt={`File ${idx + 1}`}
                      className="w-full max-h-[400px] object-contain bg-black/5 dark:bg-white/5 group-hover:scale-[1.01] transition-transform duration-300"
                    />
                  </a>
                ) : isPdf(url) ? (
                  <div className="w-full h-[500px] bg-white dark:bg-zinc-900 rounded-t-xl overflow-hidden">
                    <iframe
                      src={url}
                      title={`PDF Preview ${idx + 1}`}
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
                    <div className="w-full h-40 flex flex-col items-center justify-center gap-3 bg-muted/30">
                      <IconFileText size={36} className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                      <span className="text-xs text-muted-foreground/60">Document file</span>
                    </div>
                  </a>
                )}

                {/* File footer */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-card border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[70%]">
                    {url.split("/").pop()?.split("?")[0] || `File ${idx + 1}`}
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <IconExternalLink size={12} />
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center">
              <IconPaperclip size={24} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50">No files attached</p>
          </div>
        )}

        {/* Upload button */}
        <div className="mt-5 pt-4 border-t border-border/40">
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all text-sm font-medium hover:bg-primary/5"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.accept = "image/*,.pdf,.doc,.docx";
              input.onchange = () => {
                alert("File upload coming soon — will upload to Cloudinary");
              };
              input.click();
            }}
          >
            <IconUpload size={16} />
            Upload More Files
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Column definition ───────────────────────────────────────────── */
type SortDir = "asc" | "desc" | null;
interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  accessor: (r: any) => any;
  render?: (r: any, extra?: any) => React.ReactNode;
  className?: string;
}

const DATE_KEYS = new Set(["registrationStartDate", "registrationEndDate", "dueDate"]);

/* ── Page ────────────────────────────────────────────────────────── */
export default function FleetRentalsPage() {
  const { loading, rentalsSeed, search, openEditModal, handleDelete } = useFleet();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filesModal, setFilesModal] = useState<{ files: string[]; id: string } | null>(null);

  const rentals = rentalsSeed ?? [];

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

  const columns: Column[] = [
    { key: "unitNumber", label: "Unit #", accessor: (r) => r.unitNumber || "", className: "font-medium text-foreground" },
    { key: "agreementNumber", label: "Agreement #", accessor: (r) => r.agreementNumber || "", className: "font-mono text-[11px]" },
    { key: "invoiceNumber", label: "Invoice #", accessor: (r) => r.invoiceNumber || "", className: "font-mono text-[11px]" },
    {
      key: "registrationStartDate", label: "Start", accessor: (r) => r.registrationStartDate || "",
      render: (r) => <>{fmtDate(r.registrationStartDate)}</>,
    },
    {
      key: "registrationEndDate", label: "End", accessor: (r) => r.registrationEndDate || "",
      render: (r) => <>{fmtDate(r.registrationEndDate)}</>,
    },
    {
      key: "dueDate", label: "Due Date", accessor: (r) => r.dueDate || "",
      render: (r) => <>{fmtDate(r.dueDate)}</>,
    },
    {
      key: "amount", label: "Amount", accessor: (r) => r.amount ?? 0,
      render: (r) => <span className="font-medium text-emerald-500">{fmtCurrency(r.amount)}</span>,
    },
    {
      key: "files", label: "Files", sortable: false,
      accessor: (r) => r.rentalAgreementFilesImages?.length || 0,
      render: (r) => {
        const files: string[] = r.rentalAgreementFilesImages || [];
        const count = files.length;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setFilesModal({ files, id: r._id }); }}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${count > 0
              ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              : "bg-muted/40 text-muted-foreground/50 hover:bg-muted/60 border border-border/30"
              }`}
            title={`${count} file${count !== 1 ? "s" : ""} — click to view`}
          >
            <IconPaperclip size={12} />
            {count}
          </button>
        );
      },
    },
  ];

  /* ── Sort ────────────────────────────────────────────────── */
  const sortedRentals = useMemo(() => {
    let list = [...rentals];
    if (sortKey && sortDir) {
      const col = columns.find(c => c.key === sortKey);
      if (col) {
        list.sort((a, b) => {
          let aVal = col.accessor(a);
          let bVal = col.accessor(b);
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
      }
    }
    return list;
  }, [rentals, sortKey, sortDir]);

  /* ── Search filter ──────────────────────────────────────── */
  const filteredRentals = useMemo(() => {
    if (!search.trim()) return sortedRentals;
    const q = search.toLowerCase();
    return sortedRentals.filter((r: any) =>
      columns.some(col => {
        const val = col.accessor(r);
        return val && val.toString().toLowerCase().includes(q);
      })
    );
  }, [sortedRentals, search]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground/50">Loading rentals…</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Files modal */}
      {filesModal && (
        <FilesModal
          files={filesModal.files}
          rentalId={filesModal.id}
          onClose={() => setFilesModal(null)}
        />
      )}

      {/* Table */}
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse">
          {/* Sticky header */}
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
              {/* Actions column */}
              <th className="px-3 py-3 bg-card/95 backdrop-blur-sm w-16" />
            </tr>
            {/* Gradient separator */}
            <tr>
              <td colSpan={columns.length + 1} className="p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </td>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/40">
            {filteredRentals.map((r: any, idx: number) => (
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
                    >
                      {display}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <button
                      onClick={() => openEditModal("rental", r)}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-500 transition-all shadow-sm"
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete("rental", r._id)}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-500 transition-all shadow-sm"
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredRentals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <IconFileInvoice size={20} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50 font-medium">
              {search.trim() ? "No rentals match your search." : "No rental agreements found."}
            </p>
          </div>
        )}
      </div>

      <FleetFormModal />
    </>
  );
}
