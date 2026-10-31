# DFO2 evidence and collection validation — collector 0.1.3

This is an isolated follow-up to PR #13 on `codex/cortex-evidence-quality`, targeting `feature/symx-cortex-mvp`. No merge or production deployment is included. `chrome-extension/` (the existing Route Fetch collector) is unchanged by this follow-up.

## What the source review established

The previous adapter only read `transporterTimeAttributes.plannedInboundStemTime`, dividing it by 60,000. The existing `app/api/public/cortex-sync/route.ts` instead derives a planned inbound allowance from `plannedRtsTime - lastStop.expectedStartTime`. `lib/cortex-time.ts` documents mixed epoch units and numeric millisecond durations. The collector also previously omitted `plannedRtsTime` and used the work-block end (`scheduleEndTime`) as a planned station return.

These are verified code findings, not a fresh inspection of a signed-in Amazon response. No authenticated Amazon session or raw live customer payload was available for this assignment. They explain a likely compatibility gap; they do not prove every live DFO2 route has the required inputs.

## Changed behavior

- Read `plannedRtsTime` as a station-return timestamp. Do not substitute shift/block end for RTS.
- Parse explicit inbound duration as milliseconds, H:MM, or an ISO PT duration with explicit units. Reject invalid values instead of storing NaN or treating missing values as zero. No numeric unit guessing.
- If the explicit stem is absent or invalid, derive a **planned last-stop-to-station allowance** only when a single-route response contains every reported delivery stop, distinct sequence numbers, all planned stop timestamps, and a valid planned RTS. The result must be 0–240 minutes. It can include final-stop service and is labeled accordingly. It is not live traffic or a measured travel duration. Multi-route itinerary stems are not assigned to individual routes.
- Persist only fixed timing source/status values and numeric coverage counts. No raw stops, customer addresses, tracking IDs, phone numbers, or arbitrary payload field names enter diagnostic storage.
- Accept timezone-qualified ISO and seconds/milliseconds/microseconds epochs; reject implausible numeric timestamps and actual events more than two minutes after observation. Only DELIVERED drop-off tasks supply delivery events. A stop supplies completion evidence only when every drop-off task is delivered and timestamped; packages never count as separate stops.
- New captures use intervals between at least five completed stops spanning 30 minutes. Missing delivered-task timestamps, partial stop lists, stale detail/input fields, and no recent delivery event suppress forecasts. Older captures retain the prior low-confidence calculation until recollected. All predictions remain low confidence.
- Keep event evidence together from one detail capture. A new detail missing evidence cannot resurrect older values. Inherited counters retain their source observation time. Unidentified detail events cannot supply the forecast for an identified driver. Completed routes anchor return estimates to their final recorded completion, rather than advancing the estimate on every refresh; overdue estimates request return confirmation.
- Show fresh-detail coverage, timestamp availability, explicit-stem versus planned-allowance coverage, missing forecast inputs, and detailed timestamp counts. Event age, observation age, database transfer time, and extension request round trip are distinct measures. Negative database transfer values indicate clock differences rather than zero latency.
- Show live numeric itinerary acknowledgement progress, timeouts, skipped targets, errors, and elapsed run time in extension settings. Itinerary counts are distinct from dashboard route counts; 41 itineraries can reconcile to 40 routes.
- Manual collection reports the actual launch result and rejects commands from Amazon content scripts. DFO2 is considered first when scheduling stations. Newly captured data can be acknowledged without sitting behind a recovered queue; scheduled catch-up remains bounded.
- Skip already-acknowledged detail targets, keep one navigation outstanding and at least one second between navigations, stop after three consecutive detail timeouts, and stop on Amazon 401/403/429 responses. No signed API requests, visibility spoofing, login automation, or access-control bypasses.

## Reproduce locally

Use a separate development checkout/profile and run Chrome on the same machine as the local server:

```sh
git fetch origin
git switch codex/cortex-evidence-quality
npm ci
npx playwright install chromium
npm test
npm run typecheck
NODE_OPTIONS=--max-old-space-size=6144 MONGODB_URI=mongodb://127.0.0.1:27017/cortex-build-placeholder npm run build
node scripts/cortex-dev.mjs
```

In another terminal:

```sh
node scripts/cortex-smoke.cjs
node scripts/cortex-extension-smoke.cjs
```

Run the production build before starting the dev server if both share the same `.next` directory. The database URI above is a build placeholder, never a production connection. The preview runner generates fresh local credentials in `/tmp/symx-cortex-preview.json` (0600), starts disposable MongoDB, and binds Next.js to 127.0.0.1:3000. Keep that file private; it is deleted on shutdown. Both smoke scripts also honor `CORTEX_PREVIEW_STATE`; `CORTEX_CHROMIUM_EXECUTABLE` optionally selects an already-installed test Chromium.

