import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [result] = await SymxEmployee.aggregate([
      {
        $facet: {
          // ── Status counts ──
          statusCounts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                  $sum: {
                    $cond: [
                      { $or: [
                        { $eq: ["$status", "Active"] },
                        { $eq: [{ $ifNull: ["$status", "Active"] }, "Active"] },
                        { $not: { $in: ["$status", ["Terminated", "Resigned", "Inactive"]] } },
                      ]},
                      1, 0,
                    ],
                  },
                },
                terminated: {
                  $sum: { $cond: [{ $and: [{ $eq: ["$status", "Terminated"] }, { $eq: [{ $ifNull: ["$resignationDate", null] }, null] }] }, 1, 0] },
                },
                resigned: {
                  $sum: {
                    $cond: [
                      { $or: [{ $eq: ["$status", "Resigned"] }, { $and: [{ $ne: [{ $ifNull: ["$resignationDate", null] }, null] }, { $ne: ["$status", "Terminated"] }] }] },
                      1, 0,
                    ],
                  },
                },
                inactive: { $sum: { $cond: [{ $eq: ["$status", "Inactive"] }, 1, 0] } },
                recentHires: {
                  $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, { $gte: ["$hiredDate", thirtyDaysAgo] }] }, 1, 0] },
                },
              },
            },
          ],

          // ── Type breakdown ──
          typeBreakdown: [
            { $group: { _id: { $ifNull: ["$type", "Unassigned"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],

          // ── Active-only stats (docs, availability, tenure, etc.) ──
          activeStats: [
            {
              $match: {
                $or: [
                  { status: "Active" },
                  { status: { $exists: false } },
                  { status: { $nin: ["Terminated", "Resigned", "Inactive"] } },
                ],
              },
            },
            {
              $group: {
                _id: null,
                activeCount: { $sum: 1 },
                // Doc compliance
                hasOfferLetter: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$offerLetterFile", ""] }, ""] }] }, 1, 0] } },
                hasDL: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$driversLicenseFile", ""] }, ""] }] }, 1, 0] } },
                hasI9: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$i9File", ""] }, ""] }] }, 1, 0] } },
                hasDrugTest: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$drugTestFile", ""] }, ""] }] }, 1, 0] } },
                hasHandbook: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$handbookFile", ""] }, ""] }] }, 1, 0] } },
                missingDocs: {
                  $sum: {
                    $cond: [
                      { $or: [
                        { $in: [{ $ifNull: ["$offerLetterFile", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$driversLicenseFile", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$i9File", ""] }, ["", null]] },
                      ]},
                      1, 0,
                    ],
                  },
                },
                // DL expiry
                expiringDL: {
                  $sum: {
                    $cond: [
                      { $and: [
                        { $ne: [{ $ifNull: ["$dlExpiration", null] }, null] },
                        { $gte: ["$dlExpiration", now] },
                        { $lte: ["$dlExpiration", thirtyDaysFromNow] },
                      ]},
                      1, 0,
                    ],
                  },
                },
                expiredDL: {
                  $sum: {
                    $cond: [
                      { $and: [{ $ne: [{ $ifNull: ["$dlExpiration", null] }, null] }, { $lt: ["$dlExpiration", now] }] },
                      1, 0,
                    ],
                  },
                },
                // Employee Audit: Active + (DL expired OR missing transporterId OR missing any required doc)
                employeeAuditCount: {
                  $sum: {
                    $cond: [
                      { $or: [
                        { $and: [{ $ne: [{ $ifNull: ["$dlExpiration", null] }, null] }, { $lte: ["$dlExpiration", now] }] },
                        { $in: [{ $ifNull: ["$transporterId", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$offerLetterFile", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$handbookFile", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$driversLicenseFile", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$i9File", ""] }, ["", null]] },
                        { $in: [{ $ifNull: ["$drugTestFile", ""] }, ["", null]] },
                      ]},
                      1, 0,
                    ],
                  },
                },
                // Tenure
                totalTenureDays: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $ifNull: ["$hiredDate", null] }, null] },
                      { $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] },
                      0,
                    ],
                  },
                },
                tenureCount: {
                  $sum: { $cond: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, 1, 0] },
                },
                // Tenure buckets
                tenureLt3mo: {
                  $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, { $lt: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 90] }] }, 1, 0] },
                },
                tenure3to6mo: {
                  $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, { $gte: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 90] }, { $lt: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 180] }] }, 1, 0] },
                },
                tenure6to12mo: {
                  $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, { $gte: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 180] }, { $lt: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 365] }] }, 1, 0] },
                },
                tenure1to2yr: {
                  $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, { $gte: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 365] }, { $lt: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 730] }] }, 1, 0] },
                },
                tenure2yrPlus: {
                  $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$hiredDate", null] }, null] }, { $gte: [{ $divide: [{ $subtract: [now, "$hiredDate"] }, 86400000] }, 730] }] }, 1, 0] },
                },
                // Availability per day
                sunAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$sunday", ""] }, ""] }, { $ne: ["$sunday", "OFF"] }] }, 1, 0] } },
                monAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$monday", ""] }, ""] }, { $ne: ["$monday", "OFF"] }] }, 1, 0] } },
                tueAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$tuesday", ""] }, ""] }, { $ne: ["$tuesday", "OFF"] }] }, 1, 0] } },
                wedAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$wednesday", ""] }, ""] }, { $ne: ["$wednesday", "OFF"] }] }, 1, 0] } },
                thuAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$thursday", ""] }, ""] }, { $ne: ["$thursday", "OFF"] }] }, 1, 0] } },
                friAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$friday", ""] }, ""] }, { $ne: ["$friday", "OFF"] }] }, 1, 0] } },
                satAvail: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$saturday", ""] }, ""] }, { $ne: ["$saturday", "OFF"] }] }, 1, 0] } },
              },
            },
          ],

          // ── Hourly status ──
          hourlyBreakdown: [
            {
              $match: {
                $or: [
                  { status: "Active" },
                  { status: { $exists: false } },
                  { status: { $nin: ["Terminated", "Resigned", "Inactive"] } },
                ],
              },
            },
            { $group: { _id: { $ifNull: ["$hourlyStatus", "Unspecified"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],

          // ── Gender ──
          genderBreakdown: [
            {
              $match: {
                $or: [
                  { status: "Active" },
                  { status: { $exists: false } },
                  { status: { $nin: ["Terminated", "Resigned", "Inactive"] } },
                ],
              },
            },
            { $group: { _id: { $ifNull: ["$gender", "Not Specified"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],

          // ── Top cities ──
          cityBreakdown: [
            {
              $match: {
                $or: [
                  { status: "Active" },
                  { status: { $exists: false } },
                  { status: { $nin: ["Terminated", "Resigned", "Inactive"] } },
                ],
              },
            },
            { $group: { _id: { $ifNull: ["$city", "Unknown"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],

          // ── Offboarding pipeline ──
          offboarding: [
            {
              $match: {
                status: { $in: ["Terminated", "Resigned"] },
                $or: [
                  { terminationDate: { $gte: sixtyDaysAgo } },
                  { resignationDate: { $gte: sixtyDaysAgo } },
                ],
              },
            },
            {
              $group: {
                _id: null,
                recentTerminations: { $sum: 1 },
                pendingPaycom: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$paycomOffboarded", false] }, true] }, 1, 0] } },
                pendingAmazon: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$amazonOffboarded", false] }, true] }, 1, 0] } },
                pendingFinalCheck: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$finalCheckIssued", false] }, true] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ]);

    const sc = result.statusCounts[0] || { total: 0, active: 0, terminated: 0, resigned: 0, inactive: 0, recentHires: 0 };
    const ac = result.activeStats[0] || {
      activeCount: 0, hasOfferLetter: 0, hasDL: 0, hasI9: 0, hasDrugTest: 0, hasHandbook: 0,
      missingDocs: 0, expiringDL: 0, expiredDL: 0, employeeAuditCount: 0,
      totalTenureDays: 0, tenureCount: 0,
      tenureLt3mo: 0, tenure3to6mo: 0, tenure6to12mo: 0, tenure1to2yr: 0, tenure2yrPlus: 0,
      sunAvail: 0, monAvail: 0, tueAvail: 0, wedAvail: 0, thuAvail: 0, friAvail: 0, satAvail: 0,
    };
    const ob = result.offboarding[0] || { recentTerminations: 0, pendingPaycom: 0, pendingAmazon: 0, pendingFinalCheck: 0 };

    const totalDocScore = ac.hasOfferLetter + ac.hasDL + ac.hasI9 + ac.hasDrugTest + ac.hasHandbook;
    const totalDocPossible = ac.activeCount * 5;
    const docCompliancePct = totalDocPossible > 0 ? Math.round((totalDocScore / totalDocPossible) * 100) : 0;

    const avgTenureDays = ac.tenureCount > 0 ? Math.round(ac.totalTenureDays / ac.tenureCount) : 0;
    const avgTenureMonths = Math.round(avgTenureDays / 30);

    const retentionRate = sc.total > 0 ? Math.round((sc.active / sc.total) * 100) : 0;
    const turnoverRate = sc.total > 0 ? Math.round(((sc.terminated + sc.resigned) / sc.total) * 100) : 0;

    const typeMap: Record<string, number> = {};
    result.typeBreakdown.forEach((t: any) => { typeMap[t._id] = t.count; });

    const hourlyMap: Record<string, number> = {};
    result.hourlyBreakdown.forEach((h: any) => { hourlyMap[h._id] = h.count; });

    const genderMap: Record<string, number> = {};
    result.genderBreakdown.forEach((g: any) => { genderMap[g._id] = g.count; });

    const topCities = result.cityBreakdown.map((c: any) => [c._id, c.count]);

    return NextResponse.json({
      total: sc.total, active: sc.active, terminated: sc.terminated, resigned: sc.resigned, inactive: sc.inactive,
      recentHires: sc.recentHires,
      typeMap, hourlyMap, genderMap, topCities,
      tenureBuckets: {
        "<3mo": Math.round(ac.tenureLt3mo),
        "3-6mo": Math.round(ac.tenure3to6mo),
        "6-12mo": Math.round(ac.tenure6to12mo),
        "1-2yr": Math.round(ac.tenure1to2yr),
        "2yr+": Math.round(ac.tenure2yrPlus),
      },
      avgTenureMonths,
      availability: [
        { day: "SUN", available: ac.sunAvail, total: ac.activeCount },
        { day: "MON", available: ac.monAvail, total: ac.activeCount },
        { day: "TUE", available: ac.tueAvail, total: ac.activeCount },
        { day: "WED", available: ac.wedAvail, total: ac.activeCount },
        { day: "THU", available: ac.thuAvail, total: ac.activeCount },
        { day: "FRI", available: ac.friAvail, total: ac.activeCount },
        { day: "SAT", available: ac.satAvail, total: ac.activeCount },
      ],
      expiringDL: ac.expiringDL, expiredDL: ac.expiredDL, missingDocs: ac.missingDocs,
      employeeAuditCount: ac.employeeAuditCount,
      docCompliancePct,
      hasOfferLetter: ac.hasOfferLetter, hasDL: ac.hasDL, hasI9: ac.hasI9,
      hasDrugTest: ac.hasDrugTest, hasHandbook: ac.hasHandbook,
      activeCount: ac.activeCount,
      retentionRate, turnoverRate,
      recentTerminations: ob.recentTerminations, pendingPaycom: ob.pendingPaycom,
      pendingAmazon: ob.pendingAmazon, pendingFinalCheck: ob.pendingFinalCheck,
    });
  } catch (error) {
    console.error("[EMPLOYEES_DASHBOARD]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
