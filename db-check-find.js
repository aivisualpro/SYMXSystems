const { loadEnvConfig } = require('@next/env');
const mongoose = require('mongoose');

async function run() {
    loadEnvConfig(process.cwd());
    await mongoose.connect(process.env.MONGODB_URI);

    // Define schema precisely as it is
    const SYMXRouteSchema = new mongoose.Schema({
        yearWeek: String,
        date: Date,
        transporterId: String,
        type: String,
    }, { timestamps: true, collection: "SYMXRoutes" });

    const SYMXRoute = mongoose.models.SYMXRoute || mongoose.model("SYMXRoute", SYMXRouteSchema);

    const existing = await SYMXRoute.findById("69af848307c1fd3100ae49d9").lean();
    console.log("Result of findById:", existing ? 'FOUND' : 'NULL');

    process.exit(0);
}
run().catch(console.error);
