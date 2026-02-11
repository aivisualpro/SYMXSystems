import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import SymxCustomerDeliveryFeedback from "@/lib/models/SymxCustomerDeliveryFeedback";
import SymxPhotoOnDelivery from "@/lib/models/SymxPhotoOnDelivery";
import SymxDVICVehicleInspection from "@/lib/models/SymxDVICVehicleInspection";
import SymxEmployee from "@/lib/models/SymxEmployee";

// ────────────────────────────────────────────────────────────────────────────
// Tier classification helpers
// ────────────────────────────────────────────────────────────────────────────
function classifyOverallTier(score: number): string {
  if (score >= 850) return "Fantastic Plus";
  if (score >= 750) return "Fantastic";
  if (score >= 650) return "Great";
  if (score >= 500) return "Fair";
  return "Poor";
}

function classifyRateTier(rate: number): string {
  // Lower is better for event rates
  if (rate <= 0.5) return "Fantastic";
  if (rate <= 1.0) return "Great";
  if (rate <= 2.0) return "Fair";
  return "Poor";
}

function classifyPercentTier(pct: number): string {
  if (pct >= 99.5) return "Fantastic Plus";
  if (pct >= 98.5) return "Fantastic";
  if (pct >= 97) return "Great";
  if (pct >= 95) return "Fair";
  return "Poor";
}

function classifyFicoTier(fico: number): string {
  if (fico >= 850) return "Fantastic";
  if (fico >= 750) return "Great";
  if (fico >= 650) return "Fair";
  return "Poor";
}

// Tier value for sorting (higher = better)
function tierValue(tier: string): number {
  const t = (tier || "").toLowerCase();
  if (t.includes("fantastic plus")) return 5;
  if (t.includes("fantastic")) return 4;
  if (t.includes("great")) return 3;
  if (t.includes("fair")) return 2;
  if (t.includes("poor")) return 1;
  return 0;
}

// Safe average helper
function safeAvg(values: number[]): number {
  const valid = values.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// Parse percentage string -> number
function parsePct(val: string | number | undefined): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const n = parseFloat(val.replace("%", ""));
  return isNaN(n) ? null : n;
}

