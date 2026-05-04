/**
 * Migration: Copy ScheduleConfirmation → SYMXEmployeeSchedules messaging arrays
 * Keeps original statuses (confirmed, change_requested, pending)
 *
 * Usage: node scripts/migrate-confirmations.mjs
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env
const envPath = resolve(process.cwd(), ".env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach(line => {
    const match = line.match(/^(\w+)="?([^"]*)"?$/);
    if (match) envVars[match[1]] = match[2];
});

const MONGO_URI = envVars.MONGODB_URI || envVars.MONGO_URI;
if (!MONGO_URI) { console.error("No MONGODB_URI in .env"); process.exit(1); }

const MESSAGE_TYPE_TO_FIELD = {
    "future-shift": "futureShift",
    "shift": "shiftNotification",
    "off-tomorrow": "offTodayScheduleTom",
};

async function migrate() {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
    const db = mongoose.connection.db;

    const confirmations = await db.collection("SYMXScheduleConfirmations")
        .find({ messageType: { $in: Object.keys(MESSAGE_TYPE_TO_FIELD) } })
        .toArray();

    console.log(`Found ${confirmations.length} non-week-schedule confirmations`);

    let migrated = 0, skipped = 0, notFound = 0;

    for (const conf of confirmations) {
        const field = MESSAGE_TYPE_TO_FIELD[conf.messageType];
        if (!field || !conf.transporterId || !conf.scheduleDate) { skipped++; continue; }

        const scheduleDate = new Date(conf.scheduleDate);
        if (isNaN(scheduleDate.getTime())) { skipped++; continue; }

        // Find matching schedule by transporterId + date
        const schedule = await db.collection("SYMXEmployeeSchedules").findOne({
            transporterId: conf.transporterId,
            date: scheduleDate,
        });

        if (!schedule) { notFound++; continue; }

        const existingArr = schedule[field] || [];

        // Keep ORIGINAL status (confirmed / change_requested / pending)
        // Only skip if this exact status already exists from a previous migration run
        const alreadyHas = existingArr.some(e =>
            e.status === conf.status && e.createdBy === "migration"
        );
        if (alreadyHas) { skipped++; continue; }

        // Build entry with original status
        const entry = {
            status: conf.status, // confirmed, change_requested, pending — kept as-is
            createdAt: conf.confirmedAt || conf.changeRequestedAt || conf.updatedAt || conf.createdAt,
            createdBy: "migration",
        };
        if (conf.messageLogId) entry.messageLogId = conf.messageLogId;
        if (conf.changeRemarks) entry.changeRemarks = conf.changeRemarks;

        // Push to array
        await db.collection("SYMXEmployeeSchedules").updateOne(
            { _id: schedule._id },
            { $push: { [field]: entry } }
        );
        migrated++;

        if (migrated % 50 === 0) console.log(`  ...migrated ${migrated} so far`);
    }

    console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}, Not Found: ${notFound}`);
    await mongoose.disconnect();
}

migrate().catch(e => { console.error(e); process.exit(1); });
