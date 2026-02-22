// ── Scorecard Types ───────────────────────────────────────────────────────
export interface DriverData {
  name: string; transporterId: string; profileImage: string | null; overallStanding: string; overallScore: number | null;
  ficoMetric: number | null; ficoTier: string;
  speedingEventRate: number; speedingEventRateTier: string;
  seatbeltOffRate: number; seatbeltOffRateTier: string;
  distractionsRate: number; distractionsRateTier: string;
  signSignalViolationsRate: number; signSignalViolationsRateTier: string;
  followingDistanceRate: number; followingDistanceRateTier: string;
  dcr: string; dcrTier: string; dsb: number; dsbTier: string;
  pod: string; podTier: string; psb: number; psbTier: string;
  packagesDelivered: number; ced: number; cedTier: string;
  podOpportunities: number; podSuccess: number; podBypass: number;
  podRejects: number; podRejectBreakdown: Record<string, number>;
  dsbCount: number; issueCount: number;
  dcrFromCollection: number | null;
  // DVIC
  dvicInspections: { vin: string; fleetType: string; inspectionType: string; inspectionStatus: string; startTime: string; endTime: string; duration: string; startDate: string }[];
  dvicTotalInspections: number;
  dvicRushedCount: number;
  // Safety Dashboard
  safetyEvents: { date: string; deliveryAssociate: string; eventId: string; dateTime: string; vin: string; programImpact: string; metricType: string; metricSubtype: string; source: string; videoLink: string; reviewDetails: string }[];
  safetyEventCount: number;
  // CDF Negative Feedback
  cdfNegativeRecords: { deliveryGroupId: string; deliveryAssociateName: string; daMishandledPackage: string; daWasUnprofessional: string; daDidNotFollowInstructions: string; deliveredToWrongAddress: string; neverReceivedDelivery: string; receivedWrongItem: string; feedbackDetails: string; trackingId: string; deliveryDate: string }[];
  cdfNegativeCount: number;
  // Quality DSB/DNR
  qualityDsbDnr: { dsbCount: number; dsbDpmo: number; attendedDeliveryCount: number; unattendedDeliveryCount: number; simultaneousDeliveries: number; deliveredOver50m: number; incorrectScanUsageAttended: number; incorrectScanUsageUnattended: number; noPodOnDelivery: number; scannedNotDeliveredNotReturned: number } | null;
}

export interface PodRow {
  transporterId: string; opportunities: number; success: number;
  bypass: number; rejects: number; blurryPhoto: number; humanInThePicture: number;
  noPackageDetected: number; packageInCar: number; packageInHand: number;
  packageNotClearlyVisible: number; packageTooClose: number; photoTooDark: number; other: number;
}

export interface CdfNegativeRow {
  deliveryAssociateName: string; transporterId: string; deliveryGroupId: string;
  trackingId: string; deliveryDate: string;
  daMishandledPackage: string; daWasUnprofessional: string; daDidNotFollowInstructions: string;
  deliveredToWrongAddress: string; neverReceivedDelivery: string; receivedWrongItem: string;
  feedbackDetails: string;
}

export interface DspMetrics {
  overallScore: number; overallTier: string;
  tierDistribution: Record<string, number>;
  safety: {
    tier: string; avgFico: number; ficoTier: string;
    seatbeltOffRate: number; seatbeltOffRateTier: string;
    speedingEventRate: number; speedingEventRateTier: string;
    signSignalViolationsRate: number; signSignalViolationsRateTier: string;
    distractionsRate: number; distractionsRateTier: string;
    followingDistanceRate: number; followingDistanceRateTier: string;
  };
  deliveryQuality: {
    tier: string; dcr: number; dcrTier: string; totalDsb: number; dsbTier: string;
    pod: number; podTier: string; podAcceptanceRate: number;
    totalPodOpps: number; totalPodSuccess: number; totalPodRejects: number; totalPodBypass: number;
    totalCed: number; avgCed: number; cedTier: string;
  };
  focusAreas: { area: string; reason: string; score: number }[];
  safetyAggregate?: {
    totalEvents: number;
    driversWithEvents: number;
    byMetricSubtype: Record<string, number>;
    byProgramImpact: Record<string, number>;
  };
  cdfNegativeAggregate?: {
    total: number;
    driversAffected: number;
    mishandled: number;
    unprofessional: number;
    didNotFollow: number;
    wrongAddress: number;
    neverReceived: number;
    wrongItem: number;
  };
  dvicSummary?: {
    totalInspections: number;
    driversWithInspections: number;
    rushedCount: number;
  };
  dcrAggregate?: {
    avgDcr: number;
    totalDispatched: number;
    totalDelivered: number;
    totalRts: number;
    rtsBizClosed: number;
    rtsCustUnavail: number;
    rtsNoSecure: number;
    rtsAccess: number;
    rtsLocate: number;
    rtsOther: number;
  };
  dsbAggregate?: {
    avgDsbDpmo: number;
    totalAttended: number;
    totalUnattended: number;
    totalSimultaneous: number;
    totalOver50m: number;
    totalIncorrectAttended: number;
    totalIncorrectUnattended: number;
    totalNoPod: number;
    totalSNDNR: number;
  };
  collectionCounts?: {
    deliveryExcellence: number;
    photoOnDelivery: number;
    dvicVehicleInspection: number;
    safetyDashboardDFO2: number;
    cdfNegative: number;
    qualityDSBDNR: number;
    dcr: number;
  };
}
