import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope, resolveWriteSiteId } from "@/lib/scoped-query";
import { detectWeeklyScorecardSite, importWeeklyScorecard, inspectWeeklyScorecardHistory, parseWeeklyScorecardFilenameSite, previewWeeklyScorecard } from "@/lib/imports/weekly-scorecard";
import Site from "@/lib/models/Site";

const rowSchema = z.record(z.string(), z.unknown());
const requestSchema = z.object({
  action: z.enum(["preview", "import"]),
  reportType: z.literal("delivery-excellence"),
  periodType: z.literal("Weekly"),
  week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  rows: z.array(rowSchema).min(1).max(1000),
  fileName: z.string().min(1).max(255),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  targetSiteId: z.string().optional(),
  confirmWeekUpdate: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let session: any;
  try { session = await requirePermission("Driver Dashboard", "edit"); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 }); }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Weekly Scorecard import request.", details: parsed.error.flatten() }, { status: 400 });

  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site before importing." }, { status: 400 });
    const input = parsed.data;
    const sites = await Site.find({}, { code: 1, name: 1 }).lean<any[]>();
    const siteOptions = sites.map(site => ({ id: String(site._id), code: String(site.code || "").toUpperCase() }));
    const selectedSite = siteOptions.find(site => site.id === scope.activeSiteIds[0]);
    const filenameSiteCode = parseWeeklyScorecardFilenameSite(input.fileName);
    const detectedSite = detectWeeklyScorecardSite(input.fileName, input.rows, siteOptions);
    if (filenameSiteCode && !detectedSite) {
      return NextResponse.json({ error: `The file belongs to ${filenameSiteCode}, but that station is not configured.` }, { status: 409 });
    }
    const targetSiteId = input.targetSiteId || detectedSite?.id || scope.activeSiteIds[0];
    const writeSiteId = resolveWriteSiteId(scope, targetSiteId);
    if (!writeSiteId) return NextResponse.json({ error: "You do not have access to the detected station." }, { status: 403 });
    if (writeSiteId !== scope.activeSiteIds[0] && detectedSite?.id !== writeSiteId) {
      return NextResponse.json({ error: "The file does not identify the requested station." }, { status: 409 });
    }
    if (detectedSite && detectedSite.id !== writeSiteId) {
      return NextResponse.json({ error: `This file belongs to ${detectedSite.code} and cannot be imported into another station.` }, { status: 409 });
    }
    if (input.action === "preview") {
      const preview = await previewWeeklyScorecard(writeSiteId, input.rows, input.week);
      const history = preview.errors.length ? { exactDuplicate: false, sameWeekDifferentFile: false } : await inspectWeeklyScorecardHistory(writeSiteId, preview.week, input.fileHash);
      const site = sites.find(candidate => String(candidate._id) === writeSiteId);
      return NextResponse.json({
        reportLabel: "Weekly Driver Scorecard", periodType: "Weekly", site: site?.code || site?.name || "Selected site", week: preview.week,
        selectedSite: selectedSite?.code || "Selected site", targetSiteId: writeSiteId,
        wrongStation: !!detectedSite && detectedSite.id !== scope.activeSiteIds[0],
        exactDuplicate: history.exactDuplicate, sameWeekDifferentFile: history.sameWeekDifferentFile,
        rows: preview.rows.length, matchedDrivers: preview.matchedDrivers, unmatchedDrivers: preview.unmatchedDrivers,
        newCount: preview.newCount, updateCount: preview.updateCount, errors: preview.errors,
      }, { status: preview.errors.length ? 400 : 200 });
    }
    const result = await importWeeklyScorecard({
      siteId: writeSiteId, rows: input.rows, week: input.week, fileName: input.fileName, fileHash: input.fileHash,
      importedBy: String(session.id), importedByName: session.name || session.email || undefined,
      confirmWeekUpdate: input.confirmWeekUpdate,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const message = error?.message?.includes("Transaction numbers are only allowed")
      ? "This database does not support atomic transactions; nothing was imported."
      : error.message || "Weekly Scorecard import failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
