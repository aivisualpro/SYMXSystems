/* Shared pure normalizer, also exercised in Vitest. No addresses, phone numbers, or raw stops leave Chrome. */
(function (root) {
  const epoch = (v) => {
    if (!["number", "string"].includes(typeof v)) return null;
    if (v == null || v === "") return null;
    // Cortex timestamps can be epoch seconds, milliseconds, microseconds,
    // or ISO-8601 strings. Do not treat a date-only string as a timestamp.
    if (typeof v === "string" && /[Tt]/.test(v) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v)) {
      const parsed = Date.parse(v);
      return Number.isFinite(parsed) && parsed >= 946684800000 && parsed < 4102444800000 ? parsed : null;
    }
    const n = Number(v);
    const ms = Number.isFinite(n) && n >= 1e8
      ? Math.round(n >= 1e14 ? n / 1000 : n >= 1e11 ? n : n * 1000) : null;
    return ms != null && ms >= 946684800000 && ms < 4102444800000 ? ms : null;
  };
  const count = (v) =>
    ["number", "string"].includes(typeof v) && String(v).trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0
      ? Math.round(Number(v))
      : null;
  // This field's numeric contract is milliseconds (see lib/cortex-time.ts).
  // Never guess seconds/minutes from magnitude. Text encodings must carry units.
  function duration(v) {
    if (v == null || v === "" || !["number", "string"].includes(typeof v)) return null;
    let minutes = null;
    if (typeof v === "string" && /^\d{1,2}:[0-5]\d$/.test(v)) {
      const [h, m] = v.split(":").map(Number); minutes = h * 60 + m;
    } else if (typeof v === "string" && /^PT(?=\d)(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?$/.test(v)) {
      const parts = v.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
      minutes = Number(parts[1] || 0) * 60 + Number(parts[2] || 0) + Number(parts[3] || 0) / 60;
    } else if (String(v).trim() && Number.isFinite(Number(v))) minutes = Number(v) / 60000;
    return minutes != null && minutes >= 0 && minutes <= 240 ? minutes : null;
  }
  function normalize(data, kind, observedAt) {
    if (!data || typeof data !== "object") return [];
    const observed = epoch(observedAt) || Date.now();
    const actual = (v) => { const t = epoch(v); return t && t <= observed + 120000 ? t : null; };
    if (
      kind === "overview" &&
      Array.isArray(data.itinerarySummaries) &&
      data.itinerarySummaries.length
    ) {
      const rows = data.itinerarySummaries.flatMap((it) =>
        normalize(
          { itineraryDetails: it, transporters: data.transporters },
          "detail", observedAt,
        ).map((r) => ({ ...r, detail: false })),
      );
      const extra = normalize({ ...data, itinerarySummaries: [] }, "overview", observedAt);
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
        const driver = transporters.find((t) => t?.transporterId === driverId);
        const stops = (
          Array.isArray(data.stops)
            ? data.stops
            : Array.isArray(details.stops)
              ? details.stops
              : []
        ).filter(
          (s) => s &&
            // Some itinerary-detail responses omit routeCode on individual stops.
            // Only infer the route when the response contains exactly one route.
            (s.routeCode === r.routeCode ||
              (!s.routeCode && kind === "detail" && routes.length === 1)) &&
            s.sequenceNumber > 1 &&
            Array.isArray(s.tasks) && s.tasks.some((t) => t?.taskType === "DROP_OFF"),
        );
        const delivered = stops.flatMap(s => s.tasks.filter(t => t?.taskType === "DROP_OFF" && t.taskState === "DELIVERED"));
        const actuals = delivered.map(t => actual(t.actualExecutionTime)).filter(t => t != null);
        // Count completed stops, never packages; a partially completed multi-package stop is not complete.
        const completionTimes = stops.flatMap(s => {
          const drops = s.tasks.filter(t => t?.taskType === "DROP_OFF");
          const times = drops.map(t => t.taskState === "DELIVERED" ? actual(t.actualExecutionTime) : null);
          return times.length && times.every(t => t != null) ? [Math.max(...times)] : [];
        });
        const totalStops = count(p.totalStops ?? sp.total ?? r.totalStops);
        const explicitInbound = routes.length === 1 ? duration(times.plannedInboundStemTime) : null;
        // Only a complete single-route stop list can establish the last planned delivery.
        // This is an allowance including final-stop service, NOT an observed travel duration.
        const plannedStops = stops.map(s => epoch(s.expectedStartTime));
        const plannedRts = epoch(times.plannedRtsTime);
        const completePlan = kind === "detail" && routes.length === 1 && totalStops > 0 &&
          stops.length === totalStops && new Set(stops.map(s => s.sequenceNumber)).size === stops.length &&
          plannedStops.every(t => t != null);
        const gap = completePlan && plannedRts ? (plannedRts - Math.max(...plannedStops)) / 60000 : null;
        const allowance = gap != null && gap >= 0 && gap <= 240 ? gap : null;
        const inboundMinutes = explicitInbound ?? allowance;
        const inboundSource = explicitInbound != null ? "explicit_stem" : allowance != null ? "planned_return_gap" : "missing";
        const timingEvidence = {
          inboundSource,
          inboundField: times.plannedInboundStemTime == null ? "absent" : explicitInbound == null ? "invalid" : "valid",
          plannedRtsPresent: plannedRts != null,
          completePlan,
          deliveryStops: stops.length,
          deliveredTasks: delivered.length,
          timestampedTasks: actuals.length,
          timestampedStops: completionTimes.length,
          rejectedTimestamps: delivered.filter(t => t.actualExecutionTime != null && actual(t.actualExecutionTime) == null).length,
        };
        return {
          routeCode: String(r.routeCode),
          routeId: String(r.routeId || details.itineraryId || ""),
          driverId,
          driverName: driver
            ? [driver.firstName, driver.lastName].filter(Boolean).join(" ")
            : "Unassigned",
          totalStops,
          completedStops: count(p.completedStops ?? sp.completed),
          totalPackages: count(p.totalDeliveries ?? r.totalTasks),
          completedPackages: count(p.completedDeliveries),
          plannedDeparture: epoch(
            r.plannedDepartureTime || times.plannedDepartureTime,
          ),
          actualDeparture: actual(times.actualDepartureTime),
          plannedReturn: epoch(
            times.plannedRtsTime ||
              times.plannedReturnToStationTime,
          ),
          actualReturn: actual(times.returnToStationTime),
          firstDelivery: actuals.length ? Math.min(...actuals) : null,
          lastDelivery: actuals.length ? Math.max(...actuals) : null,
          firstStopCompleted: completionTimes.length ? Math.min(...completionTimes) : null,
          lastStopCompleted: completionTimes.length ? Math.max(...completionTimes) : null,
          inboundMinutes,
          timingEvidence,
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
  root.CortexAdapter = { normalize, epoch, duration };
})(globalThis);
