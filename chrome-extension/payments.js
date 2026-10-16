// ══════════════════════════════════════════════════════════════
// SYMX Payments reader (MAIN world, flexpayments pages only). READ-ONLY.
// Watches the portal's own requests, replays them for each invoice, and sends
// the results to SYMX. It never clicks Accept or Dispute.
// Runs a sync when the URL contains symx_pay=1 (opened by the extension).
// ══════════════════════════════════════════════════════════════
(function () {
  if (!/\/flexpayments\//.test(location.pathname)) return;
  const OPS = ["getAllInvoices", "invoiceSummary", "batchDetails", "listDisputes", "listDraftAdjustments"];
  const seen = {};        // op -> { method, url, body, response }
  const logLines = [];
  const log = (m) => { logLines.push(m); console.log("[SYMX Payments]", m); };
  window.__symxPay = { seen, logLines };

  const opOf = (url) => OPS.find((o) => String(url).includes(o));
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const res = await origFetch.apply(this, arguments);
    try {
      const op = opOf(url);
      if (op) res.clone().json().then((j) => { seen[op] = { method: (init && init.method) || (input && input.method) || "GET", url, body: init && init.body, response: j }; }).catch(() => {});
    } catch (e) {}
    return res;
  };
  const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__sp = { method: m, url: u }; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) {
    const sp = this.__sp;
    if (sp && opOf(sp.url)) this.addEventListener("load", () => { try { seen[opOf(sp.url)] = { method: sp.method, url: sp.url, body: b, response: JSON.parse(this.responseText) }; } catch (e) {} });
    return xs.apply(this, arguments);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(op, ms) { const t = Date.now(); while (!seen[op] && Date.now() - t < ms) await sleep(300); return seen[op]; }

  // Call an operation for one invoice, based on how the page called it (or the list call as a guide).
  async function call(op, batchId, extra) {
    const tpl = seen[op] || seen.getAllInvoices;
    if (!tpl) return null;
    let url = tpl.url.replace(opOf(tpl.url), op);
    let method = (tpl.method || "GET").toUpperCase();
    let body;
    if (seen[op] && tpl.body) body = String(tpl.body).replace(/"batchId"\s*:\s*"[^"]*"/, `"batchId":"${batchId}"`);
    if (seen[op] && /batchId=/.test(url)) url = url.replace(/batchId=[^&]*/, "batchId=" + encodeURIComponent(batchId));
    if (!seen[op]) {
      if (method === "GET") url += (url.includes("?") ? "&" : "?") + "batchId=" + encodeURIComponent(batchId);
      else body = JSON.stringify(Object.assign({ batchId }, extra || {}));
    }
    try {
      const r = await origFetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: method === "GET" ? undefined : body });
      if (!r.ok) { log(`${op} ${batchId}: HTTP ${r.status}`); return null; }
      return await r.json();
    } catch (e) { log(`${op} ${batchId}: ${e.message}`); return null; }
  }

  // Turn whatever shape the summary comes in into [{heading, columns, rows:[{group, lines}]}]
  function toTables(summary) {
    const out = [];
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(walk);
      const heading = n.heading || n.title || n.tableName || n.name;
      const cols = n.columns || n.columnHeaders || n.headers;
      const rows = n.rows || n.lineItems || n.data;
      if (heading && Array.isArray(cols) && Array.isArray(rows)) {
        const cname = (c) => (typeof c === "string" ? c : c && (c.label || c.name || c.title || c.heading)) || "";
        const cell = (c) => (c && typeof c === "object" ? (c.value ?? c.text ?? c.displayValue ?? "") : c ?? "");
        out.push({
          heading: String(heading).toLowerCase(), columns: cols.map(cname),
          rows: rows.map((r) => {
            const grp = r.group || r.groupValues || r.header || [];
            const lines = r.lines || r.children || r.subRows || (Array.isArray(r) ? [r] : r.cells ? [r.cells] : []);
            return { group: (Array.isArray(grp) ? grp : [grp]).map(cell).map(String), lines: lines.map((l) => (Array.isArray(l) ? l : l.cells || l.values || []).map(cell).map(String)) };
          }),
        });
        return;
      }
      Object.values(n).forEach(walk);
    };
    walk(summary);
    return out;
  }

  const find = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined) return o[k]; return undefined; };
  const post = (type, payload) => window.postMessage({ source: "SYMX_CONTENT", type, payload }, "*");

  async function run() {
    const t0 = await waitFor("getAllInvoices", 25000);
    if (!t0) { post("PAY_DONE", { note: "no invoice list seen — open the Payments > Invoices page while signed in" }); return; }
    const list = find(t0.response, ["invoices", "batches", "invoiceList", "batchList", "items"]) || (Array.isArray(t0.response) ? t0.response : []);
    log(`list: ${list.length} invoices`);
    const cutoff = Date.now() - 150 * 864e5;
    const rows = list.filter((r) => { const t = Number(r.invoiceDateInEpochMillis); return !t || t >= cutoff; });
    let sent = 0, detailed = 0, chunk = [];
    const flush = () => { if (chunk.length) { post("PAY_SYNC", { invoices: chunk }); sent += chunk.length; chunk = []; } };
    for (const row of rows) {
      const batchId = String(row.batchId || "");
      if (!batchId) continue;
      const open = row.disputeWindowStatus === "OPEN";
      const recent = Number(row.invoiceDateInEpochMillis) > Date.now() - 35 * 864e5;
      const item = { list: row };
      if (open || recent) {
        const [sum, batch, disp, adj] = await Promise.all([call("invoiceSummary", batchId), call("batchDetails", batchId), call("listDisputes", batchId), call("listDraftAdjustments", batchId)]);
        if (sum) { item.tables = toTables(sum); if (item.tables.length) detailed++; else log(`summary for ${batchId}: no tables recognised`); }
        if (batch) item.batch = batch; if (disp) item.disputes = disp; if (adj) item.adjustments = adj;
      }
      chunk.push(item);
      if (chunk.length >= 5) flush();
    }
    flush();
    post("PAY_DONE", { note: `sent ${sent} invoices (${detailed} with line items)${logLines.length ? " · " + logLines.slice(-3).join("; ") : ""}` });
  }

  if (/[?&]symx_pay=1/.test(location.search)) {
    const start = () => run().catch((e) => post("PAY_DONE", { note: "error: " + e.message }));
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  }
})();
