# SYMX Systems — Inspections Source-of-Truth Prompt Pack

Hand these prompts to your AI coding agent **one at a time, in order**.

## What this fixes (deep analysis)

Today the "is this route inspected?" signal is read off **denormalized fields on `SYMXRoute`** (`inspectionTime`, `inspectionId`). The actual record lives in `dailyInspections` (Mongoose model `DailyInspection`, indexed by `routeId`). Both write paths (`/api/mobile/inspections` POST for Flutter, `/api/fleet/inspections` POST for the Next.js web `/dispatching/closing`) write to `dailyInspections` AND then write back to `SYMXRoute`. That second write is **best-effort**: any glitch (network, crash, partial deploy) leaves a route with no `inspectionId` even though an inspection exists.

**Symptoms this causes:**
- Flutter `/app/inspections` shows a "pending" card for a route that's already been inspected.
- The web `/dispatching/closing` keeps the route in "Awaiting Inspection" forever.
- Tapping the card starts a duplicate inspection.

**Fix strategy:** treat `dailyInspections` as the source of truth. On every read of routes, look up `dailyInspections` by `routeId` and merge in the real `inspectionId`/`inspectionTime`. Dedupe the two POST paths through a shared helper. Make POST idempotent by `routeId`.

**Concrete files involved (verified in repo):**
- `lib/models/DailyInspection.ts` — has `routeId: String, indexed`
- `lib/models/SYMXRoute.ts` — has `inspectionTime: String, inspectionId: String`
- `app/api/mobile/my-routes/route.ts` — Flutter list endpoint (badge JWT)
- `app/api/mobile/inspections/route.ts` — Flutter POST (creates DailyInspection + writes back to SYMXRoute)
- `app/api/mobile/inspections/[id]/route.ts` — Flutter detail endpoint
- `app/api/fleet/inspections/route.ts` — Web POST (creates DailyInspection)
- `app/api/dispatching/routes/route.ts` — Web routes list
- `app/(protected)/dispatching/closing/page.tsx` — Web "closing" reference flow
- `app/(protected)/dispatching/closing/_components/RouteInspectionModal.tsx` — Web inspection form
- `SYMXSystemsApp/lib/features/inspections/presentation/inspections_screen.dart` — Flutter list
- `SYMXSystemsApp/lib/features/inspections/presentation/inspection_form_screen.dart` — Flutter form
- `SYMXSystemsApp/lib/features/inspections/presentation/inspection_detail_screen.dart` — Flutter detail
- `SYMXSystemsApp/lib/features/inspections/data/inspection_repository.dart` — Flutter HTTP
- `SYMXSystemsApp/lib/shared/models/route_row.dart` — Flutter row model

---

## PASS 1 — Shared inspection helper + idempotent create

