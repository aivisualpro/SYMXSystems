window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.source !== "SYMX_CORTEX_PAGE"
  )
    return;
  const { type, id, payload, ok, coverage, reason } = event.data;
  if (!["capture", "progress", "done"].includes(type)) return;
  try {
    const result = await chrome.runtime.sendMessage({
      type,
      id,
      payload,
      ok,
      coverage,
      reason,
    });
    if (type === "capture")
      window.postMessage(
        { source: "SYMX_CORTEX_BRIDGE", id, ok: !!result?.ok },
        location.origin,
      );
  } catch {
    if (type === "capture")
      window.postMessage(
        { source: "SYMX_CORTEX_BRIDGE", id, ok: false },
        location.origin,
      );
  }
});
