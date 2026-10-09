import "server-only";
import { createHash } from "crypto";
import mongoose, { ClientSession, Types } from "mongoose";
import AmazonReportImport from "@/lib/models/AmazonReportImport";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import SymxEmployee from "@/lib/models/SymxEmployee";

export const WEEKLY_SCORECARD_REPORT_TYPE = "delivery-excellence";
const weekPattern = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/;

const headerMap: Record<string, string> = {
  week: "week", "delivery associate": "deliveryAssociate", driver: "deliveryAssociate",
  "transporter id": "transporterId", "overall standing": "overallStanding", "overall score": "overallScore",
  "fico metric": "ficoMetric", "fico tier": "ficoTier", "fico score": "ficoScore",
  "speeding event rate (per trip)": "speedingEventRate", "speeding event rate tier": "speedingEventRateTier", "speeding event rate score": "speedingEventRateScore",
  "seatbelt-off rate (per trip)": "seatbeltOffRate", "seatbelt-off rate tier": "seatbeltOffRateTier", "seatbelt-off rate score": "seatbeltOffRateScore",
  "distractions rate (per trip)": "distractionsRate", "distractions rate tier": "distractionsRateTier", "distractions rate score": "distractionsRateScore",
  "sign/ signal violations rate (per trip)": "signSignalViolationsRate", "sign/signal violations rate (per trip)": "signSignalViolationsRate",
  "sign/ signal violations rate tier": "signSignalViolationsRateTier", "sign/signal violations rate tier": "signSignalViolationsRateTier",
  "sign/ signal violations rate score": "signSignalViolationsRateScore", "sign/signal violations rate score": "signSignalViolationsRateScore",
  "following distance rate (per trip)": "followingDistanceRate", "following distance rate tier": "followingDistanceRateTier", "following distance rate score": "followingDistanceRateScore",
  "cdf dpmo": "cdfDpmo", "cdf dpmo tier": "cdfDpmoTier", "cdf dpmo score": "cdfDpmoScore",
  ced: "ced", "ced tier": "cedTier", "ced score": "cedScore",
  "delivery completion dpmo": "dcDpmo", "delivery completion dpmo tier": "dcDpmoTier", "delivery completion dpmo score": "dcDpmoScore", "delivery completion dpmo weight applied": "dcDpmoWeightApplied",
  dcr: "dcr", "dcr tier": "dcrTier", "dcr score": "dcrScore",
  dsb: "dsb", "dsb dpmo tier": "dsbDpmoTier", "dsb dpmo score": "dsbDpmoScore",
  pod: "pod", "pod tier": "podTier", "pod score": "podScore",
  psb: "psb", "psb tier": "psbTier", "psb score": "psbScore", "packages delivered": "packagesDelivered",
  "fico metric weight applied": "ficoMetricWeightApplied", "speeding event rate weight applied": "speedingEventRateWeightApplied",
  "seatbelt-off rate weight applied": "seatbeltOffRateWeightApplied", "distractions rate weight applied": "distractionsRateWeightApplied",
  "sign/ signal violations rate weight applied": "signSignalViolationsRateWeightApplied", "sign/signal violations rate weight applied": "signSignalViolationsRateWeightApplied",
  "following distance rate weight applied": "followingDistanceRateWeightApplied", "cdf dpmo weight applied": "cdfDpmoWeightApplied",
  "ced weight applied": "cedWeightApplied", "dcr weight applied": "dcrWeightApplied", "dsb dpmo weight applied": "dsbDpmoWeightApplied",
  "pod weight applied": "podWeightApplied", "psb weight applied": "psbWeightApplied",
};

const numericFields = new Set([
  "overallScore", "ficoMetric", "ficoScore", "speedingEventRate", "speedingEventRateScore", "seatbeltOffRate", "seatbeltOffRateScore",
  "distractionsRate", "distractionsRateScore", "signSignalViolationsRate", "signSignalViolationsRateScore", "followingDistanceRate",
  "followingDistanceRateScore", "cdfDpmo", "cdfDpmoScore", "ced", "cedScore", "dcDpmo", "dcDpmoScore", "dcDpmoWeightApplied",
  "dcrScore", "dsb", "dsbDpmoScore", "pod", "podScore", "psb", "psbScore", "packagesDelivered", "ficoMetricWeightApplied",
  "speedingEventRateWeightApplied", "seatbeltOffRateWeightApplied", "distractionsRateWeightApplied", "signSignalViolationsRateWeightApplied",
  "followingDistanceRateWeightApplied", "cdfDpmoWeightApplied", "cedWeightApplied", "dcrWeightApplied", "dsbDpmoWeightApplied",
  "podWeightApplied", "psbWeightApplied",
]);

