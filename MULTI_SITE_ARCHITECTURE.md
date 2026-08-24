# SYMX Multi-Site Architecture Assessment

**Status:** Proposal for review — no code changes made
**Date:** 2026-08-21
**Scope:** Convert a single-site operation into an N-site (initially 3) organization

---

## 0. Decisions Locked

Three blocking questions have been answered. All three simplify the design.

| # | Question | Answer | Consequence |
|---|---|---|---|
| 1 | Is `transporterId` unique across sites? | **Yes — unique per employee, globally** | ~9 of the 16 at-risk unique indexes are **safe as-is**. `transporterId` is a reliable global employee key. Employee records are never duplicated across sites. |
| 2 | One legal entity or three? | **One legal entity** | No compliance barrier to co-mingling HR data in one database. **Option 3 confirmed** — Option 4 (DB-per-site) is now definitively ruled out. Org-wide HR reporting is legitimate. Single backup artifact is acceptable. |
| 3 | Are sites in different states? | **All California** | No per-site labor-rule configuration. The CA daily/weekly OT and meal-waiver logic in the timecard audit stays org-level. **No per-site timezone handling** — all sites are `America/Los_Angeles`, so cron scheduling stays single-run. |

### What this removes from the project

- Per-site labor-rule engine — **not needed**
- Per-site timezone handling in cron jobs and date math — **not needed**
- Legal-entity separation, per-site backup isolation, separate payroll boundaries — **not needed**
- Rewriting the scorecard import pipeline — **not needed** (see §4.4)
- Roughly half the planned unique-index migrations — **not needed**

### What this does *not* change

`transporterId` being globally unique solves *identity*, not *authorization*. Every operational record still needs `siteId` for ownership, historical attribution, and access control. A globally unique employee key makes the migration easier; it does not make scoping optional.

**One caveat that survives:** `transporterId` uniqueness says nothing about **`badgeNumber`**, which is the key the Flutter driver app authenticates on (`/api/mobile/badge-login`). Badge numbers are short and PIN-style. Whether they are unique across sites is now the top open question (§10).

---

## 1. Current-State Assessment

### 1.1 How the application is structured

| Layer | Implementation |
|---|---|
| Framework | Next.js App Router (React 19), TypeScript |
| Database | MongoDB Atlas — **one database, one cluster**, ~50 Mongoose models |
| DB access | `lib/db.ts` — single cached global connection from `MONGODB_URI` |
| Auth | Custom JWT (`jose`, HS256) in an httpOnly cookie `symx_session`, 30-day expiry |
| Session payload | `{ id, name, email, role, expires }` — **role name is baked into the token** |
| Authorization | Two parallel helpers (see 1.3) reading `SymxAppRole.permissions[]` |
| API surface | ~133 `route.ts` files under `app/api` |
| Frontend | ~14 protected page groups under `app/(protected)` |
| Mobile | Flutter driver app (`SYMXSystemsApp`), badge-number auth, bundled to `/public/app` |
| Files | Cloudinary — single account, foldered by a `module` string |
| Scheduled work | 3 Vercel Cron jobs |
| Tests | **Zero. No test runner configured.** |
| Deploy | Vercel, single project, single environment set |

### 1.2 The single-site assumption is total

**There is no site, station, organization, or tenant identifier anywhere in any of the 50 models.** This is not a case of partial multi-tenancy that needs completing — the concept does not exist. Three model files carry an explicit comment stating the assumption:

```
// Single-document collection (station-scoped app, so just one row)
```
— `WriteupSettings.ts`, `SymxHrTicketSettings.ts`, `SymxReimbursementSettings.ts`

### 1.3 Authorization is role-only, and inconsistent

Two competing helpers exist and are both in active use:

| Helper | File | Behavior when a role has no entry for a module |
|---|---|---|
| `requirePermission()` | `lib/auth/require-permission.ts` | **Denies** |
| `authorizeAction()` | `lib/rbac.ts` | **Allows** ("defaults to OPEN according to project legacy rules") |

Neither has any concept of *which site's data* the user may touch. Several routes call both. `authorizeAction`'s fail-open default is tolerable in a single-site world; in a multi-site world it is a data-leak primitive — a misconfigured role would silently grant cross-site access.

