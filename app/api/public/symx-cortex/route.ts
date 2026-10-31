import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import CortexObservation from "@/lib/models/CortexObservation";
import { analyzeDriver } from "@/lib/cortex/intelligence";
import { captureSchema, STATIONS } from "@/lib/cortex/domain";

// Development-only station lookup: resolve Amazon's own identifier against SYMX's
// authoritative Site mapping. Never guess an identity or create a Site record.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" || process.env.SYMX_CORTEX_DEMO !== "true")
    return NextResponse.json({ error: "Unavailable" }, { status: 404 });
  const key = process.env.SYMX_CORTEX_KEY;
  const supplied = req.headers.get("x-extension-key") || "";
  if (!key || Buffer.byteLength(key) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(key), Buffer.from(supplied)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const serviceAreaId = req.nextUrl.searchParams.get("serviceAreaId") || "";
  if (!serviceAreaId || serviceAreaId.length > 150)
    return NextResponse.json({ error: "Invalid service area" }, { status: 400 });
  try {
    await connectToDatabase();
    const site = await Site.findOne({
      "amazon.serviceAreaId": serviceAreaId,
      code: { $in: [...STATIONS] },
      status: "active",
    }).select("code").lean();
    if (!site)
      return NextResponse.json({ error: "Unknown station: configure local Site mapping" }, { status: 404 });
    return NextResponse.json({ code: site.code, serviceAreaId }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Station lookup unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  // Dedicated MVP key. Never accept the legacy embedded extension credential.
  const key = process.env.SYMX_CORTEX_KEY;
  const supplied = req.headers.get("x-extension-key") || "";
  if (!key)
    return NextResponse.json(
      { error: "Cortex ingest is not configured" },
      { status: 503 },
    );
  if (
    Buffer.byteLength(key) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(key), Buffer.from(supplied))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length")) > 1024 * 1024)
    return NextResponse.json({ error: "Capture too large" }, { status: 413 });
  let body;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text) > 1024 * 1024)
      return NextResponse.json({ error: "Capture too large" }, { status: 413 });
    body = captureSchema.safeParse(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "Invalid capture" }, { status: 400 });
  }
  if (!body.success)
    return NextResponse.json(
      { error: "Invalid capture", issues: body.error.issues },
      { status: 400 },
    );
  const capture = body.data;
  const age = Date.now() - Date.parse(capture.observedAt);
  if (age < -120000 || age > 7 * 86400000)
    return NextResponse.json(
      { error: "Capture timestamp outside accepted window" },
      { status: 400 },
    );
  const captureDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date(capture.observedAt));
  if (capture.date > captureDay)
    return NextResponse.json(
      { error: "Future business date" },
      { status: 400 },
    );
  try {
    await connectToDatabase();
    const site: any = await Site.findOne({
      "amazon.serviceAreaId": capture.serviceAreaId,
      status: "active",
      code: { $in: [...STATIONS] },
    }).lean();
    if (!site)
      return NextResponse.json(
        { error: "Station is not configured for Cortex" },
        { status: 403 },
      );
    const ops = capture.routes.map((route) => ({
      updateOne: {
        filter: {
          siteId: site._id,
          captureId: capture.captureId,
          routeCode: route.routeCode,
          driverId: route.driverId,
        },
        update: {
          $setOnInsert: {
            ...route,
            driverSignals: analyzeDriver({ ...route, station: site.code, date: capture.date,
              observedAt: capture.observedAt }, Date.parse(capture.observedAt)).candidates.map(s => s.code),
            siteId: site._id,
            station: site.code,
            date: capture.date,
            captureId: capture.captureId,
            observedAt: new Date(capture.observedAt),
            receivedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));
    await CortexObservation.init(); // Await the unique retry key before accepting concurrent writes.
    try {
      await CortexObservation.bulkWrite(ops, { ordered: false });
    } catch (e: any) {
      if (
        !e.writeErrors?.length ||
        e.writeErrors.some((w: any) => w.code !== 11000)
      )
        throw e;
    }
    return NextResponse.json({
      ok: true,
      captureId: capture.captureId,
      accepted: capture.routes.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Capture storage temporarily unavailable" },
      { status: 503 },
    );
  }
}
