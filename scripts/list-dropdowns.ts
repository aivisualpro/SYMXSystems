import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

const envContent = readFileSync(resolve(__dirname, "../.env"), "utf-8");
for (const line of envContent.split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq === -1) continue;
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.DEVELOPMENT_MONGODB_URI || "");
  const docs = await mongoose.connection.db!.collection("SYMXDropdownOptions")
    .find({}, { projection: { description: 1, type: 1 } })
    .sort({ type: 1, description: 1 }).toArray();
  const types = new Map<string, string[]>();
  for (const d of docs) {
    const t = d.type as string;
    if (!types.has(t)) types.set(t, []);
    types.get(t)!.push(d.description as string);
  }
  for (const [t, descs] of types) {
    console.log("--- " + t + " ---");
    for (const d of descs) console.log("  " + d);
  }
  await mongoose.disconnect();
}
run();
