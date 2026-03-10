require('dotenv').config({ path: '/Users/adeeljabbar/Downloads/Code Library/SYMXSystems/.env' });
const mongoose = require("mongoose");
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection("SYMXRoutes");
  const routes = await col.find().sort({ _id: -1 }).limit(5).toArray();
  for (const r of routes) {
    console.log(r._id.toString(), r.employeeName, r.transporterId, r.yearWeek);
  }
  process.exit(0);
}
run().catch(console.error);
