#!/usr/bin/env node
/**
 * Inspect and set per-station WST revenue rates.
 *
 * WST options carry the revenue the station earns for a unit of work, and
 * that rate differs per station — the Amazon rate cards give DFO2, DXC8
 * and DFO3 three different hourly base rates for the same service type.
 *
 * Usage:
 *   node scripts/config/wst-rates.mjs --list
 *   node scripts/config/wst-rates.mjs --list --station=DFO2
 *   node scripts/config/wst-rates.mjs --station=DXC8 --apply --dry-run
 *   node scripts/config/wst-rates.mjs --station=DXC8 --apply
 *
 * --apply uses RATE_CARDS below, which is transcribed from the PDFs. It
 * only touches WST options whose `wst` code appears there, so anything
 * station-specific that isn't on the card is left alone rather than
 * silently zeroed.
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIST = args.includes("--list");
const APPLY = args.includes("--apply");
const arg = (k) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "wst-rates" });

// ── Rate cards, transcribed ───────────────────────────────────────────
// Hourly Base Rate — Core Delivery Services, from each station's Amazon
// Delivery Service Partner Offer Details.
//
// Two columns exist on every card: routes scheduled 1–8 hrs, and routes
// scheduled over 8 hrs. `standard` is the 1–8 hr rate; `over8` is kept
// alongside it because it is the number that applies to a long route, and
// dropping it here would mean re-reading the PDF to find it later.
//
// Sources:
//   DFO2 (Oakley)    — printed 03/25/2026
//   DXC8 (San Jose)  — printed 03/20/2026
//   DFO3 (Livermore) — printed 03/20/2026
//
// NOT applied automatically. Which WST code maps to which rate line is a
// judgement about how this operation labels its work, so the mapping in
// WST_TO_RATE_LINE below has to be confirmed against the real WST list
// before --apply does anything useful.
export const RATE_CARDS = {
  DFO2: {
    station: "Oakley",
    driverMinWage: 25.25,
    helperMinWage: 18.50,
    hourly: {
      "Standard Parcel":              { standard: 38.70, over8: 40.20 },
      "Custom Delivery Van":          { standard: 38.70, over8: 40.20 },
      "Rivian EV":                    { standard: 38.70, over8: 40.20 },
      "Step Van":                     { standard: 39.20, over8: 40.70 },
      "Standard Parcel with Helper":  { standard: 64.40, over8: 67.20 },
      "Custom Delivery Van with Helper": { standard: 64.40, over8: 67.20 },
      "Rivian EV with Helper":        { standard: 64.40, over8: 67.20 },
      "Step Van with Helper":         { standard: 64.90, over8: 67.70 },
      "Standard Parcel ORE":          { standard: 68.70, over8: 71.20 },
      "4WD Truck":                    { standard: 38.70, over8: 40.20 },
    },
    nonDelivery: {
      "Transportation Services/Non-Delivery": { standard: 44.00, over8: 46.00 },
      "Classroom Training":                   { standard: 32.20, over8: 33.70 },
      "Temporary Building Closure":           { standard: 32.20, over8: 33.70 },
      "Temporary Building Closure - Driver + Helper": { standard: 55.40, over8: 58.20 },
      "Address Validation":                   { standard: 40.70, over8: 42.20 },
    },
  },
  DXC8: {
    station: "San Jose",
    driverMinWage: 26.00,
    helperMinWage: 19.75,
    hourly: {
      "Standard Parcel":              { standard: 39.80, over8: 41.30 },
      "Custom Delivery Van":          { standard: 39.80, over8: 41.30 },
      "Rivian EV":                    { standard: 39.80, over8: 41.30 },
      "Step Van":                     { standard: 39.80, over8: 41.30 },
      "Standard Parcel with Helper":  { standard: 67.20, over8: 70.00 },
      "Custom Delivery Van with Helper": { standard: 67.20, over8: 70.00 },
      "Rivian EV with Helper":        { standard: 67.20, over8: 70.00 },
      "Step Van with Helper":         { standard: 67.20, over8: 70.00 },
      "Standard Parcel ORE":          { standard: 70.80, over8: 73.50 },
    },
    nonDelivery: {},
  },
  DFO3: {
    station: "Livermore",
    driverMinWage: 23.50,
    helperMinWage: 18.50,
    hourly: {
      "Standard Parcel":              { standard: 36.20, over8: 37.50 },
      "Custom Delivery Van":          { standard: 36.20, over8: 37.50 },
      "Rivian EV":                    { standard: 36.20, over8: 37.50 },
      "Step Van":                     { standard: 36.20, over8: 37.50 },
      "Standard Parcel with Helper":  { standard: 61.70, over8: 64.20 },
      "Custom Delivery Van with Helper": { standard: 61.70, over8: 64.20 },
      "Rivian EV with Helper":        { standard: 61.70, over8: 64.20 },
      "Step Van with Helper":         { standard: 61.70, over8: 64.20 },
      "Standard Parcel ORE":          { standard: 64.40, over8: 66.70 },
    },
    nonDelivery: {},
  },
};

/**
 * WST code -> rate-card line.
 *
 * Empty deliberately. The WST codes in this system are the operation's own
 * labels, and guessing which rate line each one means would put wrong
 * numbers into revenue calculations that look plausible. Run --list first
 * to see the real codes, then fill this in.
 */
