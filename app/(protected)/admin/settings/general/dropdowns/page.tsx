"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Save, Pencil, X, Trash2, ListFilter, Tag, Search, ChevronDown } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    image?: string;
    color?: string;
    icon?: string;
    isNew?: boolean;
    isEditing?: boolean;
}

const TAILWIND_COLORS = [
    "bg-red-600", "bg-emerald-600", "bg-blue-600", "bg-amber-600", "bg-zinc-600",
    "bg-rose-600", "bg-pink-600", "bg-purple-600", "bg-indigo-600", "bg-cyan-600",
    "bg-teal-600", "bg-lime-600", "bg-orange-600", "bg-sky-600", "bg-slate-600"
];

const LUCIDE_ICONS = [
    "Activity", "AlertCircle", "AlertTriangle", "ArrowDown", "ArrowRight", "ArrowUp", "Award", "Ban",
    "Bell", "Box", "Briefcase", "Calendar", "Camera", "Check", "CheckCircle", "CheckCircle2", "CheckSquare",
    "ChevronDown", "ChevronRight", "ChevronUp", "Circle", "Clipboard", "ClipboardList", "Clock", "Cloud",
    "Compass", "Copy", "CreditCard", "Database", "Download", "Edit", "Edit2", "Edit3", "Eye", "EyeOff",
    "File", "FileText", "Flag", "Folder", "Globe", "Heart", "Home", "Image", "Info", "Key", "Layers",
    "Layout", "Link", "List", "Lock", "LogOut", "Mail", "Map", "MapPin", "MessageCircle", "MessageSquare",
    "Mic", "Minus", "MoreHorizontal", "MoreVertical", "Package", "Paperclip", "Pause", "Phone", "Play",
    "Plus", "PlusCircle", "Power", "Printer", "RefreshCcw", "RefreshCw", "Repeat", "Save", "Search",
    "Send", "Settings", "Share", "Share2", "Shield", "ShieldAlert", "ShieldCheck", "ShoppingCart", "Slash",
    "Sliders", "Smartphone", "Smile", "Star", "Sun", "Tag", "Terminal", "Thermostat", "ThumbsDown",
    "ThumbsUp", "Timer", "Tool", "Trash", "Trash2", "TrendingDown", "TrendingUp", "Truck", "Umbrella",
    "Unlock", "Upload", "User", "UserCheck", "UserMinus", "UserPlus", "Users", "Video", "VideoOff",
    "Volume", "Volume2", "VolumeX", "Wifi", "WifiOff", "X", "XCircle", "XSquare", "Zap"
];

function ColorPicker({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        "h-8 w-full border border-input rounded flex items-center justify-between px-3 text-[11px] shadow-sm transition-colors",
                        disabled ? "cursor-not-allowed opacity-50 bg-muted/50" : "bg-background hover:bg-muted/30"
                    )}
                >
                    {value ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className={cn("w-3.5 h-3.5 rounded-full shrink-0 shadow-sm", value)} />
                            <span className="truncate">{value}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">None</span>
                    )}
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[180px] p-2" align="start">
                <div className="grid grid-cols-5 gap-1.5">
                    <button
                        onClick={() => onChange("")}
                        className={cn(
                            "w-7 h-7 rounded-full border border-dashed flex items-center justify-center transition-transform hover:scale-110",
                            !value && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                        title="None"
                    >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {TAILWIND_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => onChange(c)}
                            className={cn(
                                "w-7 h-7 rounded-full shadow-sm transition-transform hover:scale-110",
                                c,
                                value === c && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            )}
                            title={c}
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function IconPicker({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search) return LUCIDE_ICONS;
        return LUCIDE_ICONS.filter(i => i.toLowerCase().includes(search.toLowerCase()));
    }, [search]);

    const ValueIcon = value ? (LucideIcons as any)[value] : null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        "h-8 w-full border border-input rounded flex items-center justify-between px-3 text-[11px] shadow-sm transition-colors",
                        disabled ? "cursor-not-allowed opacity-50 bg-muted/50" : "bg-background hover:bg-muted/30"
                    )}
                >
                    {value ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            {ValueIcon && <ValueIcon className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{value}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">None</span>
                    )}
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start" onOpenAutoFocus={e => e.preventDefault()}>
                <div className="p-2 border-b border-border/50">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search icons..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8 pl-8 text-[11px] bg-muted/30 border-muted-foreground/20 focus-visible:ring-1"
                        />
                    </div>
                </div>
                <div className="p-2 max-h-[220px] overflow-y-auto">
                    <div className="grid grid-cols-6 gap-1">
                        <button
                            onClick={() => onChange("")}
                            className={cn(
                                "w-8 h-8 rounded flex items-center justify-center hover:bg-muted/50 transition-colors",
                                !value && "bg-primary/10 text-primary font-medium"
                            )}
                            title="None"
                        >
                            <span className="text-[9px]">None</span>
                        </button>
                        {filtered.map(name => {
                            const IconComponent = (LucideIcons as any)[name];
                            if (!IconComponent) return null;
                            return (
                                <button
                                    key={name}
                                    onClick={() => onChange(name)}
                                    className={cn(
                                        "w-8 h-8 rounded shrink-0 flex items-center justify-center hover:bg-muted/50 transition-colors",
                                        value === name ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                                    )}
                                    title={name}
                                >
                                    <IconComponent className="h-4 w-4" />
                                </button>
                            );
                        })}
                    </div>
                    {filtered.length === 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                            No icons found
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default function DropdownsPage() {
    const { addRef } = useAddRef();
    const [rows, setRows] = useState<DropdownRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

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
            image: "",
            color: "",
            icon: "",
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
                body: JSON.stringify({
                    _id: row._id,
                    description: row.description,
                    type: row.type,
                    isActive: row.isActive,
                    sortOrder: row.sortOrder,
                    image: row.image,
                    color: row.color,
                    icon: row.icon
                }),
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

    // Filtered rows based on selected type and search query
    const filteredRows = useMemo(() => {
        let result = rows;
        if (selectedType !== "all") {
            result = result.filter(r => r.type === selectedType);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.description.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q)
            );
        }
        return result;
    }, [rows, selectedType, searchQuery]);

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
                {/* Active filter badge & Search */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search description or type..."
                            className="pl-9 h-9 w-full rounded-md border-input bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {selectedType !== "all" && (
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground hidden sm:block">Showing:</span>
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
                            <span className="text-[10px] text-muted-foreground hidden sm:block">
                                {filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[250px]">Description</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[180px]">Type</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Image</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Color</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Icon</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[80px]">Active</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[100px]">Actions</th>
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
                                        <td className="px-4 py-2">
                                            <Input
                                                value={row.image || ""}
                                                onChange={(e) => updateField(globalIdx, "image", e.target.value)}
                                                placeholder="URL"
                                                className="h-8 text-[11px]"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <ColorPicker
                                                value={row.color || ""}
                                                onChange={(val) => updateField(globalIdx, "color", val)}
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <IconPicker
                                                value={row.icon || ""}
                                                onChange={(val) => updateField(globalIdx, "icon", val)}
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
