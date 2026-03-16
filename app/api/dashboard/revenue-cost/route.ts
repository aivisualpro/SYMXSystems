import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";

// GET: Aggregate daily revenue (wstRevenue) and cost (totalCost) from dispatching routes
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "12", 10);

    // Calculate cutoff date
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setHours(0, 0, 0, 0);

    // Aggregate by date: sum wstRevenue and totalCost per day
    const pipeline = [
      {
        $match: {
          date: { $gte: cutoff },
          $or: [
            { wstRevenue: { $gt: 0 } },
            { totalCost: { $gt: 0 } },
          ],
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
          revenue: { $sum: { $ifNull: ["$wstRevenue", 0] } },
          cost: { $sum: { $ifNull: ["$totalCost", 0] } },
          routeCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: { $round: ["$revenue", 2] },
          cost: { $round: ["$cost", 2] },
          profit: { $round: [{ $subtract: ["$revenue", "$cost"] }, 2] },
          routeCount: 1,
        },
      },
      { $sort: { date: 1 as 1 } },
    ];

    const data = await SYMXRoute.aggregate(pipeline);

    // Also compute totals
    const totals = data.reduce(
      (acc, d) => ({
        totalRevenue: acc.totalRevenue + d.revenue,
        totalCost: acc.totalCost + d.cost,
        totalProfit: acc.totalProfit + d.profit,
        totalRoutes: acc.totalRoutes + d.routeCount,
      }),
      { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalRoutes: 0 }
    );

    return NextResponse.json({
      data,
      totals: {
        ...totals,
        totalRevenue: Math.round(totals.totalRevenue * 100) / 100,
        totalCost: Math.round(totals.totalCost * 100) / 100,
        totalProfit: Math.round(totals.totalProfit * 100) / 100,
        avgRevenuePerRoute:
          totals.totalRoutes > 0
            ? Math.round((totals.totalRevenue / totals.totalRoutes) * 100) / 100
            : 0,
        avgCostPerRoute:
          totals.totalRoutes > 0
            ? Math.round((totals.totalCost / totals.totalRoutes) * 100) / 100
            : 0,
        margin:
          totals.totalRevenue > 0
            ? Math.round(((totals.totalProfit / totals.totalRevenue) * 100) * 100) / 100
            : 0,
      },
    });
  } catch (error) {
    console.error("Revenue/Cost API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
