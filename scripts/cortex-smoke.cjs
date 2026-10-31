const { chromium } = require("playwright");
const fs = require("node:fs");
const mongoose = require("mongoose");
let browser;
(async () => {
  if (process.env.NODE_ENV === "production") throw Error("Local preview only");
  const state = JSON.parse(
    fs.readFileSync(process.env.CORTEX_PREVIEW_STATE || "/tmp/symx-cortex-preview.json", "utf8"),
  );
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(state.uri))
    throw Error("Refusing a non-local database");
  await mongoose.connect(state.uri);
  const db = mongoose.connection.db;
  if (db.databaseName !== "symx-cortex-disposable")
    throw Error("Refusing an unexpected database");
  await db.collection("SYMXCortexObservations").deleteMany({});
  const existingOrg = await db
    .collection("SYMXOrganizations")
    .findOne({ slug: "cortex-preview" });
  const org = existingOrg?._id || new mongoose.Types.ObjectId();
  await db
    .collection("SYMXOrganizations")
    .updateOne(
      { _id: org },
      {
        $setOnInsert: {
          name: "Cortex synthetic preview",
          slug: "cortex-preview",
          timezone: "America/Los_Angeles",
        },
      },
      { upsert: true },
    );
  for (const [i, code] of ["DFO2", "DXC8", "DFO3"].entries())
    await db
      .collection("SYMXSites")
      .updateOne(
        { code },
        {
          $setOnInsert: {
            organizationId: org,
            name: `${code} synthetic station`,
            slug: code.toLowerCase(),
            code,
            status: "active",
            isDefault: i === 0,
            amazon: { serviceAreaId: `demo-${code}` },
          },
        },
        { upsert: true },
      );
  await mongoose.disconnect();
  browser = await chromium.launch({ executablePath: process.env.CORTEX_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1080 },
  });
  const response = await context.request.post(
    "http://127.0.0.1:3000/api/auth/login",
    { data: { email: state.email, password: state.password } },
  );
  if (!response.ok()) throw Error(`Login failed: ${response.status()}`);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("http://127.0.0.1:3000/cortex?demo=1");
  await page
    .getByRole("heading", { name: "SYMX Cortex", exact: true })
    .waitFor();
  await page.getByText("Synthetic preview", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Open details for CX101,/ }).waitFor();
  if ((await page.locator("tbody tr").count()) !== 15)
    throw Error("Expected 15 synthetic routes");
  await page.getByLabel("Filter station").selectOption("DFO2");
  if ((await page.locator("tbody tr").count()) !== 5)
    throw Error("Station filter failed");
  await page.getByLabel("Search routes or drivers").fill("CX101");
  if ((await page.locator("tbody tr").count()) !== 1)
    throw Error("Search filter failed");
  await page.getByRole("button", { name: /^Open details for CX101,/ }).click();
  await page
    .getByText("CX101 · morning summary & driver history", { exact: true })
    .waitFor();
  if (!(await page.getByText("Return", { exact: false }).count()))
    throw Error("History missing");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
  await page.getByLabel("Search routes or drivers").fill("");
  await page.getByLabel("Filter station").selectOption("all");
  fs.mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/cortex-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/cortex-mobile.png",
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join("\n"));
  await page.goto("http://127.0.0.1:3000/cortex");
  await page
    .getByText("No route observations for this selection.", { exact: false })
    .waitFor();
  const vm = require("node:vm");
  const adapter = {};
  vm.createContext(adapter);
  vm.runInContext(
    fs.readFileSync("symx-cortex-extension/adapter.js", "utf8"),
    adapter,
  );
  const now = Date.now();
  const normalized = adapter.CortexAdapter.normalize(
    {
      itineraryDetails: {
        itineraryId: "safe-itinerary",
        transporterId: "safe-driver",
        scheduleEndTime: now + 6 * 3600000,
        routes: [
          {
            routeCode: "CX999",
            routeDeliveryProgress: {
              totalStops: 120,
              completedStops: 40,
              totalDeliveries: 200,
              completedDeliveries: 70,
            },
          },
        ],
        transporterTimeAttributes: {
          plannedDepartureTime: now - 3 * 3600000,
          actualDepartureTime: now - 3 * 3600000,
          plannedInboundStemTime: 1200000,
        },
      },
      stops: [
        {
          routeCode: "CX999",
          sequenceNumber: 2,
          tasks: [
            {
              taskType: "DROP_OFF",
              taskState: "DELIVERED",
              actualExecutionTime: now - 2 * 3600000,
            },
          ],
        },
      ],
    },
    "detail",
  );
  const capture = {
    captureId: require("node:crypto").randomUUID(),
    serviceAreaId: "demo-DFO2",
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
    }).format(new Date()),
    observedAt: new Date().toISOString(),
    kind: "detail",
    routes: normalized,
  };
  for (let i = 0; i < 2; i++) {
    const ingest = await context.request.post(
      "http://127.0.0.1:3000/api/public/symx-cortex",
      { headers: { "x-extension-key": state.key }, data: capture },
    );
    if (!ingest.ok()) throw Error(`Ingest failed: ${ingest.status()}`);
  }
  await page.setViewportSize({ width: 1512, height: 1080 });
  await page.goto("http://127.0.0.1:3000/cortex");
  await page.getByRole("button", { name: /^Open details for CX999,/ }).waitFor();
  if ((await page.locator("tbody tr").count()) !== 1)
    throw Error("Duplicate route after retry");
  await page.screenshot({
    path: "artifacts/cortex-ingested-route.png",
    fullPage: true,
  });
  const unauth = await browser.newContext();
  const denied = await unauth.request.get("http://127.0.0.1:3000/api/cortex");
  if (denied.status() !== 401)
    throw Error("Unauthenticated access was not denied");
  await browser.close();
  console.log(
    "PASS: authenticated preview, 15 routes, station/search filters, route summary, driver history, desktop/mobile screenshots, live empty state, extension normalization → ingest → storage → dashboard, retry deduplication, unauthenticated API denial; no browser errors.",
  );
})().catch(async (e) => {
  console.error(e.message);
  await mongoose.disconnect();
  if (browser) await browser.close();
  process.exitCode = 1;
});
