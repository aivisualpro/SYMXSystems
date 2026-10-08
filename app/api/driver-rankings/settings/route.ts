import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope } from "@/lib/scoped-query";
import { loadEffectiveRankingConfig, rankingConfigHistory, saveRankingConfig } from "@/lib/driver-ranking/ranking-config-service";

const denied = (error: any) => NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 });
export async function GET(req: NextRequest) {
  let session: any; try { session = await requirePermission("Driver Dashboard", "view"); } catch (error) { return denied(error); }
  await connectToDatabase(); const scope = await getRequestScope();
  if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site." }, { status: 400 });
  const week = req.nextUrl.searchParams.get("week") || "";
  return NextResponse.json({ config: await loadEffectiveRankingConfig(scope.activeSiteIds[0], week), history: await rankingConfigHistory(scope.activeSiteIds[0]), canEdit: await hasPermission(session, "Driver Dashboard", "edit") });
}
export async function POST(req: NextRequest) {
  let session: any; try { session = await requirePermission("Driver Dashboard", "edit"); } catch (error) { return denied(error); }
  try { await connectToDatabase(); const scope = await getRequestScope(); if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site." }, { status: 400 }); const body = await req.json(); return NextResponse.json({ config: await saveRankingConfig(scope.activeSiteIds[0], body.weights, body.modifiers, body.exposure, body.effectiveFromWeek, session.email || session.name || session.id, body.workload) }, { status: 201 }); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Could not save ranking settings." }, { status: 400 }); }
}
