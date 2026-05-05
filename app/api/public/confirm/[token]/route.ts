import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import RouteType from "@/lib/models/RouteType";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

// GET — Load confirmation data (public, no auth)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        await connectToDatabase();
        const { token } = await params;

        const confirmation = await ScheduleConfirmation.findOne({ token }).lean();
        if (!confirmation) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        // Check expiry
        if (new Date() > new Date(confirmation.expiresAt)) {
            return NextResponse.json({ error: "This confirmation link has expired" }, { status: 410 });
        }

        // Fetch schedule info for display
        let scheduleInfo: any = null;
        let weekSchedules: any[] = [];
        let schedules: any[] = [];
        let singleSchedule: any = null;

        const isWeekSchedule = confirmation.messageType === "week-schedule";

        if (isWeekSchedule && confirmation.transporterId) {

            // ── Strategy 1: Find by yearWeek (exact match + alternate formats) ──
            if (confirmation.yearWeek) {
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: confirmation.transporterId,
                    yearWeek: confirmation.yearWeek,
                }).sort({ date: 1 }).lean();
                console.log(`[Confirm] Strategy 1a (yearWeek=${confirmation.yearWeek}): found ${schedules.length} schedules`);

                // Try alternate format: "2026-W11" vs "2026-W1" (zero-pad vs no-pad)
                if (schedules.length === 0) {
                    const altWeek = confirmation.yearWeek.replace(/-W0?(\d+)$/, (_: string, n: string) =>
                        `-W${n.padStart(2, "0")}`
                    );
                    const altWeek2 = confirmation.yearWeek.replace(/-W0?(\d+)$/, (_: string, n: string) =>
                        `-W${parseInt(n)}`
                    );
                    const alts = Array.from(new Set([altWeek, altWeek2, confirmation.yearWeek]));
                    schedules = await SymxEmployeeSchedule.find({
                        transporterId: confirmation.transporterId,
                        yearWeek: { $in: alts },
                    }).sort({ date: 1 }).lean();
                    console.log(`[Confirm] Strategy 1b (yearWeek alts ${alts.join(", ")}): found ${schedules.length} schedules`);
                }
            }

            // ── Strategy 2: Derive date range from yearWeek or scheduleDate ──
            if (schedules.length === 0) {
                let baseDate: Date | null = null;

                if (confirmation.scheduleDate) {
                    baseDate = new Date(confirmation.scheduleDate);
                } else if (confirmation.yearWeek) {
                    // Derive a representative date (Sunday) from yearWeek string
                    const wm = confirmation.yearWeek.match(/(\d{4})-W?(\d{1,2})/);
                    if (wm) {
                        const yr = parseInt(wm[1]);
                        const wk = parseInt(wm[2]);
                        const jan1 = new Date(Date.UTC(yr, 0, 1));
                        const jan1Day = jan1.getUTCDay(); // 0=Sun
                        const firstSunday = new Date(jan1);
                        firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
                        const weekStart = new Date(firstSunday);
                        weekStart.setUTCDate(firstSunday.getUTCDate() + (wk - 1) * 7);
                        weekStart.setUTCHours(0, 0, 0, 0);
                        baseDate = weekStart;
                    }
                }

                if (baseDate) {
                    const dayOfWeek = baseDate.getUTCDay();
                    const sunday = new Date(baseDate);
                    sunday.setUTCDate(baseDate.getUTCDate() - dayOfWeek);
                    sunday.setUTCHours(0, 0, 0, 0);
                    const nextSunday = new Date(sunday);
                    nextSunday.setUTCDate(sunday.getUTCDate() + 7);
                    schedules = await SymxEmployeeSchedule.find({
                        transporterId: confirmation.transporterId,
                        date: { $gte: sunday, $lt: nextSunday },
                    }).sort({ date: 1 }).lean();
                    console.log(`[Confirm] Strategy 2 (date range ${sunday.toISOString()} - ${nextSunday.toISOString()}): found ${schedules.length} schedules`);
                }
            }

            // ── Strategy 3: Safe fallback → most recent 7 schedules ──
            if (schedules.length === 0) {
                schedules = await SymxEmployeeSchedule.find({
                    transporterId: confirmation.transporterId,
                }).sort({ date: -1 }).limit(7).lean();
                schedules.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                console.log(`[Confirm] Strategy 3 (latest 7): found ${schedules.length} schedules`);
            }

        } else if (confirmation.scheduleDate && confirmation.transporterId) {
            // Non-week-schedule: fetch single schedule by date
            singleSchedule = await SymxEmployeeSchedule.findOne({
                transporterId: confirmation.transporterId,
                date: new Date(confirmation.scheduleDate),
            }).lean();
        }

        // Build typeId → name map for resolving schedule types
        const allTypeIds = new Set<string>();
        if (schedules && schedules.length > 0) {
            schedules.forEach((s: any) => { if (s.typeId) allTypeIds.add(String(s.typeId)); });
        }
        if (singleSchedule && (singleSchedule as any).typeId) {
            allTypeIds.add(String((singleSchedule as any).typeId));
        }

        const routeTypes = allTypeIds.size > 0
            ? await RouteType.find({ _id: { $in: [...allTypeIds] } }, { _id: 1, name: 1 }).lean() as any[]
            : [];
        const rtMap = new Map<string, string>();
        routeTypes.forEach((rt: any) => rtMap.set(String(rt._id), rt.name || ""));

        const resolveType = (s: any) => {
            if (s?.typeId) return rtMap.get(String(s.typeId)) || (s as any).type || "OFF";
            return (s as any).type || "OFF";
        };

        if (isWeekSchedule && schedules.length > 0) {
            weekSchedules = schedules.map((s: any) => ({
                date: s.date,
                weekDay: s.weekDay || "",
                type: resolveType(s),
                startTime: s.startTime || "",
                van: s.van || "",
            }));

            scheduleInfo = {
                date: schedules[0].date,
                weekDay: schedules[0].weekDay,
                type: resolveType(schedules[0]),
                startTime: schedules[0].startTime,
                van: schedules[0].van,
            };
        } else if (singleSchedule) {
            scheduleInfo = {
                date: singleSchedule.date,
                weekDay: singleSchedule.weekDay,
                type: resolveType(singleSchedule),
                startTime: singleSchedule.startTime,
                van: singleSchedule.van,
            };
        }

        // Get message content from the shiftNotification array (single source of truth)
        let messageContent: string | null = null;
        const scheduleField = TAB_TO_SCHEDULE_FIELD[confirmation.messageType];
        const targetSched = singleSchedule || (schedules && schedules.length > 0 ? schedules[0] : null);
        if (scheduleField && targetSched) {
            const entries = (targetSched as any)[scheduleField] || [];
            const sentEntry = entries.find((e: any) => e.status === "sent");
            if (sentEntry?.content) messageContent = sentEntry.content;
        }

        // Derive current confirmation status from the schedule's messaging array (single source of truth)
        let currentStatus = confirmation.status || "pending";
        let confirmedAt = confirmation.confirmedAt;
        let changeRequestedAt = confirmation.changeRequestedAt;
        let changeRemarks = confirmation.changeRemarks;

        if (scheduleField && targetSched) {
            const entries: any[] = (targetSched as any)[scheduleField] || [];
            if (entries.length > 0) {
                const statusPriority: Record<string, number> = {
                    confirmed: 5, change_requested: 4, received: 3, delivered: 2, sent: 1, pending: 0,
                };
                let bestEntry = entries[entries.length - 1];
                let bestPriority = -1;
                for (const entry of entries) {
                    const p = statusPriority[entry.status] ?? -1;
                    if (p > bestPriority) { bestPriority = p; bestEntry = entry; }
                }
                currentStatus = bestEntry.status || currentStatus;
                if (bestEntry.status === "confirmed") confirmedAt = bestEntry.createdAt;
                if (bestEntry.status === "change_requested") {
                    changeRequestedAt = bestEntry.createdAt;
                    changeRemarks = bestEntry.changeRemarks || "";
                }
            }
        }

        return NextResponse.json({
            token: confirmation.token,
            employeeName: confirmation.employeeName,
            status: currentStatus,
            yearWeek: confirmation.yearWeek,
            messageType: confirmation.messageType,
            scheduleDate: confirmation.scheduleDate,
            confirmedAt,
            changeRequestedAt,
            changeRemarks,
            schedule: scheduleInfo,
            weekSchedules,
            messageContent,
        });
    } catch (error: any) {
        console.error("Confirm GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// Helper: update the messaging status array in the schedule document



// POST — Submit confirmation or change request (public, no auth)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        await connectToDatabase();
        const { token } = await params;
        const body = await req.json();
        const { action, remarks } = body; // action: "confirm" | "change_request"

        const confirmation = await ScheduleConfirmation.findOne({ token });
        if (!confirmation) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        if (new Date() > new Date(confirmation.expiresAt)) {
            return NextResponse.json({ error: "This confirmation link has expired" }, { status: 410 });
        }

        const isWeekSchedule = confirmation.messageType === "week-schedule";

        if (action === "confirm") {
            // Update the schedule entry status
            if (confirmation.scheduleDate && confirmation.transporterId) {
                await SymxEmployeeSchedule.updateOne(
                    {
                        transporterId: confirmation.transporterId,
                        date: new Date(confirmation.scheduleDate),
                    },
                    { $set: { status: "Confirmed" } }
                );
            }

            // Push "confirmed" into the schedule's messaging array (single source of truth)
            if (!isWeekSchedule) {
                await pushConfirmationToSchedule(
                    confirmation.transporterId,
                    confirmation.scheduleDate || "",
                    confirmation.messageType,
                    "confirmed",
                    "",
                    confirmation.yearWeek
                );
            }

            return NextResponse.json({ success: true, status: "confirmed" });

        } else if (action === "change_request") {
            // Update schedule entry
            if (confirmation.scheduleDate && confirmation.transporterId) {
                await SymxEmployeeSchedule.updateOne(
                    {
                        transporterId: confirmation.transporterId,
                        date: new Date(confirmation.scheduleDate),
                    },
                    { $set: { status: "Change Requested" } }
                );
            }

            // Push "change_requested" into the schedule's messaging array (single source of truth)
            if (!isWeekSchedule) {
                await pushConfirmationToSchedule(
                    confirmation.transporterId,
                    confirmation.scheduleDate || "",
                    confirmation.messageType,
                    "change_requested",
                    remarks || "",
                    confirmation.yearWeek
                );
            }

            return NextResponse.json({ success: true, status: "change_requested" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("Confirm POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

/**
 * Push a new confirmation entry (confirmed / change_requested) into the
 * schedule's messaging array (e.g. shiftNotification, futureShift).
 * This is a $push (new entry), NOT a mutation of the last entry.
 */
async function pushConfirmationToSchedule(
    transporterId: string,
    scheduleDate: string,
    messageType: string,
    status: string,
    changeRemarks: string,
    yearWeek?: string
) {
    const field = TAB_TO_SCHEDULE_FIELD[messageType];
    if (!field || !transporterId) return;

    try {
        let schedule;

        if (scheduleDate) {
            schedule = await SymxEmployeeSchedule.findOne({
                transporterId,
                date: new Date(scheduleDate),
            });
        }

        if (!schedule && yearWeek) {
            schedule = await SymxEmployeeSchedule.findOne({
                transporterId,
                yearWeek,
            });
        }

        if (!schedule) return;

        await SymxEmployeeSchedule.updateOne(
            { _id: schedule._id },
            {
                $push: {
                    [field]: {
                        status,
                        createdAt: new Date(),
                        createdBy: "employee",
                        changeRemarks: changeRemarks || undefined,
                    },
                },
            }
        );
    } catch (err: any) {
        console.error("Failed to push confirmation to schedule:", err.message);
    }
}

