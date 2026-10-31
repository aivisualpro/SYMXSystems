/* Observe only successful requests made by the signed-in Cortex page. Never issue Amazon API calls. */
(() => {
  const pending = new Map();
  const targets = new Map();
  const run = new URL(location.href).searchParams.has("symx_cortex_run");
  let driving = false,
    lastOverview = 0,
    overviewAcknowledged = false;
  const send = (payload) =>
    new Promise((resolve) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(false);
      }, 30000);
      pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      window.postMessage(
        { source: "SYMX_CORTEX_PAGE", type: "capture", id, payload },
        location.origin,
      );
    });
  window.addEventListener("message", (e) => {
    if (
      e.source === window &&
      e.origin === location.origin &&
      e.data?.source === "SYMX_CORTEX_BRIDGE"
    ) {
      const done = pending.get(e.data.id);
      if (done) {
        pending.delete(e.data.id);
        done(e.data.ok);
      }
    }
  });
  const detailAcks = new Set();
  let blocked = false;
  const started = Date.now();
  let timedOut = 0, skippedForBudget = 0;
  const progress = (type, reason) => window.postMessage({
    source: "SYMX_CORTEX_PAGE", type, reason,
    ok: overviewAcknowledged && targets.size > 0 && [...targets.keys()].every(id => detailAcks.has(id)),
    coverage: {
      expected: targets.size,
      acknowledged: [...targets.keys()].filter(id => detailAcks.has(id)).length,
      timedOut, skipped: skippedForBudget,
      overviewAcknowledged, durationMs: Date.now() - started,
    },
  }, location.origin);
  async function observe(rawUrl, data) {
    try {
      const url = new URL(rawUrl, location.origin);
      if (
        url.origin !== location.origin ||
        (!url.pathname.startsWith("/operations/execution/api/") &&
          !url.pathname.startsWith("/execution/api/"))
      )
        return;
      const detail = !!data?.itineraryDetails;
      const overview =
        Array.isArray(data?.routeSummaries) ||
        Array.isArray(data?.rmsRouteSummaries) ||
        Array.isArray(data?.itinerarySummaries);
      if (!detail && !overview) return;
      const page = new URL(location.href);
      const date =
        url.searchParams.get("selectedDay") ||
        url.searchParams.get("date") ||
        page.searchParams.get("selectedDay");
      const serviceAreaId =
        url.searchParams.get("serviceAreaId") ||
        data.itineraryDetails?.serviceAreaId ||
        page.searchParams.get("serviceAreaId");
      if (!date || !serviceAreaId) return;
      const observedAt = new Date().toISOString();
      const detailId =
        url.searchParams.get("itineraryId") ||
        data.itineraryDetails?.itineraryId ||
        page.pathname.split("/itineraries/")[1]?.split("/")[0];
      if (overview) {
        lastOverview = Date.now();
        const realCodes = new Set();
        for (const it of data.itinerarySummaries || [])
          if (it.itineraryId) {
            targets.set(it.itineraryId, "Itinerary");
            for (const r of it.routes || [])
              if (r.routeCode) realCodes.add(r.routeCode);
          }
        for (const r of data.routeSummaries || data.rmsRouteSummaries || [])
          if (realCodes.has(r.routeCode)) targets.delete(r.routeId);
        for (const r of data.routeSummaries || data.rmsRouteSummaries || [])
          if (
            r.routeId &&
            r.routeCode &&
            !realCodes.has(r.routeCode) &&
            !r.itineraryId
          )
            targets.set(r.routeId, "RMSRoute");
      }
      const ok = await send({
        serviceAreaId,
        date: date.slice(0, 10),
        observedAt,
        kind: detail ? "detail" : "overview",
        data,
      });
      if (overview && ok) overviewAcknowledged = true;
      if (detail && ok && detailId) detailAcks.add(detailId);
    } catch {
      /* An unrelated or unfamiliar response must not break Cortex. */
    }
  }
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url =
      typeof args[0] === "string" || args[0] instanceof URL
        ? String(args[0])
        : args[0]?.url;
    if (/\/execution\/api\//.test(url || "") && [401, 403, 429].includes(response.status)) blocked = true;
    if (response.ok && /\/execution\/api\//.test(url || ""))
      response
        .clone()
        .json()
        .then((data) => observe(url, data))
        .catch(() => {});
    return response;
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener(
      "load",
      () => {
        if (/\/execution\/api\//.test(String(url)) && [401, 403, 429].includes(this.status)) blocked = true;
        if (
          this.status < 200 ||
          this.status >= 300 ||
          !/\/execution\/api\//.test(String(url))
        )
          return;
        try {
          observe(
            String(url),
            this.responseType === "json"
              ? this.response
              : JSON.parse(this.responseText),
          );
        } catch {}
      },
      { once: true },
    );
    return open.call(this, method, url, ...rest);
  };
  if (run) {
    const timer = setInterval(async () => {
      if (driving) return;
      if (blocked) { clearInterval(timer); progress("done", "access"); return; }
      if (!lastOverview || Date.now() - lastOverview < 5000) {
        if (Date.now() - started > 90000) {
          clearInterval(timer);
          progress("done", "no_overview");
        }
        return;
      }
      driving = true;
      clearInterval(timer);
      const origin = location.pathname + location.search;
      let consecutiveTimeouts = 0;
      let reason = "finished";
      progress("progress");
      const page = new URL(location.href);
      for (const [id, type] of targets) {
        if (blocked || consecutiveTimeouts >= 3 || Date.now() - started > 7 * 60000) {
          skippedForBudget = Math.max(0, targets.size - [...targets.keys()].filter(id => detailAcks.has(id)).length - timedOut);
          reason = blocked ? "access" : consecutiveTimeouts >= 3 ? "stalled" : "finished";
          break;
        }
        if (detailAcks.has(id)) continue; // Passive captures already acknowledged need no repeat navigation.
        const navigationStarted = Date.now();
        const query = new URLSearchParams({
          provider: "ALL_DRIVERS",
          selectedDay: page.searchParams.get("selectedDay"),
          serviceAreaId: page.searchParams.get("serviceAreaId"),
        });
        history.pushState(
          {},
          "",
          `/operations/execution/itineraries/${encodeURIComponent(id)}/documentType/${type}?${query}`,
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
        const until = Date.now() + 30000;
        while (!blocked && !detailAcks.has(id) && Date.now() < until)
          await new Promise((r) => setTimeout(r, 500));
        if (detailAcks.has(id)) consecutiveTimeouts = 0;
        else { timedOut++; consecutiveTimeouts++; }
        progress("progress");
        // At most one navigation per second, one outstanding route at a time.
        await new Promise(r => setTimeout(r, Math.max(0, 1000 - (Date.now() - navigationStarted))));
      }
      if (!blocked) {
        history.pushState({}, "", origin);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      progress("done", blocked ? "access" : targets.size ? reason : "no_targets");
    }, 1000);
  }
})();
