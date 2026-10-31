# SYMX Cortex Phase 2 — DFO2 driver intelligence

Development branch: `codex/cortex-driver-intelligence`, based on PR #14 commit `d67963af9fddb4532dcbabf21db40b721b18af0e`. This preserves PRs #13/#14 and targets their development work. No production merge, configuration change, deployment, Amazon write, or partner-extension change is included.

## Review the preview independently

Use Node 22 and a separate checkout. Chrome and the preview server must run on the same computer. Restart the development server after switching branches so it loads the new optional observation fields.

```sh
git fetch origin
git switch codex/cortex-driver-intelligence
npm ci
npx playwright install chromium
npm test
npm run typecheck
NODE_OPTIONS=--max-old-space-size=6144 MONGODB_URI=mongodb://127.0.0.1:27017/cortex-build-placeholder npm run build
node scripts/cortex-dev.mjs
```

Keep that terminal open. In a second terminal, run these in order:

```sh
node scripts/cortex-smoke.cjs
node scripts/cortex-extension-smoke.cjs
node scripts/cortex-intelligence-smoke.cjs
```

The runner creates a disposable loopback MongoDB database and private random credentials in `/tmp/symx-cortex-preview.json` (0600). It removes the credentials on shutdown. The smoke scripts only seed the named disposable database; all Amazon requests in the extension test are intercepted synthetic GETs. They never log into Amazon. Do not paste the state file into logs or commit it. Build before starting the dev server because both use `.next`.

After the scripts finish, open `http://127.0.0.1:3000/login`, sign in with the generated credentials read privately from that state file, then visit `/cortex?demo=1`. Select DFO2. The five DFO2 scenarios include a slowdown, a delivery gap, steady pace with a late projected return, missing initial evidence, and stale data. Other stations retain their existing views; the new driver attention pilot is DFO2 only.

Review CX101's evidence, questions, RTS scenarios and recurring history; CX102's gap and withheld forecast; route hover previews; desktop/mobile layouts; and refresh with a detail dialog open. `/cortex` shows the ingested synthetic fixtures. The extension test contributes 40 routes, plus the original single ingestion test route. No persistent hosted preview is created by CI.

Review images from the synthetic browser run:

| View | Screenshot |
| --- | --- |
| DFO2 attention and route overview | [Desktop dashboard](../artifacts/cortex-intelligence-desktop.png) |
| Pace, RTS and troubleshooting questions | [Driver detail](../artifacts/cortex-driver-detail.png) |
| Daily pace and recurring observations | [Driver history](../artifacts/cortex-driver-history.png) |
| Mobile attention queue | [Mobile review](../artifacts/cortex-intelligence-mobile.png) |

Load `symx-cortex-extension/` or unpack `artifacts/symx-cortex-extension-0.2.0.zip` for the development collector. Reload only that extension and confirm version 0.2.0. It adds numeric event extraction without adding Amazon requests or changing the existing pacing, retry, opt-in, and access-control limits. The archive ships no keys or station IDs. Synthetic `demo-DFO2` mappings are never valid substitutes for live authorized station mappings.

## Evidence and calculations

- Each fully completed delivery stop contributes one numeric completion time and its optional planned start time. All drop-off tasks must be delivered and timestamped. There are no addresses, stop IDs, package IDs, phone numbers, coordinates, or raw payloads in the event series. At most 1,000 stop events are accepted per route capture; oversized series are omitted by the adapter and driver intelligence requests recollection/usable evidence.
- Overall pace is completed-stop **intervals** divided by elapsed time between completions. Recent and earlier windows cover approximately 45 minutes each and share only their boundary stop. A usable window needs five distinct completion timestamps and at least 30 minutes. This is elapsed delivery pace, including travel/service/pauses, not productive working time or a performance rating.
- A recent drop of at least 30% creates a candidate signal. If corresponding planned start spacing explains the change (normalized pace drop less than 20%), the pace-only signal is suppressed. Planned spacing is contextual information; it is not verified travel time or a route difficulty score.
- A delivery-gap candidate requires at least 20 minutes or four times the median of up to 20 recent positive stop intervals, whichever is greater. Gaps end at the **last detail capture**, so an idle dashboard cannot manufacture an increasingly long gap. Actual delivery-task times keep partial multi-package stops from looking entirely inactive.
- Missing identities, reassignment evidence, stale observations/detail, incomplete stop lists, mismatched counts, rejected timestamps, and inadequate samples withhold driver alerts. A newly assigned driver's full-route timestamps cannot safely be attributed solely to that driver. Rescues or assignment changes never observed by the collector remain a live-validation limitation.
- A first candidate is **Watch**. A current signal becomes **Check-in** only if a matching prior capture is 5–20 minutes earlier, on the same route, with no intervening clear sample in the retained evidence. The API retains up to 12 recent sample summaries. High-frequency captures can limit the available confirmation window; this does not cause an automatic escalation.
- One card appears per identified driver, with repeated signals first and only three cards expanded initially. There are no emails, push notifications, audio alerts, Amazon changes, disciplinary scores, or automatic dispatch actions. Questions ask about breaks, route conditions, access, device sync, and requested support. Causes are hypotheses to verify, not detected facts. No LLM or external AI service receives driver data in this phase.

