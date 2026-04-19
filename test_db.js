const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const routes = await db.collection("symxroutes").find({date: new Date("2026-02-08T00:00:00.000Z")}).toArray();
    console.log("Count:", routes.length);
    if(routes.length > 0) {
        let sample = routes[0];
        console.log("Found route:", JSON.stringify({
           totalHours: sample.totalHours,
           routeDuration: sample.routeDuration,
           wstDuration: sample.wstDuration,
           paycom: sample.paycomInDay
        }));
    }
    process.exit(0);
}
run();
