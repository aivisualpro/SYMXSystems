"use client";
import { useEffect, useState } from "react";
import { useSiteContext } from "@/components/providers/site-context-provider";
import {
  assessRoute,
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
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setSelected(null);
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
      .then(setData)
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
  const risks = rows.filter((r) =>
    ["delay", "late departure"].includes(assessRoute(r, now).risk),
  ).length;
  const stale = rows.filter((r) => assessRoute(r, now).stale).length;
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
            Morning readiness, route progress, and an earlier view of delays.
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
            title: "Routes captured",
            value: rows.length,
            text: `${rows.filter((r) => !r.actualDeparture).length} awaiting departure`,
            icon: Route,
          },
          {
            title: "Stops completed",
            value: `${completed} / ${stops}`,
            text: stops
              ? `${Math.round((completed / stops) * 100)}% of captured workload`
              : "Waiting for overview",
            icon: Radio,
          },
          {
            title: "Early attention",
            value: risks,
            text: "Late departures or forecast ≥30 min late",
            icon: AlertTriangle,
          },
          {
            title: "Stale routes",
            value: stale,
            text: "Forecasts suppressed until refreshed",
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
      <Card>
        <CardHeader>
          <CardTitle>Delivery operations overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a route for its morning plan and driver history. Estimates
            support dispatcher review.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b text-muted-foreground">
                <tr>
                  {[
                    "Route / driver",
                    "Station",
                    "Progress",
                    "Departure · plan / actual",
                    "Approx. RTS",
                    "Attention",
                    "Data age",
                  ].map((h) => (
                    <th key={h} className="p-3 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = assessRoute(r, now);
                  return (
                    <tr
                      key={`${r.station}:${r.routeCode}:${r.driverId}`}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="p-3">
                        <button
                          className="font-medium underline underline-offset-4 text-left"
                          onClick={() => setSelected(r)}
                        >
                          {r.routeCode}
                        </button>
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
                      <td className="p-3 whitespace-nowrap">
                        {clock(r.plannedDeparture)} / {clock(r.actualDeparture)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {clock(r.actualReturn || a.forecast)}
                        <div className="text-xs text-muted-foreground">
                          {r.actualReturn
                            ? "Actual return"
                            : a.forecast
                              ? "Low confidence"
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
                          {a.risk}
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
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
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
            </div>
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
          </CardContent>
            </Card>
          </DialogContent>
        )}
      </Dialog>
      <p className="text-xs text-muted-foreground">
        RTS uses observed delivery pace plus the planned inbound stem. It
        excludes future breaks, traffic, rescues, and dispatch changes. Missing
        or stale observations produce no forecast. This view never changes
        Amazon assignments.
      </p>
    </main>
  );
}