```
Create a single source of truth for "create inspection for a route" used by BOTH the mobile and web POST endpoints.

1. Create `lib/inspections/createInspectionForRoute.ts` exporting:

   export type InspectionInput = {
     routeId: string;                  // SYMXRoute._id (string)
     transporterId: string;            // driver
     employeeName?: string;
     inspectedBy: string;              // badgeNumber/email of submitter
     van?: string;
     vin?: string;
     mileage: number;
     anyRepairs: "TRUE" | "FALSE" | "" | null;
     repairDescription?: string | null;
     repairCurrentStatus?: string | null;
     repairImage?: string | null;
     comments?: string | null;
     vehiclePicture1?: string | null;
     vehiclePicture2?: string | null;
     vehiclePicture3?: string | null;
     vehiclePicture4?: string | null;
     dashboardImage?: string | null;
     additionalPicture?: string | null;
     routeDate?: string | Date;        // optional, else now()
     inspectionType?: string;          // default "Route Inspection"
   };

   export type InspectionResult = {
     inspection: { _id: string; routeId: string; inspectionTime: string; routeDate: Date };
     created: boolean;   // false if we returned an existing one (idempotent)
   };

   export async function createInspectionForRoute(input: InspectionInput): Promise<InspectionResult>

2. Inside the helper:
   a. Validate `routeId` and `mileage` (required, mileage >= 0).
   b. Resolve VIN + unitNumber + vehicleId from `input.van` via `Vehicle.findOne({ vehicleName: input.van })`. Prefer the resolved VIN over input.vin.
   c. IDEMPOTENCY: `DailyInspection.findOne({ routeId: input.routeId }).sort({ timeStamp: -1 }).lean()` — if found, compute its `inspectionTime` string (formatted from `timeStamp` in America/Los_Angeles, "HH:mm"), then ensure SYMXRoute is back-filled (see step e), and return `{ inspection: existing, created: false }`. Do NOT create a duplicate.
   d. If not found, create a new DailyInspection with sensible defaults — convert "" values to null, default `inspectionType` to "Route Inspection", default `routeDate` to now if missing.
   e. After create OR after finding an existing one with a stale SYMXRoute: `SYMXRoute.findByIdAndUpdate(routeId, { $set: { inspectionTime, inspectionId } })`. Wrap in try/catch — never let a write-back failure fail the overall op; log and continue.
   f. Return `{ inspection: { _id, routeId, inspectionTime, routeDate }, created }`.

3. Refactor `app/api/mobile/inspections/route.ts` POST to call the helper. Keep the auth + JSON parsing the same; replace the inline create/write-back logic with `await createInspectionForRoute({...})`. Response stays `{ success: true, inspectionId, created, message }`.

4. Refactor `app/api/fleet/inspections/route.ts` POST to call the same helper. Keep RBAC/permission checks. Adjust the response shape only if needed by callers — preserve existing fields (`inspection: { _id, ... }`) so `RouteInspectionModal.tsx` does not break.

Done when:
- `grep -rn "DailyInspection.create" app/api/` shows only one occurrence (inside the helper, if any) OR zero (and the helper uses it).
- POSTing the same payload twice returns the same `inspectionId` with `created: false` on the second call.
- `npm run build && npm run lint` pass.
```

---

## PASS 2 — Enrich `/api/mobile/my-routes` from `dailyInspections`

```
Make the Flutter list endpoint authoritative even when SYMXRoute's `inspectionId` field is missing/stale.

1. Edit `app/api/mobile/my-routes/route.ts`:
   a. After fetching `routes` from `SYMXRoute.find(...)`, collect `routeIds = routes.map(r => String(r._id))`.
   b. Query `DailyInspection.find({ routeId: { $in: routeIds } }, { _id:1, routeId:1, timeStamp:1, mileage:1 }).sort({ timeStamp: -1 }).lean()`.
   c. Build `inspByRouteId = new Map<string, { _id, timeStamp, mileage }>()`. Because the query is sorted desc, the first encounter per routeId wins (most recent).
   d. In the route enrichment map step, override:
        const insp = inspByRouteId.get(String(r._id));
        const inspectionId = insp ? String(insp._id) : (r.inspectionId || "");
        const inspectionTime = insp
          ? new Date(insp.timeStamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", timeZone: businessTZ })
          : (r.inspectionTime || "");
      Use these in the JSON response (replace the existing two lines).
   e. (Optional, recommended) When `insp` exists but `r.inspectionId !== inspectionId`, fire-and-forget `SYMXRoute.updateOne({ _id: r._id }, { $set: { inspectionId, inspectionTime } })`. Do NOT await this — it should not block the response.

2. Add a new GET handler: `GET /api/mobile/inspections?routeId=...` returns `{ inspection: <doc> | null }` for the latest DailyInspection with that routeId. Reuse the badge-token auth. This gives the Flutter detail screen a way to fetch by routeId without first knowing the inspection's _id.

Done when:
- Calling `/api/mobile/my-routes?yearWeek=2026-W20&date=2026-05-12` shows non-empty `inspectionId` for every route that has a `dailyInspections` record, regardless of whether `SYMXRoute.inspectionId` is set in DB.
- `curl '/api/mobile/inspections?routeId=<known-id>'` returns the existing inspection.
- `npm run build && npm run lint` pass.
```

