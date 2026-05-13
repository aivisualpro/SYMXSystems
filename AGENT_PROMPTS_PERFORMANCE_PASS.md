# SYMX Systems — Performance & UX Polish Prompt Pack

Hand these prompts to your AI coding agent **one at a time, in order**. Each prompt is self-contained, references real file paths, and ends with a verification step.

**Goal:** Lightning-fast loads, silent background CRUD, subtle bottom-right toasts, industry-standard polish — applied app-wide.

**Current state observed (2026-05-13):**
- Next.js 16, React 19, TanStack Query v5, Sonner toasts, MongoDB/Mongoose
- 52 route pages, 95 API routes, 133 client components, 324 `toast.*` call sites
- Sonner currently at `top-center` with `richColors` — needs to move to `bottom-right`, no rich colors
- Mutation hooks exist for: `useSchedules`, `useDispatching`, `useEmployees` — missing for: `useFleet`, `useHr`, `useAdmin`, `useShared`
- 15 raw `await fetch(...)` calls in pages/components that bypass the query layer
- Only 9 `Suspense`/`next/dynamic` usages — heavy panels load eagerly
- 9 files exceed 1000 lines (worst: `app/(protected)/scheduling/page.tsx` at 2670 lines)

---

## PASS 1 — Toast Foundation (bottom-right, subtle, centralized)

