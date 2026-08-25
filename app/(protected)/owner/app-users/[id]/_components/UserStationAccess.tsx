"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Building2, Globe, Loader2, Shield, Snowflake, Star } from "lucide-react";

interface StationRow {
  id: string;
  name: string;
  code: string;
  siteType: "permanent" | "seasonal";
  status: "active" | "inactive";
  isDefault: boolean;
  assigned: boolean;
  isPrimary: boolean;
}

type OrgScope = "all_sites" | "read_only_all_sites" | null;

/**
 * Which stations this user may see.
 *
 * This is the control that keeps one station's HR records away from
 * another station's staff, so the UI is deliberately explicit about the
 * consequences of each option rather than presenting bare checkboxes.
 */
export function UserStationAccess({ userId }: { userId: string }) {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primary, setPrimary] = useState<string | null>(null);
  const [orgScope, setOrgScope] = useState<OrgScope>(null);
  const [reason, setReason] = useState("");
  const [bypasses, setBypasses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/sites`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load station access");
      setStations(json.sites || []);
      setSelected(new Set((json.sites || []).filter((s: StationRow) => s.assigned).map((s: StationRow) => s.id)));
      setPrimary((json.sites || []).find((s: StationRow) => s.isPrimary)?.id || null);
      setOrgScope(json.orgGrant?.scope || null);
      setBypasses(!!json.user?.bypassesAssignments);
      setDirty(false);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primary === id) setPrimary(null);
      } else {
        next.add(id);
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    const siteIds = [...selected];
    if (!orgScope && siteIds.length === 0) {
      notify.error("Assign at least one station, or grant company-wide access");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/sites`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteIds,
          primarySiteId: primary && siteIds.includes(primary) ? primary : siteIds[0] || null,
          orgScope,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      notify.success("Station access updated");
      await load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border p-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Station Access</h3>
      </div>

      {bypasses && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
          <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            This user is a <strong>Super Admin</strong> and reaches every station regardless of
            what is set here. These assignments are recorded but not what grants their access.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {stations.map((s) => {
          const isSelected = selected.has(s.id);
          const isClosed = s.status === "inactive";
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                isSelected ? "border-primary/40 bg-primary/5" : "border-border",
                isClosed && "opacity-55"
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded accent-primary"
                checked={isSelected}
                onChange={() => toggle(s.id)}
                aria-label={`Assign ${s.code}`}
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="font-mono text-sm font-semibold">{s.code}</span>
                <span className="truncate text-xs text-muted-foreground">{s.name}</span>
                {s.siteType === "seasonal" && (
                  <Snowflake className="h-3 w-3 flex-shrink-0 text-sky-500" aria-label="Seasonal" />
                )}
                {isClosed && (
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">Closed</Badge>
                )}
              </div>

              {isSelected && (
                <button
                  type="button"
                  onClick={() => { setPrimary(s.id); setDirty(true); }}
                  title="Primary station — where this user lands at login"
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
                    primary === s.id
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Star className={cn("h-3 w-3", primary === s.id && "fill-current")} />
                  {primary === s.id ? "Primary" : "Set primary"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Company-wide ── */}
      <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/[0.04] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-semibold">Company-wide access</span>
        </div>
        <p className="mb-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Sees every station, including any added later. Granted separately from the
          assignments above so it stays deliberate and auditable — assigning someone to all
          three stations individually is <em>not</em> the same thing, and would silently miss a
          fourth.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: null as OrgScope, label: "None" },
            { value: "all_sites" as OrgScope, label: "Full access" },
            { value: "read_only_all_sites" as OrgScope, label: "Read-only (auditor)" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => { setOrgScope(opt.value); setDirty(true); }}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                orgScope === opt.value
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-border hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {orgScope && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Reason (recorded on the grant)
            </Label>
            <Input
              value={reason}
              onChange={(e) => { setReason(e.target.value); setDirty(true); }}
              placeholder="e.g. Regional operations oversight"
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Revoking access end-dates the assignment rather than deleting it, so the access
          history stays intact.
        </p>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Access
        </Button>
      </div>
    </div>
  );
}
