/**
 * GET  /api/mobile/end-of-day-tasks
 * POST /api/mobile/end-of-day-tasks    { templateId, photoUrl? }
 * DELETE /api/mobile/end-of-day-tasks?templateId=...
 *
 * Driver-facing end-of-day checklist. GET returns every active template
 * plus which ones this driver has already completed today; POST/DELETE
 * toggle one item at a time so progress is never lost if the app closes
 * mid-checklist.
 *
 * Auth: JWT via x-badge-token, same as the rest of /api/mobile/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import { resolveDriverScope } from "@/lib/mobile/driver-scope";
import EndOfDayTaskTemplate from "@/lib/models/EndOfDayTaskTemplate";
import EndOfDayTaskCompletion from "@/lib/models/EndOfDayTaskCompletion";

const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);
const BUSINESS_TZ = "America/Los_Angeles";

function businessDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function authenticate(req: NextRequest): Promise<{ transporterId: string } | NextResponse> {
  const token = req.headers.get("x-badge-token");
  if (!token) {
    return NextResponse.json({ error: "Missing x-badge-token header" }, { status: 401, headers: corsHeaders });
  }
  try {
    const result = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const transporterId = (result.payload.transporterId as string || "").trim().toUpperCase();
    if (!transporterId) {
      return NextResponse.json({ error: "Token missing transporterId" }, { status: 401, headers: corsHeaders });
    }
    return { transporterId };
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await connectToDatabase();
    const date = businessDateString();

    const [templates, completion] = await Promise.all([
      EndOfDayTaskTemplate.find({ isActive: true }).sort({ sortOrder: 1, title: 1 }).lean(),
      EndOfDayTaskCompletion.findOne({ transporterId: auth.transporterId, date }).lean(),
    ]);

    const completedIds = new Set((completion as any)?.items?.map((i: any) => String(i.templateId)) || []);

    return NextResponse.json(
      {
        date,
        tasks: (templates as any[]).map((t) => ({
          _id: String(t._id),
          title: t.title,
          description: t.description || "",
          requiresPhoto: !!t.requiresPhoto,
          completed: completedIds.has(String(t._id)),
        })),
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/end-of-day-tasks GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const templateId = (body?.templateId || "").trim();
    const photoUrl = body?.photoUrl || undefined;
    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400, headers: corsHeaders });
    }

    await connectToDatabase();

    const template: any = await EndOfDayTaskTemplate.findById(templateId).lean();
    if (!template) {
      return NextResponse.json({ error: "Task not found" }, { status: 404, headers: corsHeaders });
    }
    if (template.requiresPhoto && !photoUrl) {
      return NextResponse.json({ error: "This task requires a photo" }, { status: 400, headers: corsHeaders });
    }

    const driverScope = await resolveDriverScope(auth.transporterId);
    const date = businessDateString();

    // Upsert: pull any existing entry for this template first (so
    // re-completing replaces rather than duplicates), then push the new
    // one. Two ops rather than one $addToSet because the photo/timestamp
    // can change between completions.
    await EndOfDayTaskCompletion.updateOne(
      { transporterId: auth.transporterId, date },
      { $pull: { items: { templateId } } },
      { upsert: true }
    );
    await EndOfDayTaskCompletion.updateOne(
      { transporterId: auth.transporterId, date },
      {
        $push: {
          items: {
            templateId,
            title: template.title,
            completedAt: new Date(),
            ...(photoUrl ? { photoUrl } : {}),
          },
        },
        ...(driverScope.siteId ? { $set: { siteId: driverScope.siteId } } : {}),
      }
    );

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[mobile/end-of-day-tasks POST]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("templateId") || "";
    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400, headers: corsHeaders });
    }

    await connectToDatabase();
    const date = businessDateString();

    await EndOfDayTaskCompletion.updateOne(
      { transporterId: auth.transporterId, date },
      { $pull: { items: { templateId } } }
    );

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[mobile/end-of-day-tasks DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