---

## PASS 3 — Flutter `/app/inspections` UX

```
Make the inspections screen reactive to the (now-authoritative) inspection state.

1. Edit `SYMXSystemsApp/lib/shared/models/route_row.dart`:
   - Keep the `isInspected` getter as-is (`inspectionTime.trim().isNotEmpty && inspectionId.isNotEmpty`). Confirm it will now correctly return true whenever `dailyInspections` has a record, because Pass 2 enriches the response.

2. Edit `SYMXSystemsApp/lib/features/inspections/data/inspection_repository.dart`:
   - Add: `Future<Map<String, dynamic>?> getInspectionByRouteId(String routeId)` calling `GET /api/mobile/inspections?routeId=$routeId` and returning the `inspection` map or null.

3. Edit `SYMXSystemsApp/lib/features/inspections/presentation/inspections_screen.dart`:
   - In the route card builder, branch on `row.isInspected`:
     - `true` → render the card with a green check + the inspection time. Tap navigates to `InspectionDetailScreen(inspectionId: row.inspectionId)`.
     - `false` → render the "Awaiting Inspection" card style. Tap navigates to `InspectionFormScreen(route: row)`.
   - When the form returns successfully (use `Navigator.push<bool>` and await), call `ref.invalidate(myRoutesProvider(...))` so the list refreshes. Show a Sonner-style snack — Flutter uses SnackBar; place it in the bottom-right via `behavior: SnackBarBehavior.floating, margin: EdgeInsets.only(bottom: 16, right: 16, left: <large>)` so it sits in the corner on wide screens.

4. Edit `SYMXSystemsApp/lib/features/inspections/presentation/inspection_form_screen.dart`:
   - On mount, before showing the form, call `getInspectionByRouteId(route.id)`. If it returns non-null, pop with a flag and route the user to `InspectionDetailScreen` instead — this prevents duplicate submission on stale list state.
   - On successful POST, optimistically pop with `true` so the parent can invalidate the routes provider without waiting for a refetch round-trip.

5. Edit `SYMXSystemsApp/lib/features/inspections/presentation/inspection_detail_screen.dart`:
   - Accept either an `inspectionId` (existing behavior) OR a `routeId` (new) — if only `routeId` is provided, fetch via `getInspectionByRouteId`.

Done when:
- Driver logs in with `badgeNumber`, sees `/app/inspections`. For each date, routes already in `dailyInspections` show as "Inspected" with a tap-to-view. Routes with no record show "Tap to Inspect".
- Tapping inspect, filling, submitting: the card flips to "Inspected" within ~500ms (optimistic).
- Two devices submitting the same routeId simultaneously: only one DailyInspection ends up in DB (Pass 1 idempotency).
- Flutter web build: `flutter build web --release --base-href /app/ --pwa-strategy=none` succeeds.
```

---

## PASS 4 — Web `/dispatching/closing` mirror

