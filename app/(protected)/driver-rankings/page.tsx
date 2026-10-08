"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DriverRankingResult, DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";
import { WeeklyScorecardImport } from "@/components/driver-ranking/weekly-scorecard-import";

const shown = (value: number | null | undefined, suffix = "") => value === null || value === undefined ? "N/A" : `${Math.round(value * 100) / 100}${suffix}`;

export default function DriverRankingsPage() {
  const [data, setData] = useState<(DriverRankingResult & { publicDriverPerformanceEnabled?: boolean }) | null>(null);
  const [week, setWeek] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copying, setCopying] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/driver-rankings${week ? `?week=${encodeURIComponent(week)}` : ""}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load Driver Rankings.");
        return body;
      })
      .then((body: DriverRankingResult) => {
        setData(body);
        if (!week && body.period.yearWeek) setWeek(body.period.yearWeek);
      })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [week, refreshKey]);

  const drivers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.drivers || []).filter(driver => !query || driver.name.toLowerCase().includes(query));
  }, [data?.drivers, search]);

  async function copyLink(driver: DriverRankingRow) {
    setCopying(driver.driverId);
    setError("");
    try {
      const response = await fetch("/api/driver-rankings/driver-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: driver.driverId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create driver link.");
      await navigator.clipboard.writeText(`${window.location.origin}${body.path}`);
      setCopied(driver.driverId);
      window.setTimeout(() => setCopied(current => current === driver.driverId ? null : current), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create driver link.");
    } finally {
      setCopying(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Driver Rankings</h1>
          <p className="text-sm text-muted-foreground">Weekly performance and private driver scorecard links.</p>
        </div>
        <div className="flex items-center gap-3">
          <WeeklyScorecardImport enabled={Boolean(data?.canEdit)} onImported={importedWeek => { setWeek(importedWeek); setRefreshKey(value => value + 1); }} />
          <Select value={week} onValueChange={setWeek}>
            <SelectTrigger className="w-36" aria-label="Selected week"><SelectValue placeholder="Week" /></SelectTrigger>
            <SelectContent>{(data?.availableWeeks || []).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{data?.scorecardImported ? "Scorecard imported" : "Scorecard not imported"}</span>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search driver" className="pl-9" />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading rankings</div>}

      {!loading && <div className="divide-y rounded-md border">
        {drivers.map(driver => <div key={driver.driverId} className="flex items-center gap-4 px-4 py-3">
          <span className="w-10 shrink-0 text-sm font-semibold">#{driver.score?.rank ?? "-"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{driver.name}</p>
            <p className="text-xs text-muted-foreground">Final {shown(driver.score?.finalScore, "%")} · Efficiency {shown(driver.efficiency.average, "%")} · {driver.deliveryDays} days</p>
          </div>
          {data?.publicDriverPerformanceEnabled && <Button variant="ghost" size="sm" onClick={() => copyLink(driver)} disabled={copying === driver.driverId}>
            {copying === driver.driverId ? <Loader2 className="size-4 animate-spin" /> : copied === driver.driverId ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">Copy Driver Link</span>
          </Button>}
        </div>)}
        {!drivers.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No ranked drivers found.</p>}
      </div>}
    </main>
  );
}
