"use client";

import React from "react";
import { IconX, IconLoader2 } from "@tabler/icons-react";
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

export default function FleetFormModal() {
  const { modalOpen, setModalOpen, modalType, formData, updateForm, handleSave, saving, editId } = useFleet();

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
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Unit Number"><input className={inputClass} value={formData.unitNumber || ""} onChange={e => updateForm("unitNumber", e.target.value)} /></FormField>
                <FormField label="Inspector Name"><input className={inputClass} value={formData.inspectorName || ""} onChange={e => updateForm("inspectorName", e.target.value)} /></FormField>
                <FormField label="Type"><select className={inputClass} value={formData.inspectionType || "Pre-Trip"} onChange={e => updateForm("inspectionType", e.target.value)}>
                  {["Pre-Trip", "Post-Trip", "Monthly", "Annual", "DOT", "Safety"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></FormField>
                <FormField label="Result"><select className={inputClass} value={formData.overallResult || "Pass"} onChange={e => updateForm("overallResult", e.target.value)}>
                  {["Pass", "Fail", "Needs Attention"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></FormField>
                <FormField label="Date"><input type="date" className={inputClass} value={formData.inspectionDate ? formData.inspectionDate.split("T")[0] : ""} onChange={e => updateForm("inspectionDate", e.target.value)} /></FormField>
                <FormField label="Mileage"><input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} /></FormField>
              </div>
              <FormField label="Defects Found"><textarea className={inputClass} rows={2} value={formData.defectsFound || ""} onChange={e => updateForm("defectsFound", e.target.value)} /></FormField>
              <FormField label="Notes"><textarea className={inputClass} rows={2} value={formData.notes || ""} onChange={e => updateForm("notes", e.target.value)} /></FormField>
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