export const WST_TO_RATE_LINE = {
  // "SP":  "Standard Parcel",
  // "SPH": "Standard Parcel with Helper",
};

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const codeOf = new Map(sites.map((s) => [String(s._id), s.code]));
  const siteByCode = new Map(sites.map((s) => [s.code, s]));

  const wanted = (arg("station") || "").toUpperCase();

  if (LIST || !APPLY) {
    const filter = wanted ? { siteId: siteByCode.get(wanted)?._id } : {};
    const rows = await db
      .collection("SYMXWSTOptions")
      .find(filter)
      .sort({ sortOrder: 1, wst: 1 })
      .toArray();

    const byStation = {};
    for (const r of rows) {
      const c = r.siteId ? codeOf.get(String(r.siteId)) || "?" : "(unassigned)";
      (byStation[c] ||= []).push(r);
    }

    for (const [code, list] of Object.entries(byStation)) {
      const card = RATE_CARDS[code];
      console.log(
        `\n── ${code}${card ? ` (${card.station})` : ""} — ${list.length} WST option(s) ──`
      );
      console.log(
        `   ${"WST".padEnd(28)} ${"revenue".padStart(9)}  ${"amazonServiceType".padEnd(30)} active`
      );
      for (const r of list) {
        console.log(
          `   ${String(r.wst).padEnd(28)} ${String(r.revenue ?? 0).padStart(9)}  ` +
            `${String(r.amazonServiceType || "").padEnd(30)} ${r.isActive === false ? "no" : "yes"}`
        );
      }
    }

    console.log("\n── Rate cards on file ──");
    for (const [code, card] of Object.entries(RATE_CARDS)) {
      console.log(`\n   ${code} (${card.station})  driver min $${card.driverMinWage}/hr`);
      for (const [line, r] of Object.entries(card.hourly)) {
        console.log(`      ${line.padEnd(36)} $${String(r.standard).padStart(6)}  (over 8h: $${r.over8})`);
      }
    }

    if (Object.keys(WST_TO_RATE_LINE).length === 0) {
      console.log(
        "\n⚠ WST_TO_RATE_LINE is empty, so --apply would change nothing.\n" +
          "  Map each WST code above to a rate-card line in\n" +
          "  scripts/config/wst-rates.mjs, then re-run with --apply."
      );
    }
    await mongo.close();
    return;
  }

  // ── Apply ──
  if (!wanted) throw new Error("--station=CODE is required with --apply.");
  const site = siteByCode.get(wanted);
  if (!site) throw new Error(`No station "${wanted}". Have: ${[...siteByCode.keys()].join(", ")}`);
  const card = RATE_CARDS[wanted];
  if (!card) throw new Error(`No rate card on file for ${wanted}.`);

  if (Object.keys(WST_TO_RATE_LINE).length === 0) {
    throw new Error(
      "WST_TO_RATE_LINE is empty — nothing to apply.\n" +
        "Run --list, map each WST code to a rate-card line, then re-run."
    );
  }

  const rows = await db.collection("SYMXWSTOptions").find({ siteId: site._id }).toArray();
  console.log(`\n${wanted} (${card.station}) — ${rows.length} WST option(s)\n`);

  const updates = [];
  const unmapped = [];
  for (const r of rows) {
    const line = WST_TO_RATE_LINE[r.wst];
    if (!line) {
      unmapped.push(r.wst);
      continue;
    }
    const rate = card.hourly[line] || card.nonDelivery[line];
    if (!rate) {
      console.log(`  ⚠ ${r.wst}: mapped to "${line}", which is not on ${wanted}'s card`);
      continue;
    }
    if (Number(r.revenue) === rate.standard) continue;
    updates.push({ id: r._id, wst: r.wst, from: r.revenue ?? 0, to: rate.standard, line });
  }

  for (const u of updates) {
    console.log(`  ${u.wst.padEnd(28)} $${String(u.from).padStart(7)} → $${String(u.to).padStart(7)}   (${u.line})`);
  }
  if (unmapped.length) {
    console.log(`\n  ${unmapped.length} unmapped, left unchanged: ${unmapped.join(", ")}`);
  }
  if (updates.length === 0) {
    console.log("  Nothing to change.");
    await mongo.close();
    return;
  }

  if (DRY_RUN) {
    console.log("\n--dry-run set — nothing written.");
    await mongo.close();
    return;
  }

  for (const u of updates) {
    await db.collection("SYMXWSTOptions").updateOne(
      { _id: u.id },
      { $set: { revenue: u.to, updatedAt: new Date() } }
    );
  }
  console.log(`\n✓ Updated ${updates.length} rate(s) at ${wanted}.`);

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