export const normalizeWeeklyHeader = (value: string) => value.replace(/^\uFEFF/, "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const clean = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const numberValue = (value: unknown) => {
  const text = clean(value).replace(/,/g, "").replace(/%$/, "");
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export type WeeklyScorecardRow = Record<string, unknown>;
export type NormalizedWeeklyScorecard = {
  rows: Record<string, unknown>[]; week: string; transporterIds: string[]; errors: string[];
};

export type WeeklyScorecardSite = { id: string; code: string };

export function parseWeeklyScorecardFilenameSite(fileName: string): string | null {
  const match = fileName.trim().match(/^DSP_Overview_Dashboard_SYMX_([A-Z0-9]+)_\d{4}-W\d{2}\.csv$/i);
  return match ? match[1].toUpperCase() : null;
}

export function detectWeeklyScorecardSite(
  fileName: string,
  rows: WeeklyScorecardRow[],
  sites: WeeklyScorecardSite[],
): WeeklyScorecardSite | null {
  const siteByCode = new Map(sites.map(site => [site.code.trim().toUpperCase(), site]));
  const filenameSite = parseWeeklyScorecardFilenameSite(fileName);
  if (filenameSite) return siteByCode.get(filenameSite) || null;
  const firstRow = rows[0] || {};
  for (const [header, value] of Object.entries(firstRow)) {
    if (!["site", "station", "station code"].includes(normalizeWeeklyHeader(header))) continue;
    const detected = siteByCode.get(clean(value).toUpperCase());
    if (detected) return detected;
  }

  const tokens = fileName.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    const detected = siteByCode.get(token);
    if (detected) return detected;
  }
  return null;
}

export function normalizeWeeklyScorecard(rows: WeeklyScorecardRow[], expectedWeek?: string): NormalizedWeeklyScorecard {
  const errors: string[] = [];
  if (!rows.length) return { rows: [], week: expectedWeek || "", transporterIds: [], errors: ["The file contains no data rows."] };
  const normalizedHeaders = new Set(Object.keys(rows[0]).map(normalizeWeeklyHeader));
  for (const required of ["week", "transporter id", "overall score"]) if (!normalizedHeaders.has(required)) errors.push(`Missing required header: ${required}.`);
  const output: Record<string, unknown>[] = [];
  const identities = new Set<string>();
  let detectedWeek = expectedWeek || "";

  rows.forEach((source, index) => {
    const row: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(source)) {
      const field = headerMap[normalizeWeeklyHeader(header)];
      if (!field) continue;
      if (numericFields.has(field)) {
        const parsed = numberValue(value);
        if (Number.isNaN(parsed)) errors.push(`Row ${index + 2}: ${header.trim()} must be numeric.`);
        else if (parsed !== undefined) row[field] = parsed;
      } else if (clean(value)) row[field] = clean(value);
    }
    row.transporterId = clean(row.transporterId).toUpperCase();
    const rowWeek = clean(row.week) || expectedWeek || "";
    row.week = rowWeek;
    if (!weekPattern.test(rowWeek)) errors.push(`Row ${index + 2}: invalid Week.`);
    if (!detectedWeek) detectedWeek = rowWeek;
    if (detectedWeek && rowWeek !== detectedWeek) errors.push(`Row ${index + 2}: Week does not match ${detectedWeek}.`);
    if (!row.transporterId) errors.push(`Row ${index + 2}: missing Transporter ID.`);
    if (row.overallScore === undefined) errors.push(`Row ${index + 2}: missing Overall Score.`);
    const identity = `${rowWeek}|${row.transporterId}`;
    if (identities.has(identity)) errors.push(`Row ${index + 2}: duplicate Transporter ID for ${rowWeek}.`);
    identities.add(identity);
    output.push(row);
  });
  return { rows: output, week: detectedWeek, transporterIds: output.map(row => String(row.transporterId || "")).filter(Boolean), errors: [...new Set(errors)] };
}

export async function previewWeeklyScorecard(siteId: string, rows: WeeklyScorecardRow[], expectedWeek?: string) {
  const normalized = normalizeWeeklyScorecard(rows, expectedWeek);
  if (normalized.errors.length) return { ...normalized, matchedDrivers: 0, unmatchedDrivers: normalized.transporterIds.length, newCount: 0, updateCount: 0 };
  const [employees, existing] = await Promise.all([
    SymxEmployee.find({ primarySiteId: siteId, transporterId: { $in: normalized.transporterIds } }, { transporterId: 1 }).lean<any[]>(),
    SymxDeliveryExcellence.find({ siteId, week: normalized.week, transporterId: { $in: normalized.transporterIds } }).lean<any[]>(),
  ]);
  const matched = new Set(employees.map(row => clean(row.transporterId).toUpperCase()));
  return {
    ...normalized,
    matchedDrivers: normalized.transporterIds.filter(id => matched.has(id)).length,
    unmatchedDrivers: normalized.transporterIds.filter(id => !matched.has(id)).length,
    newCount: normalized.rows.length - existing.length,
    updateCount: existing.length,
  };
}

