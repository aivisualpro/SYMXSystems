import AmazonReportImport from "@/lib/models/AmazonReportImport";
import ScoreCardCDFNegative from "@/lib/models/ScoreCardCDFNegative";
import ScoreCardDSBConcession from "@/lib/models/ScoreCardDSBConcession";

export type QualityMetricFamily = "CDF" | "DSB";

export type DriverWeeklyQualityEvent = {
  eventDate: string | null;
  deliveryDate: string | null;
  impactsScorecard: true;
  trackingId: string | null;
  canonicalRecordId: string;
  sourceImportIds: string[];
  disputeStatus: string | null;
  detail: string | null;
};

export type DriverWeeklyQualitySubMetric = {
  metricFamily: QualityMetricFamily;
  subMetric: string;
  friendlyLabel: string;
  count: number;
  events: DriverWeeklyQualityEvent[];
  sourcePeriod: "Weekly";
  week: string;
};

export type DriverWeeklyQualityDetails = {
  cdf: { totalMisses: number; subMetrics: DriverWeeklyQualitySubMetric[] };
  dsb: { totalMisses: number; subMetrics: DriverWeeklyQualitySubMetric[] };
};

export type DriverSafeQualityDetails = {
  cdf: DriverSafeQualitySubMetric[];
  dsb: DriverSafeQualitySubMetric[];
};

export type DriverSafeQualitySubMetric = {
  metricFamily: QualityMetricFamily;
  friendlyLabel: string;
  count: number;
  deliveryDates: string[];
  explanation: string;
};

type SourceRow = Record<string, any>;
type ReasonDefinition = { field: string; subMetric: string; friendlyLabel: string };

const CDF_REASONS: ReasonDefinition[] = [
  { field: "daMishandledPackage", subMetric: "DA Mishandled Package", friendlyLabel: "Mishandled Package" },
  { field: "daWasUnprofessional", subMetric: "DA was Unprofessional", friendlyLabel: "Unprofessional Interaction" },
  { field: "daDidNotFollowInstructions", subMetric: "DA did not follow my delivery instructions", friendlyLabel: "Did Not Follow Instructions" },
  { field: "deliveredToWrongAddress", subMetric: "Delivered to Wrong Address", friendlyLabel: "Wrong Address" },
  { field: "neverReceivedDelivery", subMetric: "Never Received Delivery", friendlyLabel: "Delivery Not Received" },
  { field: "receivedWrongItem", subMetric: "Received Wrong Item", friendlyLabel: "Wrong Item" },
];

const DSB_REASONS: ReasonDefinition[] = [
  { field: "simultaneousDeliveries", subMetric: "Simultaneous Deliveries", friendlyLabel: "Simultaneous Deliveries" },
  { field: "deliveredOver50m", subMetric: "Delivered > 50 m", friendlyLabel: "Delivered Over 50m Away" },
  { field: "incorrectScanUsageAttended", subMetric: "Incorrect Scan Usage - Attended Delivery", friendlyLabel: "Incorrect Scan - Attended" },
  { field: "incorrectScanUsageUnattended", subMetric: "Incorrect Scan Usage - Unattended Delivery", friendlyLabel: "Incorrect Scan - Unattended" },
  { field: "noPodOnDelivery", subMetric: "No POD on Delivery", friendlyLabel: "No Photo on Delivery" },
  { field: "scannedNotDeliveredNotReturned", subMetric: "Scanned - Not Delivered - Not Returned", friendlyLabel: "Scanned / Not Delivered / Not Returned" },
];

export const DRIVER_QUALITY_EXPLANATIONS: Record<string, string> = {
  "Wrong Address": "Verify the address and group stop before completing the delivery.",
  "Did Not Follow Instructions": "Review customer delivery notes before completing the stop.",
  "Mishandled Package": "Handle packages carefully and place them securely at the delivery location.",
  "Unprofessional Interaction": "Keep customer interactions professional and respectful.",
  "Delivery Not Received": "Verify the address and delivery location before completing the stop.",
  "Wrong Item": "Double-check the package label before completing the delivery.",
  "Simultaneous Deliveries": "Complete each delivery accurately before moving to the next stop.",
  "Delivered Over 50m Away": "Complete the delivery at the correct delivery location.",
  "Incorrect Scan - Attended": "Use the correct scan type for attended deliveries.",
  "Incorrect Scan - Unattended": "Use the correct scan type for unattended deliveries.",
  "No Photo on Delivery": "Take a clear delivery photo whenever the stop requires one.",
  "Scanned / Not Delivered / Not Returned": "Make sure every scanned package is either delivered correctly or returned through the proper process.",
};

