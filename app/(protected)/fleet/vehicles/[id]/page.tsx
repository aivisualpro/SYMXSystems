"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    IconArrowLeft, IconCar, IconTool, IconClipboardCheck,
    IconActivity, IconFileInvoice, IconEdit, IconTrash,
    IconCalendar, IconMapPin, IconGauge, IconId, IconCreditCard,
    IconCheck, IconX, IconAlertTriangle, IconClock, IconHash,
    IconEngine, IconSteeringWheel, IconLicense,
} from "@tabler/icons-react";
import { StatusBadge, GlassCard } from "../../components/fleet-ui";

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
        <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
            <Icon size={14} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-sm text-foreground mt-0.5 break-words">{value || "—"}</p>
            </div>
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
                if (res.ok) setData(await res.json());
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
        { id: "inspections", label: "Inspections", icon: IconClipboardCheck, count: data.inspections?.length || 0 },
        { id: "activity", label: "Activity Logs", icon: IconActivity, count: data.activityLogs?.length || 0 },
        { id: "rentals", label: "Rental Agreements", icon: IconFileInvoice, count: data.rentalAgreements?.length || 0 },
    ];

    return (
        <div className="space-y-5 max-w-[1600px] mx-auto">
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
            {activeTab === "overview" && <OverviewTab v={v} />}
            {activeTab === "repairs" && <RepairsTab repairs={data.repairs} />}
            {activeTab === "inspections" && <InspectionsTab inspections={data.inspections} />}
            {activeTab === "activity" && <ActivityTab logs={data.activityLogs} />}
            {activeTab === "rentals" && <RentalsTab rentals={data.rentalAgreements} />}
        </div>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Overview
   ──────────────────────────────────────────────────── */
function OverviewTab({ v }: { v: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Vehicle Identity */}
            <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><IconCar size={16} className="text-blue-500" /> Vehicle Identity</h3>
                <InfoRow icon={IconId} label="VIN" value={v.vin} />
                <InfoRow icon={IconCar} label="Vehicle Name" value={v.vehicleName} />
                <InfoRow icon={IconCalendar} label="Year" value={v.year} />
                <InfoRow icon={IconEngine} label="Make" value={v.make} />
                <InfoRow icon={IconSteeringWheel} label="Model" value={v.vehicleModel} />
                <InfoRow icon={IconLicense} label="License Plate" value={v.licensePlate} />
                <InfoRow icon={IconHash} label="Unit #" value={v.unitNumber} />
            </GlassCard>

            {/* Status & Operational */}
            <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><IconAlertTriangle size={16} className="text-amber-500" /> Status & Operations</h3>
                <InfoRow icon={IconCheck} label="Status" value={<StatusBadge status={v.status} />} />
                <InfoRow icon={IconSteeringWheel} label="Ownership" value={v.ownership} />
                <InfoRow icon={IconGauge} label="Mileage" value={v.mileage ? `${v.mileage.toLocaleString()} mi` : "—"} />
                <InfoRow icon={IconTool} label="Service Type" value={v.serviceType} />
                <InfoRow icon={IconCar} label="Dashcam" value={v.dashcam} />
                <InfoRow icon={IconCar} label="Vehicle Provider" value={v.vehicleProvider} />
                <InfoRow icon={IconCar} label="Image" value={v.image ? <a href={v.image} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Image</a> : "—"} />
            </GlassCard>

            {/* Location & Dates */}
            <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><IconMapPin size={16} className="text-emerald-500" /> Location & Dates</h3>
                <InfoRow icon={IconMapPin} label="State" value={v.state} />
                <InfoRow icon={IconMapPin} label="Location" value={v.location} />
                <InfoRow icon={IconMapPin} label="Location From" value={v.locationFrom} />
                <InfoRow icon={IconCalendar} label="Start Date" value={fmtDate(v.startDate)} />
                <InfoRow icon={IconCalendar} label="End Date" value={fmtDate(v.endDate)} />
                <InfoRow icon={IconCalendar} label="Reg. Expiration" value={fmtDate(v.registrationExpiration)} />
                <InfoRow icon={IconClock} label="Created" value={fmtDateTime(v.createdAt)} />
                <InfoRow icon={IconClock} label="Last Updated" value={fmtDateTime(v.updatedAt)} />
            </GlassCard>

            {/* Notes & Info */}
            {(v.notes || v.info) && (
                <GlassCard className="p-5 lg:col-span-3">
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
    );
}

/* ────────────────────────────────────────────────────
   TAB: Repairs
   ──────────────────────────────────────────────────── */
function RepairsTab({ repairs }: { repairs: any[] }) {
    if (!repairs?.length) return <NoData label="repair" />;
    return (
        <GlassCard className="p-4">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border">
                            {["Description", "Status", "Unit #", "VIN", "Est. Date", "Duration", "Created", "Last Edit"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {repairs.map((r: any) => (
                            <tr key={r._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                <td className="px-3 py-2.5 text-xs text-foreground max-w-[250px] truncate" title={r.description}>{r.description || "—"}</td>
                                <td className="px-3 py-2.5"><StatusBadge status={r.currentStatus} /></td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.unitNumber || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{r.vin || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.estimatedDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.repairDuration ? `${r.repairDuration}d` : "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.creationDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.lastEditOn)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}

/* ────────────────────────────────────────────────────
   TAB: Inspections
   ──────────────────────────────────────────────────── */
function InspectionsTab({ inspections }: { inspections: any[] }) {
    if (!inspections?.length) return <NoData label="inspection" />;
    return (
        <GlassCard className="p-4">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border">
                            {["Type", "Result", "Date", "Inspector", "Mileage", "Defects", "Notes"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {inspections.map((i: any) => (
                            <tr key={i._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                <td className="px-3 py-2.5 text-xs text-foreground font-medium">{i.inspectionType || "—"}</td>
                                <td className="px-3 py-2.5"><StatusBadge status={i.overallResult} /></td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(i.inspectionDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{i.inspectorName || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{i.mileage ? i.mileage.toLocaleString() : "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={i.defectsFound}>{i.defectsFound || "None"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={i.notes}>{i.notes || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
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
function RentalsTab({ rentals }: { rentals: any[] }) {
    if (!rentals?.length) return <NoData label="rental agreement" />;
    return (
        <GlassCard className="p-4">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border">
                            {["Agreement #", "Invoice #", "Amount", "Start Date", "End Date", "Due Date", "Created"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rentals.map((r: any) => (
                            <tr key={r._id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                <td className="px-3 py-2.5 text-xs text-foreground font-medium">{r.agreementNumber || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.invoiceNumber || "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-foreground font-medium">{r.amount ? `$${r.amount.toLocaleString()}` : "—"}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.registrationStartDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.registrationEndDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}
