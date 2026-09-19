#!/usr/bin/env node
/**
 * One-time import: 18 vans from Rohan's "VehiclesData (4).xlsx" export,
 * all destined for DXC8.
 *
 * Only fields with a clear, confident mapping from the spreadsheet are
 * populated: vin, vehicleName, licensePlate, make, vehicleModel, year,
 * status (ACTIVE -> Active), vehicleProvider, ownership (RENTAL /
 * AMAZON_RENTAL -> Rented), startDate (from ownershipStartDate), and
 * state. Everything else the spreadsheet had that didn't have an obvious
 * home in the Vehicle schema (sub-model trim, Amazon service class/
 * program, rental sub-type) is preserved in the `info` field as a
 * readable note rather than silently dropped or force-fit into the wrong
 * column. Fields the sheet had no data for (mileage, dashcam, location,
 * notes, endDate, registrationExpiration) are left untouched.
 *
 * Duplicate handling, per VIN (checked ORG-WIDE — a duplicate can be
 * sitting at any station, unassigned, or Returned):
 *   - No existing vehicle with this VIN  -> CREATE at DXC8.
 *   - Existing vehicle, status "Returned" -> REACTIVATE in place (keeps
 *     its _id and history), moved to DXC8 if it was somewhere else, same
 *     behavior as the app's own reactivate-on-duplicate logic. Only
 *     fields this sheet actually has values for are overwritten.
 *   - Existing vehicle already at DXC8, not Returned -> SKIP, already
 *     present, nothing to do.
 *   - Existing vehicle ACTIVE at some OTHER station -> SKIP and flag for
 *     manual review. Silently relocating a van that's actively assigned
 *     somewhere else is a real business decision (is it actually at
 *     DXC8 now, or is this a VIN typo?) that a script shouldn't make on
 *     its own.
 *
 * Usage:
 *   node scripts/import-vehicles-dxc8.mjs --dry-run
 *   node scripts/import-vehicles-dxc8.mjs --target=production --i-know-this-is-production --dry-run
 *   node scripts/import-vehicles-dxc8.mjs --target=production --i-know-this-is-production
 */
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const STATION_CODE = "DXC8";

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "import-vehicles-dxc8" });

