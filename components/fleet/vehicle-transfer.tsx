"use client";

import React, { useEffect, useState } from "react";
import { IconArrowsLeftRight, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

interface Station {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

/**
 * Move vans to another station.
 *
 * Works for one vehicle or many — standing up a new station means moving
 * a batch, and one-at-a-time invites stopping halfway without knowing
 * which ones moved.
 *
 * The copy is explicit that history stays behind, because that is the
 * part people get wrong: moving a van does NOT move its repairs and
 * inspections. Those belong to the station where the work happened, so a
 * past fleet report stays true after a transfer.
 */
export function VehicleTransfer({
  vehicleIds,
  currentSiteId,
  onDone,
  compact = false,
}: {
  vehicleIds: string[];
  currentSiteId?: string | null;
  onDone?: (result: { moved: number; message: string }) => void;
  compact?: boolean;
}) {
  const [stations, setStations] = useState<Station[]>([]);
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    // Only stations this user can reach — the picker cannot offer a
    // destination they aren't entitled to in the first place.
    fetch("/api/user/sites")
      .then((r) => r.json())
      .then((d) => setStations(d.sites || []))
      .catch(() => setError("Couldn't load stations."));
  }, []);

  const destinations = stations.filter((s) => s.id !== String(currentSiteId || ""));
  const count = vehicleIds.length;

  async function transfer() {
    if (!target || count === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/fleet/vehicles/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleIds, toSiteId: target, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Transfer failed.");
        return;
      }
      setResult(data.message);
      onDone?.({ moved: data.moved, message: data.message });
    } catch (e: any) {
      setError(e?.message || "Transfer failed.");
    } finally {
      setBusy(false);
    }
  }

  if (count === 0) return null;

  return (
    <div className={compact ? "flex items-end gap-2" : "space-y-3"}>
      <div className={compact ? "flex-1" : ""}>
        <label className="block text-xs font-medium text-neutral-400 mb-1">
          Move {count === 1 ? "this van" : `${count} vans`} to
        </label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={busy}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-violet-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select a station…</option>
          {destinations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </div>

      {!compact && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Reason <span className="text-neutral-600">(optional, recorded on the vehicle)</span>
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
            placeholder="e.g. peak season coverage"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-violet-500 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      <button
        onClick={transfer}
        disabled={busy || !target}
        className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <IconLoader2 className="size-4 animate-spin" /> : <IconArrowsLeftRight className="size-4" />}
        {busy ? "Moving…" : "Move"}
      </button>

      {!compact && (
        <p className="text-xs text-neutral-500 leading-relaxed">
          Repairs, inspections and rental agreements stay with the station where
          they happened — only the van's current location changes.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-900/50 px-3 py-2 text-xs text-red-300">
          <IconAlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="rounded-lg bg-emerald-950/50 border border-emerald-900/50 px-3 py-2 text-xs text-emerald-300">
          {result}
        </div>
      )}
    </div>
  );
}
