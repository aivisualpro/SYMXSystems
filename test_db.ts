import mongoose from "mongoose";
import connectToDatabase from "./lib/db";
import SymxEmployeeSchedule from "./lib/models/SymxEmployeeSchedule";

async function run() {
    await connectToDatabase();
    
    // Check schedules for 2026-W18
    const schedules = await SymxEmployeeSchedule.find({ yearWeek: "2026-W18" }).lean();
    console.log("Total schedules found:", schedules.length);
    
    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    
    schedules.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
        typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    });
    
    console.log("Statuses:", statusCounts);
    console.log("Types:", typeCounts);
    
    process.exit(0);
}
run();
