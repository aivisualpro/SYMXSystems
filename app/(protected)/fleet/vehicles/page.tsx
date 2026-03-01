"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort } from "@tabler/icons-react";
import { useFleet } from "../layout";
import { GlassCard, StatusBadge, FleetLoading } from "../components/fleet-ui";
import FleetFormModal from "../components/fleet-form-modal";

const fmtDate = (d: string | undefined) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; }
};



type SortDir = "asc" | "desc" | null;

interface Column {
  key: string;
  label: string;
  accessor: (v: any) => any;
  render?: (v: any) => React.ReactNode;
  className?: string;
}

const columns: Column[] = [
  { key: "vin", label: "VIN", accessor: (v) => v.vin || "", className: "font-mono" },
  { key: "year", label: "Year", accessor: (v) => v.year || "" },
  { key: "vehicleName", label: "Vehicle Name", accessor: (v) => v.vehicleName || "" },
  { key: "licensePlate", label: "License Plate", accessor: (v) => v.licensePlate || "" },
  { key: "make", label: "Make", accessor: (v) => v.make || "" },
  { key: "vehicleModel", label: "Model", accessor: (v) => v.vehicleModel || "" },
  { key: "status", label: "Status", accessor: (v) => v.status || "", render: (v) => <StatusBadge status={v.status} /> },
  { key: "mileage", label: "Mileage", accessor: (v) => v.mileage || 0, render: (v) => <>{v.mileage ? v.mileage.toLocaleString() : "—"}</> },
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
  { key: "image", label: "Image", accessor: (v) => v.image || "", render: (v) => v.image ? <a href={v.image} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>View</a> : <>{"—"}</> },
  { key: "locationFrom", label: "Location From", accessor: (v) => v.locationFrom || "" },
];

export default function FleetVehiclesPage() {
  const router = useRouter();
  const { data, loading, search, openEditModal, handleDelete } = useFleet();
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

  const sortedVehicles = useMemo(() => {
    if (!data?.vehicles) return [];
    if (!sortKey || !sortDir) return data.vehicles;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return data.vehicles;
    return [...data.vehicles].sort((a, b) => {
      let aVal = col.accessor(a);
      let bVal = col.accessor(b);
      // Handle numbers
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      // Handle dates
      if (["startDate", "endDate", "registrationExpiration"].includes(sortKey)) {
        const ad = aVal ? new Date(aVal).getTime() : 0;
        const bd = bVal ? new Date(bVal).getTime() : 0;
        return sortDir === "asc" ? ad - bd : bd - ad;
      }
      // Strings
      aVal = (aVal || "").toString().toLowerCase();
      bVal = (bVal || "").toString().toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data?.vehicles, sortKey, sortDir]);

  // Apply search filter
  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return sortedVehicles;
    const q = search.toLowerCase();
    return sortedVehicles.filter((v: any) =>
      columns.some((col) => {
        const val = col.accessor(v);
        return val && val.toString().toLowerCase().includes(q);
      })
    );
  }, [sortedVehicles, search]);

  if (loading) return <FleetLoading />;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  return (
    <>
      <GlassCard className="p-4">
        <div className="overflow-auto max-h-[calc(100vh-220px)] rounded-lg border border-border">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground hover:bg-muted/50 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <span className="text-muted-foreground/40 group-hover/th:text-muted-foreground transition-colors">
                        {sortKey === col.key && sortDir === "asc" ? (
                          <IconArrowUp size={12} className="text-primary" />
                        ) : sortKey === col.key && sortDir === "desc" ? (
                          <IconArrowDown size={12} className="text-primary" />
                        ) : (
                          <IconArrowsSort size={12} />
                        )}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 bg-card" />
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v: any) => (
                <tr
                  key={v._id}
                  onClick={() => router.push(`/fleet/vehicles/${v._id}`)}
                  className="border-b border-border/50 hover:bg-primary/[0.04] transition-colors group cursor-pointer"
                >
                  {columns.map((col) => {
                    const val = col.accessor(v);
                    const display = col.render ? col.render(v) : (val || "—");
                    const isTruncated = ["notes", "info"].includes(col.key);
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap ${col.className || ""} ${isTruncated ? "max-w-[150px] truncate" : ""}`}
                        title={isTruncated ? (val || "") : undefined}
                      >
                        {display}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); openEditModal("vehicle", v); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-500"><IconEdit size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete("vehicle", v._id); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"><IconTrash size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVehicles.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground/50">{search.trim() ? "No vehicles match your search." : "No vehicles yet."}</p>}
        </div>
      </GlassCard>
      <FleetFormModal />
    </>
  );
}
