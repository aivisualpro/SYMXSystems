"use client";

import React, { useEffect, useState } from "react";

interface Station {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

/**
 * Pick a station.
 *
 * Loads from /api/user/sites, which returns only the stations the signed-in
 * user can reach — so the list cannot offer somewhere they aren't entitled
 * to, and the server re-checks anyway.
 *
 * Renders nothing when there is only one station and no value is set:
 * a single-station user has no decision to make, and an unavoidable
 * dropdown with one option is just noise. It DOES render when a value is
 * already set, so an existing assignment stays visible and changeable.
 */
export function StationSelect({
  value,
  onChange,
  label = "Station",
  hint,
  required = false,
  disabled = false,
  allowNone = false,
  className = "",
}: {
  value?: string | null;
  onChange: (siteId: string) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Offer a blank option. Off by default — records should have a station. */
  allowNone?: boolean;
  className?: string;
}) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/user/sites")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list: Station[] = d.sites || [];
        setStations(list);
        // Preselect when there is exactly one choice and nothing is set —
        // the common single-station case then needs no interaction, and the
        // caller still receives the value rather than having to infer it.
        if (!value && list.length === 1) onChange(list[0].id);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;
  if (stations.length <= 1 && !value) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <select
        value={value || ""}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
      >
        {(allowNone || !value) && <option value="">Select a station…</option>}
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} — {s.name}
          </option>
        ))}
      </select>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
