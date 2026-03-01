"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort,
  IconPhoto, IconQrcode, IconX,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import { useFleet } from "../layout";
import { StatusBadge } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtDate = (d: string | undefined) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; }
};

// Status sort priority: Active first, then others alphabetically
const STATUS_ORDER: Record<string, number> = {
  "Active": 0,
  "In Progress": 1,
  "Inactive - Maintenance": 2,
  "Inactive": 3,
  "Returned": 4,
  "Grounded": 5,
};
const statusRank = (s: string) => STATUS_ORDER[s] ?? 99;

/* ── QR Popover ──────────────────────────────────────────────────── */
function QRPopover({ vin, onClose }: { vin: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && vin) {
      QRCode.toCanvas(canvasRef.current, vin, {
        width: 160,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [vin]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl p-5 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconX size={14} />
        </button>
        <p className="text-xs font-semibold text-foreground">QR Code</p>
        <canvas ref={canvasRef} className="rounded-lg" />
        <p className="text-[10px] font-mono text-muted-foreground">{vin}</p>
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const link = document.createElement("a");
            link.download = `qr-${vin}.png`;
            link.href = canvas.toDataURL();
            link.click();
          }}
          className="text-[10px] px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
        >
          Download PNG
        </button>
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
  accessor: (v: any) => any;
  render?: (v: any, meta?: any) => React.ReactNode;
  className?: string;
  width?: string;
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function FleetVehiclesPage() {
  const router = useRouter();
  const { data, loading, search, openEditModal, handleDelete } = useFleet();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [qrVin, setQrVin] = useState<string | null>(null);

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

  const columns: Column[] = useMemo(() => [
    {
      key: "image",
      label: "Photo",
      sortable: false,
      accessor: (v) => v.image || "",
      render: (v) => v.image ? (
        <a
          href={v.image}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block"
        >
          <img
            src={v.image}
            alt="vehicle"
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
    {
      key: "qr",
      label: "QR",
      sortable: false,
      accessor: (v) => v.vin || "",
      render: (v) => v.vin ? (
        <button
          onClick={(e) => { e.stopPropagation(); setQrVin(v.vin); }}
          className="p-1.5 rounded-lg bg-muted/60 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border/40 hover:border-primary/30 transition-all group/qr"
          title={`QR: ${v.vin}`}
        >
          <IconQrcode size={13} className="group-hover/qr:scale-110 transition-transform" />
        </button>
      ) : <span className="text-muted-foreground/30">—</span>,
      width: "w-10",
    },
    { key: "vin", label: "VIN", accessor: (v) => v.vin || "", className: "font-mono text-[11px]" },
    { key: "year", label: "Year", accessor: (v) => v.year || "" },
    { key: "vehicleName", label: "Vehicle Name", accessor: (v) => v.vehicleName || "", className: "font-medium text-foreground" },
    { key: "licensePlate", label: "License Plate", accessor: (v) => v.licensePlate || "", className: "font-mono" },
    { key: "make", label: "Make", accessor: (v) => v.make || "" },
    { key: "vehicleModel", label: "Model", accessor: (v) => v.vehicleModel || "" },
    {
      key: "status", label: "Status", accessor: (v) => v.status || "",
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: "mileage", label: "Mileage", accessor: (v) => v.mileage || 0,
      render: (v) => <>{v.mileage ? v.mileage.toLocaleString() : "—"}</>,
    },
    { key: "serviceType", label: "Service Type", accessor: (v) => v.serviceType || "" },
    { key: "dashcam", label: "Dashcam", accessor: (v) => v.dashcam || "" },
    { key: "vehicleProvider", label: "Vehicle Provider", accessor: (v) => v.vehicleProvider || "" },
    { key: "ownership", label: "Ownership", accessor: (v) => v.ownership || "" },
    { key: "unitNumber", label: "Unit #", accessor: (v) => v.unitNumber || "", className: "font-medium text-foreground" },
    { key: "startDate", label: "Start Date", accessor: (v) => v.startDate || "", render: (v) => <>{fmtDate(v.startDate)}</> },
    { key: "endDate", label: "End Date", accessor: (v) => v.endDate || "", render: (v) => <>{fmtDate(v.endDate)}</> },
    { key: "registrationExpiration", label: "Reg. Expiration", accessor: (v) => v.registrationExpiration || "", render: (v) => <>{fmtDate(v.registrationExpiration)}</> },
    { key: "state", label: "State", accessor: (v) => v.state || "" },
    { key: "location", label: "Location", accessor: (v) => v.location || "" },
    { key: "notes", label: "Notes", accessor: (v) => v.notes || "" },
    { key: "info", label: "Info", accessor: (v) => v.info || "" },
    { key: "locationFrom", label: "Location From", accessor: (v) => v.locationFrom || "" },
  ], []);

  /* ── Sort: 1st by status, 2nd by vehicleName, then user override ── */
  const sortedVehicles = useMemo(() => {
    if (!data?.vehicles) return [];
    const list = [...data.vehicles];

    return list.sort((a, b) => {
      // User-selected sort takes full priority
      if (sortKey && sortDir) {
        const col = columns.find(c => c.key === sortKey);
        if (col) {
          let aVal = col.accessor(a);
          let bVal = col.accessor(b);
          if (typeof aVal === "number" && typeof bVal === "number") {
            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
          }
          if (["startDate", "endDate", "registrationExpiration"].includes(sortKey)) {
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

      // Default: 1st by status rank, 2nd by vehicleName
      const statusCmp = statusRank(a.status || "") - statusRank(b.status || "");
      if (statusCmp !== 0) return statusCmp;
      const aName = (a.vehicleName || "").toLowerCase();
      const bName = (b.vehicleName || "").toLowerCase();
      return aName < bName ? -1 : aName > bName ? 1 : 0;
    });
  }, [data?.vehicles, sortKey, sortDir, columns]);

  /* ── Search filter ───────────────────────────────────────────── */
  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return sortedVehicles;
    const q = search.toLowerCase();
    return sortedVehicles.filter((v: any) =>
      columns.some((col) => {
        const val = col.accessor(v);
        return val && val.toString().toLowerCase().includes(q);
      })
    );
  }, [sortedVehicles, search, columns]);

  const handleQrClose = useCallback(() => setQrVin(null), []);

  if (!data && !loading) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
      {/* ── QR Modal ─────────────────────────────────────────── */}
      {qrVin && <QRPopover vin={qrVin} onClose={handleQrClose} />}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="h-full overflow-auto rounded-xl border border-border/60 shadow-sm bg-card">
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
              {/* Actions column */}
              <th className="px-3 py-3 sticky right-0 bg-card/95 backdrop-blur-sm w-16" />
            </tr>
            {/* Subtle gradient separator */}
            <tr>
              <td colSpan={columns.length + 1} className="p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </td>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {/* Skeleton shimmer rows while fleet data loads */}
            {loading && Array.from({ length: 18 }).map((_, i) => (
              <tr key={`sk-${i}`} className={`border-b border-border/20 ${i % 2 === 0 ? "" : "bg-muted/[0.015]"}`}>
                {columns.map((col, j) => (
                  <td key={col.key} className="px-3 py-[11px]">
                    <div
                      className="h-3 rounded-md bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                      style={{ width: `${[70, 40, 85, 65, 55, 60, 70, 50, 68, 42, 72, 55, 48, 58, 52, 45, 62, 50, 80, 55, 45, 60, 52][j] ?? 60}%`, animationDelay: `${(i * 23 + j) * 25}ms` }}
                    />
                  </td>
                ))}
                <td className="w-16" />
              </tr>
            ))}

            {/* Real rows */}
            {!loading && filteredVehicles.map((v: any, idx: number) => (
              <tr
                key={v._id}
                onClick={() => router.push(`/fleet/vehicles/${v._id}`)}
                className={`
                  relative group cursor-pointer transition-all duration-150
                  hover:bg-primary/[0.035] hover:shadow-[inset_3px_0_0_hsl(var(--primary))]
                  ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/[0.015]"}
                `}
              >
                {columns.map((col) => {
                  const val = col.accessor(v);
                  const display = col.render ? col.render(v) : (val || "—");
                  const isTruncated = ["notes", "info"].includes(col.key);
                  return (
                    <td
                      key={col.key}
                      className={`
                        px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap
                        ${col.className || ""}
                        ${isTruncated ? "max-w-[140px] truncate" : ""}
                        ${col.width ?? ""}
                      `}
                      title={isTruncated ? (val || "") : undefined}
                    >
                      {display}
                    </td>
                  );
                })}
                {/* Row actions */}
                <td className="px-3 py-2.5 sticky right-0 bg-transparent">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal("vehicle", v); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-500 transition-all shadow-sm"
                      title="Edit"
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete("vehicle", v._id); }}
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

        {!loading && filteredVehicles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <IconPhoto size={20} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50 font-medium">
              {search.trim() ? "No vehicles match your search." : "No vehicles yet."}
            </p>
          </div>
        )}
      </div>

      <FleetFormModal />
    </>
  );
}
