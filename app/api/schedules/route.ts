import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SymxUser from "@/lib/models/SymxUser";
import SYMXRoute from "@/lib/models/SYMXRoute";
import RouteType from "@/lib/models/RouteType";
import SymxEveryday from "@/lib/models/SymxEveryday";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";
import { authorizeAction } from "@/lib/rbac";
import { z } from "zod";
import { validateBody, validateSearchParams } from "@/lib/validations";

const schedulesQuerySchema = z.object({
  yearWeek: z.string().optional().nullable(),
  weeksList: z.enum(["true", "false"]).optional().nullable()
});

const updateScheduleSchema = z.object({
  scheduleId: z.string().optional(),
  type: z.string().optional(),
  employeeId: z.string().optional(),
  note: z.string().optional(),
  startTime: z.string().optional(),
  status: z.string().optional(),
  transporterId: z.string().optional(),
  employeeName: z.string().optional(),
  oldNote: z.string().optional(),
  date: z.string().optional(),
  yearWeek: z.string().optional(),
  weekDay: z.string().optional()
});

const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Resolve performer name from session, with DB fallback
async function resolvePerformerName(session: any): Promise<{ email: string; name: string }> {
  const email = session?.email || "unknown";
  const sessionName = session?.name || "";
  // If session has a proper name (not empty and not matching a role pattern), use it
  if (sessionName && sessionName.length > 1) {
    return { email, name: sessionName };
  }
  // Fallback: look up the user from DB
  try {
    const user = await SymxUser.findOne({ email: email.toLowerCase() }, { name: 1 }).lean() as any;
    if (user?.name) {
      return { email, name: user.name };
    }
  } catch { }
  return { email, name: email };
}

// Cache for weeksList
let weeksListCache: { data: string[]; timestamp: number } | null = null;
const WEEKS_CACHE_TTL = 60 * 1000; // 1 minute

