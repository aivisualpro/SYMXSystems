"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Save, Pencil, X, Trash2, ListFilter, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAddRef } from "../layout";
import { cn } from "@/lib/utils";

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
    const [selectedType, setSelectedType] = useState<string>("all");

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
            type: selectedType !== "all" ? selectedType : "",
            isActive: true,
            sortOrder: prev.length,
            isNew: true,
            isEditing: true,
        }]);
    }, [selectedType]);

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

    // Get unique types for the sidebar
    const types = useMemo(() => {
        const typeSet = new Set<string>();
        rows.forEach(r => { if (r.type) typeSet.add(r.type); });
        return [...typeSet].sort();
    }, [rows]);

    // Filtered rows based on selected type
    const filteredRows = useMemo(() => {
        if (selectedType === "all") return rows;
        return rows.filter(r => r.type === selectedType);
    }, [rows, selectedType]);

    // Global row index lookup (for save/delete which use original array index)
    const getGlobalIndex = (filteredIdx: number) => {
        const row = filteredRows[filteredIdx];
        return rows.indexOf(row);
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex gap-4 min-h-[400px]">
            {/* ── Sub-sidebar: Type filter ── */}
            <div className="w-[180px] shrink-0 border border-border/50 rounded-lg bg-card/50 overflow-hidden flex flex-col">
                <div className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <ListFilter className="h-3 w-3" />
                        Types
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {/* All option */}
                    <button
                        onClick={() => setSelectedType("all")}
                        className={cn(
                            "flex items-center justify-between w-full px-3 py-2 text-[12px] font-medium transition-colors border-b border-border/20",
                            selectedType === "all"
                                ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-l-2 border-l-transparent"
                        )}
                    >
                        <span>All</span>
                        <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                            selectedType === "all"
                                ? "bg-primary/20 text-primary"
                                : "bg-muted/50 text-muted-foreground"
                        )}>
                            {rows.length}
                        </span>
                    </button>

                    {/* Type items */}
                    {types.map(t => {
                        const count = rows.filter(r => r.type === t).length;
                        const isActive = selectedType === t;
                        return (
                            <button
                                key={t}
                                onClick={() => setSelectedType(t)}
                                className={cn(
                                    "flex items-center justify-between w-full px-3 py-2 text-[12px] font-medium transition-colors border-b border-border/20",
                                    isActive
                                        ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-l-2 border-l-transparent"
                                )}
                            >
                                <span className="flex items-center gap-1.5 truncate">
                                    <Tag className="h-3 w-3 shrink-0" />
                                    <span className="truncate capitalize">{t}</span>
                                </span>
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0",
                                    isActive
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted/50 text-muted-foreground"
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}

                    {types.length === 0 && (
                        <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                            No types yet
                        </div>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 min-w-0">
                {/* Active filter badge */}
                {selectedType !== "all" && (
                    <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Showing:</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Tag className="h-3 w-3" />
                            {selectedType}
                            <button
                                onClick={() => setSelectedType("all")}
                                className="ml-1 hover:text-primary/70 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                )}

                <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Description</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[180px]">Type</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[80px]">Active</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                                    {selectedType === "all"
                                        ? 'No dropdown options configured. Click "Add Option" to get started.'
                                        : `No options for type "${selectedType}".`
                                    }
                                </td></tr>
                            )}
                            {filteredRows.map((row, filteredIdx) => {
                                const globalIdx = getGlobalIndex(filteredIdx);
                                const isSaving = saving === (row._id || `new-${globalIdx}`);
                                return (
                                    <tr key={row._id || `new-${globalIdx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-2 text-xs text-muted-foreground">{filteredIdx + 1}</td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={row.description}
                                                onChange={(e) => updateField(globalIdx, "description", e.target.value)}
                                                placeholder="e.g. Pre-Trip, Post-Trip..."
                                                className="h-8 text-sm"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={row.type}
                                                onChange={(e) => updateField(globalIdx, "type", e.target.value)}
                                                placeholder="e.g. inspection"
                                                className="h-8 text-sm font-mono"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                className={cn(
                                                    "w-5 h-5 rounded-md border transition-colors inline-flex items-center justify-center",
                                                    row.isActive
                                                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                        : "bg-muted/50 border-border text-muted-foreground"
                                                )}
                                                onClick={() => updateField(globalIdx, "isActive", !row.isActive)}
                                            >
                                                {row.isActive && <span className="text-[10px] font-bold">✓</span>}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center justify-end gap-1">
                                                {row.isEditing && (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => saveRow(globalIdx)} disabled={isSaving}>
                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => cancelEdit(globalIdx)} disabled={isSaving}><X className="h-3.5 w-3.5" /></Button>
                                                    </>
                                                )}
                                                {!row.isEditing && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => updateField(globalIdx, "isEditing", true)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => deleteRow(globalIdx)} disabled={isSaving}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