const isImpacting = (value: unknown) => ["1", "yes", "y", "true", "impacting"].includes(String(value ?? "").trim().toLowerCase());
const isReasonActive = (value: unknown) => value === true || ["1", "yes", "y", "true", "x"].includes(String(value ?? "").trim().toLowerCase());
const ids = (row: SourceRow) => (row.sourceImportIds ?? []).map((value: unknown) => String(value));

function expandRows(metricFamily: QualityMetricFamily, rows: SourceRow[], definitions: ReasonDefinition[], week: string) {
  const groups = new Map<string, DriverWeeklyQualitySubMetric>();
  for (const definition of definitions) {
    groups.set(definition.field, {
      metricFamily,
      subMetric: definition.subMetric,
      friendlyLabel: definition.friendlyLabel,
      count: 0,
      events: [],
      sourcePeriod: "Weekly",
      week,
    });
  }

  for (const row of rows) {
    if (!isImpacting(row.impactsScorecard)) continue;
    for (const definition of definitions) {
      if (!isReasonActive(row[definition.field])) continue;
      const group = groups.get(definition.field)!;
      group.events.push({
        eventDate: row.concessionDate || row.deliveryDate || null,
        deliveryDate: row.deliveryDate || null,
        impactsScorecard: true,
        trackingId: row.trackingId || null,
        canonicalRecordId: String(row._id),
        sourceImportIds: ids(row),
        disputeStatus: row.disputeStatus || null,
        detail: row.feedbackDetails || row.deliveryType || null,
      });
      group.count += 1;
    }
  }
  return [...groups.values()].filter(group => group.count > 0);
}

export function buildDriverWeeklyQualityDetails(cdfRows: SourceRow[], dsbRows: SourceRow[], week: string): DriverWeeklyQualityDetails {
  const impactingCdf = cdfRows.filter(row => isImpacting(row.impactsScorecard));
  const impactingDsb = dsbRows.filter(row => isImpacting(row.impactsScorecard));
  return {
    cdf: { totalMisses: impactingCdf.length, subMetrics: expandRows("CDF", impactingCdf, CDF_REASONS, week) },
    dsb: { totalMisses: impactingDsb.length, subMetrics: expandRows("DSB", impactingDsb, DSB_REASONS, week) },
  };
}

export function toDriverSafeQualityDetails(details: DriverWeeklyQualityDetails): DriverSafeQualityDetails {
  const sanitize = (metrics: DriverWeeklyQualitySubMetric[]): DriverSafeQualitySubMetric[] => metrics.map(metric => ({
    metricFamily: metric.metricFamily,
    friendlyLabel: metric.friendlyLabel,
    count: metric.count,
    deliveryDates: [...new Set(metric.events.map(event => event.deliveryDate || event.eventDate).filter((value): value is string => !!value))],
    explanation: DRIVER_QUALITY_EXPLANATIONS[metric.friendlyLabel] || "Review this delivery detail with your manager.",
  }));
  return { cdf: sanitize(details.cdf.subMetrics), dsb: sanitize(details.dsb.subMetrics) };
}

export async function loadDriverWeeklyQualityDetails(siteId: string, week: string, transporterId: string): Promise<DriverWeeklyQualityDetails> {
  const normalizedTransporterId = transporterId.trim().toUpperCase();
  const imports = await AmazonReportImport.find({
    siteId,
    week,
    periodType: "Weekly",
    status: "success",
    reportType: { $in: ["cdf-negative", "daily-dsb-concessions"] },
  }, { _id: 1, reportType: 1 }).lean();

  const importIds = (reportType: string) => imports.filter((entry: any) => entry.reportType === reportType).map((entry: any) => entry._id);
  const cdfImportIds = importIds("cdf-negative");
  const dsbImportIds = importIds("daily-dsb-concessions");
  const [cdfRows, dsbRows] = await Promise.all([
    cdfImportIds.length ? ScoreCardCDFNegative.find({ siteId, week, transporterId: normalizedTransporterId, sourceImportIds: { $in: cdfImportIds } }).lean() : [],
    dsbImportIds.length ? ScoreCardDSBConcession.find({ siteId, transporterId: normalizedTransporterId, sourceImportIds: { $in: dsbImportIds } }).lean() : [],
  ]);
  return buildDriverWeeklyQualityDetails(cdfRows as SourceRow[], dsbRows as SourceRow[], week);
}