export async function GET(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Scheduling", "view");
    if (!auth.authorized) return auth.response;

    const validation = validateSearchParams(schedulesQuerySchema, req);
    if (!validation.success) {
      return validation.response;
    }

    const { yearWeek, weeksList } = validation.data;

    await connectToDatabase();

    // Return all available weeks for the dropdown (cached)
    if (weeksList === "true") {
      const now = Date.now();
      if (weeksListCache && (now - weeksListCache.timestamp) < WEEKS_CACHE_TTL) {
        return NextResponse.json({ weeks: weeksListCache.data });
      }
      const weeks = await SymxEmployeeSchedule.distinct("yearWeek");
      weeks.sort((a: string, b: string) => b.localeCompare(a));
      weeksListCache = { data: weeks, timestamp: Date.now() };
      return NextResponse.json({ weeks });
    }

    if (!yearWeek) {
      return NextResponse.json({ error: "yearWeek parameter is required" }, { status: 400 });
    }

    // Fetch all schedule entries for this week
    const schedules = await SymxEmployeeSchedule.find(
      { yearWeek },
      { transporterId: 1, date: 1, weekDay: 1, status: 1, type: 1, subType: 1, trainingDay: 1, startTime: 1, dayBeforeConfirmation: 1, dayOfConfirmation: 1, weekConfirmation: 1, van: 1, note: 1 }
    )
      .sort({ date: 1 })
      .lean();

    // Get unique transporter IDs
    const transporterIds = [...new Set(schedules.map((s: any) => s.transporterId))];

    // ── Run employee lookup, prev-week fetch, and audit counts IN PARALLEL ──
    const weekMatch = yearWeek.match(/(\d{4})-W(\d{2})/);
    let prevYearWeek = "";
    if (weekMatch) {
      const yr = parseInt(weekMatch[1]);
      const wk = parseInt(weekMatch[2]);
      let prevYr = yr, prevWk = wk - 1;
      if (prevWk <= 0) { prevYr--; prevWk = 52; }
      prevYearWeek = `${prevYr}-W${String(prevWk).padStart(2, "0")}`;
    }

    const [employees, prevSchedules, auditCountsRaw, routeTypes, wstOptions] = await Promise.all([
      // Employee info
      SymxEmployee.find(
        { transporterId: { $in: transporterIds } },
        { _id: 1, transporterId: 1, firstName: 1, lastName: 1, type: 1, status: 1, ScheduleNotes: 1, sunday: 1, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, hiredDate: 1, profileImage: 1, rate: 1 }
      ).lean(),
      // Previous week schedules (only need date, transporterId, status)
      prevYearWeek
        ? SymxEmployeeSchedule.find(
          { yearWeek: prevYearWeek, transporterId: { $in: transporterIds } },
          { transporterId: 1, date: 1, status: 1 }
        ).lean()
        : Promise.resolve([]),
      // Audit counts
      ScheduleAuditLog.aggregate([
        { $match: { yearWeek } },
        { $group: { _id: "$transporterId", count: { $sum: 1 } } },
      ]),
      // Route types
      RouteType.find({ isActive: true }, { name: 1, theoryHrs: 1, group: 1 }).lean(),
      // WST Options
      SYMXWSTOption.find({ isActive: true }).lean(),
    ]);

    const wstMap = new Map((wstOptions as any[]).map(w => [(w.wst || '').trim().toLowerCase(), w.revenue || 0]));

    const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp]));
    const theoryHrsMap = new Map((routeTypes as any[]).map(rt => [(rt.name || '').trim().toLowerCase(), rt.theoryHrs || 0]));
    const routeTypeGroupMap = new Map((routeTypes as any[]).map(rt => [(rt.name || '').trim().toLowerCase(), (rt.group || '').trim().toLowerCase()]));

    // Group schedules by transporter → days of week
    const grouped: Record<string, any> = {};
    schedules.forEach((s: any) => {
      if (!grouped[s.transporterId]) {
        const emp = employeeMap.get(s.transporterId);
        grouped[s.transporterId] = {
          transporterId: s.transporterId,
          employee: emp
            ? {
              _id: emp._id,
              firstName: emp.firstName,
              lastName: emp.lastName,
              name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
              type: emp.type || '',
              status: emp.status || '',
              ScheduleNotes: emp.ScheduleNotes || '',
              hiredDate: emp.hiredDate || null,
              profileImage: emp.profileImage || null,
            }
            : null,
          weekNote: '',
          days: {},
        };
      }
      const date = new Date(s.date);
      const dayIndex = date.getUTCDay();
      grouped[s.transporterId].days[dayIndex] = {
        _id: s._id,
        date: s.date,
        weekDay: s.weekDay,
        status: s.status,
        type: s.type,
        subType: s.subType,
        trainingDay: s.trainingDay,
        startTime: s.startTime,
        dayBeforeConfirmation: s.dayBeforeConfirmation,
        dayOfConfirmation: s.dayOfConfirmation,
        weekConfirmation: s.weekConfirmation,
        van: s.van,
        note: s.note,
      };
      if (s.note && !grouped[s.transporterId].weekNote) {
        grouped[s.transporterId].weekNote = s.note;
      }
    });

    // Get the date range for the week
    const dates: string[] = [];
    if (schedules.length > 0) {
      const firstDate = new Date(schedules[0].date);
      const dayOfWeek = firstDate.getUTCDay();
      const sunday = new Date(firstDate);
      sunday.setUTCDate(firstDate.getUTCDate() - dayOfWeek);
      for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setUTCDate(sunday.getUTCDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    }

    // Compute Labor Cost Theory per day
    // Compute Labor Cost Theory per day
    const dailyLaborTheoryCost: Record<string, number> = {};
    const dailyLaborTheoryCostBreakdown: Record<string, any[]> = {};
    dates.forEach(d => {
        dailyLaborTheoryCost[d] = 0;
        dailyLaborTheoryCostBreakdown[d] = [];
    });

    schedules.forEach((s: any) => {
        const statusStr = (s.status || "").trim().toLowerCase();
        if (statusStr === "off") return; // Skip off days

        const typeStr = (s.type || "").trim().toLowerCase();
        const theoryHrs = theoryHrsMap.get(typeStr) || 0;
        
        if (theoryHrs > 0) {
            const emp = employeeMap.get(s.transporterId);
            const rate = emp?.rate ? Number(emp.rate) : 0;
            if (rate > 0 && s.date) {
                const dateStr = s.date instanceof Date ? s.date.toISOString().split("T")[0] : new Date(s.date).toISOString().split("T")[0];
                if (dailyLaborTheoryCost[dateStr] !== undefined) {
                    const regHrs = Math.min(theoryHrs, 8);
                    const otHrs = Math.max(0, theoryHrs - 8);
                    const regCost = regHrs * rate;
                    const otCost = otHrs * (rate * 1.5);
                    const cost = Math.round((regCost + otCost) * 100) / 100;
                    
                    dailyLaborTheoryCost[dateStr] += cost;
                    dailyLaborTheoryCostBreakdown[dateStr].push({
                        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
                        type: s.type || "",
                        rate,
                        theoryHrs,
                        cost
                    });
                }
            }
        }
    });

    // Compute previous week trailing consecutive "Scheduled" days
    const prevWeekTrailing: Record<string, number> = {};
    if (prevSchedules.length > 0) {
      const prevGrouped: Record<string, Record<number, string>> = {};
      prevSchedules.forEach((s: any) => {
        if (!prevGrouped[s.transporterId]) prevGrouped[s.transporterId] = {};
        const dayIndex = new Date(s.date).getUTCDay();
        prevGrouped[s.transporterId][dayIndex] = (s.status || "").trim().toLowerCase();
      });

      for (const tid of transporterIds as string[]) {
        const days = prevGrouped[tid];
        if (!days) continue;
        let count = 0;
        for (let d = 6; d >= 0; d--) {
          const status = days[d] || "";
          if (status !== "scheduled") break;
          count++;
        }
        if (count > 0) prevWeekTrailing[tid] = count;
      }
    }

    // Build audit counts map
    const auditCounts: Record<string, number> = {};
    auditCountsRaw.forEach((c: any) => { auditCounts[c._id] = c.count; });

    // Fetch everyday records for these dates to prevent UI bouncing
    const everydayRecords: Record<string, any> = {};
    const dailyLaborActualCost: Record<string, number> = {};
    const dailyLaborActualCostBreakdown: Record<string, any[]> = {};
    const dailyDriverActualCost: Record<string, number> = {};
    const dailyOpsActualCost: Record<string, number> = {};
    
    // Revenue mappings
    const dailyRevenue: Record<string, number> = {};
    const dailyRevenueBreakdown: Record<string, any[]> = {};
    
    if (dates.length > 0) {
      const dateObjects = dates.map(d => new Date(d));
      const dbRecords = await SymxEveryday.find({ date: { $in: dateObjects } }).lean();
      dbRecords.forEach((r: any) => {
        if (!r.date) return;
        const dStr = r.date instanceof Date ? r.date.toISOString().split("T")[0] : new Date(r.date).toISOString().split("T")[0];
        everydayRecords[dStr] = { notes: r.notes || "", routesAssigned: r.routesAssigned || 0 };
      });
      dates.forEach(d => {
          dailyLaborActualCost[d] = 0;
          dailyLaborActualCostBreakdown[d] = [];
          dailyDriverActualCost[d] = 0;
          dailyOpsActualCost[d] = 0;
          dailyRevenue[d] = 0;
          dailyRevenueBreakdown[d] = [];
      });
      const routeRecords = await SYMXRoute.find(
        { date: { $in: dateObjects } },
        { date: 1, transporterId: 1, type: 1, wst: 1, wstDuration: 1, totalCost: 1, paycomInDay: 1, paycomOutLunch: 1, paycomInLunch: 1, paycomOutDay: 1, totalHours: 1 }
      ).lean();

      routeRecords.forEach((r: any) => {
        if (!r.date) return;
        const dStr = r.date instanceof Date ? r.date.toISOString().split("T")[0] : new Date(r.date).toISOString().split("T")[0];
        
        const parseTime = (timeStr: string) => {
            if (!timeStr) return null;
            const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s?(AM|PM))?$/i);
            if (!match) return null;
            let hrs = parseInt(match[1]);
            const mins = parseInt(match[2]);
            const ampm = match[3] ? match[3].toUpperCase() : null;
            if (ampm === "PM" && hrs < 12) hrs += 12;
            if (ampm === "AM" && hrs === 12) hrs = 0;
            return hrs * 60 + mins;
        }

        const durToHrs = (durRaw: any) => {
            if (!durRaw) return 0;
            const durStr = String(durRaw).trim();

            // Match HH:MM:SS or HH:MM
            const timeMatch = durStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1], 10);
                const minutes = parseInt(timeMatch[2], 10);
                return hours + (minutes / 60);
            }
            
            // Extract decimal formats like "11.32" or "10.00h" accurately
            const floatMatch = durStr.match(/^(\d+(?:\.\d+)?)/);
            if (floatMatch) {
                const num = Number(floatMatch[1]);
                if (!isNaN(num)) return num;
            }

            return 0;
        }

        const inDayM = parseTime(r.paycomInDay || "");
        const outLunchM = parseTime(r.paycomOutLunch || "");
        const inLunchM = parseTime(r.paycomInLunch || "");
        const outDayM = parseTime(r.paycomOutDay || "");

        let dynamicTotalMs = 0;
        if (inDayM !== null && outDayM !== null) {
            if (outLunchM !== null && inLunchM !== null) {
                dynamicTotalMs = Math.max(0, (outDayM - inLunchM) + (outLunchM - inDayM));
            } else {
                dynamicTotalMs = Math.max(0, outDayM - inDayM);
            }
        }

        let totalHrsDecimal = durToHrs(r.totalHours || "");
        if (dynamicTotalMs > 0) {
            totalHrsDecimal = dynamicTotalMs / 60;
        }

        const regHrs = totalHrsDecimal > 0 ? Math.min(totalHrsDecimal, 8) : 0;
        const otHrs = totalHrsDecimal > 8 ? totalHrsDecimal - 8 : 0;

        const emp = employeeMap.get(r.transporterId);
        const rate = emp?.rate ? Number(emp.rate) : 0;
        const regPay = Math.round(rate * regHrs * 100) / 100;
        const otPay = Math.round(rate * 1.5 * otHrs * 100) / 100;
        const actualCost = Math.round((regPay + otPay) * 100) / 100;

        if (dailyLaborActualCost[dStr] !== undefined && actualCost > 0) {
            dailyLaborActualCost[dStr] += actualCost;
            
            const groupName = routeTypeGroupMap.get((r.type || "").trim().toLowerCase()) || "";
            if (groupName === "driver" || groupName === "drivers") {
                dailyDriverActualCost[dStr] += actualCost;
            } else if (groupName === "operations" || groupName === "operation" || groupName === "ops") {
                dailyOpsActualCost[dStr] += actualCost;
            }

            dailyLaborActualCostBreakdown[dStr].push({
                employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
                type: r.type || "",
                regHrs,
                otHrs,
                rate,
                cost: actualCost
            });
        }
        
        // Revenue Evaluation
        const wstVal = (r.wst || "").trim().toLowerCase();
        const wstHourlyRate = wstMap.get(wstVal) || 0;
        
        const rawTotalHours = durToHrs(r.totalHours || "");

        const generatedRevenue = Math.round((wstHourlyRate * rawTotalHours) * 100) / 100;
        
        if (generatedRevenue > 0 && dailyRevenue[dStr] !== undefined) {
             dailyRevenue[dStr] += generatedRevenue;
             dailyRevenueBreakdown[dStr].push({
                employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
                type: r.type || "",
                wst: r.wst || "—",
                hrs: rawTotalHours,
                cost: generatedRevenue
             });
        }
      });
    }

    const dailyDriverCostPct: Record<string, number> = {};
    const dailyOpsCostPct: Record<string, number> = {};
    const dailyLaborTheoryPct: Record<string, number> = {};
    const dailyLaborActualPct: Record<string, number> = {};
    const dailyLaborVarDol: Record<string, number> = {};
    const dailyLaborVarPct: Record<string, number> = {};
    
    dates.forEach(d => {
        const totalActual = dailyLaborActualCost[d] || 0;
        const totalTheory = dailyLaborTheoryCost[d] || 0;
        const rev = dailyRevenue[d] || 0;

        // Labor Var $ = Labor Cost Theory - Labor Cost Actual
        const laborVarDolRaw = totalTheory - totalActual;
        dailyLaborVarDol[d] = Math.round(laborVarDolRaw * 100) / 100;

        // Labor Var % = (Labor Var $ / Labor Cost Theory) * 100
        if (totalTheory > 0) {
            dailyLaborVarPct[d] = Math.round((laborVarDolRaw / totalTheory) * 100);
        } else {
            dailyLaborVarPct[d] = 0;
        }

        if (totalActual > 0) {
            dailyDriverCostPct[d] = Math.round(((dailyDriverActualCost[d] || 0) / totalActual) * 100);
            dailyOpsCostPct[d] = Math.round(((dailyOpsActualCost[d] || 0) / totalActual) * 100);
        } else {
            dailyDriverCostPct[d] = 0;
            dailyOpsCostPct[d] = 0;
        }

        if (rev > 0) {
            dailyLaborTheoryPct[d] = Math.round((totalTheory / rev) * 100);
            dailyLaborActualPct[d] = Math.round((totalActual / rev) * 100);
        } else {
            dailyLaborTheoryPct[d] = 0;
            dailyLaborActualPct[d] = 0;
        }
    });

    return NextResponse.json({
      yearWeek,
      dates,
      employees: Object.values(grouped),
      totalEmployees: Object.keys(grouped).length,
      prevWeekTrailing,
      auditCounts,
      everydayRecords,
      dailyRevenue,
      dailyRevenueBreakdown,
      dailyLaborActualCost,
      dailyLaborTheoryCost,
      dailyLaborTheoryCostBreakdown,
      dailyLaborActualCostBreakdown,
      dailyDriverActualCost,
      dailyOpsActualCost,
      dailyDriverCostPct,
      dailyOpsCostPct,
      dailyLaborTheoryPct,
      dailyLaborActualPct,
      dailyLaborVarDol,
      dailyLaborVarPct,
    });
  } catch (error: any) {
    console.error("Schedules API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Scheduling", "edit");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();

    // Resolve performer name once for all audit entries in this request
    const performer = await resolvePerformerName(auth.session);

    const rawBody = await req.json();
    const validation = validateBody(updateScheduleSchema, rawBody);
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;
    const { scheduleId, type, employeeId, note, startTime, status } = body;

    // Update employee global note (ScheduleNotes)
    if (employeeId && note !== undefined) {
      const { transporterId: noteTransporterId, employeeName: noteName, oldNote } = body;
      
      const updated = await SymxEmployee.findByIdAndUpdate(
        employeeId,
        { $set: { ScheduleNotes: note } },
        { new: true }
      ).lean() as any;

      if (!updated) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      // Audit log (Record globally under 'Global' yearWeek)
      if (noteTransporterId) {
        await ScheduleAuditLog.create({
          yearWeek: "Global",
          transporterId: noteTransporterId,
          employeeName: noteName || `${updated.firstName} ${updated.lastName}`,
          action: "note_updated",
          field: "ScheduleNotes",
          oldValue: oldNote || "",
          newValue: note,
          performedBy: performer.email,
          performedByName: performer.name,
        });
      }

      return NextResponse.json({ success: true, employee: updated });
    }

    // Update schedule entry type
    if (scheduleId) {
      // Fetch existing record BEFORE update (for audit old values)
      const existing = await SymxEmployeeSchedule.findById(scheduleId).lean() as any;

      const newType = (type || "").trim();
      const updateFields: Record<string, any> = { type: newType };
      if (status !== undefined) {
        updateFields.status = status;
      } else {
        let resolvedStatus = "Scheduled";
        if (newType === "") {
          resolvedStatus = "Off";
        } else {
          const typeMatch = await RouteType.findOne({ name: newType }).lean();
          if (typeMatch && (typeMatch as any).routeStatus) {
            resolvedStatus = (typeMatch as any).routeStatus;
          } else {
            const isWorking = !["off", "call out", "request off", "suspension", "stand by"].includes(newType.toLowerCase());
            resolvedStatus = isWorking ? "Scheduled" : "Off";
          }
        }
        updateFields.status = resolvedStatus;
      }
      if (startTime !== undefined) updateFields.startTime = startTime;

      const dbSession = await mongoose.startSession();
      let updated: any = null;
      try {
        await dbSession.withTransaction(async () => {
          updated = await SymxEmployeeSchedule.findByIdAndUpdate(
            scheduleId,
            { $set: updateFields },
            { new: true, session: dbSession }
          ).lean() as any;

          if (!updated) {
            throw new Error("Schedule entry not found");
          }

          // Audit log — type change
          const oldType = existing?.type || "";
          const typeChanged = oldType !== (type || "");
          if (typeChanged) {
            const dateObj = updated.date ? new Date(updated.date) : null;
            const dayName = dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "";
            const empName = body.employeeName || "";
            const startTimeAlsoChanged = startTime !== undefined && existing?.startTime !== startTime;
            await ScheduleAuditLog.create([{
              yearWeek: updated.yearWeek || "",
              transporterId: updated.transporterId,
              employeeName: empName,
              action: "type_changed",
              field: "type",
              oldValue: oldType,
              newValue: (type || "") + (startTimeAlsoChanged ? ` (${startTime})` : ""),
              date: updated.date,
              dayOfWeek: dayName,
              performedBy: performer.email,
              performedByName: performer.name,
            }], { session: dbSession });
          }

          // Audit log — startTime change (only when type did NOT also change — avoids duplicate)
          if (!typeChanged && startTime !== undefined && existing?.startTime !== startTime) {
            const dateObj = updated.date ? new Date(updated.date) : null;
            const dayName = dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "";
            await ScheduleAuditLog.create([{
              yearWeek: updated.yearWeek || "",
              transporterId: updated.transporterId,
              employeeName: body.employeeName || "",
              action: "start_time_changed",
              field: "startTime",
              oldValue: existing?.startTime || "",
              newValue: startTime,
              date: updated.date,
              dayOfWeek: dayName,
              performedBy: performer.email,
              performedByName: performer.name,
            }], { session: dbSession });
          }

          // Sync type/status to SYMXRoute (dispatching)
          if (typeChanged || status !== undefined) {
            const newTypeNorm = (updated.type || "").trim();
            const isNowWorking = newTypeNorm !== "" && updated.status !== "Off";

            if (isNowWorking) {
              await SYMXRoute.updateOne(
                { transporterId: updated.transporterId, date: updated.date },
                {
                  $set: {
                    scheduleId: scheduleId,
                    type: type || "",
                    subType: updated.subType || "",
                    weekDay: updated.weekDay || "",
                    yearWeek: updated.yearWeek || "",
                    van: updated.van || "",
                  },
                },
                { upsert: true, session: dbSession }
              );
            } else {
              await SYMXRoute.deleteOne(
                { transporterId: updated.transporterId, date: updated.date },
                { session: dbSession }
              );
            }
          }
        });
      } catch (e: any) {
        if (e.message === "Schedule entry not found") {
           return NextResponse.json({ error: "Schedule entry not found" }, { status: 404 });
        }
        throw e;
      } finally {
        await dbSession.endSession();
      }

      return NextResponse.json({ success: true, schedule: updated });
    }

    // Create new schedule entry if no scheduleId but transporterId + date provided
    const { transporterId, date, yearWeek, weekDay } = body;
    if (transporterId && date && yearWeek) {
      const newType = (type || "").trim();
      let resolvedStatus = status;
      if (!resolvedStatus) {
        if (newType === "") {
            resolvedStatus = "Off";
        } else {
            const typeMatch = await RouteType.findOne({ name: newType }).lean();
            if (typeMatch && (typeMatch as any).routeStatus) {
                resolvedStatus = (typeMatch as any).routeStatus;
            } else {
                const isWorking = !["off", "call out", "request off", "suspension", "stand by"].includes(newType.toLowerCase());
                resolvedStatus = isWorking ? "Scheduled" : "Off";
            }
        }
      }

      let created: any = null;
      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          created = await SymxEmployeeSchedule.findOneAndUpdate(
            { transporterId, date: new Date(date) },
            {
              $set: {
                type: newType,
                yearWeek,
                weekDay: weekDay || "",
                status: resolvedStatus,
                ...(startTime !== undefined ? { startTime } : {}),
              },
              $setOnInsert: {
                transporterId,
                date: new Date(date),
              },
            },
            { upsert: true, new: true, session: dbSession }
          ).lean();

          // Audit log — schedule created/updated
          const dateObj = new Date(date);
          const dayName = FULL_DAY_NAMES[dateObj.getUTCDay()] || weekDay || "";
          await ScheduleAuditLog.create([{
            yearWeek,
            transporterId,
            employeeName: body.employeeName || "",
            action: "schedule_created",
            field: "type",
            oldValue: "",
            newValue: type || "",
            date: new Date(date),
            dayOfWeek: dayName,
            performedBy: performer.email,
            performedByName: performer.name,
          }], { session: dbSession });

          // Sync to SYMXRoute — only create for working types
          if (created && (created as any)._id) {
            const newTypeNorm = (created.type || "").trim();
            const isWorking = newTypeNorm !== "" && created.status !== "Off";

            if (isWorking) {
              await SYMXRoute.updateOne(
                { transporterId, date: new Date(date) },
                {
                  $set: {
                    scheduleId: (created as any)._id,
                    type: type || "",
                    weekDay: weekDay || "",
                    yearWeek,
                  },
                },
                { upsert: true, session: dbSession }
              );
            } else {
              await SYMXRoute.deleteOne(
                { transporterId, date: new Date(date) },
                { session: dbSession }
              );
            }
          }
        });
      } finally {
        await dbSession.endSession();
      }

      return NextResponse.json({ success: true, schedule: created });
    }

    return NextResponse.json({ error: "scheduleId or transporterId+date+yearWeek is required" }, { status: 400 });
  } catch (error: any) {
    console.error("Schedule PATCH Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
