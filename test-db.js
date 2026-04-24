require('dotenv').config({ path: '.env.local' });
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI);
const SYMXRoutesInfo = mongoose.model("SYMXRoutesInfo", new mongoose.Schema({}, { strict: false }), "SYMXRoutesInfo");
async function run() {
  const docs = await SYMXRoutesInfo.find({ date: new Date("2026-04-23") }).lean();
  console.log("Count:", docs.length);
  if (docs.length > 0) {
    console.log("First doc wstDuration:", docs[0].wstDuration, "raw blockDuration:", docs[0].rawSummary?.blockDurationInMinutes);
    console.log("Second doc wstDuration:", docs[1].wstDuration, "raw blockDuration:", docs[1].rawSummary?.blockDurationInMinutes);
  }
  process.exit(0);
}
run();