export async function inspectWeeklyScorecardHistory(siteId: string, week: string, fileHash: string) {
  const [exact, sameWeek] = await Promise.all([
    AmazonReportImport.findOne({ siteId, fileHash, reportType: WEEKLY_SCORECARD_REPORT_TYPE, periodType: "Weekly", status: "success" }, { _id: 1 }).lean<any>(),
    AmazonReportImport.findOne({ siteId, week, reportType: WEEKLY_SCORECARD_REPORT_TYPE, periodType: "Weekly", status: "success" }, { _id: 1, fileHash: 1 }).sort({ importedAt: -1 }).lean<any>(),
  ]);
  return {
    exactDuplicate: !!exact,
    sameWeekDifferentFile: !exact && !!sameWeek && sameWeek.fileHash !== fileHash,
  };
}

export function weeklyScorecardFileHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export async function importWeeklyScorecard(input: {
  siteId: string; rows: WeeklyScorecardRow[]; week?: string; fileName: string; fileHash: string; importedBy: string; importedByName?: string;
  confirmWeekUpdate?: boolean;
}) {
  const preview = await previewWeeklyScorecard(input.siteId, input.rows, input.week);
  if (preview.errors.length) throw new Error(preview.errors.join(" "));
  if (!/^[a-f0-9]{64}$/.test(input.fileHash)) throw new Error("Invalid file fingerprint.");
  const history = await inspectWeeklyScorecardHistory(input.siteId, preview.week, input.fileHash);
  if (history.exactDuplicate) throw new Error("This scorecard has already been uploaded for this station and week.");
  if (history.sameWeekDifferentFile && !input.confirmWeekUpdate) throw new Error("Confirm the updated scorecard before replacing this week.");

  const employees = await SymxEmployee.find({ primarySiteId: input.siteId, transporterId: { $in: preview.transporterIds } }, { _id: 1, transporterId: 1 }).lean<any[]>();
  const employeeMap = new Map(employees.map(row => [clean(row.transporterId).toUpperCase(), row._id]));
  const siteObjectId = new Types.ObjectId(input.siteId);
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const existing = await SymxDeliveryExcellence.find({ siteId: input.siteId, week: preview.week, transporterId: { $in: preview.transporterIds } }).session(session).lean<any[]>();
      const existingMap = new Map(existing.map(row => [clean(row.transporterId).toUpperCase(), row]));
      const importId = new Types.ObjectId();
      const operations = preview.rows.map(row => ({ updateOne: {
        filter: { siteId: siteObjectId, week: preview.week, transporterId: String(row.transporterId) },
        update: { $set: { ...row, week: preview.week, siteId: siteObjectId, ...(employeeMap.has(String(row.transporterId)) ? { employeeId: employeeMap.get(String(row.transporterId)) } : {}) }, $addToSet: { sourceImportIds: importId } },
        upsert: true,
      } }));
      const write = await SymxDeliveryExcellence.bulkWrite(operations, { session });
      const updatedCount = preview.rows.filter(row => existingMap.has(String(row.transporterId))).length;
      const insertedCount = preview.rows.length - updatedCount;
      await AmazonReportImport.create([{
        _id: importId, siteId: input.siteId, fileName: input.fileName, fileHash: input.fileHash,
        reportType: WEEKLY_SCORECARD_REPORT_TYPE, reportLabel: "Weekly Driver Scorecard", periodType: "Weekly", week: preview.week,
        rowCount: preview.rows.length, impactingCount: 0, insertedCount, updatedCount, processedCount: preview.rows.length,
        skippedCount: 0, status: "success", importedAt: new Date(), importedBy: input.importedBy,
        importedByName: input.importedByName, versionKey: JSON.stringify([input.siteId, "Weekly", WEEKLY_SCORECARD_REPORT_TYPE, preview.week]),
      }], { session });
      result = { outcome: existing.length ? "REIMPORT" : "NEW", importId: String(importId), insertedCount, updatedCount, matchedDrivers: preview.matchedDrivers, unmatchedDrivers: preview.unmatchedDrivers, rowCount: preview.rows.length, week: preview.week, writeCount: write.upsertedCount + write.modifiedCount };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
