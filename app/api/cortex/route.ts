import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import connectToDatabase from "@/lib/db";
import CortexObservation from "@/lib/models/CortexObservation";
import { demoData } from "@/lib/cortex/fixtures";
import {
  dateSchema,
  businessDate,
  latestRoutes,
  type Observation,
} from "@/lib/cortex/domain";
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "view");
  } catch {
    return NextResponse.json(
      { error: "Dispatching access required" },
      { status: 403 },
    );
  }
  if (req.nextUrl.searchParams.get("demo") === "1") {
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.SYMX_CORTEX_DEMO !== "true"
    )
      return NextResponse.json({ error: "Demo disabled" }, { status: 404 });
    return NextResponse.json(demoData(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const date = req.nextUrl.searchParams.get("date") || businessDate();
  if (!dateSchema.safeParse(date).success)
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    const filter = siteFilter(scope);
    const from = new Date(`${date}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 14);
    // Limit history to the last observation per driver/route/day in MongoDB, not an arbitrary raw-row limit.
    const rows = await CortexObservation.aggregate([
      {
        $match: {
          ...filter,
          date: { $gte: from.toISOString().slice(0, 10), $lte: date },
        },
      },
      { $sort: { observedAt: -1 } },
      {
        $group: {
          _id: {
            site: "$siteId",
            date: "$date",
            route: "$routeCode",
            driver: "$driverId",
            detail: "$detail",
          },
          row: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$row" } },
      { $project: { _id: 0, siteId: 0, captureId: 0, __v: 0 } },
    ]);
    const observations: Observation[] = rows.map((r: any) => ({
      ...r,
      observedAt: new Date(r.observedAt).toISOString(),
      receivedAt: new Date(r.receivedAt).toISOString(),
    }));
    const historyGroups = new Map<string, Observation[]>();
    for (const row of observations.filter((r) => r.date < date)) {
      const key = `${row.station}|${row.date}|${row.driverId}`;
      historyGroups.set(key, [...(historyGroups.get(key) || []), row]);
    }
    const history = [...historyGroups.values()].flatMap(latestRoutes);
    return NextResponse.json(
      {
        date,
        routes: latestRoutes(observations.filter((r) => r.date === date)),
        history,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Cortex data is temporarily unavailable" },
      { status: 503 },
    );
  }
}
