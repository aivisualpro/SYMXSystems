"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Building2, Globe, Loader2, Plus, Snowflake, Users } from "lucide-react";

interface SiteRow {
  id: string;
  name: string;
  code: string;
  slug: string;
  siteType: "permanent" | "seasonal";
  address: string;
  status: "active" | "inactive";
  isDefault: boolean;
  userCount: number;
}

export default function SitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [org, setOrg] = useState<{ name: string; timezone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", siteType: "permanent", address: "" });

  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", siteType: "permanent", status: "active" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sites");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load stations");
      setSites(json.sites || []);
      setOrg(json.organization);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      notify.error("Name and station code are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create station");
      notify.success(`Station ${form.code.toUpperCase()} created`);
      setCreateOpen(false);
      setForm({ name: "", code: "", siteType: "permanent", address: "" });
      await load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (s: SiteRow) => {
    setEditing(s);
    setEditForm({ name: s.name, address: s.address, siteType: s.siteType, status: s.status });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...editForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      notify.success("Station updated");
      setEditing(null);
      await load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-4 w-4 text-violet-500" />
            {org?.name || "Organization"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {sites.length} station{sites.length === 1 ? "" : "s"} · {org?.timezone}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Station
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Code", "Name", "Type", "Status", "Users", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr
                key={s.id}
                className={cn("border-t hover:bg-muted/30", s.status === "inactive" && "opacity-55")}
              >
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5 font-mono font-semibold">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {s.code}
                    {s.isDefault && (
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-[9px] text-primary"
                        title="Historical records were backfilled to this station, and legacy code paths fall back to it."
                      >
                        DEFAULT
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">{s.name}</td>
                <td className="px-3 py-2.5">
                  {s.siteType === "seasonal" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                      <Snowflake className="h-3 w-3" /> Seasonal
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Permanent</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    className={cn(
                      "text-[10px]",
                      s.status === "active"
                        ? "border-emerald-600 bg-emerald-500 text-white"
                        : "border-slate-500 bg-slate-400 text-white"
                    )}
                  >
                    {s.status === "active" ? "Open" : "Closed"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" /> {s.userCount}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(s)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Closing a seasonal station sets it to <strong>Closed</strong> — it is never deleted, so its
        records keep their ownership and stay reportable. Assign users to stations from{" "}
        <strong>Owner → App Users</strong>.
      </p>

      {/* ── Create ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Station</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Station Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="DXC9"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Can&apos;t be changed later — it appears on exports and issued documents.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.siteType} onValueChange={(v) => setForm({ ...form, siteType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="DXC9" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit {editing?.code}</DialogTitle></DialogHeader>
          {editing && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={editForm.siteType} onValueChange={(v) => setEditForm({ ...editForm, siteType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                    disabled={editing.isDefault}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Open</SelectItem>
                      <SelectItem value="inactive">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  {editing.isDefault && (
                    <p className="text-[10px] text-muted-foreground">
                      The default station can&apos;t be closed.
                    </p>
                  )}
                </div>
              </div>

              {editForm.status === "inactive" && editing.userCount > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  Closing this station removes it from the station switcher for{" "}
                  <strong>{editing.userCount}</strong> user{editing.userCount === 1 ? "" : "s"}.
                  Their assignments stay on record and access returns if it reopens.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
