import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import MessagingTemplate from "@/lib/models/MessagingTemplate";
import { requireAnyPermission } from "@/lib/auth/require-permission";
import { getRequestScope, resolveWriteSiteId } from "@/lib/scoped-query";
import { ensureTemplateIndexes, ensureTemplatesFresh } from "@/lib/messaging/template-store";
import { MESSAGE_TEMPLATE_TYPES } from "@/lib/messaging-template-defs";

// Compose wording is PER STATION. What a station sees is, in order:
//   1. its own saved wording for that message type
//   2. the station's default for that type (Station settings → Default messages)
//   3. the legacy shared wording from before templates were per station
//   4. (the screen falls back to the built-in wording)
// Every night at 11 PM Pacific, types that have a station default are set back
// to that default (see lib/messaging/template-store.ts).

async function stationForRequest() {
  const scope = await getRequestScope();
  const siteId = resolveWriteSiteId(scope, null);
  return { scope, siteId };
}

// GET — all templates, one by ?type=, or a batch by ?types=a,b,c
export async function GET(req: NextRequest) {
  try { await requireAnyPermission([["Scheduling", "view"], ["Dispatching", "view"]]); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.name === "ForbiddenError" ? 403 : 401 }); }
  try {
    await connectToDatabase();
    await ensureTemplateIndexes();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const types = searchParams.get("types");
    const wanted = type
      ? [type]
      : types
        ? types.split(",").map((t) => t.trim()).filter(Boolean)
        : MESSAGE_TEMPLATE_TYPES;

    const { siteId } = await stationForRequest();

    // Viewing several stations at once: there is no single set of wording to
    // show. Return only the legacy shared wording and say so, so the screen
    // can ask for one station.
    let own: any[] = [];
    let siteDefaults: Record<string, string> = {};
    if (siteId) {
      await ensureTemplatesFresh(siteId);
      const oid = new mongoose.Types.ObjectId(siteId);
      const [site, docs] = await Promise.all([
        Site.findById(oid, { messageDefaults: 1 }).lean() as Promise<any>,
        MessagingTemplate.find({ siteId: oid, type: { $in: wanted } }).lean(),
      ]);
      own = docs as any[];
      siteDefaults = (site?.messageDefaults as Record<string, string>) || {};
    }
    const legacy = (await MessagingTemplate.find({
      type: { $in: wanted },
      $or: [{ siteId: { $exists: false } }, { siteId: null }],
    }).lean()) as any[];

    const map: Record<string, any> = {};
    for (const t of wanted) {
      const mine = own.find((d) => d.type === t);
      if (mine) { map[t] = { type: t, template: mine.template, source: "station" }; continue; }
      if ((siteDefaults[t] || "").trim()) { map[t] = { type: t, template: siteDefaults[t], source: "default" }; continue; }
      const old = legacy.find((d) => d.type === t);
      if (old) map[t] = { type: t, template: old.template, source: "legacy" };
    }

    if (type) return NextResponse.json({ template: map[type] || null, stationSelected: !!siteId });
    return NextResponse.json({ templates: map, stationSelected: !!siteId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch templates" }, { status: 500 });
  }
}

// PUT — save this station's wording for a type
export async function PUT(req: NextRequest) {
  try { await requireAnyPermission([["Scheduling", "edit"], ["Dispatching", "edit"]]); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.name === "ForbiddenError" ? 403 : 401 }); }
  return upsertTemplate(req);
}

// POST — alias for PUT (needed for navigator.sendBeacon which only sends POST)
export async function POST(req: NextRequest) {
  try { await requireAnyPermission([["Scheduling", "edit"], ["Dispatching", "edit"]]); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.name === "ForbiddenError" ? 403 : 401 }); }
  return upsertTemplate(req);
}

async function upsertTemplate(req: NextRequest) {
  try {
    await connectToDatabase();
    await ensureTemplateIndexes();
    const body = await req.json();
    const { type, template } = body;

    if (!type || template === undefined || template === null) {
      return NextResponse.json({ error: "type and template are required" }, { status: 400 });
    }
    if (!MESSAGE_TEMPLATE_TYPES.includes(type)) {
      return NextResponse.json({ error: "Unknown message type" }, { status: 400 });
    }

    // The station comes from who is asking and what they have selected —
    // never from the request body.
    const { siteId } = await stationForRequest();
    if (!siteId) {
      return NextResponse.json({ error: "Select a single station to edit its messages." }, { status: 400 });
    }
    const oid = new mongoose.Types.ObjectId(siteId);

    const result = await MessagingTemplate.findOneAndUpdate(
      { siteId: oid, type },
      { siteId: oid, type, template },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    return NextResponse.json({ template: result });
  } catch (err: any) {
    console.error("TEMPLATE SAVE ERROR:", err);
    return NextResponse.json({ error: err.message || "Failed to save template" }, { status: 500 });
  }
}
