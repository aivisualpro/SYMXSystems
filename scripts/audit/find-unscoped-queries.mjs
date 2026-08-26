#!/usr/bin/env node
/**
 * Static audit: every query on a site-owned model, and whether it looks scoped.
 *
 * Complements the runtime guard rather than duplicating it. The guard reports
 * what actually executed, which is proof — but only for pages someone
 * visited, so a quiet module reads identically to a clean one. This walks
 * the source instead, so coverage does not depend on where anyone clicked.
 *
 * Neither is sufficient alone:
 *   guard   — real, but only where exercised. Catches regressions. Enforces.
 *   scanner — complete, but heuristic. Plans the work.
 *
 * Usage:
 *   node scripts/audit/find-unscoped-queries.mjs
 *   node scripts/audit/find-unscoped-queries.mjs --module=fleet
 *   node scripts/audit/find-unscoped-queries.mjs --json
 */
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const JSON_OUT = process.argv.includes("--json");
const moduleArg = process.argv.find((a) => a.startsWith("--module="));
const MODULE_FILTER = moduleArg ? moduleArg.split("=")[1] : null;

const QUERY_OPS = [
  "find", "findOne", "findById", "findOneAndUpdate", "findOneAndDelete",
  "countDocuments", "count", "distinct", "aggregate",
  "updateOne", "updateMany", "deleteOne", "deleteMany", "replaceOne",
];

// Markers that indicate the caller thought about stations.
const SCOPE_MARKERS = [
  "siteId",
  "primarySiteId",
  "currentSiteId",
  "siteFilter",
  "orgWide",
  "getRequestScope",
  "scope.",
  // Driver-facing mobile routes take the station from the employee record
  // rather than a session, since there is no station picker in the app.
  "resolveDriverScope",
  // Public token flows derive the station from the token-matched record.
  "tokenSite",
];

function walk(dir, out = [], skip = new Set(["node_modules", ".next", ".git", "dist"])) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out, skip);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// ── Which models are site-owned? ──
// Derived from the source rather than hard-coded, so a model added later is
// covered automatically instead of being silently skipped.
function siteOwnedModels() {
  const dir = path.join(ROOT, "lib/models");
  const names = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(path.join(dir, file), "utf8");
    // siteAssigned counts too. Employees and vehicles TRANSFER between
    // stations rather than being owned by one, but their queries still
    // need scoping — an unscoped employee list is every station's roster.
    // Omitting it here meant those two models were never audited at all,
    // and the report still said zero.
    if (
      /\.plugin\(\s*siteOwned/.test(src) ||
      /\.plugin\(\s*siteGuard/.test(src) ||
      /\.plugin\(\s*siteAssigned/.test(src)
    ) {
      names.add(file.replace(/\.ts$/, ""));
    }
  }
  return names;
}

/** Map local binding -> model file, for imports of site-owned models. */
function importedModels(src, owned) {
  const bindings = new Map();
  const re = /import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s*from\s+["'](?:@\/)?lib\/models\/(\w+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const [, binding, modelFile] = m;
    if (owned.has(modelFile)) bindings.set(binding, modelFile);
  }
  return bindings;
}

function moduleOf(relPath) {
  const m = relPath.match(/^app\/api\/([^/]+)/) || relPath.match(/^app\/\(protected\)\/([^/]+)/);
  return m ? m[1] : "other";
}

const owned = siteOwnedModels();
const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "lib"))];
const findings = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("lib/models/")) continue; // model definitions, not call sites
  const src = readFileSync(file, "utf8");
  const bindings = importedModels(src, owned);
  if (bindings.size === 0) continue;

  const lines = src.split("\n");
  const fileHasScope = SCOPE_MARKERS.some((k) => src.includes(k));
  for (const [binding, modelFile] of bindings) {
    const callRe = new RegExp(`\\b${binding}\\s*\\.\\s*(${QUERY_OPS.join("|")})\\s*\\(`, "g");
    let m;
    while ((m = callRe.exec(src))) {
      const lineNo = src.slice(0, m.index).split("\n").length;
      // Look at the call and a few lines after it: the filter is usually
      // inline, sometimes built just above and passed in.
      const window = lines.slice(Math.max(0, lineNo - 6), lineNo + 8).join("\n");
      const nearbyScope = SCOPE_MARKERS.some((k) => window.includes(k));

      // Two tiers, because the window heuristic is genuinely unreliable in
      // one direction: filters are often built as a `query` object dozens
      // of lines before the call that uses them. Treating that as unscoped
      // buries the real findings in false positives — writeups/route.ts
      // applies siteFilter 24 lines above its .find().
      //
      //   unscoped — the FILE contains no scoping vocabulary at all. Nothing
      //              was built elsewhere and passed in, because there is no
      //              elsewhere. High confidence.
      //   review   — the file scopes something, but not visibly near this
      //              call. Could be a shared filter object, could be a gap.
      const severity = nearbyScope ? "scoped" : fileHasScope ? "review" : "unscoped";

      findings.push({
        file: rel,
        line: lineNo,
        module: moduleOf(rel),
        model: modelFile,
        operation: m[1],
        severity,
      });
    }
  }
}

const unscoped = findings.filter((f) => f.severity === "unscoped");
const review = findings.filter((f) => f.severity === "review");
const scoped = findings.filter((f) => f.severity === "scoped");

if (JSON_OUT) {
  console.log(JSON.stringify({ total: findings.length, unscoped, review }, null, 2));
  process.exit(0);
}

const byModule = {};
for (const f of unscoped) {
  if (MODULE_FILTER && f.module !== MODULE_FILTER) continue;
  (byModule[f.module] ||= []).push(f);
}

console.log(`Site-owned models: ${owned.size}`);
console.log(`Query call sites: ${findings.length}`);
console.log(`  scoped nearby:  ${scoped.length}`);
console.log(`  needs review:   ${review.length}   (file scopes something, not visibly here)`);
console.log(`  UNSCOPED:       ${unscoped.length}   (no scoping anywhere in the file)\n`);

const modules = Object.keys(byModule).sort((a, b) => byModule[b].length - byModule[a].length);
for (const mod of modules) {
  const items = byModule[mod];
  console.log(`── ${mod}  (${items.length}) ${"─".repeat(Math.max(0, 50 - mod.length))}`);
  const byFile = {};
  for (const f of items) (byFile[f.file] ||= []).push(f);
  for (const [file, fs_] of Object.entries(byFile).sort()) {
    console.log(`  ${file}`);
    for (const f of fs_.sort((a, b) => a.line - b.line)) {
      console.log(`      :${String(f.line).padEnd(5)} ${f.model}.${f.operation}()`);
    }
  }
  console.log("");
}

console.log(
  "Heuristic: a call counts as scoped if siteId / siteFilter / orgWide / scope\n" +
  "appears near it. It can be fooled in both directions, so treat this as a\n" +
  "worklist to verify — not a verdict. The runtime guard is the proof."
);
