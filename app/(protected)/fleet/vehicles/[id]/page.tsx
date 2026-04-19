"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    IconArrowLeft, IconCar, IconTool, IconClipboardCheck,
    IconActivity, IconFileInvoice, IconEdit, IconTrash,
    IconCalendar, IconMapPin, IconGauge, IconId, IconCreditCard,
    IconCheck, IconX, IconAlertTriangle, IconClock, IconHash,
    IconEngine, IconSteeringWheel, IconLicense, IconCamera,
    IconMessageCircle, IconPlus, IconLoader2, IconArrowUpRight,
} from "@tabler/icons-react";
import { StatusBadge, GlassCard } from "../../components/fleet-ui";
import { DropdownOptionSelect } from "../../components/fleet-form-modal";
import { ImageUpload } from "@/components/admin/image-upload";
import { FileUpload } from "@/components/admin/file-upload";
import * as LucideIcons from "lucide-react";
import { FleetRepairsTable } from "../../components/fleet-repairs-table";

/* ─── helpers ─────────────────────────────────────── */
const fmtDate = (d: any) => {
    if (!d) return "—";
    try { return format(new Date(d), "MMM dd, yyyy"); } catch { return "—"; }
};
const fmtDateTime = (d: any) => {
    if (!d) return "—";
    try { return format(new Date(d), "MMM dd, yyyy h:mm a"); } catch { return "—"; }
};
const getVehicleTitle = (v: any) => {
    if (v.vehicleName) return v.vehicleName;
    if (v.unitNumber) return `Unit #${v.unitNumber}`;
    return v.vin || "Vehicle";
};

/* ─── Mini KPI ────────────────────────────────────── */
function MiniKPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition-all hover:shadow-md hover:border-primary/20 group">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}

