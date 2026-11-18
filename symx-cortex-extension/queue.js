(function (root) {
  function endpoint(value) {
    const u = new URL(value);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      u.hostname === "symx-systems.vercel.app"
    )
      throw new Error("Use an isolated preview origin");
    if (
      !(u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      )
    )
      throw new Error("Use localhost or a Vercel preview origin");
    return u.origin;
  }
  function retry(attempt, now, retryAfter = 0) {
    return (
      now +
      Math.max(retryAfter, Math.min(3600000, 15000 * 2 ** Math.min(attempt, 8)))
    );
  }
  function expired(item, now) {
    return (
      now - Date.parse(item.capture.observedAt) > 7 * 86400000 ||
      item.attempts >= 12
    );
  }
  root.CortexQueue = { endpoint, retry, expired };
})(globalThis);
