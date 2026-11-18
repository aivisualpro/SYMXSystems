// Register one authorized Amazon service area in the disposable localhost preview.
// Usage: node scripts/cortex-map-station.cjs DFO2 <service-area-id>
const fs = require("node:fs");
const mongoose = require("mongoose");
(async () => {
  const [code, serviceAreaId] = process.argv.slice(2);
  if (!["DFO2", "DXC8", "DFO3"].includes(code) ||
      !/^[a-zA-Z0-9_-]{8,150}$/.test(serviceAreaId || ""))
    throw new Error("Usage: node scripts/cortex-map-station.cjs DFO2 <authorized-service-area-id>");
  const state = JSON.parse(fs.readFileSync("/tmp/symx-cortex-preview.json", "utf8"));
  if (!/^mongodb:\/\/(?:localhost|127\.0\.0\.1):/.test(state.uri))
    throw new Error("Refusing non-local database");
  await mongoose.connect(state.uri);
  const db = mongoose.connection.db;
  if (db.databaseName !== "symx-cortex-disposable")
    throw new Error("Refusing non-disposable database");
  const sites = db.collection("SYMXSites");
  const conflict = await sites.findOne({ "amazon.serviceAreaId": serviceAreaId, code: { $ne: code } });
  if (conflict) throw new Error("Service area already belongs to another site");
  let site = await sites.findOne({ code });
  if (!site) {
    let org = await db.collection("SYMXOrganizations").findOne({ slug: "cortex-preview" });
    if (!org) {
      const result = await db.collection("SYMXOrganizations").insertOne({
        name: "Cortex local preview", slug: "cortex-preview",
        timezone: "America/Los_Angeles",
      });
      org = { _id: result.insertedId };
    }
    await sites.insertOne({
      organizationId: org._id, name: code + " local testing",
      slug: code.toLowerCase(), code, status: "active",
      isDefault: code === "DFO2",
      amazon: { serviceAreaId },
    });
  } else {
    await sites.updateOne({ _id: site._id }, {
      $set: { "amazon.serviceAreaId": serviceAreaId, status: "active" },
    });
  }
  console.log("Local station mapping saved:", code);
})().catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
