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

  const pageBatch = () => (location.pathname.match(/invoices\/([0-9a-f-]{20,})/i) || [])[1] || "";
  const opOf = (url) => OPS.find((o) => String(url).includes(o));
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const res = await origFetch.apply(this, arguments);
    try {
      const op = opOf(url);
      if (op) res.clone().json().then((j) => { seen[op] = { method: (init && init.method) || (input && input.method) || "GET", url, body: init && init.body, response: j, sample: pageBatch() }; }).catch(() => {});
    } catch (e) {}
    return res;
  };
  const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__sp = { method: m, url: u }; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) {
    const sp = this.__sp;
    if (sp && opOf(sp.url)) this.addEventListener("load", () => { try { seen[opOf(sp.url)] = { method: sp.method, url: sp.url, body: b, response: JSON.parse(this.responseText), sample: pageBatch() }; } catch (e) {} });
    return xs.apply(this, arguments);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(op, ms) { const t = Date.now(); while (!seen[op] && Date.now() - t < ms) await sleep(300); return seen[op]; }

  // Call an operation for one invoice, based on how the page called it (or the list call as a guide).
  async function call(op, batchId, extra) {
    const tpl = seen[op];
    if (!tpl) return null; // no template learned from the page yet
    const swap = (str) => (tpl.sample ? String(str || "").split(tpl.sample).join(batchId) : String(str || ""));
    const url = swap(tpl.url);
    const method = (tpl.method || "GET").toUpperCase();
    const body = method === "GET" ? undefined : swap(tpl.body);
    try {
      const r = await origFetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" }, body });
      if (!r.ok) { log(`${op} ${batchId.slice(0, 8)}: HTTP ${r.status}`); return null; }
      return await r.json();
    } catch (e) { log(`${op} ${batchId.slice(0, 8)}: ${e.message}`); return null; }
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

  const findList = (n, d) => {
    if (!n || typeof n !== "object" || d > 5) return null;
    if (Array.isArray(n)) { if (n.length && n[0] && typeof n[0] === "object" && n[0].batchId) return n; for (const x of n) { const r = findList(x, d + 1); if (r) return r; } return null; }
    for (const k of Object.keys(n)) { const r = findList(n[k], d + 1); if (r) return r; }
    return null;
  };
  const DETAIL = (id) => `${location.origin}${(location.pathname.match(/^(.*?\/invoices)/) || [, "/flexpayments/simpson/flexpro/invoices"])[1]}/${id}?symx_pay=2`;
  const sendRows = async (rows, withDetail) => {
    let sent = 0, detailed = 0, chunk = [];
    const flush = () => { if (chunk.length) { post("PAY_SYNC", { invoices: chunk }); sent += chunk.length; chunk = []; } };
    for (const row of rows) {
      const batchId = String(row.batchId || "");
      if (!batchId) continue;
      const item = { list: row };
      const open = row.disputeWindowStatus === "OPEN";
      const recent = Number(row.invoiceDateInEpochMillis) > Date.now() - 35 * 864e5;
      if (withDetail && (open || recent)) {
        const [sum, batch, disp, adj] = await Promise.all([call("invoiceSummary", batchId), call("batchDetails", batchId), call("listDisputes", batchId), call("listDraftAdjustments", batchId)]);
        if (sum) { item.tables = toTables(sum); if (item.tables.length) detailed++; else log(`summary ${batchId.slice(0, 8)}: no tables recognised`); }
        if (batch) item.batch = batch; if (disp) item.disputes = disp; if (adj) item.adjustments = adj;
      }
      chunk.push(item);
      if (chunk.length >= 5) flush();
    }
    flush();
    return { sent, detailed };
  };

  // Phase 1 (invoice list page): read the list, then open the first recent invoice so the page
  // makes its own detail calls — we learn the real endpoints from those and replay them.
  async function run() {
    const t0 = await waitFor("getAllInvoices", 25000);
    if (!t0) { post("PAY_DONE", { note: "no invoice list seen — open Payments > Invoices while signed in" }); return; }
    const list = findList(t0.response, 0) || [];
    if (!list.length) { post("PAY_DONE", { note: "list shape: keys=" + Object.keys(t0.response || {}).join(",") }); return; }
    log(`list: ${list.length} invoices`);
    const cutoff = Date.now() - 150 * 864e5;
    const rows = list.filter((r) => { const t = Number(r.invoiceDateInEpochMillis); return !t || t >= cutoff; });
    try { sessionStorage.setItem("symx_pay_rows", JSON.stringify(rows)); } catch (e) {}
    const probe = rows.find((r) => r.disputeWindowStatus === "OPEN") || rows[0];
    if (!probe) { post("PAY_DONE", { note: "no invoices" }); return; }
    location.href = DETAIL(probe.batchId); // phase 2 continues on the detail page
  }

  // Phase 2 (invoice detail page): endpoints are now known from the page's own calls.
  async function run2() {
    let rows = []; try { rows = JSON.parse(sessionStorage.getItem("symx_pay_rows") || "[]"); } catch (e) {}
    if (!rows.length) { post("PAY_DONE", { note: "lost the invoice list between pages" }); return; }
    const need = ["invoiceSummary"];
    const t = Date.now(); while (need.some((o) => !seen[o]) && Date.now() - t < 20000) await sleep(400);
    await sleep(1200); // let batchDetails / disputes finish too
    log("learned: " + Object.keys(seen).filter((k) => k !== "getAllInvoices").map((k) => k + " " + seen[k].url.replace(/^https?:\/\/[^/]+/, "").slice(0, 70)).join(" | "));
    const withDetail = !!seen.invoiceSummary;
    if (!withDetail) log("page never called invoiceSummary — sending list only");
    const { sent, detailed } = await sendRows(rows, withDetail);
    try { sessionStorage.removeItem("symx_pay_rows"); } catch (e) {}
    post("PAY_DONE", { note: `sent ${sent} invoices (${detailed} with line items)${logLines.length ? " · " + logLines.slice(-3).join("; ") : ""}` });
  }

  if (/[?&]symx_pay=1/.test(location.search)) {
    const start = () => run().catch((e) => post("PAY_DONE", { note: "error: " + e.message }));
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  } else if (/[?&]symx_pay=2/.test(location.search)) {
    const start2 = () => run2().catch((e) => post("PAY_DONE", { note: "error: " + e.message }));
    if (document.readyState === "complete") start2(); else window.addEventListener("load", start2);
  }
})();
