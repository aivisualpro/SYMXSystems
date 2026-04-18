"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Pencil, X, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAddRef } from "../layout";
import { IconPicker } from "../dropdowns/page";

interface RouteTypeRow {
    _id?: string;
    name: string;
    color: string;
    icon: string;
    startTime: string;
    theoryHrs: number;
    group: string;
    routeStatus: string;
    sortOrder: number;
    isActive: boolean;
    isNew?: boolean;
    isEditing?: boolean;
}

export default function DefaultRoutesPage() {
    const { addRef } = useAddRef();
    const [routes, setRoutes] = useState<RouteTypeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = routes.findIndex(r => (r._id || `new-${routes.indexOf(r)}`) === active.id);
            const newIndex = routes.findIndex(r => (r._id || `new-${routes.indexOf(r)}`) === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                const newRoutes = arrayMove(routes, oldIndex, newIndex);
                newRoutes.forEach((r, i) => { r.sortOrder = i; });
                setRoutes(newRoutes);
                
                try {
                    await fetch("/api/admin/settings/route-types", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newRoutes.map(r => ({ _id: r._id, sortOrder: r.sortOrder })))
                    });
                } catch {
                    toast.error("Failed to save reordering");
                }
            }
        }
    };

    const fetchRoutes = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/settings/route-types");
            const data = await res.json();
            setRoutes(data.map((r: any) => ({ ...r, isEditing: false, isNew: false })));
        } catch {
            toast.error("Failed to load route types");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

    const addRow = useCallback(() => {
        setRoutes(prev => [...prev, {
            name: "",
            color: "#6B7280",
            icon: "",
            startTime: "",
            theoryHrs: 0,
            group: "None",
            routeStatus: "Scheduled",
            sortOrder: prev.length,
            isActive: true,
            isNew: true,
            isEditing: true,
        }]);
    }, []);

    useEffect(() => { addRef.current = addRow; return () => { addRef.current = null; }; }, [addRow, addRef]);

    const updateField = (idx: number, field: string, value: any) => {
        setRoutes(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, isEditing: true } : r));
    };

    const saveRow = async (idx: number) => {
        const row = routes[idx];
        if (!row.name.trim()) { toast.error("Route type name is required"); return; }

        setSaving(row._id || `new-${idx}`);
        try {
            const res = await fetch("/api/admin/settings/route-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _id: row._id, name: row.name, color: row.color, icon: row.icon, startTime: row.startTime, theoryHrs: row.theoryHrs, group: row.group, routeStatus: row.routeStatus, sortOrder: row.sortOrder, isActive: row.isActive }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const saved = await res.json();
            setRoutes(prev => prev.map((r, i) => i === idx ? { ...saved, isEditing: false, isNew: false } : r));
            toast.success("Saved");
        } catch (err: any) { toast.error(err.message || "Failed to save"); }
        finally { setSaving(null); }
    };

    const deleteRow = async (idx: number) => {
        const row = routes[idx];
        if (row.isNew) { setRoutes(prev => prev.filter((_, i) => i !== idx)); return; }
        if (!row._id) return;
        setSaving(row._id);
        try {
            await fetch(`/api/admin/settings/route-types?id=${row._id}`, { method: "DELETE" });
            setRoutes(prev => prev.filter((_, i) => i !== idx));
            toast.success("Deleted");
        } catch { toast.error("Failed to delete"); }
        finally { setSaving(null); }
    };

    const cancelEdit = (idx: number) => {
        const row = routes[idx];
        if (row.isNew) { setRoutes(prev => prev.filter((_, i) => i !== idx)); }
        else { fetchRoutes(); }
    };

    const moveRow = async (idx: number, direction: "up" | "down") => {
        if (direction === "up" && idx === 0) return;
        if (direction === "down" && idx === routes.length - 1) return;
        
        const newRoutes = [...routes];
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        
        const temp = newRoutes[idx];
        newRoutes[idx] = newRoutes[targetIdx];
        newRoutes[targetIdx] = temp;
        
        newRoutes.forEach((r, i) => { r.sortOrder = i; });
        setRoutes(newRoutes);
        
        try {
            await fetch("/api/admin/settings/route-types", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newRoutes.map(r => ({ _id: r._id, sortOrder: r.sortOrder })))
            });
        } catch {
            toast.error("Failed to reorder");
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            {isMounted ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}>
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Route Type</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Route Status</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Start Time</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Theory Hrs</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Group</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Color</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Icon</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routes.length === 0 && (
                                <tr><td colSpan={6} className="text-center text-sm text-muted-foreground py-8">No route types configured. Click &quot;Add Route Type&quot; to get started.</td></tr>
                            )}
                            <SortableContext items={routes.map((r, i) => r._id || `new-${i}`)} strategy={verticalListSortingStrategy}>
                                {routes.map((route, idx) => (
                                    <SortableRouteRow 
                                        key={route._id || `new-${idx}`}
                                        route={route}
                                        idx={idx}
                                        totalCount={routes.length}
                                        saving={saving}
                                        updateField={updateField}
                                        saveRow={saveRow}
                                        cancelEdit={cancelEdit}
                                        deleteRow={deleteRow}
                                        moveRow={moveRow}
                                    />
                                ))}
                            </SortableContext>
                        </tbody>
                    </table>
                </div>
                </DndContext>
            ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Route Type</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Route Status</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Start Time</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Theory Hrs</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Group</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Color</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Icon</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routes.map((route, idx) => (
                                <SortableRouteRow 
                                    key={route._id || `new-${idx}`}
                                    route={route}
                                    idx={idx}
                                    totalCount={routes.length}
                                    saving={saving}
                                    updateField={updateField}
                                    saveRow={saveRow}
                                    cancelEdit={cancelEdit}
                                    deleteRow={deleteRow}
                                    moveRow={moveRow}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function SortableRouteRow({ route, idx, totalCount, saving, updateField, saveRow, cancelEdit, deleteRow, moveRow }: any) {
    const isSaving = saving === (route._id || `new-${idx}`);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: route._id || `new-${idx}`,
        disabled: route.isEditing || !route._id
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: "relative" as const, zIndex: 50, opacity: 0.9, backgroundColor: 'hsl(var(--muted)/0.9)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' } : {})
    };

    return (
        <tr ref={setNodeRef} style={style} className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${isDragging ? 'shadow-2xl' : ''}`}>
            <td className="px-4 py-2 w-20 border-r border-border/10 cursor-default">
                <div className="flex items-center gap-2">
                    <span className="w-4 tabular-nums text-right text-xs text-muted-foreground font-medium">{idx + 1}</span>
                    {!route.isEditing && !!route._id && (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:bg-black/10 dark:hover:bg-white/10 p-1.5 rounded-md transition-colors text-muted-foreground/60 hover:text-foreground flex items-center justify-center -ml-1">
                            <GripVertical className="h-4 w-4" />
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-2"><Input value={route.name || ""} onChange={(e) => updateField(idx, "name", e.target.value)} placeholder="e.g. Route, Open, Close..." className="h-8 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-4 py-2"><Input value={route.routeStatus || ""} onChange={(e) => updateField(idx, "routeStatus", e.target.value)} placeholder="e.g. Scheduled, Off..." className="h-8 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-4 py-2"><Input value={route.startTime || ""} onChange={(e) => updateField(idx, "startTime", e.target.value)} placeholder="e.g. 06:00 AM" className="h-8 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-4 py-2"><Input type="number" min="0" step="0.1" value={route.theoryHrs ?? ""} onChange={(e) => updateField(idx, "theoryHrs", parseFloat(e.target.value) || 0)} className="h-8 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-4 py-2">
                <select 
                    value={route.group || "None"} 
                    onChange={(e) => updateField(idx, "group", e.target.value)}
                    disabled={!route.isEditing && !route.isNew}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="None">None</option>
                    <option value="Driver">Driver</option>
                    <option value="Operations">Operations</option>
                </select>
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                    <input type="color" value={route.color || "#6B7280"} onChange={(e) => updateField(idx, "color", e.target.value)} className="h-8 w-8 rounded cursor-pointer border border-border bg-transparent" disabled={!route.isEditing && !route.isNew} />
                    <Input value={route.color || ""} onChange={(e) => updateField(idx, "color", e.target.value)} className="h-8 text-xs font-mono w-[80px]" placeholder="#HEX" disabled={!route.isEditing && !route.isNew} />
                </div>
            </td>
            <td className="px-4 py-2">
                <IconPicker value={route.icon || ""} onChange={(v) => updateField(idx, "icon", v)} disabled={!route.isEditing && !route.isNew} />
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center justify-end gap-1">
                    {route.isEditing && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => saveRow(idx)} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => cancelEdit(idx)} disabled={isSaving}><X className="h-3.5 w-3.5" /></Button>
                        </>
                    )}
                    {!route.isEditing && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => moveRow(idx, "up")} disabled={idx === 0 || isSaving}><ArrowUp className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => moveRow(idx, "down")} disabled={idx === totalCount - 1 || isSaving}><ArrowDown className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => updateField(idx, "isEditing", true)}><Pencil className="h-3.5 w-3.5" /></Button>
                        </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => deleteRow(idx)} disabled={isSaving}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
            </td>
        </tr>
    );
}
 
