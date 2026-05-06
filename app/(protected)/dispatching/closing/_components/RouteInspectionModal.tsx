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
    const [lastMileage, setLastMileage] = useState<number | null>(null);
    const [mileageLoading, setMileageLoading] = useState(false);
    const [saveError, setSaveError] = useState("");

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
                    if (d?.user?.email) setSessionEmail(d.user.email);
                })
                .catch(() => {});

            const vin = route.genuineVin || "";
            setFormData({
                type: "Route Inspection",
                driver: route.transporterId || "",
                employeeName: route.employeeName || "",
                vin,
                vanDisplay: route.van ? `Van ${route.van}` : "",
                routeDate: route.date ? toPacificDate(route.date) : "",
                mileage: "",
                anyRepairs: "",
                comments: "",
            });

            // Auto-fetch last mileage for this VIN
            if (vin && vin.length >= 3) {
                setLastMileage(null);
                setMileageLoading(true);
                fetch(`/api/fleet/inspections?q=${encodeURIComponent(vin)}&limit=1`)
                    .then(r => r.json())
                    .then(d => {
                        const last = d?.inspections?.[0];
                        if (last?.mileage) {
                            const m = Number(last.mileage);
                            if (!isNaN(m) && m > 0) {
                                setLastMileage(m);
                                setFormData((prev: any) => ({ ...prev, mileage: m }));
                            }
                        }
                    })
                    .catch(() => {})
                    .finally(() => setMileageLoading(false));
            }
        }
    }, [open, route]);

    if (!open || !route) return null;

    const updateForm = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSaveError("");
        try {
            if (!formData.mileage && formData.mileage !== 0) throw new Error("Mileage is required");

            const finalData = {
                ...formData,
                mileage: Number(formData.mileage) || 0,
                routeId: route._id || "",
                inspectedBy: sessionEmail || ""
            };

            // 1. Submit to Fleet Inspections
            const inspectionRes = await fetch("/api/fleet/inspections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalData),
            });
            if (!inspectionRes.ok) {
                const errData = await inspectionRes.json().catch(() => ({}));
                throw new Error(errData?.error || "Failed to save inspection");
            }

            const dataResponse = await inspectionRes.json();
            const inspectionId = dataResponse.inspection?._id || dataResponse._id;

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
        } catch (err: any) {
            console.error(err);
            setSaveError(err?.message || "Error saving inspection. Please try again.");
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
                            {/* Mileage with stepper buttons */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-medium text-muted-foreground">Mileage</label>
                                {mileageLoading && (
                                    <span className="text-[10px] text-muted-foreground/60 animate-pulse">Fetching last…</span>
                                )}
                                {!mileageLoading && lastMileage !== null && (
                                    <span className="text-[10px] text-muted-foreground/70">
                                        Last: <span className="font-semibold text-foreground/80">{lastMileage.toLocaleString()} mi</span>
                                    </span>
                                )}
                            </div>
                            <div className="flex items-stretch gap-1.5">
                                {/* Decrement buttons */}
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => updateForm("mileage", Math.max(0, (Number(formData.mileage) || 0) + 50))}
                                        className="flex-1 px-2 rounded-md bg-muted/60 hover:bg-primary/20 hover:text-primary border border-border text-muted-foreground text-[10px] font-bold transition-colors flex items-center justify-center"
                                        title="+50 miles"
                                    >+50</button>
                                    <button
                                        type="button"
                                        onClick={() => updateForm("mileage", Math.max(0, (Number(formData.mileage) || 0) - 50))}
                                        className="flex-1 px-2 rounded-md bg-muted/60 hover:bg-red-500/20 hover:text-red-400 border border-border text-muted-foreground text-[10px] font-bold transition-colors flex items-center justify-center"
                                        title="-50 miles"
                                    >-50</button>
                                </div>
                                {/* Main input */}
                                <input
                                    type="number"
                                    className={inputClass + " flex-1 text-center font-semibold text-base"}
                                    value={formData.mileage ?? ""}
                                    onChange={e => updateForm("mileage", e.target.value)}
                                    placeholder="e.g. 46000"
                                    min={0}
                                    required
                                />
                                {/* Increment buttons */}
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => updateForm("mileage", (Number(formData.mileage) || 0) + 1)}
                                        className="flex-1 px-2 rounded-md bg-muted/60 hover:bg-primary/20 hover:text-primary border border-border text-muted-foreground text-[11px] font-bold transition-colors flex items-center justify-center"
                                        title="+1 mile"
                                    >+</button>
                                    <button
                                        type="button"
                                        onClick={() => updateForm("mileage", Math.max(0, (Number(formData.mileage) || 0) - 1))}
                                        className="flex-1 px-2 rounded-md bg-muted/60 hover:bg-red-500/20 hover:text-red-400 border border-border text-muted-foreground text-[11px] font-bold transition-colors flex items-center justify-center"
                                        title="-1 mile"
                                    >−</button>
                                </div>
                            </div>
                        </div>
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

                    {saveError && (
                        <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] font-medium">
                            {saveError}
                        </div>
                    )}
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
