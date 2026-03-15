"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Save, ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SETTING_KEY = "routes_completion_types";

export default function GeneralSettingsPage() {
    const [routeTypes, setRouteTypes] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Fetch route types from Default Routes + current setting in parallel
    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetch("/api/admin/settings/route-types").then(r => r.json()),
            fetch(`/api/admin/settings/general?key=${SETTING_KEY}`).then(r => r.json()),
        ])
            .then(([types, setting]) => {
                const names = Array.isArray(types) ? types.map((t: any) => t.name) : [];
                setRouteTypes(names);
                const saved = Array.isArray(setting?.value) ? setting.value : [];
                setSelectedTypes(saved);
            })
            .catch(() => {
                setRouteTypes([]);
                setSelectedTypes([]);
            })
            .finally(() => setLoading(false));
    }, []);

    const toggleType = useCallback((type: string) => {
        setSelectedTypes(prev => {
            const exists = prev.some(t => t.toLowerCase() === type.toLowerCase());
            return exists
                ? prev.filter(t => t.toLowerCase() !== type.toLowerCase())
                : [...prev, type];
        });
        setDirty(true);
    }, []);

    const removeType = useCallback((type: string) => {
        setSelectedTypes(prev => prev.filter(t => t.toLowerCase() !== type.toLowerCase()));
        setDirty(true);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings/general", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: SETTING_KEY,
                    value: selectedTypes,
                    description: "Route types that count toward routesCompleted",
                }),
            });
            if (!res.ok) throw new Error("Failed to save");
            setDirty(false);
            toast.success("Setting saved");
        } catch (err: any) {
            toast.error(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Routes Completion Logic */}
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold">Routes Completion Logic</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Route types that count toward <code className="text-[10px] px-1 py-0.5 rounded bg-muted border border-border font-mono">routesCompleted</code>
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || !dirty}
                        className="gap-1.5"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save
                    </Button>
                </div>

                {/* Multi-select dropdown */}
                <div ref={dropdownRef} className="relative">
                    <div
                        onClick={() => setOpen(!open)}
                        className={cn(
                            "flex items-center justify-between w-full min-h-[40px] px-3 py-2 rounded-lg border bg-background text-sm transition-colors cursor-pointer",
                            open ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border/80"
                        )}
                    >
                        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                            {selectedTypes.length === 0 ? (
                                <span className="text-muted-foreground text-xs">Select route types...</span>
                            ) : (
                                selectedTypes.map(t => (
                                    <span
                                        key={t}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-semibold"
                                    >
                                        {t}
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); removeType(t); }}
                                            className="hover:bg-primary/20 rounded-sm p-0.5 cursor-pointer"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </span>
                                    </span>
                                ))
                            )}
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform", open && "rotate-180")} />
                    </div>

                    {open && (
                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg py-1 max-h-[240px] overflow-auto">
                            {routeTypes.map((type: string) => {
                                const isSelected = selectedTypes.some(t => t.toLowerCase() === type.toLowerCase());
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => toggleType(type)}
                                        className={cn(
                                            "flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors",
                                            isSelected
                                                ? "bg-primary/5 text-primary font-semibold"
                                                : "text-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                            isSelected ? "bg-primary border-primary" : "border-border"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                        </div>
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