```
Apply the same source-of-truth fix to the Next.js side so the two surfaces never disagree.

1. Edit `app/api/dispatching/routes/route.ts` GET (the endpoint that powers `useDispatching().rawRouteData`):
   - After loading routes for the requested week/date, do the same `DailyInspection.find({ routeId: { $in: routeIds } })` + map merge as Pass 2.
   - Override `inspectionId`/`inspectionTime` on each route record in the response from the DailyInspection when present.
   - Fire-and-forget back-fill of stale SYMXRoute fields (same pattern as Pass 2).

2. Edit `app/(protected)/dispatching/closing/_components/RouteInspectionModal.tsx`:
   - `handleSave` currently does two awaits (POST inspection, then PUT route). Now that Pass 1's helper updates SYMXRoute inside the POST, REMOVE the second `fetch("/api/dispatching/routes", { method: "PUT" })` call. The response from POST already includes `inspection._id` and the helper handled the route write-back.
   - Use the existing `notify.silentSuccess`/`notify.error` from the previous prompt pack (Pass 1 of `AGENT_PROMPTS_PERFORMANCE_PASS.md`) — if that wrapper doesn't exist yet, keep `toast` calls.
   - In `onSaved` callback, invalidate the relevant TanStack Query keys via the parent. The parent should call `queryClient.invalidateQueries({ queryKey: qk.dispatching.routes(yearWeek) })`.

3. Edit `app/(protected)/dispatching/closing/page.tsx`:
   - Confirm `pendingRows`/`doneRows` derive from `r.inspectionTime && r.inspectionId` — they do today. No change needed once Pass 4.1 makes those fields trustworthy.
   - Pre-fetch existing inspection on row hover (optional polish): `onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['inspection', row.inspectionId], queryFn: () => fetch(...).then(r => r.json()) })}` so the detail page opens instantly.

Done when:
- A route inspected from the Flutter app appears in the web "Inspected Routes" tab within 30s (next refetch) without any manual SYMXRoute fix.
- The web modal no longer makes a second PUT request — only a single POST to `/api/fleet/inspections`.
- `npm run build && npm run lint` pass.
```

---

## PASS 5 — Indexes, monitoring, verification

```
Production-readiness.

1. Edit `lib/models/DailyInspection.ts`:
   - Confirm `routeId` is indexed (it is).
   - Add a non-unique compound index: `{ routeId: 1, timeStamp: -1 }` to make the "latest per routeId" query fast at scale.
   - Do NOT make it unique — historic data may have legitimate multiple inspections for the same routeId (e.g. mid-route re-inspection). Idempotency is enforced at the application layer in Pass 1.

2. Add a one-shot migration script at `scripts/backfill-route-inspection-ids.mjs`:
   - For every DailyInspection with non-empty `routeId`, ensure the corresponding `SYMXRoute._id` has `inspectionId` and `inspectionTime` set (from the latest DailyInspection's timestamp). Log how many routes were backfilled.
   - Add to `package.json` scripts: `"backfill:inspections": "node scripts/backfill-route-inspection-ids.mjs"`.

3. Manual verification checklist (run after migration):
   a. Pick a routeId where `SYMXRoute.inspectionId` is empty but a `DailyInspection` exists. Hit `/api/mobile/my-routes` and confirm the response has the correct `inspectionId`.
   b. Open Flutter `/app/inspections` for the same driver — that card should appear as inspected.
   c. Open `/dispatching/closing?week=2026-W20&date=2026-05-12` — that route should be under "Inspected Routes", not pending.
   d. Submit a new inspection from Flutter for a fresh route. Confirm exactly ONE DailyInspection doc was created, the SYMXRoute got both `inspectionId` and `inspectionTime`, and the web view picks it up.
   e. Submit a duplicate (re-tap inspect on the same route) — confirm a 200/201 with `created: false` and no new doc.

4. Run: `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run backfill:inspections` (dry-run flag if you add one).

Done when:
- The index exists in MongoDB (verify via `db.dailyInspections.getIndexes()`).
- Backfill script runs to completion and reports a sane count.
- All four manual scenarios behave correctly.
- No build/lint/type errors.
```

---

## Tips for the agent

- **Don't touch the badge JWT verification logic.** It's already correct in `my-routes` and `inspections` mobile routes.
- **Don't change `RouteRow` field names** — the Flutter `fromJson` does direct mapping; renaming would cascade.
- **Don't make `DailyInspection.routeId` unique.** Use application-layer idempotency from Pass 1.
- **The Flutter app builds to `public/app/`** via `npm run flutter:build`; remember to rebuild for changes to land on `localhost:9568/app/inspections`.
- **Cache invalidation:** Riverpod uses `ref.invalidate(provider)`; TanStack Query uses `queryClient.invalidateQueries({ queryKey })`. Pass 3 and Pass 4 each need their respective call.
- Run **one pass at a time**, commit, smoke-test, then proceed.
