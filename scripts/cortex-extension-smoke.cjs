/* Loads the real unpacked extension. Every Amazon request is fulfilled by synthetic local fixtures. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
let context;
(async () => {
  const state = JSON.parse(
    fs.readFileSync("/tmp/symx-cortex-preview.json", "utf8"),
  );
  const extension = path.resolve("symx-cortex-extension");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
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
  await options.getByText("Saved. Collection begins on the next minute tick.", { exact: true }).waitFor();
  await options.close();
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
  let requests = 0;
  await context.route("https://logistics.amazon.com/**", async (route) => {
    requests++;
    if (route.request().method() !== "GET")
      throw Error("Unexpected Amazon write request");
    if (route.request().url().includes("/execution/api/")) {
      await route.fulfill({
        json: route.request().url().includes("/itineraries/")
          ? detail
          : overview,
      });
      return;
    }
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body><h1>Synthetic Cortex fixture</h1><script>
      window.result = null;
      window.addEventListener('message', e => { if (e.data?.source === 'SYMX_CORTEX_PAGE' && e.data.type === 'done') window.result = e.data; });
      const load = () => fetch('/execution/api/' + (location.pathname.includes('/documentType/') ? 'itineraries/mock-route' : 'summaries') + '?selectedDay=${date}&serviceAreaId=demo-DFO2');
      window.addEventListener('popstate', load); load();
    </script></body></html>`,
    });
  });
  const page = await context.newPage();
  await page.goto(
    `https://logistics.amazon.com/operations/execution/itineraries?selectedDay=${date}&serviceAreaId=demo-DFO2&symx_cortex_run=1`,
  );
  await page.waitForFunction(() => window.result !== null, undefined, {
    timeout: 60000,
  });
  const result = await page.evaluate(() => window.result);
  if (!result.ok) throw Error(`Collector incomplete: ${result.detail}`);
  const health = await worker.evaluate(async () =>
    chrome.storage.local.get(["health", "outbox", "deadLetters"]),
  );
  if (
    health.outbox?.length ||
    health.deadLetters?.length ||
    !health.health?.DFO2?.lastSuccessAt
  )
    throw Error("Delivery did not acknowledge");
  const login = await context.request.post(
    "http://127.0.0.1:3000/api/auth/login",
    { data: { email: state.email, password: state.password } },
  );
  if (!login.ok()) throw Error("Preview login failed");
  const routes = await (
    await context.request.get("http://127.0.0.1:3000/api/cortex")
  ).json();
  const captured = routes.routes.find((r) => r.routeCode === "CX998");
  if (
    !captured?.detail ||
    captured.completedStops !== 25 ||
    !captured.firstDelivery
  )
    throw Error("Stored route detail did not reconcile");
  await context.close();
  console.log(
    `PASS: unpacked MV3 extension, options → worker configuration, mocked authorized overview + route navigation, server acknowledgement, detail reconciliation; ${requests} synthetic GETs and zero live Amazon requests.`,
  );
})().catch(async (e) => {
  console.error(e.message);
  if (context) await context.close();
  process.exitCode = 1;
});
