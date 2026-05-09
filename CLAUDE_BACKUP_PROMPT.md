# Paste this whole message to Claude in the new project

Build me the exact same MongoDB backup system I have on my other project. Same tech stack: Next.js (app router) + MongoDB Atlas + Cloudinary + Vercel. I'm a vibe coder — keep it simple but production-quality.

## What to build

A two-layer backup system:

**Layer 1 — Atlas Cloud Backup:** I'll enable this myself in the Atlas dashboard. Just remind me in the final summary.

**Layer 2 — Daily JSON export to Cloudinary** that you build:
- A Vercel cron runs every day at **11 PM Pacific Time** (use `0 6 * * *` UTC, i.e. PDT-accurate; mention DST drift in the summary).
- It hits a Next.js API route that exports every MongoDB collection to gzipped JSON and uploads to Cloudinary as a raw resource.
- Cloudinary `public_id` format: `mongodb-backups/<YYYY-MM-DD>/full-backup-<timestamp>` — every run = new path = nothing ever overwrites.
- Tag every upload with `mongodb-backup`, `date:<YYYY-MM-DD>`, `db:<dbName>`.

Then build an **admin UI** at `/admin/settings/backups` (add it as a new tab in the existing settings layout, alongside whatever tabs already exist). The UI should:
- Show a date dropdown listing every backup (newest first)
- After date is picked → show a collection dropdown with doc counts + a name filter
- After collection is picked → render the JSON with pagination (50 docs/page), prev/next buttons, **Copy page** and **Download all** buttons
- Use the project's existing UI components (`Button`, `Input`, `Select`, `Badge` from `@/components/ui/...`) and `sonner` for toasts
- Open the raw `.json.gz` in Cloudinary via a small "Open raw" link

**Plus advanced search/filter** on top of the JSON viewer:
- A **quick search** input that does a plain substring match across all fields of every doc on the current page
- An expandable **field-level filter panel** (toggle with a `SlidersHorizontal` icon button) where the user can add multiple filters as rows. Each filter row has:
  - A field-name dropdown auto-populated from the loaded docs (extract field paths up to 2 levels deep, e.g. `name`, `address.city` — put `_id` first, rest alphabetical)
  - An operator dropdown: `Contains`, `Equals`, `Starts with`, `Ends with`, `Greater than`, `Less than`, `Exists`, `Does not exist`
  - A value input (hide it when operator is `exists`/`not_exists`)
  - A `+ Add filter` button and per-row remove `X`
- Filtering happens client-side over the currently-loaded page (multiple filters AND together; `gt`/`lt` cast to Number; `contains/equals/starts/ends` are case-insensitive). Show the filtered count vs total.
- Use lucide icons: `SlidersHorizontal`, `Filter`, `Plus`, `X` for the filter UI controls.

## Files to create / edit

1. `lib/backup.ts` — exports `runBackup()`, `listBackups()`, `fetchAndParseBackup(url)`. Use `mongoose.connection.db.listCollections()` to enumerate collections, skip `system.*`, gzip the whole `{ metadata, collections }` object, upload via `cloudinary.uploader.upload_stream` with `resource_type: 'raw'`, `overwrite: false`. Listing uses `cloudinary.search.expression('tags=mongodb-backup AND resource_type:raw')`.

2. `app/api/cron/backup/route.ts` — `runtime = 'nodejs'`, `maxDuration = 300`, protected by `Authorization: Bearer ${process.env.CRON_SECRET}`.

3. `app/api/admin/backups/route.ts` — list endpoint, dedupes to one backup per date, gated by the project's existing admin permission helper (likely `requirePermission("Admin", "view")` from `@/lib/auth/require-permission` — match whatever the project actually uses).

4. `app/api/admin/backups/inspect/route.ts` — takes `?url=` (validated to start with `https://res.cloudinary.com/` to prevent SSRF), returns metadata + per-collection doc counts (no document data).

5. `app/api/admin/backups/collection/route.ts` — takes `?url=&name=&page=&pageSize=`, returns a paginated slice of one collection's documents. Supports `?full=true` to return everything (used for the Download All button).

6. `app/(protected)/admin/settings/backups/page.tsx` — the UI described above. Client component.

7. Update the existing settings layout (probably `app/(protected)/admin/settings/layout.tsx`) — add a "Backups" tab using the lucide `Database` icon.

8. `scripts/run-backup.mjs` — manual runner that mirrors the cron logic. Loads env from `.env` directly (don't add `dotenv` as a dep, use the same lightweight regex parser the project's existing migration scripts use). Add `"backup": "node scripts/run-backup.mjs"` to `package.json`.

9. `vercel.json` — append a cron entry `{ "path": "/api/cron/backup", "schedule": "0 6 * * *" }` (preserve existing crons).

10. `BACKUP_SETUP.md` — a short setup doc explaining: enable Atlas Cloud Backup, add `CRON_SECRET` env var (generate with `openssl rand -hex 32`) to both `.env` and Vercel env vars, run `npm run backup` to test, deploy to register the cron, browse at `/admin/settings/backups`.

## Required env vars

The project should already have `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Add **`CRON_SECRET`** (any long random string) to both `.env` and Vercel.

## Conventions to match

- Use the project's existing `lib/db.ts` (`connectToDatabase` default export) — don't reinvent the connection pattern.
- Use `requirePermission` from `@/lib/auth/require-permission` (or whatever the project's actual permission helper is — grep for it first).
- Match the existing settings layout tab style — read `app/(protected)/admin/settings/layout.tsx` before editing it.
- Path alias is `@/*` → project root.
- Match the project's existing manual-script style: `.mjs`, plain Node, no ts-node/tsx.

## How you should work

1. Use `AskUserQuestion` upfront only if something's genuinely ambiguous — otherwise just build it.
2. Use `TaskCreate`/`TaskUpdate` to track the steps.
3. Run `npx tsc --noEmit -p tsconfig.json` at the end to verify zero new type errors.
4. End with a short summary: what you built, file links via `computer://` URLs, and the 3-step "what I do now" instructions (generate CRON_SECRET → add to .env + Vercel → enable Atlas Cloud Backup → push to deploy).

That's it. Build it.
