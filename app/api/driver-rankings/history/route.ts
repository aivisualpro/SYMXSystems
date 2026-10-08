import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope } from "@/lib/scoped-query";
import { loadDriverRankingData } from "@/lib/driver-ranking/driver-ranking-data";
import { driverHistoryWeek, driverMetricRanks, summarizeDriverHistory } from "@/lib/driver-ranking/driver-history-review";
import { loadDriverWeeklyQualityDetails } from "@/lib/driver-ranking/driver-weekly-quality-events";

export async function GET(req: NextRequest) {
  try { await requirePermission("Driver Dashboard", "view"); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 }); }
  try {
    await connectToDatabase();
    const scope=await getRequestScope();
    if(scope.activeSiteIds.length!==1)return NextResponse.json({error:"Select one site."},{status:400});
    const week=req.nextUrl.searchParams.get("week")||"",transporterId=(req.nextUrl.searchParams.get("transporterId")||"").trim().toUpperCase();
    if(!/^\d{4}-W\d{2}$/.test(week)||!transporterId)return NextResponse.json({error:"Choose a valid driver and reporting week."},{status:400});
    const selected=await loadDriverRankingData(scope.activeSiteIds[0],{week});
    const weeks=selected.availableWeeks.filter(value=>value<=week).sort().slice(-6);
    const results=await Promise.all(weeks.map(value=>value===week?selected:loadDriverRankingData(scope.activeSiteIds[0],{week:value})));
    const history=results.flatMap(result=>{const driver=result.drivers.find(row=>row.transporterId===transporterId);if(!driver?.score)return[];const packages=result.drivers.map(row=>row.score?.packagesPerDeliveryDay).filter((value):value is number=>typeof value==="number"&&Number.isFinite(value));const teamAverage=packages.length?packages.reduce((sum,value)=>sum+value,0)/packages.length:null;return[driverHistoryWeek(driver,teamAverage)];});
    const qualityDetails=await loadDriverWeeklyQualityDetails(scope.activeSiteIds[0],week,transporterId);
    return NextResponse.json({history,review:summarizeDriverHistory(history,weeks),metricRanks:driverMetricRanks(selected.drivers,transporterId),qualityDetails});
  } catch(error:any){return NextResponse.json({error:error.message||"Could not load driver history."},{status:400});}
}
