"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Pencil,
  X,
  Route,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Sub-tabs ──
const SUB_TABS = [
  { id: "routes", label: "Default Routes", icon: Route },
  { id: "general", label: "General", icon: Settings },
];

interface RouteTypeRow {
  _id?: string;
  name: string;
  color: string;
  startTime: string;
  sortOrder: number;
  isActive: boolean;
  isNew?: boolean;
  isEditing?: boolean;
}

// ── Default Routes Tab ──
function DefaultRoutesTab({ addRef }: { addRef: React.MutableRefObject<(() => void) | null> }) {
  const [routes, setRoutes] = useState<RouteTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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
      startTime: "",
      sortOrder: prev.length,
      isActive: true,
      isNew: true,
      isEditing: true,
    }]);
  }, []);

  // Expose addRow to parent via ref
  useEffect(() => { addRef.current = addRow; }, [addRow, addRef]);

  const updateField = (idx: number, field: string, value: any) => {
    setRoutes(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, isEditing: true } : r));
  };

  const saveRow = async (idx: number) => {
    const row = routes[idx];
    if (!row.name.trim()) {
      toast.error("Route type name is required");
      return;
    }

    setSaving(row._id || `new-${idx}`);
    try {
      const res = await fetch("/api/admin/settings/route-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: row._id,
          name: row.name,
          color: row.color,
          startTime: row.startTime,
          sortOrder: row.sortOrder,
          isActive: row.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const saved = await res.json();
      setRoutes(prev => prev.map((r, i) => i === idx ? { ...saved, isEditing: false, isNew: false } : r));
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const deleteRow = async (idx: number) => {
    const row = routes[idx];
    if (row.isNew) {
      setRoutes(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!row._id) return;
    setSaving(row._id);
    try {
      await fetch(`/api/admin/settings/route-types?id=${row._id}`, { method: "DELETE" });
      setRoutes(prev => prev.filter((_, i) => i !== idx));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setSaving(null);
    }
  };

  const cancelEdit = (idx: number) => {
    const row = routes[idx];
    if (row.isNew) {
      setRoutes(prev => prev.filter((_, i) => i !== idx));
    } else {
      fetchRoutes(); // re-fetch to reset
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Route Type</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Color</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[160px]">Start Time</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No route types configured. Click &quot;Add Route Type&quot; to get started.
                </td>
              </tr>
            )}
            {routes.map((route, idx) => {
              const isSaving = saving === (route._id || `new-${idx}`);
              return (
                <tr key={route._id || `new-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <Input
                      value={route.name}
                      onChange={(e) => updateField(idx, "name", e.target.value)}
                      placeholder="e.g. Route, Open, Close..."
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={route.color}
                        onChange={(e) => updateField(idx, "color", e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer border border-border bg-transparent"
                      />
                      <Input
                        value={route.color}
                        onChange={(e) => updateField(idx, "color", e.target.value)}
                        className="h-8 text-xs font-mono w-[80px]"
                        placeholder="#HEX"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={route.startTime}
                      onChange={(e) => updateField(idx, "startTime", e.target.value)}
                      placeholder="e.g. 06:00 AM"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {route.isEditing && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => saveRow(idx)}
                            disabled={isSaving}
                          >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => cancelEdit(idx)}
                            disabled={isSaving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {!route.isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => updateField(idx, "isEditing", true)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => deleteRow(idx)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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

// ── Main Page ──
export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState("routes");
  const addRouteRef = useRef<(() => void) | null>(null);

  return (
    <div className="space-y-4">
      {/* Sub-tabs + action button */}
      <div className="flex items-center justify-between border-b border-border/50 pb-0">
        <div className="flex items-center gap-1">
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all relative",
                  isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
        {activeTab === "routes" && (
          <Button size="sm" onClick={() => addRouteRef.current?.()} className="gap-1.5 mb-1">
            <Plus className="h-3.5 w-3.5" />
            Add Route Type
          </Button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "routes" && <DefaultRoutesTab addRef={addRouteRef} />}
      {activeTab === "general" && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          General settings coming soon.
        </div>
      )}
    </div>
  );
}
