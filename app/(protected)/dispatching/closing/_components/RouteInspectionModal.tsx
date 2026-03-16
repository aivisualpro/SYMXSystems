"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { IconX, IconLoader2, IconUpload, IconPhoto } from "@tabler/icons-react";

const inputClass = "w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

/** Convert a date (ISO string or Date) to YYYY-MM-DD in Pacific Time */
function toPacificDate(d: string | Date): string {
    const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(date);
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</label>
            {children}
        </div>
    );
}

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

interface RouteInspectionModalProps {
    open: boolean;
    onClose: () => void;
    onSaved: (routeId: string, inspectionId?: string) => void;
    route: any;
}

export default function RouteInspectionModal({ open, onClose, onSaved, route }: RouteInspectionModalProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [sessionEmail, setSessionEmail] = useState("");
    const [repairStatuses, setRepairStatuses] = useState<{description: string; color?: string; icon?: string}[]>([]);

    // Fetch repair statuses from dropdown settings
    useEffect(() => {
        if (!open) return;
        fetch("/api/admin/settings/dropdowns?type=fleet repair status")
            .then(r => r.json())
            .then((data: any[]) => {
                const statuses = data
                    .filter((d: any) => d.isActive !== false)
                    .map((d: any) => ({ description: d.description, color: d.color || "", icon: d.icon || "" }));
                if (statuses.length > 0) setRepairStatuses(statuses);
            })
            .catch(() => { });
    }, [open]);

    // Reset form when modal opens or route changes
    React.useEffect(() => {
        if (open && route) {
            // Also fetch session user
            fetch("/api/auth/session")
                .then(r => r.json())
                .then(d => {
                    if (d?.user?.email) {
                        setSessionEmail(d.user.email);
                    }
                })
                .catch(() => { });

            setFormData({
                type: "Route Inspection", // Pre-filled default
                driver: route.transporterId || "",
                employeeName: route.employeeName || "",
                vin: route.genuineVin || route.van || "",
                vanDisplay: route.van ? `Van ${route.van}` : "",
                routeDate: route.date ? toPacificDate(route.date) : "",
                mileage: 0,
                anyRepairs: "",
                comments: "",
            });
        }
    }, [open, route]);

    if (!open || !route) return null;

    const updateForm = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const finalData = {
                ...formData,
                inspectedBy: sessionEmail || ""
            };

            // 1. Submit to Fleet Inspections
            const inspectionRes = await fetch("/api/fleet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "inspection", data: finalData }),
            });
            if (!inspectionRes.ok) throw new Error("Failed to save inspection");

            const dataResponse = await inspectionRes.json();
            const inspectionId = dataResponse.inspection?._id;

            // 2. Update Route with inspectionTime and inspectionId
            const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
            const routeRes = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    routeId: route._id,
                    updates: {
                        inspectionTime: nowTime,
                        ...(inspectionId ? { inspectionId } : {})
                    }
                }),
            });
            if (!routeRes.ok) throw new Error("Failed to update route inspection time");

            onSaved(route._id, inspectionId);
            onClose();
        } catch (err) {
            console.error(err);
            alert("Error saving inspection");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Record Route Inspection</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Route {route.routeNumber}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><IconX size={16} /></button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
                    <div className="p-5 space-y-4">
                        {/* Read-only Auto Fields */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                            <FormField label="Driver">
                                <input className={inputClass + " opacity-70"} value={formData.employeeName || ""} readOnly disabled />
                            </FormField>
                            <FormField label="VIN / Van">
                                <input className={inputClass + " opacity-70"}
                                    value={formData.vin ? (formData.vanDisplay ? `${formData.vanDisplay} — ${formData.vin}` : formData.vin) : ""}
                                    readOnly disabled
                                />
                            </FormField>
                            <FormField label="Route Date">
                                <input type="date" className={inputClass + " opacity-70"} value={formData.routeDate || ""} readOnly disabled />
                            </FormField>
                            <FormField label="Inspection Type">
                                <input className={inputClass + " opacity-70"} value="Route Inspection" readOnly disabled />
                            </FormField>
                        </div>

                        {/* Editable Fields */}
                        <div className="grid grid-cols-2 gap-3">
                            <FormField label="Mileage">
                                <input type="number" className={inputClass} value={formData.mileage || ""} onChange={e => updateForm("mileage", parseInt(e.target.value) || 0)} required />
                            </FormField>
                            <FormField label="Any Repairs?">
                                <select className={inputClass} value={formData.anyRepairs || ""} onChange={e => {
                                    updateForm("anyRepairs", e.target.value);
                                    if (e.target.value === "TRUE" && !formData.repairCurrentStatus) {
                                        updateForm("repairCurrentStatus", "Not Started");
                                    }
                                }}>
                                    <option value="">No</option>
                                    <option value="TRUE">Yes</option>
                                </select>
                            </FormField>
                        </div>

                        {formData.anyRepairs === "TRUE" && (
                            <div className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Repair Details</p>
                                <FormField label="Repair Description">
                                    <textarea className={inputClass} rows={3} value={formData.repairDescription || ""} onChange={e => updateForm("repairDescription", e.target.value)} placeholder="Describe the repair needed..." />
                                </FormField>
                                <PhotoUploadField label="Repair Image" value={formData.repairImage} onChange={v => updateForm("repairImage", v)} />
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

                        <FormField label="Comments">
                            <textarea className={inputClass} rows={2} value={formData.comments || ""} onChange={e => updateForm("comments", e.target.value)} />
                        </FormField>
                    </div>

                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0 bg-card">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50">
                            {saving && <IconLoader2 size={14} className="animate-spin" />} Submit Inspection
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
