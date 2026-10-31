"use client";
import { useEffect, useMemo, useState } from "react";
import { analyzeDriver, attentionQueue } from "@/lib/cortex/intelligence";
import { AttentionPanel, DriverEvidence } from "./driver-intelligence";
import { useSiteContext } from "@/components/providers/site-context-provider";
import {
  assessRoute,
  summarizeCoverage,
  businessDate,
  type Observation,
} from "@/lib/cortex/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { RefreshCw, Route, Clock3, AlertTriangle, PackageCheck, Info } from "lucide-react";

type Data = {
  routes: Observation[];
  history: Observation[];
  demo?: boolean;
  generatedAt: string;
};
const clock = (time: number | null) =>
  time
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        minute: "2-digit",
      }).format(time)
    : "—";
export function CortexDashboard() {
  const { activeSiteIds, switching } = useSiteContext();
  const [date, setDate] = useState(businessDate());
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [station, setStation] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Observation | null>(null);
  const [now, setNow] = useState(Date.now());
  const scope = activeSiteIds.join(",");
  useEffect(() => {
    setDemo(new URLSearchParams(location.search).get("demo") === "1");
  }, []);
  useEffect(() => { setData(null); setSelected(null); }, [date, demo, scope, switching]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/cortex?date=${date}${demo ? "&demo=1" : ""}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load Cortex");
        return d;
      })
      .then(d => {
        if (controller.signal.aborted) return;
        setData(d);
        setSelected(current => current ? d.routes.find((r: Observation) => r.routeCode === current.routeCode && r.station === current.station && r.driverId === current.driverId) || null : null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, demo, scope, switching, refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setRefresh((n) => n + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const rows = (data?.routes || []).filter(
    (r) =>
      (station === "all" || r.station === station) &&
      `${r.routeCode} ${r.driverName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const stops = rows.reduce((n, r) => n + (r.totalStops || 0), 0);
  const completed = rows.reduce((n, r) => n + (r.completedStops || 0), 0);
  const queue = useMemo(() => attentionQueue((data?.routes || []).filter(r =>
    (station === "all" || r.station === station) && `${r.routeCode} ${r.driverName}`.toLowerCase().includes(search.toLowerCase())), now), [data, station, search, now]);
  const risks = queue.length;
  const stale = rows.filter((r) => assessRoute(r, now).stale).length;
  const coverage = summarizeCoverage(rows, now);
  return (
    <main className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" /> DELIVERY OPERATIONS · PACIFIC TIME
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            SYMX Cortex
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live route visibility and dispatcher priorities</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      {demo && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          <strong>Synthetic preview</strong> · Sample drivers and routes. No
          live Amazon data, assignments, or notifications. The live endpoint
          still requires your authorized station context.
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">
          Business day{" "}
          <input
            aria-label="Business day"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 border rounded-md p-2 bg-background"
          />
        </label>
        <select
          aria-label="Filter station"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="border rounded-md p-2 bg-background"
        >
          <option value="all">All selected stations</option>
          {[...new Set(data?.routes.map((r) => r.station))].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="Search routes or drivers"
          placeholder="Search route or driver…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md p-2 bg-background min-w-60"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          Refreshes every minute · stale after 20 minutes
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive"
        >
          {error}{" "}
          <Button
            variant="outline"
            className="ml-2"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Routes",
            value: rows.length,
            text: `${rows.filter((r) => !r.actualDeparture).length} not departed`,
            icon: Route,
          },
          {
            title: "Stops",
            value: `${completed} / ${stops}`,
            text: stops
              ? `${Math.round((completed / stops) * 100)}% delivered`
              : "Waiting for overview",
            icon: PackageCheck,
          },
          {
            title: "Needs Review",
            value: risks,
            text: "Drivers to check",
            icon: AlertTriangle,
          },
          {
            title: "Stale Data",
            value: stale,
            text: "Outdated data",
            icon: Clock3,
          },
        ].map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums tracking-tight">
                {loading ? "…" : c.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <details className="rounded-lg border bg-card px-4 py-3 text-sm" aria-label="Collection completeness">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-medium focus-visible:outline-2 focus-visible:outline-primary">
          <span className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Data health <span className="text-xs font-normal text-muted-foreground">· {coverage.routes} routes</span></span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-normal text-muted-foreground">
            <span>Details {coverage.freshDetails}/{coverage.routes}</span>
            <span>Events {coverage.withDeliveryEvents}/{coverage.routes}</span>
            <span>RTS {coverage.forecasts}/{coverage.routes}</span>
          </span>
        </summary>
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-muted-foreground">
          <span>Route details <strong className="block text-sm text-foreground">{coverage.freshDetails} / {coverage.routes}</strong></span>
          <span>Delivery timestamps <strong className="block text-sm text-foreground">{coverage.withDeliveryEvents} / {coverage.routes}</strong></span>
          <span>Return travel <strong className="block text-sm text-foreground">{coverage.explicitInbound} / {coverage.routes}</strong></span>
          <span>RTS availability <strong className="block text-sm text-foreground">{coverage.forecasts} / {coverage.routes}</strong></span>
          <p className="sm:col-span-2 lg:col-span-4">Planned return allowances available: {coverage.plannedAllowance}. Missing or stale information can suppress forecasts; review route evidence before making decisions.</p>
        </div>
      </details>
      <AttentionPanel queue={queue} onOpen={setSelected} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routes overview <span className="ml-2 text-sm font-normal text-muted-foreground">({rows.length})</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left tabular-nums">
              <thead className="border-b text-muted-foreground">
                <tr>
                  {[
                    "Driver / route",
                    "Progress",
                    "Pace / hr",
                    "Est. RTS",
                    "Attention",
                    "Updated",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap bg-muted/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = analyzeDriver(r, now);
                  const attributable = r.driverId && !r.assignmentChanged && !r.identityUncertain;
                  return (
                    <tr
                      key={`${r.station}:${r.routeCode}:${r.driverId}`}
                      className="border-b last:border-0 hover:bg-primary/5 transition-colors"
                    >
                      <td className="p-3">
                        <div className="group relative inline-block">
                          <button
                            className="font-medium underline underline-offset-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            onClick={() => setSelected(r)}
                            aria-label={`Open details for ${r.routeCode}, ${r.driverName}`}
                          >
                            {r.routeCode}
                          </button>
                          <div role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
                            <div className="font-semibold">{r.routeCode} · {r.driverName}</div>
                            <div className="mt-1">{r.completedStops ?? "—"} / {r.totalStops ?? "—"} stops</div>
                            <div>Planned return: {clock(r.plannedReturn)}</div>
                            <div>Status: {a.risk}</div>
                            <div>Recent route pace: {a.paceWindows.recent?.rate.toFixed(1) || "Unknown"} stops/h</div>
                            <div className="text-xs text-muted-foreground mt-1">Click for full details</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.driverName === "Unassigned" && r.driverId
                            ? r.driverId
                            : r.driverName} · {r.station}
                        </div>
                      </td>
                      <td className="p-3 min-w-36">
                        <div>
                          {r.completedStops ?? "—"} / {r.totalStops ?? "—"}{" "}
                          stops
                        </div>
                        <div className="h-1.5 bg-muted rounded mt-2 overflow-hidden">
                          <div
                            className={`h-full ${r.totalStops && (r.completedStops || 0) >= r.totalStops ? "bg-emerald-600" : "bg-primary"} transition-[width]`}
                            style={{
                              width: `${r.totalStops ? Math.min(100, ((r.completedStops || 0) / r.totalStops) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.completedPackages ?? "—"} /{" "}
                          {r.totalPackages ?? "—"} packages
                        </div>
                      </td>
                      <td className="p-3 min-w-24">
                        <span className="font-semibold">{attributable ? a.paceWindows.recent?.rate.toFixed(1) || "—" : "—"}</span>
                        <span className="text-xs text-muted-foreground"> /hr</span>
                        <span tabIndex={0} aria-label="Pace evidence" className="ml-2 relative group inline-flex cursor-help rounded focus-visible:outline-2 focus-visible:outline-primary">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          <span role="tooltip" className="pointer-events-none absolute z-30 bottom-full left-0 mb-2 hidden w-64 rounded border bg-popover p-3 text-left text-xs font-normal text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
                            Recent: {attributable ? a.paceWindows.recent?.rate.toFixed(1) || "Unknown" : "Attribution unavailable"} stops/hr.
                            Earlier: {attributable ? a.paceWindows.earlier?.rate.toFixed(1) || "Unknown" : "Attribution unavailable"} stops/hr.
                            {a.paceWindows.changePercent != null && attributable ? ` Change: ${Math.abs(a.paceWindows.changePercent).toFixed(0)}% ${a.paceWindows.changePercent < 0 ? "lower" : "higher"}.` : ""}
                            {a.stale || a.detailStale ? " Sample may be stale." : ""}
                            {!r.deliveryEvents ? " Delivery timestamps unavailable." : ""}
                            Actual stop-completion evidence only; breaks and traffic are not verified.
                          </span>
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium">{r.actualReturn ? clock(r.actualReturn) : a.forecast ? clock(a.forecast) : "No Forecast"}</div>
                        <span tabIndex={0} className="group relative inline-flex cursor-help text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">
                          {r.actualReturn ? "Actual return" : a.forecast ? a.confidence : "Limited data"}
                          <span role="tooltip" className="pointer-events-none absolute z-30 bottom-full left-0 mb-2 hidden w-72 whitespace-normal rounded border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
                            {a.missingForecastInputs.length ? `Missing inputs: ${a.missingForecastInputs.join(", ")}. ` : ""}
                            {a.forecastDeltaMinutes != null ? `Projected difference from plan: ${Math.round(a.forecastDeltaMinutes)} minutes. ` : ""}
                            RTS is an estimate based on available evidence, not a confirmed return time.
                          </span>
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={a.stale ? "border-slate-300 bg-slate-100 text-slate-700" : a.candidates.length && a.priority === "check-in" ? "border-amber-300 bg-amber-50 text-amber-800" : a.candidates.length ? "border-blue-200 bg-blue-50 text-blue-700" : r.totalStops && (r.completedStops || 0) >= r.totalStops ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                          {a.stale ? "Stale" : a.candidates.length ? (a.priority === "check-in" ? "Check-in" : "Watch") : r.totalStops && (r.completedStops || 0) >= r.totalStops ? "Complete" : r.actualDeparture ? "On Road" : "Updating"}
                        </Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{Math.floor(a.ageMinutes)} min ago</span>
                        <span tabIndex={0} className="group relative ml-2 inline-flex cursor-help focus-visible:outline-2 focus-visible:outline-primary" aria-label="Update evidence">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          <span role="tooltip" className="pointer-events-none absolute z-30 bottom-full right-0 mb-2 hidden w-72 whitespace-normal rounded border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
                            {r.detail ? "Detail captured. " : "Overview only. "}
                            Last delivery: {a.eventAgeMinutes == null ? "unknown" : `${Math.floor(Math.max(0, a.eventAgeMinutes))} min ago`}.
                            {r.detailObservedAt ? ` Detail updated ${Math.floor(Math.max(0, now - Date.parse(r.detailObservedAt)) / 60000)} minutes ago.` : ""}
                            {!demo && r.receivedAt && Number.isFinite(Date.parse(r.receivedAt)) && Number.isFinite(Date.parse(r.observedAt)) ? ` SYMX transfer: ${Date.parse(r.receivedAt) < Date.parse(r.observedAt) ? "clock difference" : `${Math.round((Date.parse(r.receivedAt) - Date.parse(r.observedAt)) / 1000)} seconds`}.` : ""}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !error && rows.length === 0 && (
            <p className="text-center py-12 text-muted-foreground">
              No route observations for this selection. Check the collector
              status, selected stations, and business day.
            </p>
          )}
          {loading && (
            <p role="status" className="p-8 text-center text-muted-foreground">
              Loading route observations…
            </p>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        {selected && (
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogTitle className="sr-only">{selected.routeCode} route details</DialogTitle>
            <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row justify-between">
            <div>
              <CardTitle>
                {selected.routeCode} · morning summary & driver history
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                {selected.driverName} · {selected.station} · history within the
                last 14 days
              </p>
            </div>

          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <p>
                Planned stops{" "}
                <strong className="block text-xl">
                  {selected.totalStops ?? "Unknown"}
                </strong>
              </p>
              <p>
                Planned departure{" "}
                <strong className="block text-xl">
                  {clock(selected.plannedDeparture)}
                </strong>
              </p>
              <p>
                Planned return{" "}
                <strong className="block text-xl">
                  {clock(selected.plannedReturn)}
                </strong>
              </p>
              <p>
                {selected.actualReturn ? "Actual return" : "Projected return"}
                <strong className="block text-xl">{clock(selected.actualReturn || assessRoute(selected, now).forecast)}</strong>
                <span className="text-xs text-muted-foreground">{selected.actualReturn ? "Recorded timestamp" : assessRoute(selected, now).confidence}</span>
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4 mb-6 text-sm space-y-2">
              <h3 className="font-semibold">Timing evidence & RTS confidence</h3>
              <p>{selected.actualReturn ? "Actual return recorded" : assessRoute(selected, now).confidence}</p>
              {!selected.actualReturn && <p>Missing inputs: {assessRoute(selected, now).missingForecastInputs.join(", ") || "None"}</p>}
              {assessRoute(selected, now).planComparisonNote && <p>{assessRoute(selected, now).planComparisonNote}</p>}
              <p>First delivery: {clock(selected.firstDelivery)} · Last delivery: {clock(selected.lastDelivery)}</p>
              <p>Inbound: {selected.inboundMinutes == null ? "Unavailable" : `${Math.round(selected.inboundMinutes)} min`} · {selected.timingEvidence?.inboundSource === "planned_return_gap" ? "Planned last-stop-to-station allowance, including final-stop service; not live travel" : selected.timingEvidence?.inboundSource === "explicit_stem" ? "Explicit planned inbound stem" : "Source not verified; recollect detail"}</p>
              {selected.timingEvidence && <>
                <p>Inbound field: {selected.timingEvidence.inboundField} · Planned RTS timestamp: {selected.timingEvidence.plannedRtsPresent ? "present" : "absent"} · Complete planned delivery list: {selected.timingEvidence.completePlan ? "yes" : "no"}</p>
                <p>Delivery task timestamps: {selected.timingEvidence.timestampedTasks} / {selected.timingEvidence.deliveredTasks} · Fully timestamped stops: {selected.timingEvidence.timestampedStops} / {selected.timingEvidence.deliveryStops} · Rejected timestamps: {selected.timingEvidence.rejectedTimestamps}</p>
              </>}
            </div>
            <DriverEvidence route={selected} history={data?.history || []} now={now} />
            <details><summary className="cursor-pointer text-sm font-medium mb-3">Captured route records</summary>
            <div className="space-y-2">
              {selected.driverId &&
                data?.history
                  .filter(
                    (h) =>
                      h.driverId === selected.driverId &&
                      h.station === selected.station,
                  )
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((h) => (
                    <div
                      key={`${h.date}:${h.routeCode}`}
                      className="flex flex-wrap gap-6 border-t pt-3 text-sm"
                    >
                      <span>{h.date}</span>
                      <span>{h.routeCode}</span>
                      <span>
                        {h.completedStops ?? "—"} / {h.totalStops ?? "—"} stops
                      </span>
                      <span>Return {clock(h.actualReturn)}</span>
                    </div>
                  ))}
              {(!selected.driverId ||
                !data?.history.some(
                  (h) =>
                    h.driverId === selected.driverId &&
                    h.station === selected.station,
                )) && (
                <p className="text-muted-foreground">
                  No captured history for this driver yet.
                </p>
              )}
            </div>
            </details>
          </CardContent>
            </Card>
          </DialogContent>
        )}
      </Dialog>

    </main>
  );
}