## RTS and history

The point forecast uses recent actual stop pace when available, otherwise the valid whole-route pace, plus the explicit planned inbound stem or strictly validated planned return allowance from Phase 1. It shows the difference from Amazon's current verified planned RTS and remains low confidence. A stale or unverified planned RTS withholds the comparison without discarding an otherwise valid return estimate. The scenario range uses earlier versus recent pace with the same known inbound input; it is not a statistical confidence interval. Missing travel is never filled in. Stale or inconsistent inputs, a prolonged delivery gap, and overdue completed-route estimates suppress the forecast as before. Final-stop return estimates remain anchored to the actual completion, not every dashboard refresh.

Each new observation stores server-derived signal codes. Daily history retains signals even when the last capture recovered, while the live queue uses only current evidence. History is scoped to the same driver and station and deduplicated by workday. Three or more captured days with the same signal produce a recurring-observation note. That note is not a causal finding or a judgment of driver performance. Reassigned route samples are withheld from driver pace attribution.

The history view covers the prior 14 days; raw observations and signals retain the existing 35-day TTL. No historical events or past warnings are invented or backfilled for older captures. History responses include compact pace summaries rather than full event arrays. A six-day sample supports a descriptive latest-three versus previous-three daily pace comparison; routes and workloads may differ. Coaching adapts to the number of **captured** workdays, explicitly not employment tenure. Limited history prompts an offer of basic help; more captured days favor questions about changed conditions and recurring obstacles.

## Validation

The automated coverage includes numeric-event privacy/persistence, pace windows, planned-spacing context, missing/invalid events, gaps, stale data, repeat-capture confirmation and recovery, reassignment, cross-station scoping, out-of-order arrivals, historical signal retention, RTS calculations, driver grouping, and coaching evidence limits. Existing ingestion/queue and collector tests remain in place.

[GitHub Actions run 41159085135](https://github.com/aivisualpro/SYMXSystems/actions/runs/41159085135) passed on implementation commit `6c08b09612f1cdb6db97fdf45d2af4d5332df360`:

- **376 tests passed across 26 files**, including the full MongoDB-backed integration suite.
- TypeScript checks and optimized production build passed.
- All **three browser smoke scripts passed**, with no browser errors: existing authenticated dashboard/ingestion, actual unpacked MV3 extension, and Phase 2 driver intelligence.
- The extension acknowledged **40/40 synthetic DFO2 itinerary details**, verified numeric event persistence, pacing, and reconciliation, and made **43 intercepted synthetic GETs with zero live Amazon requests**.
- Browser coverage includes DFO2-only attention, recent/earlier pace, gap-based forecast suppression, evidence and possible explanations, recurring history, preserved hover/dialog behavior through refresh, and mobile layout.
- The four Phase 2 screenshots linked above were generated by this exact run and visually reviewed. The documentation/screenshot-only handoff commit adds no executable behavior after the tested implementation.

The local workspace passed focused tests, TypeScript and production build, but could not start MongoDB. The first local full-suite attempt therefore had 289 passed tests and 85 database tests unable to execute; it was not treated as a full pass. The full results above come from the isolated GitHub runner. No live Amazon accuracy or throughput was measured.

## Remaining authorized live DFO2 validation

1. Confirm the live `actualExecutionTime`, planned start, stop-count and inbound contracts, including multi-package stops, partial attempts, batching, pre-start RMSRoute details and planned-return allowances. Inspect normalized counts/statuses only; keep raw customer information out of diagnostics.
2. Verify route reassignment/rescue identity behavior and that collection sees the transition before interpreting any individual driver's full-route event history.
3. Compare signals with known breaks, longer travel legs, apartments/businesses, access problems and sync delays. These factors are currently unknown unless indirectly reflected in planned spacing; the system does not claim to recognize a break or assess route difficulty.
4. Measure repeated foreground/background collection, clock alignment, browser restart recovery, route coverage and event freshness with the existing authorized Chrome profile. No live speed improvement is claimed from synthetic timings.
5. Validate RTS error and the usefulness/false-positive rate of the pilot thresholds against actual DFO2 returns across several days before operational reliance or replication to other stations. The thresholds are development defaults, not disciplinary policy.

Production approval and rollout remain separate. PRs #13 and #14 must remain unmerged during this milestone.
