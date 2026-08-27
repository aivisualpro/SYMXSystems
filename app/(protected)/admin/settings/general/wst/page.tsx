"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Pencil, X, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { useAddRef } from "../_components/add-ref-context";
import { cn } from "@/lib/utils";

interface StationRate {
    siteId: string;
    revenue: number;
}

interface Station {
    id: string;
    code: string;
    name: string;
}

interface WSTRow {
    _id?: string;
    wst: string;
    /** Fallback rate, used by any station without one of its own. */
    revenue: number;
    /** Per-station rates. The selections are shared; only the price differs. */
    rates?: StationRate[];
    amazonServiceType: string;
    isActive: boolean;
    sortOrder: number;
    isNew?: boolean;
    isEditing?: boolean;
}

/** This option's rate at a station, or null when it has none of its own. */
function rateAt(row: WSTRow, siteId: string): number | null {
    const hit = (row.rates || []).find((r) => String(r.siteId) === String(siteId));
    return hit ? hit.revenue : null;
}

export default function WSTPage() {
    const { addRef } = useAddRef();
    const [rows, setRows] = useState<WSTRow[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const fetchRows = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/settings/wst");
            const data = await res.json();
            // The endpoint returns { options, stations }. Tolerate a bare
            // array too, so a stale cached response doesn't blank the page.
            const options = Array.isArray(data) ? data : data.options || [];
            setStations(Array.isArray(data) ? [] : data.stations || []);
            setRows(options.map((r: any) => ({ ...r, isEditing: false, isNew: false })));
        } catch {
            notify.error("Failed to load WST options");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, {
            rates: [],
            wst: "",
            revenue: 0,
            amazonServiceType: "",
            isActive: true,
            sortOrder: prev.length,
            isNew: true,
            isEditing: true,
        }]);
    }, []);

    useEffect(() => { addRef.current = addRow; return () => { addRef.current = null; }; }, [addRow, addRef]);

    const updateField = (idx: number, field: string, value: any) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, isEditing: true } : r));
    };

    /** Set (or clear) one station's rate without touching the others. */
    const setStationRate = (idx: number, siteId: string, raw: string) => {
        setRows(prev => prev.map((r, i) => {
            if (i !== idx) return r;
            const rates = [...(r.rates || [])];
            const at = rates.findIndex((x) => String(x.siteId) === String(siteId));
            if (raw === "") {
                // Cleared means "no rate of its own" — fall back to the
                // default rather than storing a zero, which would silently
                // price the work at nothing.
                if (at !== -1) rates.splice(at, 1);
            } else {
                const revenue = parseFloat(raw) || 0;
                if (at === -1) rates.push({ siteId, revenue });
                else rates[at] = { siteId, revenue };
            }
            return { ...r, rates, isEditing: true };
        }));
    };

    const saveRow = async (idx: number) => {
        const row = rows[idx];
        if (!row.wst.trim()) { notify.error("WST is required"); return; }

        setSaving(row._id || `new-${idx}`);
        try {
            const res = await fetch("/api/admin/settings/wst", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    _id: row._id,
                    wst: row.wst,
                    revenue: row.revenue,
                    rates: row.rates || [],
                    amazonServiceType: row.amazonServiceType,
                    isActive: row.isActive,
                    sortOrder: row.sortOrder,
                }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const saved = await res.json();
            setRows(prev => prev.map((r, i) => i === idx ? { ...saved, isEditing: false, isNew: false } : r));
            notify.success("Saved");
        } catch (err: any) { notify.error(err.message || "Failed to save"); }
        finally { setSaving(null); }
    };

    const deleteRow = async (idx: number) => {
        const row = rows[idx];
        if (row.isNew) { setRows(prev => prev.filter((_, i) => i !== idx)); return; }
        if (!row._id) return;
        setSaving(row._id);
        try {
            await fetch(`/api/admin/settings/wst?id=${row._id}`, { method: "DELETE" });
            setRows(prev => prev.filter((_, i) => i !== idx));
            notify.success("Deleted");
        } catch { notify.error("Failed to delete"); }
        finally { setSaving(null); }
    };

    const cancelEdit = (idx: number) => {
        const row = rows[idx];
        if (row.isNew) { setRows(prev => prev.filter((_, i) => i !== idx)); }
        else { fetchRows(); }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {rows.length} WST Option{rows.length !== 1 ? "s" : ""}
                </span>
                {rows.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <DollarSign className="h-3 w-3" />
                        Avg Revenue: ${(rows.reduce((sum, r) => sum + (r.revenue || 0), 0) / rows.length).toFixed(2)}
                    </span>
                )}
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[200px]">WST</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[400px]">Amazon Service Type</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[150px]">Revenue ($)</th>
                            {stations.map((st) => (
                                <th
                                    key={st.id}
                                    title={`${st.name} — leave blank to use the default rate`}
                                    className="text-right text-xs font-semibold text-muted-foreground px-3 py-2.5 w-[110px]"
                                >
                                    {st.code}
                                </th>
                            ))}
                            <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[80px]">Active</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={6 + stations.length} className="text-center text-sm text-muted-foreground py-8">No WST options configured. Click &quot;Add WST&quot; to get started.</td></tr>
                        )}
                        {rows.map((row, idx) => {
                            const isSaving = saving === (row._id || `new-${idx}`);
                            return (
                                <tr key={row._id || `new-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={row.wst}
                                            onChange={(e) => updateField(idx, "wst", e.target.value)}
                                            placeholder="e.g. WST-A, WST-B..."
                                            className="h-8 text-sm"
                                            disabled={!row.isEditing && !row.isNew}
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={row.amazonServiceType || ""}
                                            onChange={(e) => updateField(idx, "amazonServiceType", e.target.value)}
                                            placeholder="e.g. Standard Parcel - Large Van..."
                                            className="h-8 text-[11px]"
                                            disabled={!row.isEditing && !row.isNew}
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={row.revenue || ""}
                                                onChange={(e) => updateField(idx, "revenue", parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                className="h-8 text-sm pl-7 font-mono"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </div>
                                    </td>
                                    {stations.map((st) => {
                                        const own = rateAt(row, st.id);
                                        return (
                                            <td key={st.id} className="px-3 py-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={own === null ? "" : own}
                                                    onChange={(e) => setStationRate(idx, st.id, e.target.value)}
                                                    // Placeholder shows the rate this station would
                                                    // actually use, so a blank cell reads as
                                                    // "inherits 38.70" rather than as missing data.
                                                    placeholder={row.revenue ? String(row.revenue) : "0.00"}
                                                    className={cn(
                                                        "h-8 text-sm text-right font-mono",
                                                        own === null && "text-muted-foreground/60 italic"
                                                    )}
                                                    disabled={!row.isEditing && !row.isNew}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-2 text-center">
                                        <button
                                            className={cn(
                                                "w-5 h-5 rounded-md border transition-colors",
                                                row.isActive
                                                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                    : "bg-muted/50 border-border text-muted-foreground"
                                            )}
                                            onClick={() => updateField(idx, "isActive", !row.isActive)}
                                        >
                                            {row.isActive && <span className="text-[10px] font-bold">✓</span>}
                                        </button>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            {row.isEditing && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => saveRow(idx)} disabled={isSaving}>
                                                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => cancelEdit(idx)} disabled={isSaving}><X className="h-3.5 w-3.5" /></Button>
                                                </>
                                            )}
                                            {!row.isEditing && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => updateField(idx, "isEditing", true)}><Pencil className="h-3.5 w-3.5" /></Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => deleteRow(idx)} disabled={isSaving}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
