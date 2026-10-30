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
    const started = Date.now();
    const timer = setInterval(async () => {
      if (driving) return;
      if (!lastOverview || Date.now() - lastOverview < 5000) {
        if (Date.now() - started > 90000) {
          clearInterval(timer);
          window.postMessage(
            {
              source: "SYMX_CORTEX_PAGE",
              type: "done",
              ok: false,
              detail: "No overview: sign in or review API compatibility",
            },
            location.origin,
          );
        }
        return;
      }
      driving = true;
      clearInterval(timer);
      const origin = location.pathname + location.search;
      let completed = 0;
      let timedOut = 0;
      let skippedForBudget = 0;
      const page = new URL(location.href);
      for (const [id, type] of targets) {
        if (Date.now() - started > 7 * 60000) {
          skippedForBudget = targets.size - completed - timedOut;
          break;
        }
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
        while (!detailAcks.has(id) && Date.now() < until)
          await new Promise((r) => setTimeout(r, 500));
        if (detailAcks.has(id)) completed++;
        else timedOut++;
      }
      history.pushState({}, "", origin);
      window.dispatchEvent(new PopStateEvent("popstate"));
      const incomplete = [...targets.keys()].filter((id) => !detailAcks.has(id));
      window.postMessage(
        {
          source: "SYMX_CORTEX_PAGE",
          type: "done",
          ok:
            overviewAcknowledged &&
            targets.size > 0 &&
            incomplete.length === 0,
          detail: targets.size === 0
            ? "Overview captured, but no detail targets were discovered; check Cortex route response compatibility"
            : `${completed}/${targets.size} details acknowledged; ${timedOut} timed out; ${skippedForBudget} not attempted due to run limit` +
              (incomplete.length ? `; first missing IDs: ${incomplete.slice(0, 3).join(", ")}` : ""),
        },
        location.origin,
      );
    }, 1000);
  }
})();
