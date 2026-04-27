const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const statuses = await db.collection("SYMXEmployeeSchedules").distinct("status");
    console.log("Distinct statuses:", statuses);
    
    // Check type as well
    const types = await db.collection("SYMXEmployeeSchedules").distinct("type");
    console.log("Distinct types:", types);
    
    process.exit(0);
}
run();
