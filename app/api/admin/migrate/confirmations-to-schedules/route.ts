import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

/**
 * GET or POST /api/admin/migrate/confirmations-to-schedules
 *
 * Migrates confirmation data from SYMXScheduleConfirmations into
 * the corresponding SYMXEmployeeSchedules messaging arrays:
 *   - messageType "future-shift" → futureShift
 *   - messageType "shift"        → shiftNotification
 *   - messageType "off-tomorrow" → futureShift (merged)
 *
 * "week-schedule" stays in SYMXScheduleConfirmations only.
 *
 * Match key: transporterId + scheduleDate
 * Keeps original status (confirmed / change_requested / pending).
 */

const MESSAGE_TYPE_TO_FIELD: Record<string, string> = {
    "future-shift": "futureShift",
    "shift": "shiftNotification",
    "off-tomorrow": "futureShift",  // merged into futureShift
};

async function runMigration() {
    await connectToDatabase();

    // Fetch all non-week-schedule confirmations
    const confirmations = await ScheduleConfirmation.find({
        messageType: { $in: Object.keys(MESSAGE_TYPE_TO_FIELD) },
    }).lean();

    console.log(`[Migration] Found ${confirmations.length} non-week-schedule confirmations to migrate`);

    let migrated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const conf of confirmations as any[]) {
        const field = MESSAGE_TYPE_TO_FIELD[conf.messageType];
        if (!field) { skipped++; continue; }

        if (!conf.transporterId || !conf.scheduleDate) {
            skipped++;
            continue;
        }

        // Parse scheduleDate to match the schedule doc
        const scheduleDate = new Date(conf.scheduleDate);
        if (isNaN(scheduleDate.getTime())) {
            skipped++;
            continue;
        }

        // Find the matching schedule
        const schedule = await SymxEmployeeSchedule.findOne({
            transporterId: conf.transporterId,
            date: scheduleDate,
        });

        if (!schedule) {
            notFound++;
            continue;
        }

        // Keep original status: confirmed, change_requested, or pending
        const entry: any = {
            status: conf.status,
            createdAt: conf.confirmedAt || conf.changeRequestedAt || conf.updatedAt || conf.createdAt,
            createdBy: "migration",
            messageLogId: conf.messageLogId || undefined,
        };

        // Check if this status already exists to avoid duplicates
        const existingArr: any[] = (schedule as any)[field] || [];
        const alreadyExists = existingArr.some(
            (e: any) => e.status === conf.status && e.createdBy === "migration"
        );

        if (alreadyExists) {
            skipped++;
            continue;
        }

        // Push the new entry
        existingArr.push(entry);
        (schedule as any)[field] = existingArr;
        schedule.markModified(field);
        await schedule.save();
        migrated++;
    }

    console.log(`[Migration] Done. Migrated: ${migrated}, Skipped: ${skipped}, Not Found: ${notFound}`);

    return {
        success: true,
        total: confirmations.length,
        migrated,
        skipped,
        notFound,
    };
}

// Support both GET (browser URL bar) and POST
export async function GET(req: NextRequest) {
    try {
        const result = await runMigration();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Migration] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const result = await runMigration();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Migration] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