/* ─── Info Row ────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
    return (
        <div className="flex items-center gap-2.5 py-1.5 border-b border-border/50 last:border-0">
            <Icon size={13} className="text-muted-foreground shrink-0" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-20 shrink-0">{label}</p>
            <p className="text-xs text-foreground break-words flex-1 min-w-0">{value || "—"}</p>
        </div>
    );
}

/* ─── Tab Button ──────────────────────────────────── */
function TabBtn({ active, label, count, icon: Icon, onClick }: { active: boolean; label: string; count: number; icon: any; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
        >
            <Icon size={14} />
            {label}
            {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

/* ─── Section: No Data ────────────────────────────── */
function NoData({ label }: { label: string }) {
    return <p className="text-center py-12 text-xs text-muted-foreground/50">No {label} records found for this vehicle.</p>;
}

/* ════════════════════════════════════════════════════ */
export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/fleet/vehicles/${id}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error("Failed to fetch vehicle:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <IconCar size={20} className="absolute inset-0 m-auto text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Loading vehicle...</p>
                </div>
            </div>
        );
    }

    if (!data?.vehicle) {
        return (
            <div className="text-center py-20">
                <IconCar size={48} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Vehicle not found</p>
                <button onClick={() => router.back()} className="mt-3 text-xs text-primary hover:underline">← Go back</button>
            </div>
        );
    }

    const v = data.vehicle;
    const stats = data.stats;

    const tabs = [
        { id: "overview", label: "Overview", icon: IconCar, count: 0 },
        { id: "repairs", label: "Repairs", icon: IconTool, count: data.repairs?.length || 0 },
        { id: "inspections", label: "Inspections", icon: IconClipboardCheck, count: data.dailyInspections?.length || 0 },
        { id: "activity", label: "Activity Logs", icon: IconActivity, count: data.activityLogs?.length || 0 },
        { id: "rentals", label: "Rental Agreements", icon: IconFileInvoice, count: data.rentalAgreements?.length || 0 },
        { id: "communications", label: "Communications", icon: IconMessageCircle, count: v.fleetCommunications?.length || 0 },
    ];

    return (
        <div className="space-y-5 w-full">
            {/* ── Header ────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/fleet/vehicles")}
                        className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all hover:shadow-md"
                    >
                        <IconArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-foreground">{getVehicleTitle(v)}</h1>
                            <StatusBadge status={v.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground font-mono">{v.vin}</span>
                            {v.unitNumber && (
                                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                                    Unit #{v.unitNumber}
                                </span>
                            )}
                            {v.licensePlate && (
                                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium">
                                    {v.licensePlate}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Stats KPI Row ─────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniKPI icon={IconTool} label="Open Repairs" value={stats.openRepairs} color="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
                <MiniKPI icon={IconCheck} label="Completed Repairs" value={stats.completedRepairs} color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
                <MiniKPI icon={IconClipboardCheck} label="Inspections" value={stats.totalInspections} color="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
                <MiniKPI icon={stats.failedInspections > 0 ? IconX : IconCheck} label="Pass / Fail" value={`${stats.passedInspections} / ${stats.failedInspections}`} color={stats.failedInspections > 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"} />
                <MiniKPI icon={IconActivity} label="Activity Logs" value={stats.totalActivityLogs} color="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
                <MiniKPI icon={IconCreditCard} label="Rental Total" value={`$${stats.totalRentalAmount.toLocaleString()}`} color="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" />
            </div>

            {/* ── Tabs ──────────────────────────────────────── */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
                {tabs.map((tab) => (
                    <TabBtn key={tab.id} active={activeTab === tab.id} label={tab.label} count={tab.count} icon={tab.icon} onClick={() => setActiveTab(tab.id)} />
                ))}
            </div>

            {/* ── Tab Content ───────────────────────────────── */}
            {activeTab === "overview" && <OverviewTab v={v} masterPhoto={data.masterPhotoInspection} />}
            {activeTab === "repairs" && (
                <div className="h-[600px]">
                    {v.vin ? <FleetRepairsTable vin={v.vin} isTab={true} /> : <NoData label="repair" />}
                </div>
            )}
            {activeTab === "inspections" && <InspectionsTab inspections={data.dailyInspections || []} />}
            {activeTab === "activity" && <ActivityTab logs={data.activityLogs} />}
            {activeTab === "rentals" && <RentalsTab vehicleId={id} rentals={data.rentalAgreements} onUpdate={(r) => setData({...data, rentalAgreements: r})} />}
            {activeTab === "communications" && <CommunicationsTab vehicleId={id} communications={v.fleetCommunications || []} onUpdate={(updated) => setData({ ...data, vehicle: { ...v, fleetCommunications: updated } })} />}
        </div>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Overview
   ──────────────────────────────────────────────────── */
function OverviewTab({ v, masterPhoto }: { v: any; masterPhoto: any }) {
    const [lightbox, setLightbox] = useState<string | null>(null);

    // Build the combined photo gallery: main image + master inspection photos
    const allPhotos: { url: string; label: string; isMaster?: boolean }[] = [];
    if (v.image) allPhotos.push({ url: v.image, label: "Vehicle Image" });
    if (masterPhoto) {
        const masterPhotos = [
            { url: masterPhoto.vehiclePicture1, label: "Photo 1" },
            { url: masterPhoto.vehiclePicture2, label: "Photo 2" },
            { url: masterPhoto.vehiclePicture3, label: "Photo 3" },
            { url: masterPhoto.vehiclePicture4, label: "Photo 4" },
            { url: masterPhoto.dashboardImage, label: "Dashboard" },
            { url: masterPhoto.additionalPicture, label: "Additional" },
        ].filter(p => p.url);
        masterPhotos.forEach(p => allPhotos.push({ ...p, isMaster: true }));
    }

    return (
        <>
            {/* Lightbox */}
            {lightbox && (
                <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors" onClick={() => setLightbox(null)}>
                        <IconX size={18} />
                    </button>
                    <img src={lightbox} alt="full" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Vehicle Details */}
                <GlassCard className="p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2"><IconCar size={14} className="text-blue-500" /> Vehicle Details</h3>
                    <InfoRow icon={IconCalendar} label="Year" value={v.year} />
                    <InfoRow icon={IconEngine} label="Make" value={v.make} />
                    <InfoRow icon={IconSteeringWheel} label="Model" value={v.vehicleModel} />
                    <InfoRow icon={IconSteeringWheel} label="Ownership" value={v.ownership} />
                    <InfoRow icon={IconGauge} label="Mileage" value={v.mileage ? `${v.mileage.toLocaleString()} mi` : "—"} />
                    <InfoRow icon={IconTool} label="Service Type" value={v.serviceType} />
                    <InfoRow icon={IconCar} label="Dashcam" value={v.dashcam} />
                    <InfoRow icon={IconCar} label="Provider" value={v.vehicleProvider} />
                </GlassCard>

                {/* Column 2: Location & Dates */}
                <GlassCard className="p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2"><IconMapPin size={14} className="text-emerald-500" /> Location & Dates</h3>
                    <InfoRow icon={IconMapPin} label="State" value={v.state} />
                    <InfoRow icon={IconMapPin} label="Location" value={v.location} />
                    <InfoRow icon={IconMapPin} label="From" value={v.locationFrom} />
                    <InfoRow icon={IconCalendar} label="Start" value={fmtDate(v.startDate)} />
                    <InfoRow icon={IconCalendar} label="End" value={fmtDate(v.endDate)} />
                    <InfoRow icon={IconCalendar} label="Reg. Exp." value={fmtDate(v.registrationExpiration)} />
                    <InfoRow icon={IconClock} label="Created" value={fmtDateTime(v.createdAt)} />
                    <InfoRow icon={IconClock} label="Updated" value={fmtDateTime(v.updatedAt)} />
                </GlassCard>

                {/* Column 3: Photo Gallery */}
                {allPhotos.length > 0 && (
                    <GlassCard className="p-4 flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <IconCamera size={16} className="text-purple-500" /> Photos
                            {masterPhoto && (
                                <span className="text-[10px] text-muted-foreground/60 font-normal flex items-center gap-1">
                                    <span className="text-amber-500">★</span> Standard · {fmtDate(masterPhoto.routeDate)}
                                </span>
                            )}
                        </h3>

                        {/* Main vehicle image — large */}
                        {v.image && (
                            <button
                                onClick={() => setLightbox(v.image)}
                                className="relative w-full aspect-[16/10] rounded-xl overflow-hidden group border border-border/30 shadow-sm focus:outline-none transition-all hover:shadow-lg"
                            >
                                <img src={v.image} alt="Vehicle" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white border border-white/10">Vehicle</span>
                                </div>
                            </button>
                        )}

                        {/* Master inspection photos — 2-column grid */}
                        {masterPhoto && (() => {
                            const mPhotos = [
                                { url: masterPhoto.vehiclePicture1, label: "Photo 1" },
                                { url: masterPhoto.vehiclePicture2, label: "Photo 2" },
                                { url: masterPhoto.vehiclePicture3, label: "Photo 3" },
                                { url: masterPhoto.vehiclePicture4, label: "Photo 4" },
                                { url: masterPhoto.dashboardImage, label: "Dashboard" },
                                { url: masterPhoto.additionalPicture, label: "Additional" },
                            ].filter(p => p.url);
                            if (!mPhotos.length) return null;
                            return (
                                <div className="grid grid-cols-3 gap-2">
                                    {mPhotos.map((p) => (
                                        <button
                                            key={p.label}
                                            onClick={() => setLightbox(p.url)}
                                            className="relative aspect-square rounded-lg overflow-hidden group border border-border/30 focus:outline-none transition-all hover:shadow-md hover:border-amber-500/30"
                                        >
                                            <img src={p.url} alt={p.label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[8px] text-white font-medium">{p.label}</span>
                                            </div>
                                            <div className="absolute top-1 right-1">
                                                <span className="text-amber-400 text-[8px]">★</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                    </GlassCard>
                )}

                {/* Notes & Info */}
                {(v.notes || v.info) && (
                    <GlassCard className="p-4 lg:col-span-2">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Notes & Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {v.notes && (
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/50">{v.notes}</p>
                                </div>
                            )}
                            {v.info && (
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Info</p>
                                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/50">{v.info}</p>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                )}
            </div>
        </>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Inspections
   ──────────────────────────────────────────────────── */
function InspectionsTab({ inspections }: { inspections: any[] }) {
    const router = useRouter();
    if (!inspections?.length) return <NoData label="inspection" />;

    const cols = [
        { key: "isStandardPhoto", label: "★", className: "w-8 text-center", render: (r: any) => r.isStandardPhoto ? <span className="text-amber-500 text-sm leading-none" title="Master Photo">★</span> : <span className="text-muted-foreground/15 text-sm leading-none">☆</span> },
        { key: "routeDate", label: "Date", render: (r: any) => fmtDate(r.routeDate) },
        { key: "driverName", label: "Driver", className: "font-medium text-foreground", render: (r: any) => r.driverName || r.driver || "—" },
        { key: "mileage", label: "Mileage", render: (r: any) => r.mileage ? r.mileage.toLocaleString() : <span className="text-muted-foreground/30">—</span> },
        { key: "comments", label: "Comments", className: "max-w-[260px] truncate", render: (r: any) => r.comments || "—" },
        { key: "inspectedByName", label: "Inspected By", render: (r: any) => r.inspectedByName || r.inspectedBy || "—" },
    ];

    return (
        <div className="overflow-auto rounded-xl border border-border/60 shadow-sm bg-card">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                    <tr className="bg-card/95 backdrop-blur-sm border-b border-border/80">
                        {cols.map(col => (
                            <th key={col.key} className={`px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap text-muted-foreground/70`}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                    <tr><td colSpan={cols.length} className="p-0">
                        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                    </td></tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                    {inspections.map((r: any, idx: number) => (
                        <tr
                            key={r._id}
                            onClick={() => router.push(`/fleet/inspections/${r._id}`)}
                            className={`relative group cursor-pointer transition-all duration-150 hover:bg-primary/[0.035] hover:shadow-[inset_3px_0_0_hsl(var(--primary))] ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/[0.015]"}`}
                        >
                            {cols.map(col => (
                                <td key={col.key}
                                    className={`px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap ${col.className || ""}`}
                                    title={col.key === "comments" ? (r.comments || "") : undefined}
                                >
                                    {col.render(r)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Activity Logs
   ──────────────────────────────────────────────────── */
function ActivityTab({ logs }: { logs: any[] }) {
    if (!logs?.length) return <NoData label="activity" />;
    return (
        <GlassCard className="p-4">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border">
                            {["Service Type", "Mileage", "Start Date", "End Date", "Reg. Expiration", "Notes", "Created"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((l: any) => (
                            <tr key={l._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                <td className="px-3 py-2.5 text-xs text-foreground font-medium">{l.serviceType || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.mileage ? l.mileage.toLocaleString() : "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.startDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.endDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.registrationExpiration)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[250px] truncate" title={l.notes}>{l.notes || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Rental Agreements
   ──────────────────────────────────────────────────── */
function RentalsTab({ vehicleId, rentals, onUpdate }: { vehicleId: string; rentals: any[]; onUpdate: (data: any[]) => void }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        _id: "", invoiceNumber: "", agreementNumber: "",
        registrationStartDate: "", registrationEndDate: "", dueDate: "", amount: "", file: "", image: ""
    });

    const openModal = (r?: any) => {
        if (r) {
            setEditMode(true);
            setFormData({
                _id: r._id,
                invoiceNumber: r.invoiceNumber || "",
                agreementNumber: r.agreementNumber || "",
                registrationStartDate: r.registrationStartDate ? new Date(r.registrationStartDate).toISOString().split('T')[0] : "",
                registrationEndDate: r.registrationEndDate ? new Date(r.registrationEndDate).toISOString().split('T')[0] : "",
                dueDate: r.dueDate ? new Date(r.dueDate).toISOString().split('T')[0] : "",
                amount: r.amount?.toString() || "",
                file: r.rentalAgreementFilesImages?.[0] || r.file || "",
                image: r.rentalAgreementFilesImages?.[1] || r.image || ""
            });
        } else {
            setEditMode(false);
            setFormData({
                _id: "", invoiceNumber: "", agreementNumber: "",
                registrationStartDate: "", registrationEndDate: "", dueDate: "",
                amount: "", file: "", image: ""
            });
        }
        setModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = editMode ? "PUT" : "POST";
            const payload = { rentalId: formData._id, ...formData };
            const res = await fetch(`/api/fleet/vehicles/${vehicleId}/rentals`, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save rental agreement");
            const savedItem = await res.json();
            
            let updatedList = [...rentals];
            if (editMode) {
                updatedList = updatedList.map(item => item._id === savedItem._id ? savedItem : item);
            } else {
                updatedList.unshift(savedItem);
            }
            onUpdate(updatedList);
            setModalOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (rentalId: string) => {
        if (!confirm("Are you sure you want to delete this agreement?")) return;
        setDeletingId(rentalId);
        try {
            const res = await fetch(`/api/fleet/vehicles/${vehicleId}/rentals?rentalId=${rentalId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            onUpdate(rentals.filter(r => r._id !== rentalId));
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    const updateRentalDoc = async (rentalId: string, payload: any) => {
        try {
            const res = await fetch(`/api/fleet/vehicles/${vehicleId}/rentals?rentalId=${rentalId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "rental", id: rentalId, data: payload })
            });
            if (!res.ok) throw new Error("Failed to update");
            const { rental } = await res.json();
            onUpdate(rentals.map((r: any) => r._id === rentalId ? rental : r));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <IconFileInvoice size={16} className="text-primary" /> Rental Agreements
                </h3>
                <button onClick={() => openModal()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    <IconPlus size={14} /> Add Agreement
                </button>
            </div>

            {!rentals?.length ? (
                <NoData label="rental agreement" />
            ) : (
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border">
                            {["Invoice #", "Agreement #", "Start Date", "End Date", "Due Date", "Amount", "File", "Image", "Actions"].map((h) => (
                                <th key={h} className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rentals.map((r: any) => {
                            const fileProp = r.rentalAgreementFilesImages?.[0] || r.file;
                            const imageProp = r.rentalAgreementFilesImages?.[1] || r.image;

                            return (
                                <tr key={r._id} className="group border-b border-border/50 hover:bg-muted/50 transition-colors">
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.invoiceNumber || "—"}</td>
                                    <td className="px-3 py-2.5 text-xs text-foreground font-medium whitespace-nowrap">{r.agreementNumber || "—"}</td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.registrationStartDate)}</td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.registrationEndDate)}</td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                                    <td className="px-3 py-2.5 text-xs text-foreground font-medium whitespace-nowrap">{r.amount ? `$${r.amount.toLocaleString()}` : "—"}</td>
                                    <td className="px-3 py-2.5 text-xs w-[120px]">
                                        <div className="w-full">
                                            <FileUpload
                                                value={fileProp ? [fileProp] : []}
                                                onChange={(url: any) => updateRentalDoc(r._id, { file: Array.isArray(url) ? url[0] || "" : url })}
                                                compact={true}
                                                label="Upload"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs w-[60px]">
                                        <div className="w-12 h-12">
                                            <ImageUpload
                                                value={imageProp ? [imageProp] : []}
                                                onChange={(url: any) => updateRentalDoc(r._id, { image: Array.isArray(url) ? url[0] || "" : url })}
                                                compact={true}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openModal(r)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                                                <IconEdit size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(r._id)} disabled={deletingId === r._id} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                                                {deletingId === r._id ? <IconLoader2 size={14} className="animate-spin" /> : <IconTrash size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">{editMode ? "Edit" : "Add"} Rental Agreement</h3>
                            <button onClick={() => setModalOpen(false)} className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"><IconX size={16} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Invoice #</label>
                                    <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Agreement #</label>
                                    <input type="text" value={formData.agreementNumber} onChange={e => setFormData({ ...formData, agreementNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Start Date</label>
                                    <input type="date" value={formData.registrationStartDate} onChange={e => setFormData({ ...formData, registrationStartDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">End Date</label>
                                    <input type="date" value={formData.registrationEndDate} onChange={e => setFormData({ ...formData, registrationEndDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Due Date</label>
                                    <input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Amount ($)</label>
                                    <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-1">
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-3">Attached Document</label>
                                    <FileUpload
                                        value={formData.file ? [formData.file] : []}
                                        onChange={(url: any) => setFormData({ ...formData, file: typeof url === "string" ? url : url[0] || "" })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-muted-foreground mb-3">Attached Image</label>
                                    <ImageUpload
                                        value={formData.image ? [formData.image] : []}
                                        onChange={(url: any) => setFormData({ ...formData, image: typeof url === "string" ? url : url[0] || "" })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50">
                                    {saving && <IconLoader2 size={14} className="animate-spin" />} Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Communications
   ──────────────────────────────────────────────────── */
function CommunicationsTab({ vehicleId, communications, onUpdate }: { vehicleId: string; communications: any[]; onUpdate: (data: any[]) => void }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ _id: "", date: "", status: "", comments: "" });
    const [statusOptions, setStatusOptions] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/admin/settings/dropdowns")
            .then(res => res.json())
            .then((data: any[]) => {
                if (Array.isArray(data)) {
                    setStatusOptions(data.filter((o: any) => {
                        if (o.isActive === false) return false;
                        const t = (o.type || "").toLowerCase().trim();
                        return t === "fleet communication status";
                    }));
                }
            })
            .catch(() => { });
    }, []);

    const openModal = (comm?: any) => {
        if (comm) {
            setEditMode(true);
            setFormData({
                _id: comm._id,
                date: comm.date ? new Date(comm.date).toISOString().split('T')[0] : "",
                status: comm.status || "",
                comments: comm.comments || ""
            });
        } else {
            setEditMode(false);
            setFormData({ _id: "", date: new Date().toISOString().split('T')[0], status: "", comments: "" });
        }
        setModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = editMode ? "PUT" : "POST";
            const payload = editMode
                ? { commId: formData._id, date: formData.date, status: formData.status, comments: formData.comments }
                : { date: formData.date, status: formData.status, comments: formData.comments };
            const res = await fetch(`/api/fleet/vehicles/${vehicleId}/communications`, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save");
            const savedItem = await res.json();

            let updatedList = [...communications];
            if (editMode) {
                updatedList = updatedList.map(c => c._id === savedItem._id ? savedItem : c);
            } else {
                updatedList.push(savedItem);
            }
            onUpdate(updatedList);
            setModalOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (commId: string) => {
        if (!confirm("Are you sure you want to delete this communication?")) return;
        setDeletingId(commId);
        try {
            const res = await fetch(`/api/fleet/vehicles/${vehicleId}/communications?commId=${commId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            onUpdate(communications.filter(c => c._id !== commId));
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <IconMessageCircle size={16} className="text-primary" /> Communications
                </h3>
                <button onClick={() => openModal()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    <IconPlus size={14} /> Add Note
                </button>
            </div>

            {communications.length === 0 ? (
                <NoData label="communication" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-card z-10">
                            <tr className="border-b border-border">
                                {["Date", "Status", "Comments", "Added By", "Added On", "Actions"].map((h) => (
                                    <th key={h} className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {communications.map((c: any) => {
                                const statusOpt = statusOptions.find(o => o.description === c.status);
                                const IconComp = statusOpt?.icon ? (LucideIcons as any)[statusOpt.icon] : null;

                                return (
                                    <tr key={c._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors group">
                                        <td className="px-3 py-2.5 text-xs text-foreground font-medium whitespace-nowrap">{fmtDate(c.date)}</td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {c.status ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                                                    {IconComp && <IconComp size={12} className="opacity-70" />}
                                                    {statusOpt?.color && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusOpt.color }} />}
                                                    {c.status}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[300px] truncate" title={c.comments}>{c.comments || "—"}</td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.createdBy || "—"}</td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(c.createdAt)}</td>
                                        <td className="px-3 py-2.5 text-xs text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openModal(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                                                    <IconEdit size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(c._id)} disabled={deletingId === c._id} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                                                    {deletingId === c._id ? <IconLoader2 size={14} className="animate-spin" /> : <IconTrash size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">{editMode ? "Edit" : "Add"} Communication</h3>
                            <button onClick={() => setModalOpen(false)} className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"><IconX size={16} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Date <span className="text-red-500">*</span></label>
                                <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Status</label>
                                <DropdownOptionSelect
                                    value={formData.status}
                                    onChange={(val) => setFormData({ ...formData, status: val })}
                                    options={statusOptions}
                                    placeholder="Select Status..."
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Comments</label>
                                <textarea rows={4} value={formData.comments} onChange={e => setFormData({ ...formData, comments: e.target.value })} placeholder="Enter notes..." className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50">
                                    {saving && <IconLoader2 size={14} className="animate-spin" />} Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}
