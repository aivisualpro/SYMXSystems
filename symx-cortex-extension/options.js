const el = (id) => document.getElementById(id);
async function refresh() {
  const {
    config,
    outbox = [],
    health = {},
    deadLetters = [],
  } = await chrome.storage.local.get([
    "config",
    "outbox",
    "health",
    "deadLetters",
  ]);
  el("health").textContent = JSON.stringify(
    { queued: outbox.length, failed: deadLetters.length, stations: health },
    null,
    2,
  );
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
      ? "Request received. Check DFO2 manualRequestStatus below for the actual result."
      : result === undefined
        ? "No response from extension worker. Check that the extension was reloaded after git pull."
        : (result?.error || `Collection rejected: ${JSON.stringify(result)}`);
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
