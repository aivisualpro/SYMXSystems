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

interface QuoNumber {
  id: string;
  number: string;
  label: string;
  /** Set when another station already uses this number. */
  claimedBySiteId: string | null;
  claimedByCode: string | null;
}

interface SiteRow {
  id: string;
  name: string;
  code: string;
  slug: string;
  siteType: "permanent" | "seasonal";
  address: string;
  messaging?: { quoPhoneNumberId?: string; quoPhoneNumber?: string };
  amazon?: { serviceAreaId?: string };
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

  // ── Quo numbers available to assign ──
  // Loaded once when the page opens rather than per-dialog: the list is
  // small, rarely changes, and fetching it on every edit made opening the
  // dialog wait on a third-party API.
  const [quoNumbers, setQuoNumbers] = useState<QuoNumber[]>([]);
  const [quoReason, setQuoReason] = useState<string | null>(null);
  const [quoLoading, setQuoLoading] = useState(true);
  // Set when the list cannot be used, or when the admin chooses to type
  // the values in anyway — a number that exists but has not yet appeared
  // in the API response still has to be enterable.
  const [manualEntry, setManualEntry] = useState(false);

  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    siteType: "permanent",
    status: "active",
    quoPhoneNumberId: "",
    quoPhoneNumber: "",
    amazonServiceAreaId: "",
  });

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

  const loadQuoNumbers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quo/numbers");
      const json = await res.json();
      setQuoNumbers(Array.isArray(json.numbers) ? json.numbers : []);
      setQuoReason(json.available ? null : json.reason || "Quo numbers unavailable.");
    } catch {
      setQuoNumbers([]);
      setQuoReason("Could not load numbers from Quo. Enter the values manually.");
    } finally {
      setQuoLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadQuoNumbers(); }, [loadQuoNumbers]);

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
    // Reset per-station: leaving manual entry on from the previous
    // station would quietly bypass the picker for the next one.
    setManualEntry(false);
    setEditing(s);
    setEditForm({
      name: s.name,
      address: s.address,
      siteType: s.siteType,
      status: s.status,
      quoPhoneNumberId: s.messaging?.quoPhoneNumberId || "",
      quoPhoneNumber: s.messaging?.quoPhoneNumber || "",
      amazonServiceAreaId: s.amazon?.serviceAreaId || "",
    });
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
      // Reload both: the number list carries which station holds each
      // number, so without this the next station edited would still show
      // the one just assigned as free to take.
      await Promise.all([load(), loadQuoNumbers()]);
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

              {/* ── Messaging (Quo / OpenPhone) ──
                  Each station texts drivers from its own number. It is also
                  the ONLY way an inbound reply can be attributed: the
                  webhook is unauthenticated and carries no station, so a
                  reply is matched by the number it arrived at. */}
              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Messaging (Quo)</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    This station&apos;s texting number. Without it, sending from
                    this station is refused rather than falling back to another
                    station&apos;s number.
                  </p>
                </div>
                {quoLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading numbers from Quo…
                  </div>
                ) : !manualEntry && quoNumbers.length > 0 ? (
                  <>
                    {/* Picking from the account sets the ID and the number
                        together. They were two free-text fields, which meant
                        they could be saved describing different numbers —
                        and the pair only has to disagree once for messages
                        to send from one number while replies are attributed
                        by another. */}
                    <Select
                      value={editForm.quoPhoneNumberId || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__none__") {
                          setEditForm({ ...editForm, quoPhoneNumberId: "", quoPhoneNumber: "" });
                          return;
                        }
                        const pick = quoNumbers.find((n) => n.id === v);
                        if (pick) {
                          setEditForm({
                            ...editForm,
                            quoPhoneNumberId: pick.id,
                            quoPhoneNumber: pick.number,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a number" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">None — cannot send from this station</span>
                        </SelectItem>
                        {quoNumbers.map((n) => {
                          // A number held by ANOTHER station is shown but not
                          // selectable. Hiding it would leave the admin
                          // wondering where the number went; letting it be
                          // picked would fail on the unique index with a
                          // database error rather than an explanation.
                          const takenByOther =
                            !!n.claimedBySiteId && n.claimedBySiteId !== editing.id;
                          return (
                            <SelectItem key={n.id} value={n.id} disabled={takenByOther}>
                              <span className="font-mono text-xs">{n.number}</span>
                              {n.label && n.label !== n.number && (
                                <span className="text-muted-foreground"> · {n.label}</span>
                              )}
                              {takenByOther && (
                                <span className="text-muted-foreground"> — already on {n.claimedByCode}</span>
                              )}
                            </SelectItem>
                          );
                        })}
                        {/* The saved number may not be on the account any
                            more — renumbered, or removed in Quo. Without this
                            the picker would show an empty box and silently
                            drop the value on save. */}
                        {editForm.quoPhoneNumberId &&
                          !quoNumbers.some((n) => n.id === editForm.quoPhoneNumberId) && (
                            <SelectItem value={editForm.quoPhoneNumberId}>
                              <span className="font-mono text-xs">
                                {editForm.quoPhoneNumber || editForm.quoPhoneNumberId}
                              </span>
                              <span className="text-muted-foreground"> — saved, but not found in Quo</span>
                            </SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => setManualEntry(true)}
                      className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Enter values manually instead
                    </button>
                  </>
                ) : (
                  <>
                    {(quoReason || manualEntry) && (
                      <p className="text-[11px] text-muted-foreground">
                        {quoReason ||
                          "Manual entry — the ID and the number must describe the same line."}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">OpenPhone ID</Label>
                        <Input
                          value={editForm.quoPhoneNumberId}
                          onChange={(e) => setEditForm({ ...editForm, quoPhoneNumberId: e.target.value })}
                          placeholder="PNxxxxxxxxxxxx"
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Phone number</Label>
                        <Input
                          value={editForm.quoPhoneNumber}
                          onChange={(e) => setEditForm({ ...editForm, quoPhoneNumber: e.target.value })}
                          placeholder="+15551234567"
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                    {!quoReason && manualEntry && quoNumbers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualEntry(false)}
                        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        Choose from the Quo account instead
                      </button>
                    )}
                  </>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Both the ID and the number are stored: the API sends by ID,
                  the webhook reports the number. No two stations may share
                  either.
                </p>
              </div>

              {/* ── Amazon Logistics ──
                  How scraped route data finds its way to the right station. */}
              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Amazon Logistics</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    The service area ID Amazon stamps on this station&apos;s
                    routes. The route sync uses it to file each route under the
                    right station, so routes whose service area is unmapped are
                    skipped rather than guessed at.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Service Area ID</Label>
                  <Input
                    value={editForm.amazonServiceAreaId}
                    onChange={(e) => setEditForm({ ...editForm, amazonServiceAreaId: e.target.value })}
                    placeholder="9900c1c3-98c1-4162-b8ca-1363e2944946"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Found as <span className="font-mono">serviceAreaId</span> on any
                    route in this station&apos;s Amazon data. No two stations may
                    share one.
                  </p>
                </div>
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