// Determine DSP-level tier from average metric
function getDspTier(avg: number, type: "score" | "rate" | "percent" | "fico"): string {
  switch (type) {
    case "score": return classifyOverallTier(avg * 10); // scale 0-100 -> 0-1000
    case "rate": return classifyRateTier(avg);
    case "percent": return classifyPercentTier(avg);
    case "fico": return classifyFicoTier(avg);
    default: return "N/A";
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const week = searchParams.get("week");

    await connectToDatabase();

    // If no week specified, return available weeks
    if (!week) {
      const weeks = await SymxDeliveryExcellence.distinct("week");
      // Sort weeks descending (most recent first)
      weeks.sort((a: string, b: string) => b.localeCompare(a));
      return NextResponse.json({ weeks });
    }

    // Fetch all 4 data sources for the selected week + employee images
    const [excellence, cdf, pod, dvic, employees] = await Promise.all([
      SymxDeliveryExcellence.find({ week }).lean(),
      SymxCustomerDeliveryFeedback.find({ week }).lean(),
      SymxPhotoOnDelivery.find({ week }).lean(),
      SymxDVICVehicleInspection.find({ week }).lean(),
      SymxEmployee.find({ transporterId: { $exists: true, $ne: '' } }, { transporterId: 1, profileImage: 1 }).lean(),
    ]);

    // Employee image map
    const empImageMap = new Map<string, string>();
    employees.forEach((e: any) => {
      if (e.transporterId && e.profileImage) empImageMap.set(e.transporterId, e.profileImage);
    });

    // Build a lookup map by transporterId
    const cdfMap = new Map<string, any>();
    cdf.forEach((c: any) => cdfMap.set(c.transporterId, c));

    const podMap = new Map<string, any>();
    pod.forEach((p: any) => podMap.set(p.transporterId, p));

    // DVIC: group inspections per transporter
    const dvicMap = new Map<string, any[]>();
    dvic.forEach((d: any) => {
      if (!dvicMap.has(d.transporterId)) dvicMap.set(d.transporterId, []);
      dvicMap.get(d.transporterId)!.push(d);
    });

    // Merge data per driver
    const drivers = excellence.map((driver: any) => {
      const cdfData = cdfMap.get(driver.transporterId) || {};
      const podData = podMap.get(driver.transporterId) || {};

      // POD reject breakdown
      const podRejectBreakdown: Record<string, number> = {};
      if (podData.blurryPhoto) podRejectBreakdown["Blurry Photo"] = podData.blurryPhoto;
      if (podData.humanInThePicture) podRejectBreakdown["Human in Picture"] = podData.humanInThePicture;
      if (podData.noPackageDetected) podRejectBreakdown["No Package Detected"] = podData.noPackageDetected;
      if (podData.packageInCar) podRejectBreakdown["Package in Car"] = podData.packageInCar;
      if (podData.packageInHand) podRejectBreakdown["Package in Hand"] = podData.packageInHand;
      if (podData.packageNotClearlyVisible) podRejectBreakdown["Package Not Clearly Visible"] = podData.packageNotClearlyVisible;
      if (podData.packageTooClose) podRejectBreakdown["Package Too Close"] = podData.packageTooClose;
      if (podData.photoTooDark) podRejectBreakdown["Photo Too Dark"] = podData.photoTooDark;
      if (podData.other) podRejectBreakdown["Other"] = podData.other;

      return {
        // Identity
        name: driver.deliveryAssociate || `${podData.firstName || ""} ${podData.lastName || ""}`.trim() || "Unknown",
        transporterId: driver.transporterId,
        profileImage: empImageMap.get(driver.transporterId) || null,

        // Delivery Excellence metrics
        overallStanding: driver.overallStanding || "N/A",
        overallScore: driver.overallScore ?? null,
        ficoMetric: driver.ficoMetric ?? null,
        ficoTier: driver.ficoTier || "N/A",
        
        // Safety metrics
        speedingEventRate: driver.speedingEventRate ?? 0,
        speedingEventRateTier: driver.speedingEventRateTier || "N/A",
        seatbeltOffRate: driver.seatbeltOffRate ?? 0,
        seatbeltOffRateTier: driver.seatbeltOffRateTier || "N/A",
        distractionsRate: driver.distractionsRate ?? 0,
        distractionsRateTier: driver.distractionsRateTier || "N/A",
        signSignalViolationsRate: driver.signSignalViolationsRate ?? 0,
        signSignalViolationsRateTier: driver.signSignalViolationsRateTier || "N/A",
        followingDistanceRate: driver.followingDistanceRate ?? 0,
        followingDistanceRateTier: driver.followingDistanceRateTier || "N/A",

        // Delivery Quality
        dcr: driver.dcr || "N/A",
        dcrTier: driver.dcrTier || "N/A",
        dsb: driver.dsb ?? 0,
        dsbTier: driver.dsbDpmoTier || "N/A",
        pod: driver.pod || "N/A",
        podTier: driver.podTier || "N/A",
        psb: driver.psb ?? 0,
        psbTier: driver.psbTier || "N/A",
        packagesDelivered: driver.packagesDelivered ?? 0,
        ced: driver.ced ?? 0,
        cedTier: driver.cedTier || "N/A",

        // Scores
        ficoScore: driver.ficoScore ?? null,
        dcrScore: driver.dcrScore ?? null,
        dsbDpmoScore: driver.dsbDpmoScore ?? null,
        podScore: driver.podScore ?? null,
        psbScore: driver.psbScore ?? null,
        cedScore: driver.cedScore ?? null,
        cdfDpmoScore: driver.cdfDpmoScore ?? null,

        // CDF
        cdfDpmo: driver.cdfDpmo ?? cdfData.cdfDpmo ?? 0,
        cdfDpmoTier: driver.cdfDpmoTier ?? cdfData.cdfDpmoTier ?? "N/A",
        negativeFeedbackCount: cdfData.negativeFeedbackCount ?? 0,

        // POD
        podOpportunities: podData.opportunities ?? 0,
        podSuccess: podData.success ?? 0,
        podBypass: podData.bypass ?? 0,
        podRejects: podData.rejects ?? 0,
        podRejectBreakdown,

        // Scores for sorting
        dsbCount: driver.dsb ?? 0,
        issueCount: (podData.rejects ?? 0) + (cdfData.negativeFeedbackCount ?? 0),

        // DVIC
        dvicInspections: (dvicMap.get(driver.transporterId) || []).map((d: any) => ({
          vin: d.vin || "",
          fleetType: d.fleetType || "",
          inspectionType: d.inspectionType || "",
          inspectionStatus: d.inspectionStatus || "",
          startTime: d.startTime || "",
          endTime: d.endTime || "",
          duration: d.duration || "",
          startDate: d.startDate || "",
        })),
        dvicTotalInspections: (dvicMap.get(driver.transporterId) || []).length,
        dvicRushedCount: (dvicMap.get(driver.transporterId) || []).filter((d: any) => {
          // Parse duration — consider "rushed" if < 2 minutes
          const dur = d.duration || "";
          const match = dur.match(/(\d+)\s*min/i);
          if (match) return parseInt(match[1]) < 2;
          // If format is HH:MM:SS
          const timeParts = dur.split(":");
          if (timeParts.length >= 2) {
            const mins = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
            return mins < 2;
          }
          return false;
        }).length,
      };
    });

    // Sort: worst first (DSB highest, then CDF incidents, then POD rejects, then lowest overall score, then A-Z)
    drivers.sort((a: any, b: any) => {
      if (b.dsbCount !== a.dsbCount) return b.dsbCount - a.dsbCount;
      if (b.negativeFeedbackCount !== a.negativeFeedbackCount) return b.negativeFeedbackCount - a.negativeFeedbackCount;
      if (b.podRejects !== a.podRejects) return b.podRejects - a.podRejects;
      if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
      const scoreA = a.overallScore ?? 999;
      const scoreB = b.overallScore ?? 999;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a.name || "").localeCompare(b.name || "");
    });

    // ────────────────────────────────────────────────────────────────────────
    // DSP-Level Aggregate Metrics (for scorecard)
    // ────────────────────────────────────────────────────────────────────────
    const totalDrivers = drivers.length;
    const totalDelivered = drivers.reduce((sum: number, d: any) => sum + (d.packagesDelivered || 0), 0);
    const scoresWithData = drivers.filter((d: any) => d.overallScore != null);
    const avgOverall = scoresWithData.length > 0
      ? scoresWithData.reduce((sum: number, d: any) => sum + d.overallScore, 0) / scoresWithData.length
      : 0;

    // Safety & Compliance averages
    const avgSeatbeltOffRate = safeAvg(drivers.map((d: any) => d.seatbeltOffRate));
    const avgSpeedingEventRate = safeAvg(drivers.map((d: any) => d.speedingEventRate));
    const avgSignSignalViolationsRate = safeAvg(drivers.map((d: any) => d.signSignalViolationsRate));
    const avgDistractionsRate = safeAvg(drivers.map((d: any) => d.distractionsRate));
    const avgFollowingDistanceRate = safeAvg(drivers.map((d: any) => d.followingDistanceRate));
    const ficoValues = drivers.map((d: any) => d.ficoMetric).filter((v: any) => v != null);
    const avgFico = ficoValues.length > 0 ? ficoValues.reduce((a: number, b: number) => a + b, 0) / ficoValues.length : 0;

    // Delivery Quality
    const dcrValues = drivers.map((d: any) => parsePct(d.dcr)).filter((v): v is number => v != null);
    const avgDcr = dcrValues.length > 0 ? dcrValues.reduce((a, b) => a + b, 0) / dcrValues.length : 0;
    
    const totalDsb = drivers.reduce((sum: number, d: any) => sum + (d.dsb || 0), 0);
    
    const podPctValues = drivers.map((d: any) => parsePct(d.pod)).filter((v): v is number => v != null);
    const avgPod = podPctValues.length > 0 ? podPctValues.reduce((a, b) => a + b, 0) / podPctValues.length : 0;

    const totalPodOpps = drivers.reduce((sum: number, d: any) => sum + (d.podOpportunities || 0), 0);
    const totalPodSuccess = drivers.reduce((sum: number, d: any) => sum + (d.podSuccess || 0), 0);
    const totalPodRejects = drivers.reduce((sum: number, d: any) => sum + (d.podRejects || 0), 0);
    const totalPodBypass = drivers.reduce((sum: number, d: any) => sum + (d.podBypass || 0), 0);
    const podAcceptanceRate = totalPodOpps > 0 ? (totalPodSuccess / totalPodOpps) * 100 : 0;

    // Customer Delivery Experience
    const cedValues = drivers.map((d: any) => d.ced).filter((v: any) => v != null && v > 0);
    const avgCed = cedValues.length > 0 ? cedValues.reduce((a: number, b: number) => a + b, 0) / cedValues.length : 0;
    const totalCed = drivers.reduce((sum: number, d: any) => sum + (d.ced || 0), 0);

    // CDF
    const totalNegativeFeedback = drivers.reduce((sum: number, d: any) => sum + (d.negativeFeedbackCount || 0), 0);
    const cdfDpmoValues = drivers.map((d: any) => d.cdfDpmo).filter((v: any) => v != null && v > 0);
    const avgCdfDpmo = cdfDpmoValues.length > 0 ? cdfDpmoValues.reduce((a: number, b: number) => a + b, 0) / cdfDpmoValues.length : 0;

    // Tier distributions
    const tierDistribution: Record<string, number> = {};
    drivers.forEach((d: any) => {
      const t = d.overallStanding || "N/A";
      tierDistribution[t] = (tierDistribution[t] || 0) + 1;
    });

    // Overall tier for safety section
    const allSafetyRates = [avgSeatbeltOffRate, avgSpeedingEventRate, avgSignSignalViolationsRate, avgDistractionsRate, avgFollowingDistanceRate];
    const worstSafetyRate = Math.max(...allSafetyRates);
    const safetyTier = classifyRateTier(worstSafetyRate);

    // Overall tier for delivery quality
    const deliveryTier = classifyPercentTier(avgDcr);

    // Overall DSP tier
    const overallTier = avgOverall > 0 ? classifyOverallTier(avgOverall * 10) : "N/A";

    // Recommended Focus Areas — identify the 3 weakest categories
    const focusAreas: { area: string; reason: string; score: number }[] = [];
    
    // Check CED
    if (totalCed > 10) focusAreas.push({ area: "Customer Escalation Defect DPMO", reason: `${totalCed} escalation incidents`, score: totalCed });
    // Check CDF
    if (totalNegativeFeedback > 0) focusAreas.push({ area: "Customer Delivery Feedback", reason: `${totalNegativeFeedback} negative feedback records`, score: totalNegativeFeedback });
    // Check DSB
    if (totalDsb > 5) focusAreas.push({ area: "Delivery Success Behaviors", reason: `${totalDsb} total DSB events`, score: totalDsb });
    // Check POD rejects
    if (totalPodRejects > 5) focusAreas.push({ area: "Photo-On-Delivery Compliance", reason: `${totalPodRejects} POD rejects`, score: totalPodRejects });
    // Check safety
    if (worstSafetyRate > 1.5) focusAreas.push({ area: "On-Road Safety", reason: `Worst rate: ${worstSafetyRate.toFixed(2)} events/100 trips`, score: worstSafetyRate });
    // Check DCR
    if (avgDcr < 99) focusAreas.push({ area: "Delivery Completion Rate", reason: `Average DCR: ${avgDcr.toFixed(2)}%`, score: 100 - avgDcr });

    // Sort by impact (highest score = most issues)
    focusAreas.sort((a, b) => b.score - a.score);

    const dspMetrics = {
      overallScore: Math.round(avgOverall * 100) / 100,
      overallTier,
      tierDistribution,
      safety: {
        tier: safetyTier,
        avgFico: Math.round(avgFico),
        ficoTier: avgFico > 0 ? classifyFicoTier(avgFico) : "N/A",
        seatbeltOffRate: Math.round(avgSeatbeltOffRate * 100) / 100,
        seatbeltOffRateTier: classifyRateTier(avgSeatbeltOffRate),
        speedingEventRate: Math.round(avgSpeedingEventRate * 100) / 100,
        speedingEventRateTier: classifyRateTier(avgSpeedingEventRate),
        signSignalViolationsRate: Math.round(avgSignSignalViolationsRate * 100) / 100,
        signSignalViolationsRateTier: classifyRateTier(avgSignSignalViolationsRate),
        distractionsRate: Math.round(avgDistractionsRate * 100) / 100,
        distractionsRateTier: classifyRateTier(avgDistractionsRate),
        followingDistanceRate: Math.round(avgFollowingDistanceRate * 100) / 100,
        followingDistanceRateTier: classifyRateTier(avgFollowingDistanceRate),
      },
      deliveryQuality: {
        tier: deliveryTier,
        dcr: Math.round(avgDcr * 100) / 100,
        dcrTier: classifyPercentTier(avgDcr),
        totalDsb,
        dsbTier: totalDsb <= 5 ? "Fantastic" : totalDsb <= 20 ? "Great" : totalDsb <= 50 ? "Fair" : "Poor",
        pod: Math.round(avgPod * 100) / 100,
        podTier: classifyPercentTier(avgPod),
        podAcceptanceRate: Math.round(podAcceptanceRate * 100) / 100,
        totalPodOpps,
        totalPodSuccess,
        totalPodRejects,
        totalPodBypass,
        totalCed,
        avgCed: Math.round(avgCed * 100) / 100,
        cedTier: totalCed <= 5 ? "Fantastic" : totalCed <= 15 ? "Great" : totalCed <= 30 ? "Fair" : "Poor",
        totalNegativeFeedback,
        avgCdfDpmo: Math.round(avgCdfDpmo),
        cdfDpmoTier: avgCdfDpmo <= 200 ? "Fantastic" : avgCdfDpmo <= 500 ? "Great" : avgCdfDpmo <= 1000 ? "Fair" : "Poor",
      },
      focusAreas: focusAreas.slice(0, 3),
    };

    // Sort raw POD data (most rejects first)
    const podRows = pod.map((p: any) => ({
      name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown",
      transporterId: p.transporterId,
      opportunities: p.opportunities ?? 0,
      success: p.success ?? 0,
      bypass: p.bypass ?? 0,
      rejects: p.rejects ?? 0,
      blurryPhoto: p.blurryPhoto ?? 0,
      humanInThePicture: p.humanInThePicture ?? 0,
      noPackageDetected: p.noPackageDetected ?? 0,
      packageInCar: p.packageInCar ?? 0,
      packageInHand: p.packageInHand ?? 0,
      packageNotClearlyVisible: p.packageNotClearlyVisible ?? 0,
      packageTooClose: p.packageTooClose ?? 0,
      photoTooDark: p.photoTooDark ?? 0,
      other: p.other ?? 0,
    }));
    podRows.sort((a: any, b: any) => b.rejects - a.rejects || (a.name || "").localeCompare(b.name || ""));

    // Sort raw CDF data (most negative feedback first)
    const cdfRows = cdf.map((c: any) => ({
      name: c.deliveryAssociate || "Unknown",
      transporterId: c.transporterId,
      cdfDpmo: c.cdfDpmo ?? 0,
      cdfDpmoTier: c.cdfDpmoTier || "N/A",
      cdfDpmoScore: c.cdfDpmoScore ?? 0,
      negativeFeedbackCount: c.negativeFeedbackCount ?? 0,
    }));
    cdfRows.sort((a: any, b: any) => b.negativeFeedbackCount - a.negativeFeedbackCount || (a.name || "").localeCompare(b.name || ""));

    // DVIC aggregated rows (all inspections for the week)
    const dvicRows = dvic.map((d: any) => ({
      transporterId: d.transporterId,
      transporterName: d.transporterName || "Unknown",
      vin: d.vin || "",
      fleetType: d.fleetType || "",
      inspectionType: d.inspectionType || "",
      inspectionStatus: d.inspectionStatus || "",
      startTime: d.startTime || "",
      endTime: d.endTime || "",
      duration: d.duration || "",
      startDate: d.startDate || "",
    }));

    return NextResponse.json({
      week,
      totalDrivers,
      totalDelivered,
      avgOverallScore: Math.round(avgOverall * 100) / 100,
      dspMetrics,
      drivers,
      podRows,
      cdfRows,
      dvicRows,
    });

  } catch (error) {
    console.error("Error fetching performance data:", error);
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}
