import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope } from "@/lib/scoped-query";
import Site from "@/lib/models/Site";
import SymxEmployee from "@/lib/models/SymxEmployee";
import AmazonReportImport from "@/lib/models/AmazonReportImport";
import ScoreCardCDFNegative from "@/lib/models/ScoreCardCDFNegative";
import ScoreCardDSBConcession from "@/lib/models/ScoreCardDSBConcession";

const requestSchema = z.object({
  action: z.enum(["preview", "import"]),
  reportType: z.enum(["cdf-negative", "daily-dsb-concessions"]),
  week: z.string().regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/),
  fileName: z.string().trim().min(1).max(500),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(10000),
});

function header(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
}

function normalizedRow(row: Record<string, unknown>) {
  return new Map(Object.entries(row).map(([key, value]) => [header(key), value]));
}

function value(row: Map<string, unknown>, ...aliases: string[]) {
  for (const alias of aliases) {
    const candidate = row.get(header(alias));
    if (candidate !== undefined && candidate !== null) return String(candidate).trim();
  }
  return "";
}

function transporter(value: string) {
  return value.trim().toUpperCase();
}

function impacting(value: unknown) {
  return ["1", "yes", "y", "true", "impacting"].includes(String(value ?? "").trim().toLowerCase());
}

function flagged(value: unknown) {
  return ["1", "yes", "y", "true", "x"].includes(String(value ?? "").trim().toLowerCase());
}

function identity(row: Map<string, unknown>) {
  return transporter(value(row, "Transporter ID", "Delivery Associate"));
}

