"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Save, Pencil, X, Trash2, GripVertical, ChevronDown, Check, Minus } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAddRef } from "../layout";
import { IconPicker } from "../dropdowns/page";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface RouteTypeRow {
    _id?: string;
    name: string;
    color: string;
    icon: string;
    startTime: string;
    theoryHrs: number;
    group: string;
    routeStatus: string;
    isDefault: boolean;
    partOf: string[];
    isDA: boolean;
    isOps: boolean;
    isStandby: boolean;
    sortOrder: number;
    isActive: boolean;
    isNew?: boolean;
    isEditing?: boolean;
}

const PART_OF_OPTIONS = ["Dispatching", "Shift", "Route Itinerary", "Week Schedule"];

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
            isDefault: false,
            partOf: [],
            isDA: false,
            isOps: false,
            isStandby: false,
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
                body: JSON.stringify({ _id: row._id, name: row.name, color: row.color, icon: row.icon, startTime: row.startTime, theoryHrs: row.theoryHrs, group: row.group, routeStatus: row.routeStatus, isDefault: row.isDefault, partOf: row.partOf, isDA: row.isDA, isOps: row.isOps, isStandby: row.isStandby, sortOrder: row.sortOrder, isActive: row.isActive }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const saved = await res.json();
            const schedulesUpdated = saved.schedulesUpdated || 0;
            delete saved.schedulesUpdated;
            setRoutes(prev => prev.map((r, i) => i === idx ? { ...saved, isEditing: false, isNew: false } : r));
            toast.success("Saved");
            if (schedulesUpdated > 0) {
                toast.info(`Updated start time for ${schedulesUpdated} schedule${schedulesUpdated === 1 ? '' : 's'} this week`);
            }
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
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[44px]">#</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[140px]">Route Type</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[200px]">Part Of</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2 w-[55px]">Default</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2 w-[40px]">DA</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2 w-[45px]">Ops</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2 w-[60px]">Standby</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[130px]">Route Status</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[120px]">Start Time</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[80px]">Theory Hrs</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[110px]">Group</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-2 py-2 w-[110px]">Color</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-2 py-2 w-[40px]">Icon</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-2 py-2 w-[80px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routes.length === 0 && (
                                <tr><td colSpan={14} className="text-center text-sm text-muted-foreground py-8">No route types configured. Click &quot;Add Route Type&quot; to get started.</td></tr>
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
            <td className="px-2 py-1.5 w-[44px] border-r border-border/10 cursor-default">
                <div className="flex items-center gap-1">
                    <span className="w-4 tabular-nums text-right text-xs text-muted-foreground font-medium">{idx + 1}</span>
                    {!route.isEditing && !!route._id && (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:bg-black/10 dark:hover:bg-white/10 p-1 rounded-md transition-colors text-muted-foreground/60 hover:text-foreground flex items-center justify-center">
                            <GripVertical className="h-3.5 w-3.5" />
                        </div>
                    )}
                </div>
            </td>
            <td className="px-2 py-1.5 w-[140px]"><Input value={route.name || ""} onChange={(e) => updateField(idx, "name", e.target.value)} placeholder="e.g. Route, Open, Close..." className="h-7 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            {/* Part Of multi-select dropdown */}
            <td className="px-2 py-1.5 w-[200px]">
                <PartOfDropdown
                    value={route.partOf || []}
                    onChange={(next) => updateField(idx, "partOf", next)}
                    disabled={!route.isEditing && !route.isNew}
                />
            </td>
            {/* Default toggle */}
            <td className="px-2 py-1.5 text-center">
                <button
                    type="button"
                    role="switch"
                    aria-checked={!!route.isDefault}
                    onClick={() => (route.isEditing || route.isNew) && updateField(idx, "isDefault", !route.isDefault)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${route.isDefault ? 'bg-emerald-500' : 'bg-muted-foreground/30'} ${(!route.isEditing && !route.isNew) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${route.isDefault ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </td>
            {/* DA toggle */}
            <td className="px-2 py-1.5 text-center">
                <button
                    type="button"
                    role="switch"
                    aria-checked={!!route.isDA}
                    onClick={() => (route.isEditing || route.isNew) && updateField(idx, "isDA", !route.isDA)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${route.isDA ? 'bg-emerald-500' : 'bg-muted-foreground/30'} ${(!route.isEditing && !route.isNew) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${route.isDA ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </td>
            {/* Ops toggle */}
            <td className="px-2 py-1.5 text-center">
                <button
                    type="button"
                    role="switch"
                    aria-checked={!!route.isOps}
                    onClick={() => (route.isEditing || route.isNew) && updateField(idx, "isOps", !route.isOps)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${route.isOps ? 'bg-emerald-500' : 'bg-muted-foreground/30'} ${(!route.isEditing && !route.isNew) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${route.isOps ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </td>
            {/* Standby toggle */}
            <td className="px-2 py-1.5 text-center">
                <button
                    type="button"
                    role="switch"
                    aria-checked={!!route.isStandby}
                    onClick={() => (route.isEditing || route.isNew) && updateField(idx, "isStandby", !route.isStandby)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${route.isStandby ? 'bg-emerald-500' : 'bg-muted-foreground/30'} ${(!route.isEditing && !route.isNew) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${route.isStandby ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </td>
            <td className="px-2 py-1.5"><Input value={route.routeStatus || ""} onChange={(e) => updateField(idx, "routeStatus", e.target.value)} placeholder="e.g. Scheduled, Off..." className="h-7 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-2 py-1.5"><Input value={route.startTime || ""} onChange={(e) => updateField(idx, "startTime", e.target.value)} placeholder="e.g. 06:00 AM" className="h-7 text-sm" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-2 py-1.5"><Input type="number" min="0" step="0.1" value={route.theoryHrs ?? ""} onChange={(e) => updateField(idx, "theoryHrs", parseFloat(e.target.value) || 0)} className="h-7 text-sm w-[70px]" disabled={!route.isEditing && !route.isNew} /></td>
            <td className="px-2 py-1.5">
                <select 
                    value={route.group || "None"} 
                    onChange={(e) => updateField(idx, "group", e.target.value)}
                    disabled={!route.isEditing && !route.isNew}
                    className="flex h-7 w-full items-center justify-between rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="None">None</option>
                    <option value="Driver">Driver</option>
                    <option value="Operations">Operations</option>
                </select>
            </td>
            <td className="px-2 py-1.5">
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            disabled={!route.isEditing && !route.isNew}
                            className={`flex items-center justify-center h-7 w-7 rounded-md border border-border shadow-sm transition-colors mx-auto ${(!route.isEditing && !route.isNew) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-primary/30'}`}
                            style={{ backgroundColor: route.color || "#6B7280" }}
                            title={route.color || "#6B7280"}
                        />
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-3" align="center" onOpenAutoFocus={e => e.preventDefault()}>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Color</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={route.color || "#6B7280"} onChange={(e) => updateField(idx, "color", e.target.value)} className="h-8 w-8 rounded cursor-pointer border border-border bg-transparent" />
                                <Input value={route.color || ""} onChange={(e) => updateField(idx, "color", e.target.value)} className="h-7 text-[10px] font-mono flex-1" placeholder="#HEX" />
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </td>
            <td className="px-2 py-1.5 text-center">
                {(() => {
                    const IconComp = route.icon ? (LucideIcons as any)[route.icon] : null;
                    return (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    disabled={!route.isEditing && !route.isNew}
                                    className={`flex items-center justify-center h-7 w-7 rounded-md border border-border/50 transition-colors mx-auto ${(!route.isEditing && !route.isNew) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
                                    title={route.icon || "No icon"}
                                >
                                    {IconComp ? <IconComp className="h-4 w-4" /> : <Minus className="h-3 w-3 opacity-30" />}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[220px] p-0" align="center" onOpenAutoFocus={e => e.preventDefault()}>
                                <div className="p-2">
                                    <IconPicker value={route.icon || ""} onChange={(v) => updateField(idx, "icon", v)} disabled={false} />
                                </div>
                            </PopoverContent>
                        </Popover>
                    );
                })()}
            </td>
            <td className="px-2 py-1.5">
                <div className="flex items-center justify-end gap-0.5">
                    {route.isEditing && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => saveRow(idx)} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => cancelEdit(idx)} disabled={isSaving}><X className="h-3.5 w-3.5" /></Button>
                        </>
                    )}
                    {!route.isEditing && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => updateField(idx, "isEditing", true)}><Pencil className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => deleteRow(idx)} disabled={isSaving}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
            </td>
        </tr>
    );
}

function PartOfDropdown({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
    const [open, setOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggleOpen = () => {
        if (disabled) return;
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Flip up if less than 180px below
            setOpenUp(spaceBelow < 180);
        }
        setOpen(prev => !prev);
    };

    const toggle = (opt: string) => {
        if (disabled) return;
        const next = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt];
        onChange(next);
    };

    return (
        <div ref={ref} className="relative">
            <button
                ref={btnRef}
                type="button"
                onClick={handleToggleOpen}
                className={`flex h-auto min-h-[28px] w-full items-center gap-1 flex-wrap rounded-md border border-input bg-transparent px-1.5 py-0.5 text-[11px] shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
                {value.length === 0 ? (
                    <span className="text-muted-foreground px-0.5">None</span>
                ) : (
                    value.map(v => (
                        <span key={v} className="inline-flex items-center rounded bg-primary/10 text-black dark:text-white px-1.5 py-0 text-[10px] font-medium leading-[18px] whitespace-nowrap">{v}</span>
                    ))
                )}
                <ChevronDown className={`h-3 w-3 shrink-0 opacity-50 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className={`absolute z-50 w-[180px] rounded-md border border-border bg-popover shadow-lg py-1 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                    {PART_OF_OPTIONS.map(opt => {
                        const selected = value.includes(opt);
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => toggle(opt)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className={`flex items-center justify-center h-3.5 w-3.5 rounded-sm border ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                                    {selected && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                {opt}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