Super-admin is environment-variable based (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`, `session.id === "super-admin"`), bypassing all checks.

### 1.4 Catalogue of single-site assumptions

#### A. Records with no scoping identifier — *all 50 models*
Every operational record (routes, schedules, inspections, write-ups, incidents, HR tickets, reimbursements, scorecards, messages, notifications) is globally addressable by `_id` with no ownership dimension.

#### B. Globally-unique constraints that will collide across sites

| Model | Constraint | Collision risk |
|---|---|---|
| `SYMXRoute` | `{transporterId, date}` unique | **High** — same driver ID pattern, same date |
| `SymxEmployeeSchedule` | `{transporterId, date}` unique | **High** |
| `SYMXRoutesInfo` | `{date, rowIndex}` unique | **Certain** — row 1 exists at every site every day |
| `SymxAvailableWeek` | `week` unique | **Certain** |
| `RouteType` | `name` unique | **High** — every site has a "Standard" route type |
| `DropdownOption` | `{description, type}` unique | **High** — shared category names |
| `SYMXSetting` | `key` unique | **Certain** |
| `SymxCardConfig` | `page` unique | **Certain** |
| `MessagingTemplate` | name unique | **High** |
| `SYMXWSTOption` | `wst` unique | **High** |
| `SymxEveryday` | unique | **High** |
| `ScheduleConfirmation` | unique | **High** |
| All `ScoreCard*` models | `{week, transporterId, …}` unique | **Depends on transporterId uniqueness — open question** |
| `SymxAppRole` | `name` unique | Acceptable if roles stay org-level |
| `SymxUser` | `email` unique | Acceptable — one person, one login |
| `Vehicle` | `vin` unique | Acceptable — VIN is globally unique in reality |

**25 of 50 models are keyed on `transporterId`.** Whether Amazon transporter IDs are unique across stations is the single most important open question in this document (see §10).

#### C. Identity and authentication
- Session JWT has no site claim.
- Role name is embedded in the token — a user's effective permissions are partly stale-cached client-side.
- **Mobile badge login (`/api/mobile/badge-login`) resolves a driver by `badgeNumber` alone.** Badge numbers are short, PIN-style, and site-local. Across three sites this is an authentication collision risk, not merely a scoping one.

#### D. Unscoped queries
16 occurrences of `.find()` / `.find({})` / `.countDocuments()` with no filter in API routes, plus 14 route files using `.aggregate()` pipelines that would silently blend sites. Representative examples:

```
app/api/fleet/dashboard/route.ts:44      DailyInspection.find({})…
app/api/fleet/rentals/route.ts:21        VehicleRentalAgreement.find({})…
app/api/insurance/policies/route.ts:27   InsurancePolicy.find({})…
app/api/admin/notifications/route.ts:19  SymxNotification.find()…
app/api/messaging/templates/route.ts:29  MessagingTemplate.find({})…
```

#### E. Background jobs — all global
```json
"crons": [
  { "path": "/api/admin/live-shipments/refresh-all", "schedule": "0 4 * * *" },
  { "path": "/api/cron/backup",                      "schedule": "0 6 * * *" },
  { "path": "/api/cron/generate-next-week-routes",   "schedule": "0 7 * * 6" }
]
```
`generate-next-week-routes` calls `generateScheduleForWeek()` then `generateRoutesForWeek()` with no site parameter, and `autoAssignVans()` would pool vehicles across all sites. The backup job dumps the entire database as one artifact — no per-site restore path.

#### F. Public, unauthenticated endpoints with no site attribution
```
/api/public/hr-ticket              /api/public/reimbursement
/api/public/reimbursement-upload   /api/public/interview
/api/public/confirm/[token]        /api/public/route-types
/api/public/extension-sync
```
A ticket submitted from a public form has no way to record which site it belongs to. `/api/public/route-types` leaks the full route-type catalogue to anyone.

#### G. Files and documents
Cloudinary uploads are foldered by a `module` string only. Resulting URLs are **public, unauthenticated, and permanent** — HR documents (offer letters, drivers' licences, drug tests, termination letters, signed write-ups) are protected only by URL obscurity. This is already a weakness; across three sites with separate HR staff it becomes a compliance problem.

#### H. Notifications
`SymxNotification` has no user and no site field. Every notification is visible to everyone.

#### I. Settings singletons
`WriteupSettings`, `SymxHrTicketSettings`, `SymxReimbursementSettings`, `SYMXSetting`, `SymxCardConfig` are all "one row for the whole app". Each becomes one-row-per-site (or org-default + site-override).

#### J. Integration credentials are single-tenant
```
CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET   QUO_API_KEY / QUO_WEBHOOK_SECRET
RESEND_API_KEY                                  GOOGLE_SERVICE_ACCOUNT_KEY
COACHING_TEMPLATE_DOC_ID                        SUPER_ADMIN_EMAIL / PASSWORD
```
The OpenPhone ("Quo") messaging number, the Resend sending domain, and the Google Docs coaching template are all likely to differ per site.

#### K. Frontend
No `middleware.ts` exists — there is no central place where a request is currently intercepted, which means there is also no existing chokepoint to add site context to. Providers are `header-actions`, `network-status`, `theme` only; no session/site context provider.

#### L. Testing and deployment
Zero automated tests. Single Vercel project, single env-var set, `main` deploys straight to production. There is currently no mechanism that would catch a cross-site leak.

---

## 2. Architecture Comparison

| Criterion | 1. Separate apps + DBs | 2. Same code, 3 deployments | **3. Unified, 1 DB, row-level scoping** | 4. Unified app, DB-per-site | 5. Hybrid |
|---|---|---|---|---|---|
| **Data isolation** | Perfect (physical) | Perfect (physical) | Logical — depends on discipline; enforceable with a guard layer | Strong (physical), one app | Varies |
| **Leak risk** | ~0 | ~0 | Real but controllable; **highest-effort item** | Low | Low–medium |
| **Dev & maintenance** | Terrible — 3× divergence | Poor — config drift, 3× env sets | **Best** — one codebase, one deploy | Medium — connection routing complexity | Medium |
| **Infra cost** | 3× hosting + 3× DB | 3× hosting + 3× DB | **1×** | 1× app + 3× DB | 1–2× |
| **Consistent updates** | Manual, drifts immediately | Possible but 3 deploy pipelines | **Single deploy, atomic** | Single deploy, N migrations | Single deploy |
| **Site customization** | Unlimited (but by forking) | Env-var driven | Config rows per site — clean | Config rows per site | Clean |
| **Auth / authz** | 3 separate logins per user | 3 separate logins (or shared IdP) | **One login, one session, multi-site claims** | One login, cross-DB user store needed | One login |
| **Cross-site transfers** | Impossible without export/import; **history lost** | Same | **Native** — reassign, history preserved | Painful — cross-DB moves, no transactions | Native |
| **Consolidated reporting** | Requires a separate warehouse | Requires a warehouse | **Native** — one aggregate with explicit org scope | Requires fan-out queries + merge in app | Native or warehouse |
| **Site-specific reporting** | Native | Native | Native (filtered) | Native | Native |
| **Scale beyond 3** | Linear pain — 4th site = 4th fork | Linear cost, config sprawl | **Add a row** | New DB + migration run per site | Good |
| **Migration complexity** | Very high (3-way data split + app fork) | High | **Medium — additive, phased, reversible** | High — split data, route connections | Medium–high |
| **Testing burden** | 3× everything | 3× smoke tests | One suite + **mandatory authz/isolation tests** | One suite + N migration tests | Medium |
| **Failure isolation** | **Excellent** — one site down ≠ others | Excellent | Weakest — shared blast radius | Good — DB fault isolated | Good |
| **Security / HR privacy** | Strongest by construction | Strongest | Requires deliberate design; auditable in one place | Strong | Strong |
| **Backup / restore** | Per-site native | Per-site native | Needs per-site logical export; **point-in-time restore of one site is hard** | **Per-site native** | Varies |
| **Per-site integrations** | Native | Native (env vars) | Config rows — clean and auditable | Config rows | Clean |
| **Operational impact** | 3 on-call surfaces | 3 deploy targets | 1 surface, 1 pipeline | 1 app, 3 DBs to monitor | 2 surfaces |

### Cost sketch (order of magnitude, monthly)

| Option | Hosting | Database | Ops overhead |
|---|---|---|---|
| 1 | 3× Vercel Pro | 3× Atlas cluster | Highest — 3 codebases |
| 2 | 3× Vercel Pro | 3× Atlas cluster | High — 3 env sets |
| **3** | **1× Vercel Pro** | **1× Atlas cluster** | **Lowest** |
| 4 | 1× Vercel Pro | 3× Atlas cluster (or 3 DBs in one cluster) | Medium |
| 5 | 1–2× | 1–2× | Medium |

---

## 3. Recommended Architecture

### Recommendation: **Option 3 — one unified application, one database, strict server-enforced site scoping — with two hybrid elements.**

**Hybrid element 1 — configuration, not code:** per-site behaviour (integration credentials, messaging numbers, write-up ladders, business rules, branding) lives in `SiteSetting` / `SiteIntegration` rows, never in `if (site === 'X')` branches.

**Hybrid element 2 — an escape hatch:** the data-access layer is built so that a future site requiring physical isolation (a legal demand, an acquisition, a different jurisdiction) can be split onto its own database without an application rewrite, because every query already flows through a scope-aware repository layer.

### Why Option 3

1. **Transfers and shared resources are first-class requirements.** You explicitly need employees and vehicles to move between sites without duplicating records or losing history. In Options 1, 2, and 4 a transfer is an export/import across a database boundary — non-transactional, history-destroying, and impossible to report on cleanly. In Option 3 it is a row update plus an assignment-history record.

2. **Consolidated reporting is a stated requirement.** Options 1/2/4 require a separate data warehouse and an ETL pipeline to answer "how did all three sites perform last week." Option 3 answers it with one aggregation and an explicit org-level scope.

3. **One codebase, one deploy.** You are a small team shipping frequently — this session alone produced six commits across four feature areas. Three deployments would triple release overhead and guarantee drift within weeks.

4. **The migration is additive and reversible.** Adding `site_id` + backfilling to Site 1 keeps the existing operation running throughout. Splitting the current single database three ways (Options 1/2/4) requires a hard cutover.

5. **Adding a 4th site is inserting a row**, not provisioning infrastructure.

### Why the others are less appropriate

- **Option 1 (separate apps/DBs/deploys)** — violates your "do not create three copied versions of the code" constraint. Guarantees divergence, triples cost, makes transfers and consolidated reporting near-impossible. Only justified if the sites were legally separate entities forbidden from co-mingling data.

- **Option 2 (same code, 3 deployments)** — avoids code forking but keeps every other cost: 3× infrastructure, 3× env-var sets that drift, no cross-site transfers, no consolidated reporting, and users needing three logins. It buys physical isolation you have not asked for at a price you would pay monthly forever.

- **Option 4 (one app, DB-per-site)** — superficially attractive for isolation, but MongoDB gives no cross-database joins or transactions. Every consolidated report becomes N queries merged in application code; every cross-site transfer becomes a manual two-phase copy with no rollback. Migrations must run N times and can partially fail, leaving sites on different schema versions. This is the worst complexity-to-benefit ratio of the five.

- **Option 5 (pure hybrid)** — a hybrid of physical splits is premature. The hybrid elements worth keeping (config-driven per-site behaviour, a future physical-split escape hatch) are folded into the Option 3 recommendation above.

### The honest risk of Option 3

Logical isolation is only as good as its enforcement. A single forgotten `.find({})` leaks data across sites. **This risk is mitigated by making unscoped access structurally impossible rather than merely discouraged** — see §5. That guard layer is the highest-value work in this entire project and must land before any second site is onboarded.

---

## 4. Proposed Data Model

### 4.1 Core hierarchy

```
Organization (1)
 └── Site (N)                       ← "Site 1" seeded from today's data
      ├── UserSiteAssignment (N)    ← user ↔ site ↔ role, effective-dated
      ├── EmployeeSiteAssignment(N) ← employee ↔ site, primary/temporary, dated
      ├── VehicleSiteAssignment (N) ← vehicle ↔ site, permanent/loan, dated
      ├── SiteSetting (1 per site)  ← business rules, overrides org defaults
      ├── SiteIntegration (N)       ← per-site credentials/config
      └── [all operational records — site_id required]
```

### 4.2 New collections

```ts
Organization {
  _id, name, slug,
  timezone,                                    // 'America/Los_Angeles' — org-level (Decision #3)
  createdAt
}

Site {
  _id, organizationId, name, slug,
  code,                                        // short display code for UI/exports
  address,                                     // no `state` field needed — all CA (Decision #3)
                                               // no per-site `timezone` — inherited from org
  status: 'active' | 'inactive',
  isDefault: boolean,                          // for legacy/fallback resolution
  createdAt, updatedAt
}

UserSiteAssignment {
  _id, userId, siteId,
  roleId,                                      // role is PER SITE
  isPrimary: boolean,
  startDate, endDate,                          // null endDate = current
  grantedBy, createdAt
}

OrgRoleGrant {                                 // company-wide access, separate from sites
  _id, userId, roleId,
  scope: 'all_sites' | 'read_only_all_sites',
  startDate, endDate, grantedBy
}

EmployeeSiteAssignment {
  _id, employeeId, siteId,
  assignmentType: 'permanent' | 'temporary',
  startDate, endDate,
  reason, createdBy, createdAt
}

VehicleSiteAssignment {
  _id, vehicleId, siteId,
  assignmentType: 'permanent' | 'loan',
  startDate, endDate, reason, createdBy
}

SiteSetting {
  _id, siteId, key, value,                     // overrides OrgSetting of same key
}

SiteIntegration {
  _id, siteId, provider,                       // 'openphone' | 'resend' | 'cloudinary' | 'google'
  config: { ... },                             // non-secret config
  secretRef: string,                           // pointer to secret store, NOT the secret
  isActive
}
```

### 4.3 Classification of every existing model

#### Organization-level (no `site_id`)

| Model | Rationale |
|---|---|
| `SymxAppModule` | Feature catalogue — same everywhere |
| `SymxAppRole` | Role *definitions* are reusable templates; the *grant* is per-site via `UserSiteAssignment` |
| `SymxUser` | One person, one login; site access via assignments |
| `InsurancePolicy` | Corporate policies — add `appliesToSiteIds: []` for site-specific riders |

#### Org catalogue + optional site override (`site_id` nullable)

| Model | Rationale |
|---|---|
| `DropdownOption` | Write-up categories should stay org-standard so cross-site reporting is comparable; allow site-specific additions via nullable `site_id` |
| `RouteType` | Org catalogue with per-site enablement |
| `WriteupSettings` | **Org default + per-site override.** Keeps the discipline ladder consistent unless a site deliberately diverges |

#### Org-owned, site-assigned, transferable (add `primarySiteId` + assignment history)

| Model | Notes |
|---|---|
| `SymxEmployee` | `primarySiteId` = current home site. Full history in `EmployeeSiteAssignment`. **Never rewrite historical records on transfer.** |
| `Vehicle` | `currentSiteId` + `VehicleSiteAssignment` history. VIN stays globally unique. |
| `VehicleRentalAgreement` | Follows the vehicle; carries `siteId` for cost allocation |

#### Site-owned — **`site_id` required, immutable after creation**

Snapshotted at creation and never updated, so a transfer preserves which site owned the event when it happened.

```
Operations   SYMXRoute · SYMXRoutesInfo · SYMXRTS · SYMXRescue
Scheduling   SymxEmployeeSchedule · ScheduleConfirmation · ScheduleAuditLog
             · SymxAvailableWeek
Fleet        DailyInspection · VehicleInspection · SymxDVICVehicleInspection
             · VehicleRepair · VehicleActivityLog
HR / discipline
             SymxIncident · Writeup · VerbalCoaching · SYMXCoachingWriteUp
             · SymxEmployeeNote · SymxHrTicket · SymxReimbursement · SymxInterview
Scorecards   ScoreCardDCR · ScoreCardRTS · ScoreCardCDFNegative
             · ScoreCardQualityDSBDNR · SymxDeliveryExcellence
             · SymxPhotoOnDelivery · SymxSafetyDashboardDFO2
             · SymxScoreCardRemarks · SymxEveryday
Comms        MessageLog · SymxNotification · MessagingTemplate
Settings     SYMXSetting · SymxCardConfig · SYMXWSTOption
             · SymxHrTicketSettings · SymxReimbursementSettings
Misc         SymxPublicUploadLog
```

### 4.4 Index rewrites required *(revised — Decision #1)*

Because `transporterId` is globally unique per employee, **most of the feared collisions cannot happen.** The migration is roughly half the size originally scoped.

#### Group A — Keep global unique. No change. *(9 indexes)*

These are keyed on `transporterId` (or another globally-unique value), so they remain correct and become a useful **cross-site double-booking guard**: a driver physically cannot run a route at two sites on the same day, and the existing constraint now enforces that across the whole organization for free.

```js
SYMXRoute            { transporterId, date }                              ✅ keep
SymxEmployeeSchedule { transporterId, date }                              ✅ keep
ScoreCardDCR         { week, transporterId }                              ✅ keep
ScoreCardRTS         { week, transporterId, trackingId, plannedDeliveryDate } ✅ keep
ScoreCardQualityDSBDNR { week, transporterId }                            ✅ keep
ScoreCardCDFNegative { week, deliveryAssociate, trackingId }              ✅ keep
SymxDeliveryExcellence { week, transporterId }                            ✅ keep
SymxPhotoOnDelivery  { week, transporterId }                              ✅ keep
SymxSafetyDashboardDFO2 { week, transporterId, eventId }                  ✅ keep
SymxScoreCardRemarks { transporterId, week }                              ✅ keep
ScheduleConfirmation { token }         random 8-char token                ✅ keep
Vehicle              { vin }           globally unique in reality         ✅ keep
SymxUser             { email }         one person, one login              ✅ keep
```

> **Note:** the scorecard import pipeline needs **no structural change** — a significant scope reduction. Scorecard rows still need a `siteId` for reporting and access control, but not for uniqueness.

#### Group B — Must become compound with `siteId`. *(6 indexes)*

Every one of these is keyed on a value that repeats identically at every site.

```js
SYMXRoutesInfo   { date, rowIndex }  → { siteId, date, rowIndex }   // row 1 exists everywhere, daily
SymxEveryday     { date }            → { siteId, date }             // one day-record per site
SYMXSetting      { key }             → { siteId, key }
SymxCardConfig   { page }            → { siteId, page }
MessagingTemplate{ type }            → { siteId, type }             // 6 enum types, per site
RouteType        { name }            → { siteId, name }             // if site-scoped; see below
```

#### Group C — Resolve by classification, not by index change. *(3)*

```js
DropdownOption { description, type }  → { siteId, description, type } sparse; null siteId = org catalogue
SymxAvailableWeek { week }            → stays global — weeks are universal, org-level
SYMXWSTOption  { wst }                → stays global — org catalogue
SymxAppRole    { name }               → stays global — role definitions are org-level templates
SymxAppModule  { name }               → stays global — feature catalogue
```

#### Performance indexes — still required for every site-owned collection

Uniqueness is now largely handled, but **query performance is not**. Every site-scoped collection still needs a leading-`siteId` compound index on its hot read paths, or scoping converts full-collection scans into filtered full-collection scans:

```js
SYMXRoute            { siteId, date }
SymxEmployeeSchedule { siteId, date }
Writeup              { siteId, status, incidentDate }
VerbalCoaching       { siteId, coachingDate }
DailyInspection      { siteId, routeDate }
SymxHrTicket         { siteId, status, createdAt }
SymxIncident         { siteId, createdAt }
…and equivalents for each remaining site-owned model
```

### 4.5 Historical ownership rules

| Situation | Behaviour |
|---|---|
| Driver transfers Site A → Site B | `SymxEmployee.primarySiteId` changes; a new `EmployeeSiteAssignment` row is written; **all existing routes, write-ups, schedules, inspections keep `siteId = A`** |
| Temporary loan (driver covers a week at Site B) | `EmployeeSiteAssignment{type:'temporary', startDate, endDate}`; records created that week get `siteId = B`; permanent ownership unchanged |
| Vehicle loaned between sites | Same pattern; inspections during the loan belong to the operating site |
| Site A closes | `Site.status = 'inactive'`; records remain queryable by org admins; nothing is deleted |
| Write-up escalation lookback | Must search **across all sites the employee has worked at**, not just the current one — otherwise a transfer resets someone's disciplinary history. This is a deliberate, documented cross-site read. |

That last row is the most important business rule in the model. Discipline history must follow the person; the *record* stays owned by the site where the incident occurred.

---

## 5. Authorization Design

**Principle: unscoped data access must be structurally impossible, not merely discouraged.**

### 5.1 Scope resolution (server-side, every request)

```ts
// lib/auth/site-scope.ts
export interface SiteScope {
  userId: string;
  isOrgAdmin: boolean;
  allowedSiteIds: string[];     // from UserSiteAssignment + OrgRoleGrant — authoritative, from DB
  activeSiteIds: string[];      // requested context ∩ allowed
  mode: 'single' | 'multi' | 'org';
  roleBySite: Record<string, string>;
}

export async function getSiteScope(req): Promise<SiteScope>
```

Rules:
- `allowedSiteIds` is resolved **from the database on every request**, never trusted from the JWT. (The current design already suffers from a stale role name in the token; do not repeat that mistake with site access.)
- Requested context comes from the `X-Site-Context` header or the `symx_site_ctx` cookie, then is **intersected with** `allowedSiteIds`. A user requesting a site they don't have returns 403 — or, for record lookups, 404.
- `mode: 'org'` requires an explicit `OrgRoleGrant`. **Consolidated reporting is opt-in, never the default.**

### 5.2 Enforcement layers (defence in depth)

| Layer | Mechanism |
|---|---|
| **1. Repository guard** | A Mongoose plugin applied to every site-owned model. Adds a pre-hook on `find/findOne/count/aggregate/update/delete` that **throws unless a `siteId` filter is present** or the query is explicitly marked `.orgWide(reason)`. In dev/test it throws loudly; in production it throws and logs to the audit trail. This is the single most important control. |
| **2. Scoped query helper** | `scopedFind(Model, scope, filter)` injects `siteId: { $in: scope.activeSiteIds }`. Application code should never hand-write a `siteId` filter. |
| **3. Write path** | `siteId` is set **from the scope**, never from the request body. A client-supplied `siteId` is ignored/rejected. |
| **4. Object-level check** | Any `GET /api/x/[id]` fetches, then verifies `record.siteId ∈ scope.allowedSiteIds`; on mismatch returns **404, not 403** (avoids existence disclosure). |
| **5. Permission check** | Existing `requirePermission(module, action)` extended to `requirePermission(module, action, { siteId })` — resolves the role **for that site** from `UserSiteAssignment`. |
| **6. Route middleware** | Introduce `middleware.ts` (does not currently exist) to attach and validate site context centrally before any handler runs. |
| **7. Aggregations** | All 14 `.aggregate()` pipelines must begin with a `$match` on `siteId`. Enforced by the same plugin. |

### 5.3 Fixing the fail-open helper

`lib/rbac.ts::authorizeAction()` currently returns `authorized: true` when no role config exists. **This must be inverted to fail-closed before multi-site launch**, and the two authorization helpers should be consolidated into one. Two code paths that disagree about the default is a latent breach.

### 5.4 Per-surface enforcement

| Surface | Control |
|---|---|
| **API routes** (133) | Every route obtains `scope` and uses scoped queries. Routes are audited one module at a time. |
| **Frontend** | Site context is UI convenience only. **No frontend filter is ever load-bearing.** Server returns only permitted data. |
| **Reports / dashboards** | Take `scope` explicitly; org-wide requires `mode:'org'` + grant. Every report header displays which sites it covers. |
| **Exports (CSV/PDF)** | Same scope object; the export file embeds the site(s) in its filename and header row. |
| **Documents / files** | Upload path becomes `{orgSlug}/{siteSlug}/{module}/…`. **Raw Cloudinary URLs stop being handed to clients** — documents are served through an authenticated proxy route that checks scope, or via short-lived signed URLs. This fixes an existing weakness, not just a multi-site one. |
| **Background jobs** | Jobs iterate sites explicitly: `for (const site of await getActiveSites())`. A job may not run unscoped without an explicit `orgWide` declaration. `generate-next-week-routes` runs per site (respecting each site's timezone); `autoAssignVans` pools only that site's vehicles. |
| **Backups** | Per-site logical export in addition to the whole-DB dump, so one site can be restored without touching the others. |
| **Notifications** | `SymxNotification` gains `siteId` **and** `userId` — currently it has neither. |
| **Public endpoints** | Site comes from the link/token or an explicit validated site slug (`/apply/{siteSlug}`), never inferred. |
| **Mobile / badge auth** | Badge token must carry `siteId`; badge numbers become unique **per site**, and the login endpoint must disambiguate. |
| **Caching** | Any cache key must include the site scope. React Query keys, any server-side memoization, and CDN headers on data responses must be site-partitioned or `private`. |

### 5.5 Audit trail

Add an `AccessAuditLog` for: cross-site reads by org admins, site-context switches, permission grants/revocations, transfers, and every hard delete (which currently leaves no trace — see the recent bulk-delete work). HR-data privacy across three sites makes this non-optional.

---

## 6. Site-Selection Experience

### 6.1 Context model

```
mode: 'single'  → siteIds: [A]           most users, always
mode: 'multi'   → siteIds: [A, B]        regional managers
mode: 'org'     → siteIds: all           executives, explicit grant only
```

### 6.2 Transport

| Mechanism | Use |
|---|---|
| `symx_site_ctx` cookie | Persists the last-used context across sessions |
| `X-Site-Context` header | Sent on every API call by a shared fetch wrapper |
| `?site=` query param | Overrides both; makes deep links shareable; **server-validated** |

**Recommendation:** header + cookie as primary, with `?site=` supported for shareability. A URL path prefix (`/s/phoenix/dispatching`) is architecturally cleaner and more auditable, but would require touching all 14 page groups and 133 API routes — disproportionate given the "minimize breaking changes" constraint. Revisit if the app is ever restructured.

### 6.3 UX

- A **site switcher in the top bar**, always visible, showing the active context. Single-site users see their site name as static text (no switcher).
- Multi-site users get a dropdown: individual sites, "Selected sites…" (checkbox multi-select), and "All sites (company view)" if granted.
- **Company-wide view is visually distinct** — a coloured banner reading "Company-wide view — 3 sites" so nobody misreads consolidated numbers as one site's.
- Switching context **refetches**, it does not filter cached client data. All React Query keys include the site scope.
- Every report, export, and printed PDF states its site scope in the header.
- Guard rail: creating a record while in `multi` or `org` mode must prompt for a target site — never silently pick one.

---

## 7. Migration Plan

Expand → migrate → contract. **The existing site keeps operating throughout; every phase is independently deployable and reversible.**

### Phase 0 — Safety net *(blocking prerequisite)*
- Verified restorable backup; document and rehearse the restore.
- Stand up a **staging environment with a production data clone** — none exists today.
- Introduce a test runner and write the first isolation tests (§9).
- Fix `authorizeAction()` fail-open default.
- **Rollback:** n/a — additive only.

### Phase 1 — Introduce the hierarchy (no behaviour change)
- Create `Organization`, `Site` collections. Seed one org + one site (`isDefault: true`) representing today's operation.
- Create `UserSiteAssignment`; backfill every existing user → Site 1 with their current role.
- Ship. Nothing reads these yet.
- **Rollback:** drop the new collections.

### Phase 2 — Add `siteId` everywhere, optional, backfilled
- Add `siteId` as **optional** to all site-owned models.
- Backfill every existing document to Site 1 (batched, resumable, idempotent).
- Reads treat missing `siteId` as Site 1 (compatibility shim).
- Add new compound indexes **alongside** the old ones (`background: true`); do not drop old ones yet.
- **Validation:** every collection reports 0 documents with null `siteId`.
- **Rollback:** ignore the field; old indexes still serve.

### Phase 3 — Scope resolution in shadow mode
- Ship `getSiteScope()`, the repository guard plugin, and `middleware.ts` — but in **log-only mode**: unscoped queries are recorded, not blocked.
- Run for 1–2 weeks. The log becomes the authoritative to-do list of every unscoped access path, including ones this static analysis missed.
- **Rollback:** feature flag off.

### Phase 4 — Enforce, module by module
Order chosen by blast radius, lowest first:
1. Fleet → 2. Scorecards → 3. Scheduling → 4. Dispatching → 5. Write-ups/HR → 6. Incidents/Insurance → 7. Admin/Owner → 8. Public + Mobile endpoints
- Each module: flip the guard to throw, fix fallout, run isolation tests, ship.
- **Rollback:** per-module flag back to log-only.

### Phase 5 — Contract
- Make `siteId` required.
- Drop the old single-field unique indexes.
- Remove the "missing siteId = Site 1" shim.
- Split settings singletons into per-site rows.
- Move file storage to site-prefixed paths; migrate existing assets; switch to proxied/signed document access.
- **Rollback:** hardest point to reverse — gate behind a verified backup and a quiet operational window.

### Phase 6 — Onboard Site 2 (pilot)
- Create the site, assign users, configure `SiteSetting` / `SiteIntegration`.
- Run Site 2 in parallel for a full operational cycle (a week including a Friday route generation and a full closing cycle).
- **Explicitly verify** Site 1 users cannot see Site 2 data and vice versa.
- Only then onboard Site 3.

### Phase 7 — Cross-site features
- Transfers UI, temporary assignments, consolidated dashboards, per-site backup/restore, cross-site discipline lookback.

---

## 8. Implementation Plan

| Phase | Area | Files / artifacts |
|---|---|---|
| **0** | Test infra | `vitest.config.ts`, `playwright.config.ts`, `package.json` scripts, CI workflow, first isolation tests |
| **0** | Authz fix | `lib/rbac.ts` (fail-closed), consolidate with `lib/auth/require-permission.ts` |
| **1** | Models | `lib/models/Organization.ts`, `Site.ts`, `UserSiteAssignment.ts`, `OrgRoleGrant.ts`, `lib/models/index.ts` |
| **1** | Migration | `scripts/migrate/01-seed-org-and-site.mjs`, `02-backfill-user-site-assignments.mjs` |
| **1** | Admin UI | `app/(protected)/owner/sites/` (list, create, edit), site assignment on the user editor |
| **2** | Models | `siteId` added to ~35 site-owned models |
| **2** | Migration | `scripts/migrate/03-backfill-site-id.mjs` (batched, resumable), `04-add-compound-indexes.mjs`, `05-validate-backfill.mjs` |
| **3** | Core lib | `lib/auth/site-scope.ts`, `lib/db/site-guard-plugin.ts`, `lib/db/scoped-query.ts`, `middleware.ts` (new) |
| **3** | Observability | `lib/audit/unscoped-access-log.ts` |
| **4** | API | All ~133 `app/api/**/route.ts`, module by module |
| **4** | Jobs | `app/api/cron/generate-next-week-routes/route.ts`, `lib/schedule-generation.ts`, `lib/route-generation.ts` (per-site loop, per-site timezone), `app/api/cron/backup/route.ts`, `app/api/admin/live-shipments/refresh-all/route.ts`, `vercel.json` |
| **4** | Frontend | `components/app-sidebar.tsx`, new `components/providers/site-context-provider.tsx`, site switcher component, shared fetch wrapper, all React Query keys |
| **4** | Public/mobile | `app/api/public/**`, `app/api/mobile/**`, badge-token site claim, `SYMXSystemsApp` Flutter auth + API client |
| **5** | Files | `app/api/upload/cloudinary/route.ts`, new authenticated document-proxy route, asset migration script |
| **5** | Settings | `WriteupSettings`, `SymxHrTicketSettings`, `SymxReimbursementSettings`, `SYMXSetting`, `SymxCardConfig` → per-site rows + org defaults |
| **5** | Integrations | `SiteIntegration` model, `lib/integrations/resolve.ts`, messaging panel, Resend sender, Google Docs template |
| **7** | Cross-site | Transfer UI + API, `EmployeeSiteAssignment` / `VehicleSiteAssignment` UI, consolidated dashboard, cross-site discipline lookback in `lib/writeup-logic.ts` |

**Rough complexity:** Phases 0–3 are the foundation and are mostly mechanical once designed. Phase 4 is the bulk of the effort — 133 routes is the dominant line item. Phase 5 file/settings work is moderate. Phase 7 is net-new feature work.

---

## 9. Testing Plan

**Starting point: zero tests.** Test infrastructure is a Phase 0 deliverable, not an afterthought.

### 9.1 Unit
- `getSiteScope()` — every role/grant combination, including a user with zero assignments (must deny).
- Scope intersection: requested ⊄ allowed → denied.
- Site-guard plugin: unscoped query throws; `.orgWide()` passes.
- Index-collision cases: two sites, same `transporterId` + date → both insert successfully.
- Discipline lookback spans an employee's sites but records retain original ownership.

### 9.2 Integration (per module)
- Scoped list/create/update/delete for each of the ~14 modules.
- Write path ignores a client-supplied `siteId`.
- Aggregations return only in-scope data.

### 9.3 Authorization / isolation — **the critical suite**

For each of Site A / B / C, with a user assigned only to A:

| Attack | Expected |
|---|---|
| `GET /api/{module}?site=B` | 403 |
| `GET /api/{module}/{idFromSiteB}` | **404** (not 403) |
| `PUT/DELETE` a Site B record by id | 404 |
| `POST` with body `{ siteId: 'B' }` | Record created in A, or rejected |
| Report/export with `siteId=B` filter | 403 |
| Export while in multi-site mode without grant | 403 |
| Direct document/file URL from Site B | Denied |
| Set `X-Site-Context: B` header manually | 403 |
| Tamper `symx_site_ctx` cookie to B | 403 |
| Forge a JWT claiming site B | Rejected — access read from DB, not token |
| Mobile badge login with a Site B badge number | Resolves to correct site or is rejected |
| Public form submission | Attributed to the correct site |
| List endpoints | Return **zero** Site B/C rows — assert counts, not just absence of errors |

Plus: an org-admin can see all three; a read-only auditor can read all and write none.

### 9.4 Migration tests
- Backfill script is idempotent (run twice, same result).
- Backfill is resumable (kill mid-run, restart, completes).
- Post-backfill validation: zero null `siteId` in every site-owned collection.
- Pre/post record counts match exactly per collection.
- Compatibility shim: a record with null `siteId` still resolves during Phase 2–4.
- Rollback rehearsal on a staging clone.

### 9.5 End-to-end (Playwright)
- Single-site user: full daily flow (dispatch → closing → write-up), never sees a site switcher.
- Multi-site manager: switch A → B, confirm the dataset changes entirely; confirm no stale cached rows from A appear.
- Org admin: company view shows a labelled consolidated total equal to the sum of the three sites.
- Transfer flow: move a driver A → B; verify their A-era write-ups stay owned by A but still appear in their discipline history.
- Temporary assignment: driver covers a week at B; that week's records belong to B, permanent record still A.
- Friday cron: generates routes for all sites, correctly separated, honouring each site's timezone.

### 9.6 Continuous
- CI runs the isolation suite on every PR. **A cross-site leak fails the build.**
- A periodic production job asserts zero documents with null/invalid `siteId`.

---

## 10. Open Decisions

**Decisions 1–3 (transporterId uniqueness, single legal entity, all-California) are answered — see §0.** The remaining questions do not block starting Phases 0–1.

**Now highest impact — blocks the mobile/auth work in Phase 4:**

1. **Are `badgeNumber` values unique across sites?** `transporterId` uniqueness does not cover this. Badge numbers are short, PIN-style, and are the sole credential for the Flutter driver app. If they can collide, `/api/mobile/badge-login` needs site disambiguation before any second site goes live with the mobile app.

**High impact — affects scoping rules:**

2. **Can one employee be actively assigned to two sites in the same week**, or is assignment always exclusive at a point in time? (Note: the retained global `{transporterId, date}` unique index already enforces one route per driver per day org-wide — confirm that matches reality.)
3. **Should disciplinary history follow an employee across a transfer?** (Recommended: yes — otherwise transferring resets someone's record. Now cleanly supportable since `transporterId` is a stable global key.)
4. **Should write-up categories and the escalation ladder be org-standard or site-configurable?** (Recommended: org default with site override. Single legal entity argues for org-standard.)
5. **Do vehicles move between sites routinely, occasionally, or effectively never?**

**Medium impact — affects integrations and config:**

6. **One OpenPhone number for all sites, or one per site?** Same question for the Resend sending domain and Cloudinary account. (Currently live and broken — see the messaging fix committed separately.)
7. **How is the Amazon scorecard file attributed to a site on import?** Uniqueness is solved, but the importer still has to stamp a `siteId`. Is there one file per station, or one combined file?
8. **Should the driver mobile app be site-aware at launch, or can it lag a release?**

**Operational:**

9. **Are Sites 2 and 3 existing operations with historical data to import, or greenfield?** Importing history is a substantially larger project than starting them empty.
10. **Is there an acceptable maintenance window** for the Phase 5 contract step?
11. **Who are the org-wide admins?** Single legal entity means consolidated HR visibility is legally fine — this is now purely a policy choice.

---

## 11. Final Recommendation

**Decision:** Build a single unified application on one MongoDB database with strict, server-enforced, row-level site scoping (Option 3), using configuration rows rather than site-specific code, and a repository guard layer that makes unscoped queries throw rather than leak.

**Confirmed by Decisions 1–3.** The single-legal-entity answer removes the only argument that could have favoured Option 4. The all-California answer removes per-site rule and timezone complexity. The `transporterId` answer removes roughly half the index migration and leaves the scorecard pipeline structurally untouched.

**Major risks, in order:**

1. **Cross-site data leakage through a missed query.** Mitigated by the repository guard plugin (blocking, not advisory), shadow-mode discovery before enforcement, and a CI isolation suite that fails the build. This remains the project's defining risk and is unaffected by the three answers.
2. **No existing test coverage.** There is currently nothing that would catch a leak. Test infrastructure is a hard prerequisite, not a parallel task.
3. **The fail-open `authorizeAction()` helper.** A latent breach today, unacceptable across sites. Fix in Phase 0.
4. **`badgeNumber` collisions in mobile auth** (Open Decision #1). Now the highest-impact unknown. Blocks the mobile portion of Phase 4, not the foundation.
5. **Unprotected document URLs.** HR files are currently guarded only by URL obscurity. Still worth fixing regardless of site count.
6. **Migration scope.** ~35 models and ~133 routes. Mechanical but voluminous — the risk is fatigue-driven inconsistency, which the guard layer is designed to catch.

**Estimated complexity:** Large, but **meaningfully reduced** by the three answers. Phases 0–3 (foundation) are the highest-leverage and most design-sensitive. Phase 4 (route-by-route enforcement) remains the bulk of the hours. Phase 5+ is moderate. Still a multi-month effort at a part-time cadence, and it should not be compressed — the failure mode is silent and reputationally serious.

**First implementation milestone:**

> **Phase 0 complete + Phase 1 shipped.** Concretely: a staging environment with cloned production data; a test runner with the first cross-site isolation tests (asserting against seeded fixtures); `authorizeAction()` made fail-closed; and `Organization` / `Site` / `UserSiteAssignment` collections created, seeded with the current operation as Site 1, with every existing user assigned to it. **Zero behaviour change in production** — this milestone is provably safe and establishes the foundation everything else depends on.

**This milestone is now unblocked and ready to start on approval.** Open Decision #1 (`badgeNumber`) must be answered before the mobile portion of Phase 4, not before Phase 0.