The dashboard smoke verifies authentication, station/search filtering, history, ingestion, retry deduplication, and desktop/mobile UI. The extension smoke uses the actual unpacked MV3 extension against **40 synthetic DFO2 routes**, checks 40/40 detail acknowledgements and navigation pacing, verifies persisted timing evidence and its route dialog, and writes screenshots. Every Amazon request is intercepted with synthetic data. These scripts do not validate real Amazon compatibility.

After the smoke scripts finish, keep the preview runner open. Visit `http://127.0.0.1:3000/login` and sign in with the generated credentials read privately from the state file. Open `/cortex?demo=1` for the labeled 15-route sample, or `/cortex` for the ingested synthetic observations. The smoke scripts seed synthetic station mappings; do not use `demo-DFO2` as a live mapping.

For manual live development collection, load `symx-cortex-extension/` or unpack `artifacts/symx-cortex-extension-0.1.3.zip`, reload only the development extension, confirm version 0.1.3, enter the local test key and verified DFO2 service-area mapping, enable collection, sign in normally, and choose **Collect DFO2 now**. The partner extension remains untouched.

## Verified results and preview

[GitHub Actions validation](https://github.com/aivisualpro/SYMXSystems/actions/runs/41155747790) passed on commit `2b84b9d0689f25df62e558b7f756c37f5cb663de`:

- **347 tests passed across 25 files**, including MongoDB-backed integration tests and the fake-clock collector cases.
- TypeScript checks and the optimized production build passed.
- The dashboard browser smoke passed authentication, filtering, driver history, normalization → ingestion → storage → display, retry deduplication, and unauthenticated-access denial, with no browser errors.
- The actual unpacked MV3 extension acknowledged **40/40 synthetic DFO2 itinerary details**, verified paced navigation and timing evidence through database readback and the route dialog, and made **43 intercepted GET requests with zero live Amazon requests**.
- The screenshots below come from the isolated disposable preview. The 15-route sample dashboard and 40-route extension fixture are different scenarios. Running both scripts leaves 41 ingested routes: one ingestion case plus the 40-route extension fixture. The extension screenshot's run duration is a synthetic test measurement, not a live Amazon performance benchmark.

| Preview | Screenshot |
| --- | --- |
| Desktop sample dashboard | [Desktop](../artifacts/cortex-desktop.png) |
| Mobile sample dashboard | [Mobile](../artifacts/cortex-mobile.png) |
| Captured observation in the dashboard | [Ingested route](../artifacts/cortex-ingested-route.png) |
| Completed extension collection | [Extension status](../artifacts/cortex-extension-status.png) |
| Route timestamp evidence and confidence | [Timing details](../artifacts/cortex-timing-evidence.png) |

The local workspace passed focused tests, typecheck, and production build, but could not start MongoDB (`open: Operation not permitted`) or download Chromium (the archive endpoint returned an HTML block page). The full database and browser results above were obtained in the GitHub runner. A persistent interactive preview is not hosted by this workflow; use the local reproduction commands above.

`.github/workflows/cortex-development.yml` reproduces the full suite, typecheck, production build, disposable preview, and both synthetic browser smoke scripts. It uses no production secrets and contains no deployment step. The development extension archive is [symx-cortex-extension-0.1.3.zip](../artifacts/symx-cortex-extension-0.1.3.zip).

## Remaining authorized DFO2 validation

1. Inspect the **normalized** route dialog for inbound field status, planned RTS presence, complete-plan status, rejected timestamps, and timestamped stop/task counts. Share only these counts/status values for diagnosis; do not export raw customer payloads.
2. Verify Amazon's reported total-stop definition against the complete delivery list. If totals include station, pickup, or other stops, the conservative complete-plan gate will suppress the derived allowance. Do not loosen it until the response contract is verified.
3. Compare planned return and explicit duration formats with the signed-in Cortex display. Confirm whether the allowance includes final-stop service or other planned activities before relying on it operationally.
4. Repeat DFO2 collection in foreground/background and after browser restart; check discovered/acknowledged itinerary counts, reconciled route count, clock alignment, latency, and partial-run status. Confirm no avoidable extra page loads or throttling.
5. Validate missing timestamps, pre-start RMSRoute details, reassignment/rescue changes, and actual return records. Compare forecasts against observed returns across multiple days before expanding to other stations.

No actual DFO2 completeness, collection-speed improvement, Amazon event-publishing latency, or RTS accuracy was measured during this assignment. Forecasting remains a dispatcher aid with explicit missing inputs.
