"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Pencil, X, Trash2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { useAddRef } from "../_components/add-ref-context";
import { cn } from "@/lib/utils";

interface TaskRow {
    _id?: string;
    title: string;
    description: string;
    requiresPhoto: boolean;
    isActive: boolean;
    sortOrder: number;
    isNew?: boolean;
    isEditing?: boolean;
}

export default function EndOfDayTasksPage() {
    const { addRef } = useAddRef();
    const [rows, setRows] = useState<TaskRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const fetchRows = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/settings/end-of-day-tasks");
            const data = await res.json();
            const templates = Array.isArray(data) ? data : data.templates || [];
            setRows(templates.map((r: any) => ({ ...r, isEditing: false, isNew: false })));
        } catch {
            notify.error("Failed to load end-of-day tasks");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, {
            title: "",
            description: "",
            requiresPhoto: false,
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
        if (!row.title.trim()) { notify.error("Title is required"); return; }

        setSaving(row._id || `new-${idx}`);
        try {
            const res = await fetch("/api/admin/settings/end-of-day-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    _id: row._id,
                    title: row.title,
                    description: row.description,
                    requiresPhoto: row.requiresPhoto,
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
            await fetch(`/api/admin/settings/end-of-day-tasks?id=${row._id}`, { method: "DELETE" });
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
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {rows.length} End-of-Day Task{rows.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                    Shown to every driver on the mobile app as a checklist once their route work is done.
                </span>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[220px]">Title</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Description</th>
                            <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[100px]">Photo</th>
                            <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[80px]">Active</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-8">No end-of-day tasks configured. Click &quot;Add Task&quot; to get started.</td></tr>
                        )}
                        {rows.map((row, idx) => {
                            const isSaving = saving === (row._id || `new-${idx}`);
                            return (
                                <tr key={row._id || `new-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={row.title}
                                            onChange={(e) => updateField(idx, "title", e.target.value)}
                                            placeholder="e.g. Photo of van interior..."
                                            className="h-8 text-sm"
                                            disabled={!row.isEditing && !row.isNew}
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={row.description || ""}
                                            onChange={(e) => updateField(idx, "description", e.target.value)}
                                            placeholder="Optional detail shown under the title..."
                                            className="h-8 text-[11px]"
                                            disabled={!row.isEditing && !row.isNew}
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button
                                            className={cn(
                                                "w-6 h-6 rounded-md border transition-colors inline-flex items-center justify-center",
                                                row.requiresPhoto
                                                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                                                    : "bg-muted/50 border-border text-muted-foreground"
                                            )}
                                            title="Require a photo to complete this task"
                                            onClick={() => updateField(idx, "requiresPhoto", !row.requiresPhoto)}
                                        >
                                            <Camera className="h-3 w-3" />
                                        </button>
                                    </td>
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
