const el = (id) => document.getElementById(id);
async function refresh() {
  const {
    config,
    outbox = [],
    health = {},
    deadLetters = [],
    jobs = {},
  } = await chrome.storage.local.get([
    "config",
    "outbox",
    "health",
    "deadLetters",
    "jobs",
  ]);
  el("health").textContent = JSON.stringify(
    { queued: outbox.length, failed: deadLetters.length, stations: health },
    null,
    2,
  );
  const panel = el("collection-health");
  panel.replaceChildren();
  const summary = document.createElement("p");
  summary.textContent = `${outbox.length} queued · ${deadLetters.length} failed deliveries`;
  panel.append(summary);
  for (const code of ["DFO2", "DXC8", "DFO3"]) {
    const h = health[code];
    if (!h && !config?.stations?.some(s => s.code === code)) continue;
    const card = document.createElement("article"); card.className = "station";
    const heading = document.createElement("strong"); heading.textContent = `${code} · ${h?.captureStatus || "Not collected"}`; card.append(heading);
    const lines = [];
    if (h?.coverage) {
      const c = h.coverage;
      lines.push(`${c.acknowledged} / ${c.expected} itinerary details acknowledged`);
      lines.push(`${c.timedOut} timed out · ${c.skipped} not attempted · ${Math.round(c.durationMs / 1000)}s elapsed`);
      lines.push(`Overview ${c.overviewAcknowledged ? "acknowledged" : "not acknowledged"}`);
    }
    if (h?.captureDetail) lines.push(h.captureDetail);
    if (h?.lastObservedAt) lines.push(`Latest observation: ${Math.max(0, Math.floor((Date.now() - Date.parse(h.lastObservedAt)) / 60000))} min ago`);
    if (h?.observedToAckMs != null) lines.push(`Observation → acknowledgement: ${(h.observedToAckMs / 1000).toFixed(1)}s`);
    if (h?.lastRoundTripMs != null) lines.push(`Last sync round trip: ${(h.lastRoundTripMs / 1000).toFixed(1)}s`);
    if (h?.error) lines.push(`Sync error: ${h.error}`);
    for (const line of lines) { const p = document.createElement("p"); p.textContent = line; card.append(p); }
    panel.append(card);
  }
  el("collect-now").disabled = Object.values(jobs).some(job => job.code === "DFO2");
  return config;
}
refresh().then((config) => {
  if (!config) return;
  el("origin").value = config.origin;
  el("key").value = config.key;
  el("enabled").checked = config.enabled;
  for (const s of config.stations) el(s.code).value = s.serviceAreaId;
});
el("settings").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const origin = CortexQueue.endpoint(el("origin").value);
    const stations = ["DFO2", "DXC8", "DFO3"]
      .map((code) => ({ code, serviceAreaId: el(code).value.trim() }))
      .filter((s) => s.serviceAreaId);
    if (
      new Set(stations.map((s) => s.serviceAreaId)).size !== stations.length ||
      false
    )
      throw new Error("Enter distinct authorized service areas");
    const result = await chrome.runtime.sendMessage({
      type: "configure",
      config: {
        origin,
        key: el("key").value,
        enabled: el("enabled").checked,
        stations,
      },
    });
    if (!result?.ok)
      throw new Error(result?.error || "Settings could not be saved");
    el("status").textContent =
      stations.length ? "Saved. Collection is configured for known stations." : "Saved. Open an authorized Amazon Cortex page to identify the station automatically.";
  } catch (e) {
    el("status").textContent = e.message;
  }
});
el("collect-now").addEventListener("click", async () => {
  const button = el("collect-now");
  button.disabled = true;
  el("status").textContent = "Starting DFO2 collection…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "collect-now" });
    el("status").textContent = result?.ok
      ? "DFO2 collection started. Coverage updates below while it runs."
      : result === undefined
        ? "No response from extension worker. Check that the extension was reloaded after git pull."
        : (result?.error || "Collection unavailable");
  } catch (e) {
    el("status").textContent = e.message;
  } finally {
    button.disabled = false;
    await refresh();
  }
});
el("retry").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "retry" });
  el("status").textContent = result?.ok
    ? "Retry queued; delivery resumes on the next minute tick."
    : "Retry unavailable; check pending queue size.";
  await refresh();
});
setInterval(refresh, 3000);
