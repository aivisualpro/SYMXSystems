import mongoose from "mongoose";
import connectToDatabase from "./lib/db";
import SymxEmployeeSchedule from "./lib/models/SymxEmployeeSchedule";

async function run() {
    await connectToDatabase();
    const statuses = await SymxEmployeeSchedule.distinct("status");
    console.log("Distinct statuses:", statuses);
    
    // Check some records for today or tomorrow
    const today = new Date().toISOString().split("T")[0];
    console.log("Today is:", today);
    process.exit(0);
}
run();
