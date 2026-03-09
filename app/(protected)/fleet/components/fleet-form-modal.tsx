"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { IconX, IconLoader2, IconUpload, IconPhoto, IconCheck, IconSearch, IconChevronDown } from "@tabler/icons-react";
import { useFleet } from "../layout";

const inputClass = "w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ── Searchable select ───────────────────────────────────────────── */
function SearchableSelect({
  value, onChange, options, placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string, option?: any) => void;
  options: { value: string; label: string; raw?: any }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = useMemo(() => options.find(o => o.value === value)?.label || "", [options, value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }}
          className={`${inputClass} flex items-center justify-between gap-1 text-left cursor-pointer`}
        >
          <span className={value ? "text-foreground truncate" : "text-muted-foreground/50 truncate"}>
            {selectedLabel || placeholder}
          </span>
          <IconChevronDown size={14} className="text-muted-foreground/40 flex-shrink-0" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-primary/50 ring-1 ring-primary/20">
          <IconSearch size={13} className="text-muted-foreground/40 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none min-w-0"
            onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
          />
          {value && (
            <button type="button" onClick={() => { onChange(""); setQuery(""); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors">
              <IconX size={12} />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-xl max-h-[180px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">No results</div>
          ) : (
            filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value, opt.raw); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/5 ${opt.value === value ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                  }`}
              >
                {opt.value === value && <IconCheck size={12} className="text-primary flex-shrink-0" />}
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Photo upload field ──────────────────────────────────────────── */
function PhotoUploadField({
  label, value, onChange,
}: { label: string; value?: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) onChange(data.secure_url);
    } catch (err) { console.error("Upload failed:", err); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      <div className="flex items-center gap-2">
        {value ? (
          <div className="relative w-full h-20 rounded-lg overflow-hidden border border-border/50 group">
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="px-2 py-1 rounded bg-white/20 text-white text-[10px] font-medium hover:bg-white/30 transition-colors">
                Replace
              </button>
              <button type="button" onClick={() => onChange("")} className="px-2 py-1 rounded bg-red-500/30 text-white text-[10px] font-medium hover:bg-red-500/50 transition-colors">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full h-20 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 flex flex-col items-center justify-center gap-1 text-muted-foreground/50 hover:text-primary/60 transition-colors disabled:opacity-50">
            {uploading ? (
              <><IconLoader2 size={16} className="animate-spin" /><span className="text-[10px]">Uploading…</span></>
            ) : (
              <><IconUpload size={16} /><span className="text-[10px]">Upload</span></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FleetFormModal() {
  const { modalOpen, setModalOpen, modalType, formData, updateForm, handleSave, saving, editId, data } = useFleet();

  // Load employees & vehicles for dropdowns
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [inspectionTypes, setInspectionTypes] = useState<any[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string>("");

  useEffect(() => {
    if (!modalOpen || modalType !== "inspection") return;

    // Fetch employees for driver dropdown
    fetch("/api/fleet?section=inspection-dropdowns")
      .then(r => r.json())
      .then(d => {
        if (d.employees) setEmployees(d.employees);
        if (d.vehicles) setVehicles(d.vehicles);
        if (d.inspectionTypes) setInspectionTypes(d.inspectionTypes);
      })
      .catch(() => { });

    // When editing, fetch the full record to get photo URLs (list view omits them)
    if (editId) {
      fetch(`/api/fleet?section=inspection-detail&id=${editId}`)
        .then(r => r.json())
        .then(d => {
          const insp = d.inspection;
          if (!insp) return;
          const photoFields = ["vehiclePicture1", "vehiclePicture2", "vehiclePicture3", "vehiclePicture4", "dashboardImage", "additionalPicture"];
          for (const field of photoFields) {
            if (insp[field]) updateForm(field, insp[field]);
          }
        })
        .catch(() => { });
    }

    // Get current user session for auto inspectedBy
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(d => {
        if (d?.user?.email) {
          setSessionEmail(d.user.email);
          if (!editId && !formData.inspectedBy) {
            updateForm("inspectedBy", d.user.email);
          }
        }
      })
      .catch(() => { });
  }, [modalOpen, modalType]);

  if (!modalOpen) return null;

  const title = `${editId ? "Edit" : "New"} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><IconX size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">

            {modalType === "vehicle" && (<>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="VIN"><input className={inputClass} value={formData.vin || ""} onChange={e => updateForm("vin", e.target.value)} placeholder="Vehicle VIN" required /></FormField>
                <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} placeholder="Unit #" /></FormField>
                <FormField label="Vehicle Name"><input className={inputClass} value={formData.vehicleName || ""} onChange={e => updateForm("vehicleName", e.target.value)} placeholder="Vehicle Name" /></FormField>
                <FormField label="Year"><input className={inputClass} value={formData.year || ""} onChange={e => updateForm("year", e.target.value)} placeholder="2024" /></FormField>
                <FormField label="Make"><input className={inputClass} value={formData.make || ""} onChange={e => updateForm("make", e.target.value)} placeholder="Ford" /></FormField>
                <FormField label="Model"><input className={inputClass} value={formData.vehicleModel || ""} onChange={e => updateForm("vehicleModel", e.target.value)} placeholder="Transit" /></FormField>
                <FormField label="License Plate"><input className={inputClass} value={formData.licensePlate || ""} onChange={e => updateForm("licensePlate", e.target.value)} /></FormField>
                <FormField label="Status"><select className={inputClass} value={formData.status || "Active"} onChange={e => updateForm("status", e.target.value)}>
                  {["Active", "Inactive", "Maintenance", "Grounded", "Decommissioned"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></FormField>
                <FormField label="Ownership"><select className={inputClass} value={formData.ownership || "Owned"} onChange={e => updateForm("ownership", e.target.value)}>
                  {["Owned", "Leased", "Rented"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></FormField>
                <FormField label="Service Type"><input className={inputClass} value={formData.serviceType || ""} onChange={e => updateForm("serviceType", e.target.value)} /></FormField>
                <FormField label="Mileage"><input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} /></FormField>
                <FormField label="State"><input className={inputClass} value={formData.state || ""} onChange={e => updateForm("state", e.target.value)} /></FormField>
                <FormField label="Location"><input className={inputClass} value={formData.location || ""} onChange={e => updateForm("location", e.target.value)} /></FormField>
                <FormField label="Dashcam"><input className={inputClass} value={formData.dashcam || ""} onChange={e => updateForm("dashcam", e.target.value)} /></FormField>
                <FormField label="Provider"><input className={inputClass} value={formData.vehicleProvider || ""} onChange={e => updateForm("vehicleProvider", e.target.value)} /></FormField>
                <FormField label="Start Date"><input type="date" className={inputClass} value={formData.startDate ? formData.startDate.split("T")[0] : ""} onChange={e => updateForm("startDate", e.target.value)} /></FormField>
                <FormField label="End Date"><input type="date" className={inputClass} value={formData.endDate ? formData.endDate.split("T")[0] : ""} onChange={e => updateForm("endDate", e.target.value)} /></FormField>
                <FormField label="Reg. Expiration"><input type="date" className={inputClass} value={formData.registrationExpiration ? formData.registrationExpiration.split("T")[0] : ""} onChange={e => updateForm("registrationExpiration", e.target.value)} /></FormField>
                <FormField label="Location From"><input className={inputClass} value={formData.locationFrom || ""} onChange={e => updateForm("locationFrom", e.target.value)} /></FormField>
              </div>
              <FormField label="Notes"><textarea className={inputClass} rows={2} value={formData.notes || ""} onChange={e => updateForm("notes", e.target.value)} /></FormField>
              <FormField label="Info"><textarea className={inputClass} rows={2} value={formData.info || ""} onChange={e => updateForm("info", e.target.value)} /></FormField>
            </>)}



            {modalType === "repair" && (<>
              <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} /></FormField>
              <FormField label="Description"><textarea className={inputClass} rows={3} value={formData.description || ""} onChange={e => updateForm("description", e.target.value)} required /></FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Status"><select className={inputClass} value={formData.currentStatus || "Not Started"} onChange={e => updateForm("currentStatus", e.target.value)}>
                  {["Not Started", "In Progress", "Waiting for Parts", "Sent to Repair Shop", "Completed"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></FormField>
                <FormField label="Estimated Date"><input type="date" className={inputClass} value={formData.estimatedDate ? formData.estimatedDate.split("T")[0] : ""} onChange={e => updateForm("estimatedDate", e.target.value)} /></FormField>
                <FormField label="Duration (days)"><input type="number" className={inputClass} value={formData.repairDuration || ""} onChange={e => updateForm("repairDuration", parseInt(e.target.value) || 0)} /></FormField>
              </div>
            </>)}

            {modalType === "inspection" && (<>
              {/* ── Inspection Type — FIRST FIELD, full width ── */}
              <FormField label="Inspection Type">
                <select className={inputClass} value={formData.type || ""} onChange={e => updateForm("type", e.target.value)}>
                  <option value="">Select type…</option>
                  {inspectionTypes.length > 0
                    ? inspectionTypes.map((t: any) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))
                    : <>
                      <option value="Route Inspection">Route Inspection</option>
                      <option value="Yard Inspection">Yard Inspection</option>
                      <option value="Pre-Trip Inspection">Pre-Trip Inspection</option>
                      <option value="Post-Trip Inspection">Post-Trip Inspection</option>
                    </>
                  }
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                {/* Driver — only for Route Inspection */}
                {formData.type === "Route Inspection" && (
                  <FormField label="Driver">
                    <SearchableSelect
                      value={formData.driver || ""}
                      placeholder="Search driver…"
                      options={employees.map((emp: any) => ({
                        value: emp.transporterId,
                        label: `${emp.firstName} ${emp.lastName}`,
                      }))}
                      onChange={(val) => updateForm("driver", val)}
                    />
                  </FormField>
                )}

                {/* VIN dropdown — shows vehicleName - vin */}
                <FormField label="VIN">
                  <SearchableSelect
                    value={formData.vin || ""}
                    placeholder="Search VIN…"
                    options={vehicles.map((v: any) => ({
                      value: v.vin,
                      label: `${v.vehicleName ? v.vehicleName + " — " : ""}${v.vin}`,
                      raw: v,
                    }))}
                    onChange={(val, raw) => {
                      updateForm("vin", val);
                      if (raw?.unitNumber) updateForm("unitNumber", raw.unitNumber);
                      if (raw?.vehicleName) updateForm("vehicleName", raw.vehicleName);
                    }}
                  />
                </FormField>

                {/* Route Date — only for Route Inspection */}
                {formData.type === "Route Inspection" && (
                  <FormField label="Route Date">
                    <input type="date" className={inputClass} value={formData.routeDate ? (typeof formData.routeDate === "string" ? formData.routeDate.split("T")[0] : "") : ""} onChange={e => updateForm("routeDate", e.target.value)} />
                  </FormField>
                )}

                {/* Inspection Date — for all OTHER types (not Route Inspection) */}
                {formData.type && formData.type !== "Route Inspection" && (
                  <FormField label="Inspection Date">
                    <input type="date" className={inputClass} value={formData.routeDate ? (typeof formData.routeDate === "string" ? formData.routeDate.split("T")[0] : "") : ""} onChange={e => updateForm("routeDate", e.target.value)} />
                  </FormField>
                )}

                <FormField label="Mileage"><input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} /></FormField>
                <FormField label="Any Repairs?"><select className={inputClass} value={formData.anyRepairs || ""} onChange={e => updateForm("anyRepairs", e.target.value)}>
                  <option value="">No</option>
                  <option value="TRUE">Yes</option>
                </select></FormField>
              </div>
              <FormField label="Comments"><textarea className={inputClass} rows={2} value={formData.comments || ""} onChange={e => updateForm("comments", e.target.value)} /></FormField>
              {formData.anyRepairs === "TRUE" && (
                <div className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Repair Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Repair Description"><input className={inputClass} value={formData.repairDescription || ""} onChange={e => updateForm("repairDescription", e.target.value)} /></FormField>
                    <FormField label="Repair Status"><input className={inputClass} value={formData.repairCurrentStatus || ""} onChange={e => updateForm("repairCurrentStatus", e.target.value)} placeholder="e.g. In Progress" /></FormField>
                    <FormField label="Estimated Date"><input type="date" className={inputClass} value={formData.repairEstimatedDate ? formData.repairEstimatedDate.split("T")[0] : ""} onChange={e => updateForm("repairEstimatedDate", e.target.value)} /></FormField>
                  </div>
                  <FormField label="Repair Image URL"><input className={inputClass} value={formData.repairImage || ""} onChange={e => updateForm("repairImage", e.target.value)} placeholder="https://..." /></FormField>
                </div>
              )}
              <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <IconPhoto size={12} /> Photos
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <PhotoUploadField label="Passenger Side" value={formData.vehiclePicture1} onChange={v => updateForm("vehiclePicture1", v)} />
                  <PhotoUploadField label="Back Photo" value={formData.vehiclePicture2} onChange={v => updateForm("vehiclePicture2", v)} />
                  <PhotoUploadField label="Driver Side" value={formData.vehiclePicture3} onChange={v => updateForm("vehiclePicture3", v)} />
                  <PhotoUploadField label="Front Photo" value={formData.vehiclePicture4} onChange={v => updateForm("vehiclePicture4", v)} />
                  <PhotoUploadField label="Dashboard" value={formData.dashboardImage} onChange={v => updateForm("dashboardImage", v)} />
                  <PhotoUploadField label="Additional" value={formData.additionalPicture} onChange={v => updateForm("additionalPicture", v)} />
                </div>
              </div>
            </>)}

            {modalType === "rental" && (<>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} /></FormField>
                <FormField label="Agreement #"><input className={inputClass} value={formData.agreementNumber || ""} onChange={e => updateForm("agreementNumber", e.target.value)} /></FormField>
                <FormField label="Invoice #"><input className={inputClass} value={formData.invoiceNumber || ""} onChange={e => updateForm("invoiceNumber", e.target.value)} /></FormField>
                <FormField label="Amount"><input type="number" className={inputClass} value={formData.amount || ""} onChange={e => updateForm("amount", parseFloat(e.target.value) || 0)} /></FormField>
                <FormField label="Start Date"><input type="date" className={inputClass} value={formData.registrationStartDate ? formData.registrationStartDate.split("T")[0] : ""} onChange={e => updateForm("registrationStartDate", e.target.value)} /></FormField>
                <FormField label="End Date"><input type="date" className={inputClass} value={formData.registrationEndDate ? formData.registrationEndDate.split("T")[0] : ""} onChange={e => updateForm("registrationEndDate", e.target.value)} /></FormField>
                <FormField label="Due Date"><input type="date" className={inputClass} value={formData.dueDate ? formData.dueDate.split("T")[0] : ""} onChange={e => updateForm("dueDate", e.target.value)} /></FormField>
              </div>
            </>)}

            {modalType === "activity" && (<>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="VIN"><input className={inputClass} value={formData.vin || ""} onChange={e => updateForm("vin", e.target.value)} /></FormField>
                <FormField label="Service Type"><input className={inputClass} value={formData.serviceType || ""} onChange={e => updateForm("serviceType", e.target.value)} placeholder="Oil Change, Tire Rotation..." /></FormField>
                <FormField label="Mileage"><input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} /></FormField>
                <FormField label="Start Date"><input type="date" className={inputClass} value={formData.startDate ? formData.startDate.split("T")[0] : ""} onChange={e => updateForm("startDate", e.target.value)} /></FormField>
                <FormField label="End Date"><input type="date" className={inputClass} value={formData.endDate ? formData.endDate.split("T")[0] : ""} onChange={e => updateForm("endDate", e.target.value)} /></FormField>
                <FormField label="Reg. Expiration"><input type="date" className={inputClass} value={formData.registrationExpiration ? formData.registrationExpiration.split("T")[0] : ""} onChange={e => updateForm("registrationExpiration", e.target.value)} /></FormField>
              </div>
              <FormField label="Notes"><textarea className={inputClass} rows={3} value={formData.notes || ""} onChange={e => updateForm("notes", e.target.value)} /></FormField>
            </>)}

          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50">
              {saving && <IconLoader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