```
Refactor the toast system app-wide. Do not change call-site signatures; create a wrapper so callers keep working.

1. Edit `app/layout.tsx`:
   - Change `<Toaster position="top-center" richColors />` to `<Toaster position="bottom-right" closeButton expand={false} duration={2500} />`.
   - Remove `richColors`.

2. Edit `components/ui/sonner.tsx`:
   - Add sensible defaults in toastOptions: `{ classNames: { toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md", description: "group-[.toast]:text-muted-foreground", actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground", cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground" } }`.
   - Make `error` toasts NOT auto-dismiss (duration: Infinity) — users must close them.
   - `success` and `info` auto-dismiss in 2.5s.

3. Create `lib/notify.ts` exporting a single object `notify` with: success(msg, opts?), error(msg, opts?), info(msg, opts?), warning(msg, opts?), promise(promiseFn, { loading, success, error }), dismiss(id?). Internally use `sonner`'s `toast.*`. This is the ONLY place that imports from `sonner` outside `components/ui/sonner.tsx`.

4. Do NOT change any existing `toast.*` call sites yet — Pass 2 handles that.

Done when: `npm run lint` passes, app starts, toasts appear bottom-right, errors stay until clicked.
```

---

## PASS 2 — Migrate the 324 `toast.*` Call Sites to `notify`

```
Replace every direct sonner import across the app with the centralized `notify` helper from `lib/notify.ts`.

1. Find all files containing `from "sonner"` or `from 'sonner'` under `app/`, `components/`, `lib/` (excluding `components/ui/sonner.tsx` and `lib/notify.ts`).

2. In each file:
   - Replace `import { toast } from "sonner"` with `import { notify } from "@/lib/notify"`.
   - Replace `toast.success(x)` → `notify.success(x)`.
   - Replace `toast.error(x)` → `notify.error(x)`.
   - Replace `toast.info(x)` → `notify.info(x)`.
   - Replace `toast.warning(x)` → `notify.warning(x)`.
   - Replace `toast.promise(...)` → `notify.promise(...)`.
   - Replace bare `toast(...)` → `notify.info(...)`.
   - Replace `toast.dismiss(id)` → `notify.dismiss(id)`.

3. For success toasts on CRUD operations specifically (save, update, delete, create), wrap them in a guard: only show if the operation took >400ms OR if it's a destructive action (delete). For fast operations on non-destructive actions, the UI update IS the confirmation — drop the toast entirely. To do this, add a `notify.silentSuccess(msg)` that no-ops in production for now (we'll wire timing in Pass 5).

4. Do not modify the message strings.

Done when:
- `grep -rn "from \"sonner\"" app/ components/ lib/ | grep -v "components/ui/sonner.tsx" | grep -v "lib/notify.ts"` returns 0 results.
- `npm run lint` passes.
- `npm run build` succeeds with no type errors.
```

---

## PASS 3 — Optimistic-First Mutation Hooks (silent background CRUD)

```
Goal: every CRUD action updates the UI instantly, runs the request in the background, rolls back on error. No `await` on the mutation in the UI layer.

Existing pattern to follow: `lib/query/hooks/useSchedules.ts` → `useUpdateSchedule`. It uses `onMutate` for optimistic updates, `onError` for rollback, `onSettled` for revalidation. Study it first.

1. Build a generic helper at `lib/query/optimistic.ts`:

   export function makeOptimisticMutation<TData, TVariables, TContext>({
     mutationFn,
     queryKey,
     updater,  // (old, vars) => newData
     successMsg,
     errorMsg,
   }) { ... returns useMutation config with onMutate/onError/onSettled wired up. }

   - Cancels in-flight queries for `queryKey` in onMutate.
   - Snapshots previous value.
   - Applies `updater` for optimistic UI.
   - On error: rollback + `notify.error(errorMsg ?? "Couldn't save changes — try again")`.
   - On success: optional `notify.silentSuccess(successMsg)`.
   - On settled: invalidate `queryKey`.

2. Create missing mutation hooks (use the helper):
   - `lib/query/hooks/useFleet.ts` — add `useCreateVehicle`, `useUpdateVehicle`, `useDeleteVehicle`, `useUpdateVehicleStatus`.
   - `lib/query/hooks/useHr.ts` — add `useCreateInterview`, `useUpdateInterview`, `useDeleteInterview`, `useUpdateReimbursement`, `useApproveReimbursement`.
   - `lib/query/hooks/useAdmin.ts` — add `useCreateUser`, `useUpdateUser`, `useDeleteUser`, `useUpdateRouteType`, `useUpdateDropdown`, `useUpdateConfig`.
   - `lib/query/hooks/useShared.ts` — keep read-only.

   For each: include optimistic updater, error rollback, silent success.

3. Find the 15 raw `await fetch(...)` calls (use `grep -rn "await fetch(" app/ components/ | grep -v "/api/"`) and convert each into a call to one of the new hooks. The UI handler should be:

     const mutate = useUpdateVehicle();
     // in onClick:
     mutate.mutate({ ...payload });  // NO await

   Not:

     await mutate.mutateAsync(...);

4. For destructive actions (delete), add a confirmation step BEFORE the optimistic update (use the existing AlertDialog pattern from `components/ui/alert-dialog.tsx`). Once confirmed, fire-and-forget.

5. Audit `app/(protected)/scheduling/page.tsx`, `app/(protected)/dispatching/routes/page.tsx`, `app/(protected)/everyday/page.tsx`, `app/(protected)/hr/interviews/page.tsx`, `app/(protected)/hr/reimbursement/page.tsx`, `app/(protected)/load-out/page.tsx` for any `await mutateAsync` or `await fetch` patterns and convert them.

Done when:
- `grep -rn "await mutateAsync\|await fetch(" app/ components/ | grep -v "/api/"` returns 0 results.
- All CRUD buttons feel instant in the browser.
- Disconnecting wifi mid-mutation produces a rollback + error toast.
- `npm run build && npm run lint` both pass.
```

---

## PASS 4 — Initial Paint Performance (code-split heavy pages)

```
Goal: pages render meaningful content within ~200ms even on slow networks. Currently `app/(protected)/scheduling/page.tsx` is 2670 lines and ships as one client bundle.

1. For each file >1000 lines under `app/(protected)/`:
   - `app/(protected)/scheduling/page.tsx` (2670)
   - `app/(protected)/everyday/page.tsx` (1962)
   - `app/(protected)/dispatching/_components/RoutesInfoPanel.tsx` (1791)
   - `app/(protected)/dispatching/routes/page.tsx` (1734)
   - `app/(protected)/load-out/page.tsx` (1371)
   - `app/(protected)/hr/reimbursement/page.tsx` (1222)
   - `app/(protected)/hr/interviews/page.tsx` (1199)
   - `app/(protected)/dispatching/time/page.tsx` (1102)
   - `app/(protected)/scorecard/[tab]/page.tsx` (1025)

   Extract into co-located components under `app/(protected)/<route>/_components/`:
   - The week/day navigation header → `WeekNavigator.tsx`
   - The main grid/table → `ScheduleGrid.tsx` (or analogous for each page)
   - Modals/dialogs → one file per modal
   - Filters/search panels → `Filters.tsx`
   - Heavy side panels (MessagingPanel already exists; do the same for others)

   The page's `page.tsx` should end up <300 lines, mostly composition.

2. Lazy-load heavy panels with `next/dynamic`:

     const MessagingPanel = dynamic(() => import("@/components/scheduling/messaging-panel"), {
       loading: () => <PanelSkeleton />,
       ssr: false,
     });

   Apply to: MessagingPanel, EmployeeNotesPanel, any modal/dialog that mounts >500 lines of code, recharts-based charts, leaflet maps.

3. Add a `loading.tsx` to every route under `app/(protected)/` that doesn't have one. Use a skeleton that mirrors the page layout (header bar + grid placeholder), not a spinner.

4. In `app/providers.tsx`, change `gcTime: 5 * 60_000` to `gcTime: 10 * 60_000` so cached pages survive longer when the user navigates back.

5. For the scheduling page specifically: prefetch the next/previous week on hover of the chevron buttons:

     onMouseEnter={() => queryClient.prefetchQuery({ queryKey: qk.schedules.week(adjacentWeek), queryFn: ... })}

Done when:
- `find app/ -name "page.tsx" -exec wc -l {} \; | awk '$1 > 600'` shows no offenders.
- Network tab shows the scheduling JS bundle drops by at least 30%.
- `npm run build` succeeds and reports smaller First Load JS for the scheduling route.
- `npm run lint` passes.
```

---

## PASS 5 — Smart Loading & Background Sync Polish

```
Industry-standard touches that make the app feel "real".

1. Smart success toasts — wire timing in `lib/notify.ts`:

   notify.silentSuccess accepts an optional `startedAt: number`. If `Date.now() - startedAt < 400`, no toast. If >=400ms, show a brief toast. This means fast saves are silent (UI is the confirmation), slow saves get acknowledged.

   In the optimistic mutation helper from Pass 3, capture `startedAt` in onMutate, pass it through context to onSuccess, and call `notify.silentSuccess(msg, { startedAt })`.

2. Offline detection — create `components/providers/network-status.tsx`:
   - Listens to `window.navigator.onLine` + `online`/`offline` events.
   - When offline: shows a persistent bottom-right toast "You're offline — changes will sync when you reconnect."
   - When back online: dismisses that toast + calls `queryClient.invalidateQueries()` to refetch stale data.
   - Mount it in `app/providers.tsx` inside the `<QueryClientProvider>`.

3. Background refresh indicator — in the app header, add a tiny pulsing dot when any query/mutation is fetching. Use `useIsFetching()` and `useIsMutating()` from `@tanstack/react-query`. Place it in the existing header component (find via `grep -rn "header-actions-provider" components/`).

4. Mutation queue — if `notify.error` fires for a network failure (not a 4xx), queue the failed mutation in memory and retry once `online` event fires. Store retry queue in a `useRef` on a top-level provider; no localStorage (would persist stale auth tokens). Cap at 20 queued items; older ones are dropped with a warning toast.

5. Stale-while-revalidate tuning in `app/providers.tsx`:
   - Already good. Verify `refetchOnWindowFocus: true` is kept for live data.
   - Add `networkMode: "offlineFirst"` to defaults so optimistic updates apply even when offline.

6. Request deduplication for double-clicks — wrap every mutation trigger in a `useDebouncedMutation(mutationHook, 300)` hook in `lib/query/useDebouncedMutation.ts`. Apply to destructive buttons (delete) and save buttons. Two clicks within 300ms fire one request.

Done when:
- Killing wifi → orange offline toast appears bottom-right.
- Restoring wifi → toast vanishes, all visible data refreshes.
- Fast saves are silent, slow saves show a 2.5s confirmation.
- `npm run build && npm run lint` pass.
```

---

## PASS 6 — Verification & Production-Readiness

```
Final pass. No new features — only confirm the work.

1. Run: `npm run build` — must succeed with no errors. Note final bundle sizes vs the report from Pass 4.
2. Run: `npm run lint` — must succeed.
3. Run: `npx tsc --noEmit` — must succeed with zero type errors.
4. Manually click through these routes in the dev server (localhost:9568):
   - /scheduling?week=2026-W20
   - /scheduling/messaging/shift?week=2026-W20&date=2026-05-12
   - /scheduling/messaging/future-shift?week=2026-W20&date=2026-05-12
   - /dispatching/routes
   - /everyday
   - /hr/interviews
   - /hr/reimbursement
   - /load-out
   - /fleet
   - /scorecard
   For each: time-to-interactive < 1s on a warm cache, < 2.5s cold. CRUD actions feel instant.
5. Confirm no console errors in browser devtools on any page.
6. Run a Lighthouse mobile audit on /scheduling — Performance score should be >= 85.
7. Write a short CHANGELOG.md entry at the repo root listing what changed in each pass.

Report back: bundle size before/after, Lighthouse score, any routes where the build still shows >300kB First Load JS.
```

---

## Tips for running this with your agent

- Run **one pass at a time**. Don't paste all six at once.
- After each pass, sanity-check in your dev server before moving on.
- If your agent gets stuck on the migration in Pass 2 (324 files), tell it to work in batches of 30 files and report progress.
- If Pass 4's component extraction feels too aggressive, you can skip the smaller files (1000–1300 lines) and just tackle the top 3.
- Keep each pass in its own git commit — easy to bisect if something regresses.
