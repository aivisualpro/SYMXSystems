import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();
const db = mongo.db();

const metrics = await db.collection("dropdownoptions").find({ type: "metric" }).toArray();
console.log("=== metric dropdown options ===");
console.log(JSON.stringify(metrics, null, 2));

const count = await db.collection("SYMXCoachingWriteUps").countDocuments();
console.log("\n=== existing coaching writeup count ===", count);

const sample = await db.collection("SYMXCoachingWriteUps").find({}).limit(3).toArray();
console.log("\n=== sample records ===");
console.log(JSON.stringify(sample, null, 2));

await mongo.close();
