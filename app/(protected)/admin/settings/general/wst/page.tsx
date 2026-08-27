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
    /** Rate for a route scheduled 1–8 hours. */
    standard: number;
    /** Rate for a route scheduled over 8 hours. */
    over8: number;
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

/** One tier of this option's rate at a station, or null when unset. */
function rateAt(row: WSTRow, siteId: string, tier: "standard" | "over8"): number | null {
    const hit = (row.rates || []).find((r) => String(r.siteId) === String(siteId));
    if (!hit) return null;
    const v = hit[tier];
    return typeof v === "number" ? v : null;
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

    /** Set one tier of one station's rate, leaving every other value alone. */
    const setStationRate = (
        idx: number,
        siteId: string,
        tier: "standard" | "over8",
        raw: string
    ) => {
        setRows(prev => prev.map((r, i) => {
            if (i !== idx) return r;
            const rates = [...(r.rates || [])];
            const at = rates.findIndex((x) => String(x.siteId) === String(siteId));
            const value = raw === "" ? 0 : parseFloat(raw) || 0;

            if (at === -1) {
                rates.push({ siteId, standard: 0, over8: 0, [tier]: value } as StationRate);
            } else {
                rates[at] = { ...rates[at], [tier]: value };
                // Both tiers cleared means this station has no rate at all —
                // drop the entry rather than storing a pair of zeros, which
                // would price the work at nothing rather than falling back.
                if (!rates[at].standard && !rates[at].over8) rates.splice(at, 1);
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
                        {stations.length} station{stations.length === 1 ? "" : "s"} × 2 rate tiers
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
                            {stations.map((st) => (
                                <th
                                    key={st.id}
                                    colSpan={2}
                                    title={st.name}
                                    className="text-center text-xs font-semibold text-muted-foreground px-3 py-1.5 w-[200px] border-l border-border/50"
                                >
                                    <div>{st.code}</div>
                                    <div className="flex gap-2 mt-1 font-normal text-[10px] text-muted-foreground/70">
                                        <span className="flex-1 text-right">1–8 hrs</span>
                                        <span className="flex-1 text-right">Over 8</span>
                                    </div>
                                </th>
                            ))}
                            <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[80px]">Active</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={5 + stations.length * 2} className="text-center text-sm text-muted-foreground py-8">No WST options configured. Click &quot;Add WST&quot; to get started.</td></tr>
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
                                    {stations.flatMap((st) =>
                                        (["standard", "over8"] as const).map((tier) => {
                                            const own = rateAt(row, st.id, tier);
                                            return (
                                                <td
                                                    key={`${st.id}-${tier}`}
                                                    className={cn(
                                                        "px-2 py-2",
                                                        tier === "standard" && "border-l border-border/50"
                                                    )}
                                                >
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={own || ""}
                                                        onChange={(e) => setStationRate(idx, st.id, tier, e.target.value)}
                                                        placeholder="0.00"
                                                        title={
                                                            tier === "standard"
                                                                ? `${st.code}: routes scheduled 1–8 hours`
                                                                : `${st.code}: routes scheduled over 8 hours — every hour bills at this rate`
                                                        }
                                                        className={cn(
                                                            "h-8 text-sm text-right font-mono",
                                                            !own && "text-muted-foreground/50"
                                                        )}
                                                        disabled={!row.isEditing && !row.isNew}
                                                    />
                                                </td>
                                            );
                                        })
                                    )}
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