// ── Source data, transformed from VehiclesData (4).xlsx ──
const VEHICLES = [
  { vin: "3C6LRVDG0SE566586", vehicleName: "41", licensePlate: "3MQ196", make: "Ram", vehicleModel: "ProMaster", year: "2025", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: Tradesman 2500 159 WB 3dr High Roof Cargo Van w/ Passenger Seat. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "3C6MRVUG4PE521470", vehicleName: "4 DXC8", licensePlate: "3JT285", make: "Ram", vehicleModel: "ProMaster", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 3500 159 WB 3dr High Roof Extended Window Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "1FTBW9CK2PKA31242", vehicleName: "14 electric dxc8", licensePlate: "3JC495", make: "Ford", vehicleModel: "E-Transit", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-15", state: "OK - Oklahoma", info: "Sub-model: 350 3dr SWB Medium Roof Cargo Van. Class: STANDARD_CARGO_VAN. Program: Standard Parcel Electric - Rivian SMALL. Type: Rental." },
  { vin: "1FTYE1C85PKC06747", vehicleName: "8 DXC8", licensePlate: "3KH035", make: "Ford", vehicleModel: "Transit", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 150 3dr SWB Medium Roof Cargo Van. Class: STANDARD_CARGO_VAN. Program: Standard Parcel - Large Van. Type: Rental." },
  { vin: "1FTYE1C84RKA60358", vehicleName: "6 DXC8", licensePlate: "3KJ628", make: "Ford", vehicleModel: "Transit", year: "2024", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 150 3dr LWB Medium Roof Cargo Van. Class: LARGE_CARGO_VAN. Program: Standard Parcel - Large Van. Type: Rental." },
  { vin: "1FTBR3X8XLKA87281", vehicleName: "11- dxc8 branded", licensePlate: "69522Z2", make: "Ford", vehicleModel: "Transit", year: "2020", status: "Active", vehicleProvider: "ELEMENT", ownership: "Rented", startDate: "2026-09-07", state: "CA - California", info: "Sub-model: 250 3dr LWB High Roof Extended Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Amazon Branded Last Mile Rental." },
  { vin: "3C6LRVDG6RE111915", vehicleName: "5 DXC8", licensePlate: "3MH249", make: "Ram", vehicleModel: "ProMaster", year: "2024", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: SLT 2500 159 WB 3dr High Roof Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "1FTBR3X88NKA12761", vehicleName: "1 DXC8", licensePlate: "3GP495", make: "Ford", vehicleModel: "Transit", year: "2022", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 250 3dr LWB High Roof Extended Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "1FTBW3XK8PKA37683", vehicleName: "12 xl electric dxc8", licensePlate: "3JB812", make: "Ford", vehicleModel: "E-Transit", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-15", state: "OK - Oklahoma", info: "Sub-model: 350 3dr LWB High Roof Extended Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel Electric - Rivian SMALL. Type: Rental." },
  { vin: "1FTYE1C8XRKA86575", vehicleName: "9 DXC8", licensePlate: "3LA096", make: "Ford", vehicleModel: "Transit", year: "2024", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 150 3dr LWB Medium Roof Cargo Van. Class: LARGE_CARGO_VAN. Program: Standard Parcel - Large Van. Type: Rental." },
  { vin: "1FTBR3X82NKA02727", vehicleName: "2 DXC8", licensePlate: "3GP394", make: "Ford", vehicleModel: "Transit", year: "2022", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-14", state: "OK - Oklahoma", info: "Sub-model: 250 3dr LWB High Roof Extended Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "3C6MRVJG5RE134000", vehicleName: "13-DXC8", licensePlate: "3KT935", make: "Ram", vehicleModel: "ProMaster", year: "2024", status: "Active", vehicleProvider: "Budget", ownership: "Rented", startDate: "2026-09-08", state: "OK - Oklahoma", info: "Sub-model: SLT 3500 159 WB 3dr High Roof Extended Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "3C6LRVDGXPE578249", vehicleName: "15- DXC8", licensePlate: "3JZ351", make: "Ram", vehicleModel: "ProMaster", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 2500 159 WB 3dr High Roof Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "1FTBR3U84PKB47131", vehicleName: "10 DXC8 4wd", licensePlate: "3JW193", make: "Ford", vehicleModel: "Transit", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: AWD 250 3dr LWB High Roof Extended Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "1FTYE1C82PKC06785", vehicleName: null, licensePlate: "3KH057", make: "Ford", vehicleModel: "Transit", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-15", state: "OK - Oklahoma", info: "Sub-model: 150 3dr SWB Medium Roof Cargo Van. Class: STANDARD_CARGO_VAN. Program: Standard Parcel - Large Van. Type: Rental." },
  { vin: "W2Y40BHY4MT065959", vehicleName: "7 DXC8", licensePlate: "3GC696", make: "Freightliner", vehicleModel: "Sprinter", year: "2021", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 2500 3dr Cargo 144 in. WB. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Large Van. Type: Rental." },
  { vin: "3C6LRVDG1PE564398", vehicleName: "3-dxc8", licensePlate: "3JY750", make: "Ram", vehicleModel: "ProMaster", year: "2023", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-16", state: "OK - Oklahoma", info: "Sub-model: 2500 159 WB 3dr High Roof Cargo Van. Class: EXTRA_LARGE_CARGO_VAN. Program: Standard Parcel - Extra Large Van - US. Type: Rental." },
  { vin: "1FTYE1C8XRKA69940", vehicleName: "16-DXC8", licensePlate: "3KU785", make: "Ford", vehicleModel: "Transit", year: "2024", status: "Active", vehicleProvider: "BUDGET", ownership: "Rented", startDate: "2026-09-10", state: "OK - Oklahoma", info: "Sub-model: 150 3dr LWB Medium Roof Cargo Van. Class: LARGE_CARGO_VAN. Program: Standard Parcel - Large Van. Type: Rental." },
];

// Collections whose records follow a reactivated van to its new station —
// mirrors lib/fleet/transfer-vehicle.ts exactly, so a reactivation done by
// this script behaves identically to one done through the app.
const FOLLOWS_VEHICLE = [
  { collection: "vehiclesRepairs", label: "repairs" },
  { collection: "vehiclesInspections", label: "inspections" },
  { collection: "vehiclesRentalAgreements", label: "rental agreements" },
  { collection: "vehiclesActivityLogs", label: "activity log" },
  { collection: "dailyInspections", label: "daily inspections" },
];

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const site = await db.collection("SYMXSites").findOne({ code: STATION_CODE });
  if (!site) {
    console.error(`No site found with code "${STATION_CODE}". Aborting.`);
    await mongo.close();
    process.exit(1);
  }
  const siteId = site._id;
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Importing ${VEHICLES.length} vehicle(s) into ${STATION_CODE} (${site.name}, _id ${siteId})\n`);

  const sites = await db.collection("SYMXSites").find({}).project({ code: 1, name: 1 }).toArray();
  const siteLabel = (id) => {
    if (!id) return "unassigned (no station)";
    const s = sites.find((x) => String(x._id) === String(id));
    return s ? `${s.code} — ${s.name}` : "an unknown station";
  };

  let created = 0, reactivated = 0, alreadyPresent = 0, conflicts = 0;

  for (const v of VEHICLES) {
    const existing = await db.collection("vehicles").findOne({ vin: v.vin });

    if (!existing) {
      console.log(`  CREATE   ${v.vin}  "${v.vehicleName || v.licensePlate}"`);
      if (!DRY_RUN) {
        const doc = { ...v, currentSiteId: siteId, mileage: 0, dashcam: "", theoryHrs: 0, createdAt: new Date(), updatedAt: new Date() };
        // Don't write null fields — leave them genuinely absent rather
        // than storing an explicit null the UI would then have to treat
        // as "set to nothing."
        for (const k of Object.keys(doc)) if (doc[k] === null || doc[k] === undefined) delete doc[k];
        await db.collection("vehicles").insertOne(doc);
      }
      created++;
      continue;
    }

    const status = String(existing.status || "").trim();
    const atDxc8 = existing.currentSiteId && String(existing.currentSiteId) === String(siteId);

    if (status === "Returned") {
      const previousSiteId = existing.currentSiteId ? String(existing.currentSiteId) : null;
      const moving = previousSiteId && previousSiteId !== String(siteId);
      console.log(`  REACTIVATE  ${v.vin}  currently Returned at ${siteLabel(existing.currentSiteId)}${moving ? ` -> moving to ${STATION_CODE}` : ""}`);
      if (!DRY_RUN) {
        const updateFields = { ...v, currentSiteId: siteId, status: "Active", updatedAt: new Date() };
        for (const k of Object.keys(updateFields)) if (updateFields[k] === null || updateFields[k] === undefined) delete updateFields[k];
        await db.collection("vehicles").updateOne({ _id: existing._id }, { $set: updateFields });

        if (moving) {
          const match = { $or: [{ vehicleId: existing._id }, { vin: existing.vin }] };
          for (const { collection, label } of FOLLOWS_VEHICLE) {
            const res = await db.collection(collection).updateMany(match, { $set: { siteId } });
            if (res.modifiedCount > 0) console.log(`      moved ${res.modifiedCount} ${label}`);
          }
        }

        await db.collection("vehiclesActivityLogs").insertOne({
          vehicleId: existing._id,
          vin: existing.vin || "",
          serviceType: "Reactivated",
          startDate: new Date(),
          notes: `Reactivated from Returned status via bulk import${moving ? ` and moved to ${STATION_CODE}` : ""}`,
          siteId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      reactivated++;
      continue;
    }

    if (atDxc8) {
      console.log(`  SKIP     ${v.vin}  already at ${STATION_CODE}, status "${status || "Active"}" — no changes made`);
      alreadyPresent++;
      continue;
    }

    console.log(`  CONFLICT ${v.vin}  already exists at ${siteLabel(existing.currentSiteId)}, status "${status || "Active"}" — NOT moved. Review manually (Transfer if it really belongs at ${STATION_CODE}, or check for a VIN typo).`);
    conflicts++;
  }

  console.log(`\n${created} created, ${reactivated} reactivated, ${alreadyPresent} already present, ${conflicts} conflict(s) needing manual review.`);
  if (DRY_RUN) console.log("Re-run without --dry-run (with --target=production --i-know-this-is-production) to apply.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
