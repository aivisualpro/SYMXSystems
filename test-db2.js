const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://adeel_db_user:MX3ZW3LRoVYHob1g@symxproduction.e1h4x4o.mongodb.net/SYMXProduction");
const SYMXRoutesInfo = mongoose.model("SYMXRoutesInfo", new mongoose.Schema({}, { strict: false }), "SYMXRoutesInfo");
async function run() {
  const docs = await SYMXRoutesInfo.find({ date: new Date("2026-04-23") }).limit(3).lean();
  console.log("Count:", docs.length);
  for (let i = 0; i < docs.length; i++) {
    console.log(`Doc ${i} wstDuration:`, docs[i].wstDuration);
    console.log(`Doc ${i} rawSummary keys:`, docs[i].rawSummary ? Object.keys(docs[i].rawSummary) : "no rawSummary");
    if (docs[i].rawSummary) {
      if (typeof docs[i].rawSummary === "string") {
        console.log(`Doc ${i} rawSummary is STRING. length:`, docs[i].rawSummary.length);
        console.log(`Doc ${i} blockDuration match:`, docs[i].rawSummary.match(/blockDuration/g));
        try {
            const p = JSON.parse(docs[i].rawSummary);
            console.log("Parsed keys:", Object.keys(p));
            console.log("Parsed blockDuration:", p.blockDurationInMinutes);
        } catch (e) {}
      } else {
        console.log(`Doc ${i} rawSummary blockDuration:`, docs[i].rawSummary.blockDurationInMinutes);
        const j = JSON.stringify(docs[i].rawSummary);
        console.log(`Doc ${i} JSON blockDuration match:`, j.match(/blockDuration/g));
        // try to find blockDuration recursively
        function findKey(obj, key) {
           if (!obj || typeof obj !== 'object') return;
           if (key in obj) return obj[key];
           for (const k in obj) {
             const res = findKey(obj[k], key);
             if (res !== undefined) return res;
           }
        }
        console.log(`Doc ${i} deep search blockDuration:`, findKey(docs[i].rawSummary, "blockDurationInMinutes"));
      }
    }
  }
  process.exit(0);
}
run();
