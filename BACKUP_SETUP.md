# MongoDB Backup Setup

Two layers of backup — both run automatically, neither overwrites previous backups.

## Layer 1 — MongoDB Atlas Cloud Backup (your primary backup)

Since you're on Atlas M10 or higher, Atlas already does this for you with **point-in-time recovery**. You just need to enable it.

1. Go to https://cloud.mongodb.com → your cluster → **Backup** tab.
2. Click **Enable Cloud Backup**.
3. Default policy is fine for most projects:
   - Hourly snapshots kept for 2 days
   - Daily snapshots kept for 7 days
   - Weekly snapshots kept for 4 weeks
   - Monthly snapshots kept for 12 months
4. (Optional) Adjust retention under **Edit Snapshot Schedule**.

That's it — Atlas now creates dated snapshots automatically. Restore any of them with one click. No script touches this.

## Layer 2 — Daily JSON export to Cloudinary (extra safety)

A Vercel cron hits `/api/cron/backup` every day at **06:00 UTC** (= **11:00 PM Pacific Daylight Time**, or 10:00 PM Pacific Standard Time during winter — Vercel Cron is UTC-only and does not adjust for DST), exports every collection as gzipped JSON, and uploads it to Cloudinary as a new dated file.

Path in Cloudinary: `mongodb-backups/2026-05-09/full-backup-1746763200000.json.gz`

Each day = new path = nothing is ever overwritten.

### Required: add `CRON_SECRET` env var

Generate a random string and add it to:

1. Your local `.env`:
   ```
   CRON_SECRET=paste-a-long-random-string-here
   ```
2. Vercel dashboard → your project → **Settings → Environment Variables** → add `CRON_SECRET` with the same value.

You can generate one with: `openssl rand -hex 32`

Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`, so the route is protected — only Vercel can trigger it.

### Deploy

Push to main / your prod branch. Vercel reads `vercel.json` and registers the cron. Confirm it under **Vercel dashboard → your project → Cron Jobs**.

## Manual backup (any time)

```bash
npm run backup
```

This runs `scripts/run-backup.mjs` against whatever `MONGODB_URI` is in your `.env` and uploads a new dated file to Cloudinary.

## Restoring a backup

The Cloudinary file is just gzipped JSON. To restore:

```bash
# 1. Download the .json.gz from Cloudinary
curl -o backup.json.gz "<paste secure_url here>"

# 2. Decompress
gunzip backup.json.gz

# 3. The file looks like:
# { "metadata": {...}, "collections": { "users": [...], "schedules": [...], ... } }
```

For a real restore, prefer the **Atlas snapshot** — it's faster and exact. Use the Cloudinary JSON only as a fallback if Atlas is unreachable.

## What's where

| File | Purpose |
|---|---|
| `lib/backup.ts` | Core backup logic (export + gzip + Cloudinary upload) |
| `app/api/cron/backup/route.ts` | Vercel-cron-triggered HTTP endpoint, protected by `CRON_SECRET` |
| `scripts/run-backup.mjs` | Manual `npm run backup` runner |
| `vercel.json` | Cron schedule (`0 2 * * *` daily) |

## Notes / gotchas

- **Cloudinary free tier** has a 100MB raw-file size limit. If your gzipped backup exceeds that, switch to **Vercel Blob**, **AWS S3**, or **Backblaze B2** — only the upload step in `lib/backup.ts` needs to change.
- The route uses `maxDuration = 300` (5 min). Vercel Hobby caps at 60s; if you're on Hobby, either upgrade or move to GitHub Actions.
- `system.*` collections are skipped (Atlas re-creates them).
- No automatic deletion of old backups. If you want to prune anything older than e.g. 90 days, add a separate cleanup cron — happy to add it when you ask.
