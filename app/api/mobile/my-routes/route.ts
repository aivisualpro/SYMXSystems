/**
 * GET /api/mobile/my-routes
 *
 * Returns the routes for the authenticated driver (scoped to their
 * transporterId from the JWT).  Used by the Flutter "Daily Inspections"
 * screen.
 *
 * Query params:
 *   yearWeek  – required, e.g. "2026-W19"
 *   date      – optional, e.g. "2026-05-09" (defaults to today in
 *               America/Los_Angeles)
 *
 * Auth: JWT via `x-badge-token` header.
 *
 * This is a parallel auth path — it does NOT touch the existing
 * cookie-based session flow or require Dispatching permissions.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import RouteType from "@/lib/models/RouteType";

// ── JWT secret (same as badge-login / me) ──
const secretKey = process.env.JWT_SECRET || "symx_systems_secret_key";
const key = new TextEncoder().encode(secretKey);

/** Business timezone — all date computations use Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";

// ── CORS headers ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-badge-token",
};

// ── OPTIONS preflight ──
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ── Helpers ──────────────────────────────────────────────────────

/** Returns today's date string (YYYY-MM-DD) in the business timezone. */
function todayInLA(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}

/**
 * Derives the ISO yearWeek string (e.g. "2026-W19") from a YYYY-MM-DD
 * date string when the caller does not provide an explicit yearWeek.
 */
function dateToYearWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid TZ edge cases
  // ISO week: Mon = 1 … Sun = 7
  const dayOfWeek = d.getDay() || 7; // convert 0 (Sun) → 7
  // Thursday of the same ISO week determines the year
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${thursday.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ── GET handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──
    const token = req.headers.get("x-badge-token");
    if (!token) {
      return NextResponse.json(
        { error: "Missing x-badge-token header" },
        { status: 401, headers: corsHeaders }
      );
    }

    let payload: any;
    try {
      const result = await jwtVerify(token, key, { algorithms: ["HS256"] });
      payload = result.payload;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    const transporterId = (payload.transporterId || "").trim().toUpperCase();
    if (!transporterId) {
      return NextResponse.json(
        { error: "Token missing transporterId" },
        { status: 401, headers: corsHeaders }
      );
    }

    // ── Query params ──
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date") || todayInLA();
    const yearWeek = searchParams.get("yearWeek") || dateToYearWeek(dateParam);

    await connectToDatabase();

    // ── Build query ──
    const query: any = {
      yearWeek,
      transporterId,
    };
    // If a specific date was requested, filter to that day
    if (dateParam) {
      query.date = new Date(dateParam);
    }

    // ── Parallel fetches ──
    const [routes, employee, allRouteTypes] = await Promise.all([
      SYMXRoute.find(query)
        .sort({ date: 1 })
        .lean(),
      SymxEmployee.findOne(
        { transporterId },
        {
          firstName: 1,
          lastName: 1,
          type: 1,
          profileImage: 1,
          transporterId: 1,
          badgeNumber: 1,
        }
      ).lean(),
      RouteType.find(
        {},
        { _id: 1, name: 1, color: 1, icon: 1 }
      ).lean(),
    ]);

    // ── RouteType lookup map ──
    const rtIdToMeta = new Map<string, { name: string; color: string; icon: string }>();
    for (const rt of allRouteTypes as any[]) {
      rtIdToMeta.set(String(rt._id), {
        name: rt.name || "",
        color: rt.color || "#6B7280",
        icon: rt.icon || "",
      });
    }

    // ── Employee info ──
    const emp = employee as any;
    const firstName = (emp?.firstName || "").trim();
    const lastName = (emp?.lastName || "").trim();
    const employeeInfo = {
      transporterId,
      badgeNumber: emp?.badgeNumber || "",
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.toUpperCase(),
      type: emp?.type || "",
      profileImage: emp?.profileImage || "",
    };

    // ── Enrich routes ──
    const enrichedRoutes = (routes as any[]).map((r) => {
      const typeId = r.typeId ? String(r.typeId) : "";
      const rtMeta = typeId ? rtIdToMeta.get(typeId) : null;

      return {
        id: String(r._id),
        transporterId: r.transporterId || "",
        date: r.date,
        weekDay: r.weekDay || "",
        employeeName: employeeInfo.fullName,
        type: rtMeta?.name || r.type || "",
        typeColor: rtMeta?.color || "#6B7280",
        typeIcon: rtMeta?.icon || "",
        routeNumber: r.routeNumber || "",
        van: r.van || "",
        routeDuration: r.routeDuration || "",
        waveTime: r.waveTime || "",
        inspectionTime: r.inspectionTime || "",
        inspectionId: r.inspectionId || "",
        actualDepartureTime: r.actualDepartureTime || "",
        deliveryCompletionTime: r.deliveryCompletionTime || "",
        profileImage: employeeInfo.profileImage,
        // Extra fields useful for the detail bottom sheet
        stopCount: r.stopCount || 0,
        packageCount: r.packageCount || 0,
        attendance: r.attendance || "",
        serviceType: r.serviceType || "",
      };
    });

    return NextResponse.json(
      {
        routes: enrichedRoutes,
        employee: employeeInfo,
        date: dateParam,
        yearWeek,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[mobile/my-routes] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
