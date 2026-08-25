# Staging / Test Environment Setup

A safe place to rehearse the multi-site migration before it touches DFO2's live operation.

**Goal:** a full copy of production — same code, same data shape — that you can break, migrate, roll back, and re-clone as many times as you like.

---

## Recommended shape

| Piece | Recommendation | Why |
|---|---|---|
| **Database** | New database **in your existing Atlas cluster**, named `symx-staging` | Free (same cluster), adequate isolation for a rehearsal. Upgrade to a separate cluster only if staging load starts affecting production. |
| **Hosting** | Vercel **Preview deployments** off a `staging` branch | You already have Vercel. Preview deploys are automatic and free, and get their own env vars. |
| **Data** | Cloned from production via `clone-to-staging.mjs`, **scrubbed** | No `mongodump` needed (you don't have it installed). Scrubbing means staging isn't a second copy of real HR data to protect. |
| **Cron jobs** | **Disabled on staging** | Otherwise staging's Friday job generates routes and staging's backup job writes to your real Cloudinary. |
| **Integrations** | Point at test accounts or leave unset | Staging must never text a real driver. |

---

## Step 1 — Create the staging database

Atlas doesn't require you to "create" a database explicitly — writing to it creates it. You do need a user that can access it.

1. Atlas → **Database Access** → your existing user (or create `symx-staging-user`) → ensure it has `readWriteAnyDatabase`, or explicitly grant `readWrite` on `symx-staging`.
2. Atlas → **Network Access** → confirm your IP and Vercel's egress are allowed (you likely already have `0.0.0.0/0`).

## Step 2 — Add the staging URI to `.env`

Take your existing `MONGODB_URI` and change **only the database name** in the path:

```bash
# .env  (local only — .env is gitignored)

# existing, untouched
MONGODB_URI=mongodb+srv://USER:PASS@symxproduction.e1h4x4o.mongodb.net/symx?retryWrites=true&w=majority

# new — note the /symx-staging path
STAGING_MONGODB_URI=mongodb+srv://USER:PASS@symxproduction.e1h4x4o.mongodb.net/symx-staging?retryWrites=true&w=majority
```

> The database name **must** contain `staging`, `stage`, `test`, `dev`, `sandbox`, or `preview`. Every script refuses to write to a destination that doesn't — that check is what stops a mistyped command from overwriting production.

## Step 3 — Clone production into staging

```bash
# See what would be copied — touches nothing
node scripts/staging/clone-to-staging.mjs --dry-run

# Do it, anonymising employee PII
node scripts/staging/clone-to-staging.mjs --scrub
```

Reads from `MONGODB_URI`, writes to `STAGING_MONGODB_URI`. Production is only ever read from. It wipes each staging collection first, so re-running gives a clean mirror rather than duplicates, and verifies document counts match at the end.

**`--scrub`** anonymises emails, phone numbers, addresses, DOBs, and gas-card PINs, and sets every user's password to a known value so you can log in as anyone:

```
email:    user<last6ofid>@staging.local
password: stagingpassword
```

Because emails are anonymised there is no way to guess which account is which. List them, mapped back to name / role / site:

```bash
node scripts/staging/list-staging-logins.mjs
```

Your `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `.env` also still work — that login path is an env-var bypass in `app/api/auth/login/route.ts` that never reads the database, so scrubbing doesn't affect it.

Skip large collections you don't need:

```bash
node scripts/staging/clone-to-staging.mjs --scrub --skip=MessageLog,ScoreCard_*
```

## Step 4 — Run the app against staging

**Locally:**

```bash
# .env.local overrides .env for `npm run dev`
echo 'MONGODB_URI=<your STAGING_MONGODB_URI value>' > .env.local
npm run dev
```

**On Vercel (shared URL for others to test):**

1. Create a `staging` branch: `git checkout -b staging && git push -u origin staging`
2. Vercel → **Settings → Environment Variables**, and for the **Preview** environment set:

| Variable | Value |
|---|---|
| `MONGODB_URI` | your staging connection string |
| `CRON_SECRET` | a *different* random value than production |
| `QUO_API_KEY` | **leave unset** — prevents staging texting real drivers |
| `RESEND_API_KEY` | **leave unset** — prevents staging emailing real people |
| `SUPER_ADMIN_EMAIL` / `_PASSWORD` | staging-only values |
| `CLOUDINARY_*` | same account is fine, or a separate folder |

3. Every push to `staging` gets its own preview URL.

> **Cron on preview deploys:** Vercel only runs cron jobs on *production* deployments, so preview deploys won't fire the Friday route generation or the nightly backup. That's the behaviour you want — no action needed.

## Step 5 — Rehearse the migration

Scripts default to **staging** whenever `STAGING_MONGODB_URI` is set. Production requires two explicit flags.

```bash
# Baseline — expect failures, nothing has been seeded yet
node scripts/migrate/03-validate-phase1.mjs

# Seed org + DFO2/DXC8/DFO3
node scripts/migrate/01-seed-org-and-sites.mjs --dry-run
node scripts/migrate/01-seed-org-and-sites.mjs

# Assign every user to DFO2
node scripts/migrate/02-backfill-user-site-assignments.mjs --dry-run
node scripts/migrate/02-backfill-user-site-assignments.mjs

# Confirm
node scripts/migrate/03-validate-phase1.mjs
```

Each script prints its target before doing anything:

```
────────────────────────────────────────────────────────────────
  Script:   01-seed-org-and-sites
  Source:   STAGING_MONGODB_URI (default — pass --target=production to override)
  Host:     symxproduction.e1h4x4o.mongodb.net
  Database: symx-staging
  Assessed: ✓ non-production
────────────────────────────────────────────────────────────────
```

**Read the `Database:` line every single time.** It is the difference between a rehearsal and an incident.

### Starting over

Re-clone. It's non-destructive to production and takes a minute:

```bash
node scripts/staging/clone-to-staging.mjs --scrub
```

That is the whole rollback story for staging, and it's why rehearsing here rather than in production matters.

## Step 6 — When you're ready for production

Only after the staging rehearsal passes end to end:

```bash
node scripts/migrate/01-seed-org-and-sites.mjs \
  --target=production --i-know-this-is-production --dry-run

node scripts/migrate/01-seed-org-and-sites.mjs \
  --target=production --i-know-this-is-production

node scripts/migrate/02-backfill-user-site-assignments.mjs \
  --target=production --i-know-this-is-production

node scripts/migrate/03-validate-phase1.mjs \
  --target=production --i-know-this-is-production
```

Both flags are required by design. Typing them should feel deliberate.

**Before the production run:** confirm you have a working restore path. Atlas → Backup → verify a recent snapshot exists and that you know how to restore it. Phase 1 is additive and low-risk, but the habit needs to be in place before Phase 5, which is not.

---

## Running the test suite

```bash
npm install
npm test              # full suite
npm run test:watch    # during development
```

First run downloads a MongoDB binary (~100 MB, cached afterwards). Tests use a throwaway in-memory database and never touch Atlas — `tests/setup.ts` strips any non-local `MONGODB_URI` from the environment before a test can use it.

If your machine can't reach `fastdl.mongodb.org`:

```bash
export MONGOMS_SYSTEM_BINARY=/path/to/mongod   # use an installed mongod
export MONGOMS_VERSION=7.0.14                  # or pin a version
```

---

## Safety rules built into the scripts

| Rule | Enforced by |
|---|---|
| Migrations default to staging when it exists | `resolveTargetDb()` precedence |
| Production requires `--target=production --i-know-this-is-production` | `resolveTargetDb()` |
| Destination must look non-production to be overwritten | `clone-to-staging.mjs` |
| Source and destination can't be the same database | `clone-to-staging.mjs` |
| Interactive confirm before erasing staging | `confirm()` (skip with `--yes`) |
| Target host + database printed before any action | every script |
| Credentials never printed | `hostFromUri()` strips them |
| Tests can never reach a remote database | `tests/setup.ts` |
