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

import { RefreshCw, Radio, Route, Clock3, AlertTriangle } from "lucide-react";

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
    <main className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" /> DELIVERY OPERATIONS · PACIFIC TIME
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            SYMX Cortex
          </h1>
          <p className="text-muted-foreground mt-1">
            Routes, pace and driver alerts.
          </p>
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            icon: Radio,
          },
          {
            title: "Needs review",
            value: risks,
            text: "Drivers to check",
            icon: AlertTriangle,
          },
          {
            title: "Stale",
            value: stale,
            text: "Outdated data",
            icon: Clock3,
          },
        ].map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                {loading ? "…" : c.value}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{c.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border p-4 text-sm space-y-2" aria-label="Collection completeness">
        <div className="font-medium">Data coverage · {coverage.routes} routes</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span>Route details: {coverage.freshDetails} / {coverage.routes}</span>
          <span>Timestamps: {coverage.withDeliveryEvents} / {coverage.routes}</span>
          <span>Return travel: {coverage.explicitInbound} / {coverage.routes}</span>
          <span>Return allowance: {coverage.plannedAllowance} / {coverage.routes}</span>
          <span>RTS forecasts: {coverage.forecasts} / {coverage.routes}</span>
        </div>
      </div>
      <AttentionPanel queue={queue} onOpen={setSelected} />
      <Card>
        <CardHeader>
          <CardTitle>Routes overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b text-muted-foreground">
                <tr>
                  {[
                    "Driver / route",
                    "Station",
                    "Progress",
                    "Pace / hr",
                    "Departure",
                    "Est. RTS",
                    "Attention",
                    "Updated",
                  ].map((h) => (
                    <th key={h} className="p-3 font-medium whitespace-nowrap">
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
                      className="border-b last:border-0 hover:bg-muted/50"
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
                            : r.driverName}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{r.station}</Badge>
                      </td>
                      <td className="p-3 min-w-36">
                        <div>
                          {r.completedStops ?? "—"} / {r.totalStops ?? "—"}{" "}
                          stops
                        </div>
                        <div className="h-1.5 bg-muted rounded mt-2 overflow-hidden">
                          <div
                            className="h-full bg-primary"
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
                      <td className="p-3 min-w-28">
                        <strong>{attributable ? a.paceWindows.recent?.rate.toFixed(1) || "—" : "—"}</strong>
                        <div className="text-xs text-muted-foreground">Earlier {attributable ? a.paceWindows.earlier?.rate.toFixed(1) || "—" : "—"}</div>
                        {attributable && a.paceWindows.changePercent != null && <div className="text-xs">{Math.abs(a.paceWindows.changePercent).toFixed(0)}% {a.paceWindows.changePercent < 0 ? "lower" : "higher"}</div>}
                        {!attributable && <div className="text-xs text-muted-foreground">Driver attribution unavailable</div>}
                        {a.paceWindows.overall && (a.stale || a.detailStale) && <div className="text-xs text-muted-foreground">Stale sample</div>}
                        {!r.deliveryEvents && <div className="text-xs text-muted-foreground">Awaiting stop timestamps</div>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {clock(r.plannedDeparture)} / {clock(r.actualDeparture)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {clock(r.actualReturn || a.forecast)}
                        {a.forecastDeltaMinutes != null && <div className="text-xs">{Math.abs(Math.round(a.forecastDeltaMinutes))} min {a.forecastDeltaMinutes < 0 ? "before" : "past"} plan</div>}
                        <div className="text-xs text-muted-foreground max-w-72 whitespace-normal">
                          {r.actualReturn
                            ? "Actual return"
                            : a.forecast
                              ? a.confidence
                              : a.missingForecastInputs.length
                                ? `Missing: ${a.missingForecastInputs.slice(0, 2).join(", ")}${a.missingForecastInputs.length > 2 ? " · see details" : ""}`
                                : a.confidence}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            ["delay", "late departure", "stale"].includes(
                              a.risk,
                            )
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {a.candidates.length ? a.priority : a.risk}
                        </Badge>
                        {a.delayMinutes != null && a.delayMinutes >= 30 && (
                          <div className="text-xs mt-1">
                            ~{Math.round(a.delayMinutes)} min past plan
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {Math.floor(a.ageMinutes)} min
                        <div className="text-xs text-muted-foreground">
                          {r.detail
                            ? `Detail${r.detailObservedAt ? ` · ${Math.floor(Math.max(0, now - Date.parse(r.detailObservedAt)) / 60000)} min` : ""}`
                            : "Overview only"}
                        </div>
                        <div className="text-xs text-muted-foreground">Last delivery: {a.eventAgeMinutes == null ? "unknown" : `${Math.floor(Math.max(0, a.eventAgeMinutes))} min ago`}</div>
                        {!demo && r.receivedAt && Number.isFinite(Date.parse(r.receivedAt)) && Number.isFinite(Date.parse(r.observedAt)) && (
                          <div className="text-xs text-muted-foreground mt-1" title="Time from extension observation to SYMX database receipt; does not measure when Amazon first learned of the delivery">
                            SYMX transfer: {Date.parse(r.receivedAt) < Date.parse(r.observedAt) ? "clock difference" : `${Math.round((Date.parse(r.receivedAt) - Date.parse(r.observedAt)) / 1000)}s`}
                          </div>
                        )}
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
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
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
      <p className="text-xs text-muted-foreground">
        RTS uses observed delivery pace plus an explicit planned inbound stem or a labeled planned return allowance. It
        excludes future breaks, traffic, rescues, and dispatch changes. Missing
        or stale observations produce no forecast. This view never changes
        Amazon assignments.
      </p>
    </main>
  );
}
