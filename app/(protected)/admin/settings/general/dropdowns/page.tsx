"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAddRef } from "../layout";

interface DropdownRow {
    _id?: string;
    description: string;
    type: string;
    isActive: boolean;
    sortOrder: number;
    isNew?: boolean;
    isEditing?: boolean;
}

export default function DropdownsPage() {
    const { addRef } = useAddRef();
    const [rows, setRows] = useState<DropdownRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const fetchRows = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/settings/dropdowns");
            const data = await res.json();
            setRows(data.map((r: any) => ({ ...r, isEditing: false, isNew: false })));
        } catch {
            toast.error("Failed to load dropdown options");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, {
            description: "",
            type: "",
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

    const saveRow = async (idx: number) => {
        const row = rows[idx];
        if (!row.description.trim()) { toast.error("Description is required"); return; }
        if (!row.type.trim()) { toast.error("Type is required"); return; }

        setSaving(row._id || `new-${idx}`);
        try {
            const res = await fetch("/api/admin/settings/dropdowns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _id: row._id, description: row.description, type: row.type, isActive: row.isActive, sortOrder: row.sortOrder }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const saved = await res.json();
            setRows(prev => prev.map((r, i) => i === idx ? { ...saved, isEditing: false, isNew: false } : r));
            toast.success("Saved");
        } catch (err: any) { toast.error(err.message || "Failed to save"); }
        finally { setSaving(null); }
    };

    const deleteRow = async (idx: number) => {
        const row = rows[idx];
        if (row.isNew) { setRows(prev => prev.filter((_, i) => i !== idx)); return; }
        if (!row._id) return;
        setSaving(row._id);
        try {
            await fetch(`/api/admin/settings/dropdowns?id=${row._id}`, { method: "DELETE" });
            setRows(prev => prev.filter((_, i) => i !== idx));
            toast.success("Deleted");
        } catch { toast.error("Failed to delete"); }
        finally { setSaving(null); }
    };

    const cancelEdit = (idx: number) => {
        const row = rows[idx];
        if (row.isNew) { setRows(prev => prev.filter((_, i) => i !== idx)); }
        else { fetchRows(); }
    };

    const types = [...new Set(rows.map(r => r.type).filter(Boolean))];

    if (loading) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            {types.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Types:</span>
                    {types.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {t} ({rows.filter(r => r.type === t).length})
                        </span>
                    ))}
                </div>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Description</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[180px]">Type</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={4} className="text-center text-sm text-muted-foreground py-8">No dropdown options configured. Click &quot;Add Option&quot; to get started.</td></tr>
                        )}
                        {rows.map((row, idx) => {
                            const isSaving = saving === (row._id || `new-${idx}`);
                            return (
                                <tr key={row._id || `new-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                                    <td className="px-4 py-2"><Input value={row.description} onChange={(e) => updateField(idx, "description", e.target.value)} placeholder="e.g. Pre-Trip, Post-Trip..." className="h-8 text-sm" /></td>
                                    <td className="px-4 py-2"><Input value={row.type} onChange={(e) => updateField(idx, "type", e.target.value)} placeholder="e.g. inspection" className="h-8 text-sm font-mono" /></td>
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
