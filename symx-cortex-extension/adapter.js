/* Shared pure normalizer, also exercised in Vitest. No addresses, phone numbers, or raw stops leave Chrome. */
(function (root) {
  const epoch = (v) => {
    if (v == null || v === "") return null;
    // Cortex timestamps can be epoch seconds, milliseconds, microseconds,
    // or ISO-8601 strings. Do not treat a date-only string as a timestamp.
    if (typeof v === "string" && /[Tt]/.test(v) && /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(v)) {
      const parsed = Date.parse(v);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    const n = Number(v);
    return Number.isFinite(n) && n > 0
      ? Math.round(n >= 1e14 ? n / 1000 : n >= 1e11 ? n : n * 1000)
      : null;
  };
  const count = (v) =>
    v != null && Number.isFinite(Number(v)) && Number(v) >= 0
      ? Math.round(Number(v))
      : null;
  function normalize(data, kind) {
    if (
      kind === "overview" &&
      Array.isArray(data.itinerarySummaries) &&
      data.itinerarySummaries.length
    ) {
      const rows = data.itinerarySummaries.flatMap((it) =>
        normalize(
          { itineraryDetails: it, transporters: data.transporters },
          "detail",
        ).map((r) => ({ ...r, detail: false })),
      );
      const extra = normalize({ ...data, itinerarySummaries: [] }, "overview");
      return [
        ...rows,
        ...extra.filter((r) => !rows.some((x) => x.routeCode === r.routeCode)),
      ];
    }
    const details = data.itineraryDetails || {};
    const times = details.transporterTimeAttributes || {};
    const transporters = Array.isArray(data.transporters)
      ? data.transporters
      : [];
    const routes =
      kind === "detail"
        ? Array.isArray(details.routes) && details.routes.length
          ? details.routes
          : details.routeCode
            ? [details]
            : []
        : Array.isArray(data.rmsRouteSummaries)
          ? data.rmsRouteSummaries
          : Array.isArray(data.routeSummaries)
            ? data.routeSummaries
            : [];
    const seen = new Set();
    return routes
      .filter((r) => r && r.routeCode)
      .map((r) => {
        const p = r.routeDeliveryProgress || {};
        const sp = r.stopProgress || {};
        const driverId = String(
          details.transporterId ||
            r.transporterIdFromRms ||
            r.transporterId ||
            "",
        );
        const driver = transporters.find((t) => t.transporterId === driverId);
        const stops = (
          Array.isArray(data.stops)
            ? data.stops
            : Array.isArray(details.stops)
              ? details.stops
              : []
        ).filter(
          (s) =>
            // Some itinerary-detail responses omit routeCode on individual stops.
            // Only infer the route when the response contains exactly one route.
            (s.routeCode === r.routeCode ||
              (!s.routeCode && kind === "detail" && routes.length === 1)) &&
            s.sequenceNumber > 1 &&
            s.tasks?.some((t) => t.taskType === "DROP_OFF"),
        );
        const actuals = stops
          .flatMap((s) =>
            (s.tasks || [])
              .filter(
                (t) => t.taskType === "DROP_OFF" && t.taskState === "DELIVERED",
              )
              .map((t) => epoch(t.actualExecutionTime)),
          )
          .filter(Boolean);
        return {
          routeCode: String(r.routeCode),
          routeId: String(r.routeId || details.itineraryId || ""),
          driverId,
          driverName: driver
            ? [driver.firstName, driver.lastName].filter(Boolean).join(" ")
            : "Unassigned",
          totalStops: count(p.totalStops ?? sp.total ?? r.totalStops),
          completedStops: count(p.completedStops ?? sp.completed),
          totalPackages: count(p.totalDeliveries ?? r.totalTasks),
          completedPackages: count(p.completedDeliveries),
          plannedDeparture: epoch(
            r.plannedDepartureTime || times.plannedDepartureTime,
          ),
          actualDeparture: epoch(times.actualDepartureTime),
          plannedReturn: epoch(
            times.plannedReturnToStationTime ||
              times.plannedEndTime ||
              details.scheduleEndTime ||
              r.plannedEndTime,
          ),
          actualReturn: epoch(times.returnToStationTime),
          firstDelivery: actuals.length ? Math.min(...actuals) : null,
          lastDelivery: actuals.length ? Math.max(...actuals) : null,
          inboundMinutes:
            times.plannedInboundStemTime != null
              ? Number(times.plannedInboundStemTime) / 60000
              : null,
          detail: kind === "detail",
        };
      })
      .filter((r) => {
        const key = `${r.routeCode}|${r.driverId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  root.CortexAdapter = { normalize, epoch };
})(globalThis);
