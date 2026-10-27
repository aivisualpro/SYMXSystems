# SYMX Systems — project guide for Claude Code

SYMX Systems is the operations app for an Amazon delivery service partner (DSP) running several stations
(DFO2, DFO3, DXC8, DSF8). Owner: Rohan. Production: https://symx-systems.vercel.app (Vercel).

## Stack
- Next.js (App Router) + TypeScript, Mongoose/MongoDB, TanStack Query, shadcn/ui, Tailwind.
- `chrome-extension/` — "SYMX Route Fetch" (MV3). Captures Amazon Cortex data and posts to `/api/public/*`.
- `SYMXSystemsApp/` — Flutter driver app (Android + a web build served under `/app`).
- `scripts/otr-report/` — read-only report generator for OTR/Business Coach evidence.

## Key conventions
- **Multi-site**: every site-owned model uses the `siteOwned` plugin. Server routes scope queries with
  `getRequestScope()` + `siteFilter(scope, …)`; writes use `resolveWriteSiteId`. Cross-station queries must be
  wrapped in `orgWide(query, "reason")`. Add new pages to `lib/site-scoping-registry.ts` if they are scoped.
- **Auth**: office users = cookie session (`getSession`, `requirePermission`, `authorizeAction`). Super Admin check:
  `isSuperAdmin`. Driver app = `x-badge-token` JWT (see `app/api/mobile/*`). Extension routes use
  `x-extension-key` (`CORTEX_SYNC_KEY`). `proxy.ts` lists public path prefixes (`/api/public/`, `/api/mobile/`, …).
- **Next route files must only export handlers** (no helper exports) — put helpers in `lib/`.
- Dates: business timezone is America/Los_Angeles. Route/schedule dates are stored as UTC-midnight; compare as
  YYYY-MM-DD strings.

## Cortex capture pipeline
- `chrome-extension/content.js` hooks XHR/fetch for `/execution/api/summaries`, `route-summaries`,
  `/execution/api/itineraries/`. `background.js` runs scheduled captures at `SCHEDULE_TIMES`
  (08:45, 12:30, 15:00, 18:00, 22:00, 22:30, 23:00 PT) — keep `app/api/public/capture-watchdog` in sync.
- Server sync: `app/api/public/cortex-sync` (per itinerary), `extension-sync` (route list), `cortex-alerts` (Slack).
  Ownership model: `mergeCortexFields` (`cortexSyncedFields` / `cortexConflicts`) protects manual edits.
- **Before drivers start**, Cortex has no itinerary: the page is keyed by routeId at
  `/operations/execution/itineraries/<routeId>/documentType/RMSRoute` (same payload: all planned stops).
  Cortex's own `onRoadPickups` counter is 0 until start; sync derives it from PICK_UP tasks on stops with
  `sequenceNumber > 1`. Stop 1 = station load.
- Cortex requests are signed by the page; the extension cannot fetch them itself — it navigates in-page.
- Time fields: see `lib/cortex-time.ts`; `Pln/Act` stems are durations (H:MM), never clock times.

## Messaging / confirmations
- Tabs: shift (today), future-shift & off-tomorrow (tomorrow; stored on the SEND day's schedule row in
  `futureShift[]`), route-itinerary, training-reminder (stored on the training day), week-schedule (separate collection).
- Status must only count entries created for that row's day: `entriesInWindow` / `messageWindowForTab` in
  `lib/messaging-constants.ts`. Used by dispatching routes API, messaging employees, live-status, Roster Plan thumbs.
- Sending for a date after today shows a confirm dialog (`components/scheduling/messaging-panel.tsx`).

## Other systems added recently
- Payments module (Super Admin only): `app/(protected)/payments/**`, `lib/payments-*.ts`, `chrome-extension/payments.js`.
- Slack: per-station webhook in `Site.slackWebhookUrl`; capture watchdog at `/api/public/capture-watchdog`
  (needs `CRON_SECRET`; called every 15 min by an external pinger, cron-job.org, because Vercel Hobby limits crons).
- Schedule start times: `ScheduleStartOverride` (+ `/api/schedules/start-time`) = "apply to all of a type for a day".
- Driver app uploads photos to `/api/mobile/upload` (badge token); legacy `/api/admin/upload` also accepts it.
  Cloudinary credentials come from env vars (`CLOUDINARY_*`); old photos live in the previous account (migration pending).
- Netradyne webhook → FCM push + spoken alert: `app/api/public/netradyne-webhook`, `lib/firebase-admin.ts`,
  `SYMXSystemsApp/lib/core/notifications/push_service.dart`. Launch steps: `SYMXSystemsApp/MDM_LAUNCH.md`.

## Commands
- Dev: `npm run dev`. Build: `npm run build`. Flutter web: `SYMXSystemsApp/build_web.sh`.
- Driver app Android release: `cd SYMXSystemsApp && flutter build appbundle --release` (needs Android SDK + signing key;
  never commit `key.properties` / `.jks` / `.env`).
- Typecheck a few files quickly (full `tsc` can be slow): make a temp tsconfig with `"files": [...]` and run
  `npx tsc --noEmit -p <it>`.

## Open items
- Verify watchdog + Slack webhooks on every station; add DSF8 (inactive/not configured).
- Driver app: publish privately via managed Google Play (Play Console "Private app" with org ID), push via MDM,
  battery-optimization exemption; then add surveys, feedback, concern acknowledgement, training videos.
- Migrate old Cloudinary images to the new account (rewrite stored URLs).
- WST duration source in Cortex (Edit Route Assignments) not yet found: enable `localStorage.symx_sniff="1"`
  on that page and read `window.__symxSniff`.
- Payments line items may still parse as 0 — check the extension popup "learned:" log.
- Netradyne driver IDs have no UI yet (alerts fall back to name matching).
- OTR report: run `scripts/otr-report/fetch.mjs` then `analyze.mjs` and review `coverage.csv` / `weekly.csv`.
- "Copy last week" / "Generate week" ignore day-specific start-time overrides.

## Working style
Rohan runs the business, not the code: explain in plain language, keep UI changes consistent with existing
shadcn styling, and say plainly what was verified versus untested. Never print or commit secrets.
