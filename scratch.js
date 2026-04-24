const mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://admin:Ld4j1LndlY30T4iP@cluster0.b73x01z.mongodb.net/symx?retryWrites=true&w=majority&appName=Cluster0");

const SYMXRoute = mongoose.model("SYMXRoute", new mongoose.Schema({}, { strict: false }));
const SYMXRoutesInfo = mongoose.model("SYMXRoutesInfo", new mongoose.Schema({}, { strict: false }), "SYMXRoutesInfo");

async function check() {
  const routesInfo = await SYMXRoutesInfo.find({ date: new Date("2026-04-23") }).limit(1).lean();
  console.log("RoutesInfo:", routesInfo[0]?.wstDuration, routesInfo[0]?.routeNumber);
  
  const route = await SYMXRoute.find({ routeNumber: routesInfo[0]?.routeNumber }).limit(1).lean();
  console.log("Route:", route[0]?.wstDuration, route[0]?.routeNumber);
  process.exit(0);
}
check();
