"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatching } from "../layout";
import { cn } from "@/lib/utils";
import {
    Users,
    Loader2,
    ChevronUp,
    ChevronDown,
    Pencil,
    Check,
    X,
    DoorClosed,
    ClipboardCheck,
    ExternalLink,
    CheckCircle2,
    AlertTriangle,
    XCircle,
} from "lucide-react";
import {
    TooltipProvider,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ── Column Definitions ──
const COLUMNS = [
    { key: "weekDay", label: "Date", width: "w-[110px]" },
    { key: "employee", label: "Employee", width: "flex-1 min-w-[180px]" },
    { key: "van", label: "Van", width: "w-[100px]" },
    { key: "inspection", label: "Inspection", width: "w-[140px]" },
] as const;

const GRID_TEMPLATE = "110px 1fr 100px 140px";

const EDITABLE_FIELDS = new Set(["van"]);

const SHORT_DAYS: Record<string, string> = {
    Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

// ── Inspection form styles ──
const inputClass = "w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

interface RouteRow {
    _id: string;
    transporterId: string;
    date: string;
    weekDay: string;
    employeeName: string;
    van: string;
}

type SortKey = "weekDay" | "employee" | "van" | "inspection";

// ── Inspection Form Modal ──
function InspectionFormModal({
    open,
    onClose,
    prefill,
}: {
    open: boolean;
    onClose: () => void;
    prefill: { van: string; driver: string; driverName: string; date: string };
}) {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        unitNumber: "",
        inspectorName: "",
        inspectionType: "Post-Trip",
        overallResult: "Pass",
        inspectionDate: "",
        mileage: "",
        defectsFound: "",
        notes: "",
    });

    // Reset form when opening
    useEffect(() => {
        if (open) {
            setForm({
                unitNumber: prefill.van || "",
                inspectorName: "",
                inspectionType: "Post-Trip",
                overallResult: "Pass",
                inspectionDate: prefill.date?.split("T")[0] || new Date().toISOString().split("T")[0],
                mileage: "",
                defectsFound: "",
                notes: "",
            });
        }
    }, [open, prefill]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/fleet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "inspection",
                    data: {
                        unitNumber: form.unitNumber,
                        inspectorName: form.inspectorName,
                        inspectionType: form.inspectionType,
                        overallResult: form.overallResult,
                        inspectionDate: form.inspectionDate,
                        mileage: parseInt(form.mileage) || 0,
                        defectsFound: form.defectsFound,
                        notes: form.notes,
                        driver: prefill.driver,
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create inspection");
            toast.success("Inspection created successfully");
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to create inspection");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                            New Inspection
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {prefill.driverName} — Van {prefill.van || "N/A"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Unit Number / Van</label>
                                <input className={inputClass} value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} placeholder="Van #" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Inspector Name</label>
                                <input className={inputClass} value={form.inspectorName} onChange={e => setForm(f => ({ ...f, inspectorName: e.target.value }))} placeholder="Inspector" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Type</label>
                                <select className={inputClass} value={form.inspectionType} onChange={e => setForm(f => ({ ...f, inspectionType: e.target.value }))}>
                                    {["Pre-Trip", "Post-Trip", "Monthly", "Annual", "DOT", "Safety"].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Result</label>
                                <div className="flex gap-1.5">
                                    {[
                                        { val: "Pass", icon: CheckCircle2, color: "text-emerald-500 border-emerald-500/50 bg-emerald-500/10" },
                                        { val: "Needs Attention", icon: AlertTriangle, color: "text-amber-500 border-amber-500/50 bg-amber-500/10" },
                                        { val: "Fail", icon: XCircle, color: "text-red-500 border-red-500/50 bg-red-500/10" },
                                    ].map(opt => {
                                        const Icon = opt.icon;
                                        const isActive = form.overallResult === opt.val;
                                        return (
                                            <button
                                                type="button"
                                                key={opt.val}
                                                onClick={() => setForm(f => ({ ...f, overallResult: opt.val }))}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border text-[11px] font-semibold transition-all",
                                                    isActive ? opt.color : "text-muted-foreground border-border bg-muted/30 hover:bg-muted/50"
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                                {opt.val === "Needs Attention" ? "Warn" : opt.val}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Date</label>
                                <input type="date" className={inputClass} value={form.inspectionDate} onChange={e => setForm(f => ({ ...f, inspectionDate: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Mileage</label>
                                <input type="number" className={inputClass} value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} placeholder="0" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Defects Found</label>
                            <textarea className={inputClass} rows={2} value={form.defectsFound} onChange={e => setForm(f => ({ ...f, defectsFound: e.target.value }))} placeholder="Describe any defects..." />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Notes</label>
                            <textarea className={inputClass} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50">
                            {saving && <Loader2 size={14} className="animate-spin" />} Create Inspection
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Closing Page ──
export default function ClosingPage() {
    const { selectedWeek, selectedDate, searchQuery, routesGenerated, routesLoading, setStats } = useDispatching();

    const [allRoutes, setAllRoutes] = useState<RouteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("employee");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");

    // ── Inspection modal state ──
    const [inspectionModal, setInspectionModal] = useState(false);
    const [inspectionPrefill, setInspectionPrefill] = useState({ van: "", driver: "", driverName: "", date: "" });

    // ── Fetch routes ──
    useEffect(() => {
        if (!selectedWeek) return;
        let cancelled = false;
        setLoading(true);

        fetch(`/api/dispatching/routes?yearWeek=${encodeURIComponent(selectedWeek)}`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (!data.routes || data.routes.length === 0) { setAllRoutes([]); return; }

                const rows: RouteRow[] = data.routes.map((rec: any) => {
                    const emp = data.employees?.[rec.transporterId];
                    return {
                        _id: rec._id,
                        transporterId: rec.transporterId,
                        date: rec.date,
                        weekDay: rec.weekDay || "",
                        employeeName: emp?.name || rec.transporterId,
                        van: rec.van || "",
                    };
                });
                setAllRoutes(rows);
            })
            .catch(() => setAllRoutes([]))
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [selectedWeek, routesGenerated]);

    // ── Save ──
    const handleSave = useCallback(async (routeId: string, field: string, value: string) => {
        setAllRoutes(prev => prev.map(r => r._id === routeId ? { ...r, [field]: value } : r));
        setEditingCell(null);
        try {
            const res = await fetch("/api/dispatching/routes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routeId, updates: { [field]: value } }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            toast.success(`Updated ${field}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update");
        }
    }, []);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const formatDateColumn = (dateStr: string, weekDay: string) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const yy = String(d.getUTCFullYear()).slice(-2);
        const day = weekDay ? (SHORT_DAYS[weekDay] || weekDay.slice(0, 3)) : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
        return `${mm}/${dd}/${yy} ${day}`;
    };

    // ── Filter + sort ──
    const { rows: displayRows, totalFiltered, totalForDate } = useMemo(() => {
        let dateFiltered = allRoutes;
        if (selectedDate) dateFiltered = allRoutes.filter(r => r.date?.split("T")[0] === selectedDate);
        const totalForDate = dateFiltered.length;

        let filtered = dateFiltered;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = dateFiltered.filter(r =>
                r.employeeName.toLowerCase().includes(q) ||
                r.transporterId.toLowerCase().includes(q) ||
                r.van.toLowerCase().includes(q)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            const aVal = sortKey === "employee" ? a.employeeName : (a as any)[sortKey] || "";
            const bVal = sortKey === "employee" ? b.employeeName : (b as any)[sortKey] || "";
            return sortDir === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        });

        return { rows: sorted, totalFiltered: sorted.length, totalForDate };
    }, [allRoutes, selectedDate, searchQuery, sortKey, sortDir]);

    // ── Stats ──
    useEffect(() => { setStats({ employeeCount: totalFiltered }); }, [totalFiltered, setStats]);
    useEffect(() => { return () => setStats({}); }, [setStats]);

    // ── Loading / Empty ──
    if (routesLoading || loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!routesGenerated || allRoutes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse bg-gradient-to-br from-indigo-500 to-blue-500" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500">
                        <DoorClosed className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Closing</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {!routesGenerated
                        ? "No routes generated for this week yet. Click \"Generate Routes\" in the header to create route records from the schedule."
                        : "No route data available for this week."}
                </p>
                <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold", "bg-muted/50 border border-border text-muted-foreground")}>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Click &quot;Generate Routes&quot; to get started
                </div>
            </div>
        );
    }

    // ── Cell renderer ──
    const renderCell = (row: RouteRow, field: string, value: any) => {
        const isEditing = editingCell?.rowId === row._id && editingCell?.field === field;
        const isEditable = EDITABLE_FIELDS.has(field);
        const displayVal = value === 0 || value === "" ? "—" : String(value);

        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(row._id, field, editValue); if (e.key === "Escape") setEditingCell(null); }}
                        className="h-6 text-xs px-1.5 w-full" />
                    <button onClick={() => handleSave(row._id, field, editValue)} className="text-emerald-500 hover:text-emerald-400 shrink-0"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingCell(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                </div>
            );
        }

        if (isEditable) {
            return (
                <button onClick={() => { setEditingCell({ rowId: row._id, field }); setEditValue(value === 0 ? "" : String(value)); }}
                    className="group/cell flex items-center gap-1 text-left w-full">
                    <span className={cn("text-[11px] truncate", displayVal === "—" ? "text-muted-foreground/40" : "text-foreground")}>{displayVal}</span>
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/cell:text-muted-foreground/60 transition-opacity shrink-0" />
                </button>
            );
        }

        return <span className={cn("text-[11px] truncate", displayVal === "—" ? "text-muted-foreground/40" : "text-foreground")}>{displayVal}</span>;
    };

    // ── Inspection button ──
    const renderInspectionButton = (row: RouteRow) => {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => {
                            setInspectionPrefill({
                                van: row.van,
                                driver: row.transporterId,
                                driverName: row.employeeName,
                                date: row.date,
                            });
                            setInspectionModal(true);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all border cursor-pointer select-none",
                            "bg-indigo-500/15 text-indigo-500 border-indigo-500/30",
                            "hover:bg-indigo-500/25 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <ClipboardCheck className="h-3 w-3 shrink-0" />
                        <span>Inspect</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    Create inspection for {row.van || "this vehicle"}
                </TooltipContent>
            </Tooltip>
        );
    };

    // ── Table ──
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="grid items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-muted/30"
                        style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                        {COLUMNS.map((col) => (
                            <button key={col.key} onClick={() => handleSort(col.key)}
                                className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors text-left">
                                {col.label}
                                {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                            </button>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-auto">
                        {displayRows.map((row) => (
                            <div key={row._id} className="grid items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 transition-colors"
                                style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                                <span className="text-[11px] font-medium text-foreground">{formatDateColumn(row.date, row.weekDay)}</span>
                                <div className="flex items-center gap-2 min-w-0"><span className="text-xs font-semibold truncate">{row.employeeName}</span></div>
                                {renderCell(row, "van", row.van)}
                                {renderInspectionButton(row)}
                            </div>
                        ))}

                        {displayRows.length === 0 && (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                No employees found for this date
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-2.5 border-t border-border/50 bg-muted/20">
                        <span className="text-[11px] text-muted-foreground">{totalFiltered} of {totalForDate} employees</span>
                    </div>
                </div>
            </div>

            {/* Inspection Form Modal */}
            <InspectionFormModal
                open={inspectionModal}
                onClose={() => setInspectionModal(false)}
                prefill={inspectionPrefill}
            />
        </TooltipProvider>
    );
}