export async function POST(request: NextRequest) {
  try { await requirePermission("Driver Dashboard", "edit"); }
  catch (error: any) { return NextResponse.json({ error: error.name === "ForbiddenError" ? error.message : "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 }); }

  const session = await getSession();
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quality-detail import request.", details: parsed.error.flatten() }, { status: 400 });

  await connectToDatabase();
  const scope = await getRequestScope();
  if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site before importing." }, { status: 400 });
  const siteId = scope.activeSiteIds[0];
  const site = await Site.findById(siteId, { code: 1 }).lean() as any;
  if (!site) return NextResponse.json({ error: "Selected site was not found." }, { status: 400 });

  const input = parsed.data;
  const rows = input.rows.map(normalizedRow);
  const transporterIds = [...new Set(rows.map(identity).filter(Boolean))];
  const employees = transporterIds.length ? await SymxEmployee.find(
    { primarySiteId: siteId, transporterId: { $in: transporterIds } },
    { _id: 1, transporterId: 1 },
  ).lean() as any[] : [];
  const employeeMap = new Map(employees.map(employee => [transporter(String(employee.transporterId || "")), employee._id]));
  const matched = rows.filter(row => employeeMap.has(identity(row))).length;
  const impactCount = rows.filter(row => impacting(value(row, "Impacts Scorecard"))).length;
  const reportLabel = input.reportType === "cdf-negative" ? "CDF Negative" : "DSB / Delivery Concessions";

  if (input.action === "preview") {
    return NextResponse.json({ reportType: input.reportType, reportLabel, site: site.code || "Selected site", week: input.week, rows: rows.length, matched, unmatched: rows.length - matched, impacting: impactCount });
  }

  const existing = await AmazonReportImport.findOne({ siteId, fileHash: input.fileHash, status: "success" }, { _id: 1 }).lean();
  if (existing) return NextResponse.json({ error: "This exact file has already been imported." }, { status: 409 });

  const ledger = await AmazonReportImport.create({
    siteId, fileName: input.fileName, fileHash: input.fileHash, reportType: input.reportType,
    reportLabel, periodType: "Weekly", week: input.week, rowCount: rows.length,
    impactingCount: impactCount, importedBy: String(session.id), importedByName: session.name,
    versionKey: JSON.stringify([String(siteId), "Weekly", input.reportType, input.week]), status: "pending",
    processingStartedAt: new Date(),
  });

  try {
    const operations = input.reportType === "cdf-negative"
      ? rows.map(row => {
        const transporterId = identity(row);
        const trackingId = value(row, "Tracking ID", "Tracking ID / TBA", "TBA");
        if (!transporterId || !trackingId) return null;
        const record = {
          siteId, week: input.week, transporterId, deliveryAssociate: transporterId,
          deliveryAssociateName: value(row, "Driver", "Delivery Associate Name"),
          deliveryGroupId: value(row, "Delivery Group ID"), trackingId,
          deliveryDate: value(row, "Delivery Date"), impactsScorecard: value(row, "Impacts Scorecard"),
          disputeStatus: value(row, "Dispute Status"), action: value(row, "Action"),
          daMishandledPackage: value(row, "DA Mishandled Package"),
          daWasUnprofessional: value(row, "DA was Unprofessional"),
          daDidNotFollowInstructions: value(row, "DA Did Not Follow Delivery Instructions", "DA did not follow my delivery instructions"),
          deliveredToWrongAddress: value(row, "Delivered to Wrong Address"),
          neverReceivedDelivery: value(row, "Never Received Delivery"),
          receivedWrongItem: value(row, "Received Wrong Item"), feedbackDetails: value(row, "Feedback Details"),
          ...(employeeMap.has(transporterId) ? { employeeId: employeeMap.get(transporterId) } : {}),
        };
        return { updateOne: { filter: { siteId, week: input.week, transporterId, trackingId }, update: { $set: record, $addToSet: { sourceImportIds: ledger._id } }, upsert: true } };
      }).filter(Boolean)
      : rows.map(row => {
        const transporterId = identity(row);
        const trackingId = value(row, "Tracking ID", "Tracking ID / TBA", "TBA");
        const concessionDate = value(row, "Concession Date");
        if (!transporterId || !trackingId || !concessionDate) return null;
        const record = {
          siteId, week: input.week, transporterId, trackingId, concessionDate,
          driverName: value(row, "Driver", "Delivery Associate Name"),
          deliveryType: value(row, "Delivery Type"), deliveryDate: value(row, "Delivery Date"),
          impactsScorecard: value(row, "Impacts Scorecard"), disputeStatus: value(row, "Dispute Status"),
          action: value(row, "Action"), serviceArea: value(row, "Service Area"), dsp: value(row, "DSP"),
          simultaneousDeliveries: flagged(value(row, "Simultaneous Deliveries")),
          deliveredOver50m: flagged(value(row, "Delivered >50m", "Delivered > 50m", "Delivered > 50 m", "Delivered > 50 meters")),
          incorrectScanUsageAttended: flagged(value(row, "Incorrect Scan Usage - Attended", "Incorrect Scan Usage - Attended Delivery", "Incorrect Scan - Attended")),
          incorrectScanUsageUnattended: flagged(value(row, "Incorrect Scan Usage - Unattended", "Incorrect Scan Usage - Unattended Delivery", "Incorrect Scan - Unattended")),
          noPodOnDelivery: flagged(value(row, "No POD on Delivery", "No POD")),
          scannedNotDeliveredNotReturned: flagged(value(row, "Scanned - Not Delivered - Not Returned", "Scanned Not Delivered Not Returned")),
          ...(employeeMap.has(transporterId) ? { employeeId: employeeMap.get(transporterId) } : {}),
        };
        return { updateOne: { filter: { siteId, transporterId, trackingId, concessionDate }, update: { $set: record, $addToSet: { sourceImportIds: ledger._id } }, upsert: true } };
      }).filter(Boolean);

    if (!operations.length) throw new Error("No complete canonical records were found in this report.");
    const result = input.reportType === "cdf-negative"
      ? await ScoreCardCDFNegative.bulkWrite(operations as any[])
      : await ScoreCardDSBConcession.bulkWrite(operations as any[]);
    await AmazonReportImport.updateOne({ _id: ledger._id, status: "pending" }, { $set: {
      status: "success", insertedCount: result.upsertedCount || 0, updatedCount: result.modifiedCount || 0,
      processedCount: operations.length, skippedCount: rows.length - operations.length, importedAt: new Date(),
    } });
    return NextResponse.json({ success: true, importId: String(ledger._id), inserted: result.upsertedCount || 0, updated: result.modifiedCount || 0, skipped: rows.length - operations.length });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Import failed";
    await AmazonReportImport.updateOne({ _id: ledger._id, status: "pending" }, { $set: { status: "failed", errorMessage: message, importedAt: new Date() } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
