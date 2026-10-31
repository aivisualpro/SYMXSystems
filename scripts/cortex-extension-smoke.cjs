/* Loads the real unpacked extension. Every Amazon request is fulfilled by synthetic local fixtures. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
let context;
(async () => {
  const state = JSON.parse(
    fs.readFileSync(process.env.CORTEX_PREVIEW_STATE || "/tmp/symx-cortex-preview.json", "utf8"),
  );
  const extension = path.resolve("symx-cortex-extension");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    executablePath: process.env.CORTEX_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  let worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ lastScheduled: { DFO2: Date.now() } });
  });
  const extensionId = worker.url().split("/")[2];
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator("#origin").fill("http://127.0.0.1:3000");
  await options.locator("#key").fill(state.key);
  await options.locator("#DFO2").fill("demo-DFO2");
  await options.locator("#enabled").check();
  await options.getByRole("button", { name: "Save settings", exact: true }).click();
  await options.getByText("Saved. Collection is configured for known stations.", { exact: true }).waitFor();
  const now = Date.now();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date());
  const overview = {
    routeSummaries: [
      {
        routeCode: "CX998",
        routeId: "mock-route",
        transporterId: "mock-driver",
        stopProgress: { total: 100, completed: 25 },
      },
    ],
    transporters: [
      {
        transporterId: "mock-driver",
        firstName: "Synthetic",
        lastName: "Extension Driver",
      },
    ],
  };
  const detail = {
    itineraryDetails: {
      itineraryId: "mock-route",
      transporterId: "mock-driver",
      scheduleEndTime: now + 6 * 3600000,
      routes: [
        {
          routeCode: "CX998",
          routeDeliveryProgress: { totalStops: 100, completedStops: 25 },
        },
      ],
      transporterTimeAttributes: {
        plannedDepartureTime: now - 2 * 3600000,
        actualDepartureTime: now - 2 * 3600000,
        plannedInboundStemTime: 1200000,
      },
    },
    stops: [
      {
        routeCode: "CX998",
        sequenceNumber: 2,
        tasks: [
          {
            taskType: "DROP_OFF",
            taskState: "DELIVERED",
            actualExecutionTime: now - 3600000,
          },
        ],
      },
    ],
  };
  const routeCount = 40;
  overview.routeSummaries = Array.from({ length: routeCount }, (_, i) => ({
    ...overview.routeSummaries[0], routeCode: `CX${800 + i}`, routeId: `mock-route-${i}`,
  }));
  const detailFor = (i) => ({
    ...detail,
    itineraryDetails: {
      ...detail.itineraryDetails, itineraryId: `mock-route-${i}`,
      routes: [{ ...detail.itineraryDetails.routes[0], routeCode: `CX${800 + i}` }],
      transporterTimeAttributes: { ...detail.itineraryDetails.transporterTimeAttributes, plannedRtsTime: now + 6 * 3600000 },
    },
    stops: Array.from({ length: 100 }, (_, n) => ({
      routeCode: `CX${800 + i}`, sequenceNumber: n + 2,
      expectedStartTime: now - 2 * 3600000 + n * 4 * 60000,
      tasks: [{ taskType: "DROP_OFF", taskState: n < 25 ? "DELIVERED" : "PENDING",
        actualExecutionTime: n < 25 ? now - (120 - n * 5) * 60000 : null }],
    })),
  });
  let requests = 0;
  const navigations = [];
  await context.route("https://logistics.amazon.com/**", async (route) => {
    requests++;
    if (route.request().method() !== "GET")
      throw Error("Unexpected Amazon write request");
    if (route.request().url().includes("/execution/api/itineraries/")) navigations.push(Date.now());
    if (route.request().url().includes("/execution/api/")) {
      await route.fulfill({
        json: route.request().url().includes("/itineraries/")
          ? detailFor(Number(route.request().url().match(/mock-route-(\d+)/)?.[1] || 0))
          : overview,
      });
      return;
    }
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body><h1>Synthetic Cortex fixture</h1><script>
      window.result = null;
      window.addEventListener('message', e => { if (e.data?.source === 'SYMX_CORTEX_PAGE' && e.data.type === 'done') window.result = e.data; });
      const load = () => fetch('/execution/api/' + (location.pathname.includes('/documentType/') ? 'itineraries/' + location.pathname.split('/itineraries/')[1].split('/')[0] : 'summaries') + '?selectedDay=${date}&serviceAreaId=demo-DFO2');
      window.addEventListener('popstate', load); load();
    </script></body></html>`,
    });
  });
  // Hold extension-created navigation at about:blank until Playwright attaches its request interception.
  // This prevents any real Amazon request while preserving the actual tab ID registered by the worker.
  await worker.evaluate(() => {
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = async config => {
      globalThis.cortexRequestedTab = config;
      return create({ ...config, url: "about:blank" });
    };
  });
  const opened = context.waitForEvent("page");
  await options.locator("#collect-now").click();
  const collectionPage = await opened;
  const requested = await worker.evaluate(() => globalThis.cortexRequestedTab);
  if (!requested?.active || !requested.url?.includes("symx_cortex_run=1")) throw Error("Manual collection did not request a visible Cortex run");
  await collectionPage.goto(requested.url);
  await options.getByText("DFO2 collection started. Coverage updates below while it runs.", { exact: true }).waitFor();
  let health;
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    health = await options.evaluate(async () => await chrome.storage.local.get(["health", "outbox", "deadLetters"]));
    if (health.health?.DFO2?.captureStatus === "complete") break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (health.health?.DFO2?.captureStatus !== "complete") throw Error(`Manual collection incomplete: ${JSON.stringify(health.health?.DFO2 || {})}; requests=${requests}`);
  if (
    health.outbox?.length ||
    health.deadLetters?.length ||
    !health.health?.DFO2?.lastSuccessAt
  )
    throw Error(`Delivery did not acknowledge: queued=${health.outbox?.length || 0}, failed=${health.deadLetters?.length || 0}, station=${JSON.stringify(health.health?.DFO2 || {})}; requests=${requests}`);
  if (health.health.DFO2.coverage?.expected !== routeCount || health.health.DFO2.coverage?.acknowledged !== routeCount)
    throw Error("Structured route coverage does not match the 40-route fixture");
  if (navigations.length !== routeCount || navigations.some((at, i) => i > 0 && at - navigations[i - 1] < 900))
    throw Error("Route navigation count or pacing was outside its limit");
  await options.getByText("40 / 40 itinerary details acknowledged", { exact: true }).waitFor();
  await options.screenshot({ path: "artifacts/cortex-extension-status.png", fullPage: true });
  const login = await context.request.post(
    "http://127.0.0.1:3000/api/auth/login",
    { data: { email: state.email, password: state.password } },
  );
  if (!login.ok()) throw Error("Preview login failed");
  const routes = await (
    await context.request.get("http://127.0.0.1:3000/api/cortex")
  ).json();
  const captured = routes.routes.find((r) => r.routeCode === "CX800");
  if (
    !captured?.detail ||
    captured.completedStops !== 25 ||
    !captured.firstDelivery || captured.timingEvidence?.timestampedStops !== 25
  )
    throw Error("Stored route detail did not reconcile");
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/cortex");
  await page.getByRole("button", { name: /^Open details for CX800,/ }).click();
  await page.getByText("Timing evidence & RTS confidence", { exact: true }).waitFor();
  await page.getByText("Explicit planned inbound stem", { exact: false }).waitFor();
  await page.screenshot({ path: "artifacts/cortex-timing-evidence.png", fullPage: true });
  await context.close();
  console.log(
    `PASS: unpacked MV3 extension, settings-tab Collect DFO2 now → worker, 40 synthetic DFO2 routes + paced navigation + structured coverage + timing evidence, server acknowledgement, detail reconciliation; ${requests} synthetic GETs and zero live Amazon requests.`,
  );
})().catch(async (e) => {
  console.error(e.message);
  if (context) await context.close();
  process.exitCode = 1;
});
