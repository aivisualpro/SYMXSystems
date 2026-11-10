import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import MessagingTemplate from "@/lib/models/MessagingTemplate";
import { MESSAGE_TEMPLATE_TYPES } from "@/lib/messaging-template-defs";

const BUSINESS_TZ = "America/Los_Angeles";

// ── One-time index fix ───────────────────────────────────────────────
// Templates used to be unique by `type` alone (one shared copy). They are
// now unique per (station, type), so the old index has to go or a second
// station could never save its own wording.
let indexesReady: Promise<void> | null = null;
export function ensureTemplateIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      await connectToDatabase();
      try { await MessagingTemplate.collection.dropIndex("type_1"); } catch { /* already gone */ }
      try { await MessagingTemplate.createIndexes(); } catch (e) { console.error("[templates] createIndexes", e); }
    })().catch((e) => { indexesReady = null; throw e; });
  }
  return indexesReady;
}

/** Wall-clock parts of an instant in Pacific time. */
function ptParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour") % 24, min: g("minute"), s: g("second") };
}

/** The UTC instant at which it is `h`:00 in Pacific time on calendar day y-m-d. */
function ptWallToInstant(y: number, m: number, d: number, h: number): Date {
  let guess = Date.UTC(y, m - 1, d, h, 0, 0);
  for (let i = 0; i < 2; i++) {
    const p = ptParts(new Date(guess));
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    guess -= shown - Date.UTC(y, m - 1, d, h, 0, 0);
  }
  return new Date(guess);
}

/** The most recent 11:00 PM Pacific at or before `now`. */
export function lastResetBoundary(now = new Date()): Date {
  const p = ptParts(now);
  const todayAt11 = ptWallToInstant(p.y, p.m, p.d, 23);
  if (todayAt11.getTime() <= now.getTime()) return todayAt11;
  const prev = new Date(Date.UTC(p.y, p.m - 1, p.d) - 86400000);
  return ptWallToInstant(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), 23);
}

/**
 * If the nightly 11 PM reset has passed since this station's wording was last
 * reset, set every type that has a station default back to that default.
 * Types without a saved default are left alone. Safe to call often.
 */
export async function ensureTemplatesFresh(siteId: string): Promise<boolean> {
  await ensureTemplateIndexes();
  const boundary = lastResetBoundary();
  const oid = new mongoose.Types.ObjectId(siteId);

  // Claim the reset atomically so two requests don't both run it.
  const claimed: any = await Site.findOneAndUpdate(
    { _id: oid, $or: [{ messageTemplatesResetAt: null }, { messageTemplatesResetAt: { $lt: boundary } }] },
    { $set: { messageTemplatesResetAt: new Date() } },
    { new: false, projection: { messageDefaults: 1, messageTemplatesResetAt: 1 } }
  ).lean();
  if (!claimed) return false;

  // First time we see this station: just start the clock. Resetting now
  // would wipe wording typed before the feature existed.
  if (!claimed.messageTemplatesResetAt) return false;

  const defaults: Record<string, string> = claimed.messageDefaults || {};
  const ops = MESSAGE_TEMPLATE_TYPES.filter((t) => (defaults[t] || "").trim()).map((t) => ({
    updateOne: {
      filter: { siteId: oid, type: t },
      update: { $set: { siteId: oid, type: t, template: defaults[t] } },
      upsert: true,
    },
  }));
  if (ops.length) await MessagingTemplate.bulkWrite(ops);
  return ops.length > 0;
}

/** Run the reset check for every active station (called by the 15-minute pinger). */
export async function resetDueTemplatesForAllSites(): Promise<number> {
  await connectToDatabase();
  const sites: any[] = await Site.find({ status: "active" }, { _id: 1 }).lean();
  let n = 0;
  for (const s of sites) {
    try { if (await ensureTemplatesFresh(String(s._id))) n++; } catch (e) { console.error("[templates] reset failed", e); }
  }
  return n;
}
