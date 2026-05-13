# Changelog

## [2026-05-13] — Enterprise Route Performance Optimization

### Pass 1 — Toast Foundation
- Refactored toast system from `top-center` to `bottom-right` with close buttons
- Created centralized `lib/notify.ts` wrapper; all 324 `toast.*` call-sites migrated to `notify.*`
- Error toasts persist (`duration: Infinity`) until manually dismissed; success/info auto-dismiss in 2.5s

### Pass 2 — Migrate Toast Call Sites
- Replaced every direct `sonner` import across `app/`, `components/`, `lib/` with `notify` helper
- Added timing guards for CRUD success toasts: silent if operation took <400ms

### Pass 3 — Optimistic-First Mutation Hooks
- Created `lib/query/optimistic.ts` — generic factory for fire-and-forget CRUD with:
  - Automatic query cancellation, snapshotting, and optimistic cache writes
  - Rollback on error with `notify.error`
  - Background revalidation on settle
- Migrated 14+ domain hooks to the optimistic pattern

### Pass 4 — Initial Paint Performance
- **Cache tuning**: `gcTime` increased from 5 → 10 minutes in `app/providers.tsx`
- **Code-splitting**: Extracted utilities from 3 monolith pages:
  - `scheduling/page.tsx`: 2670 → 2460 lines (−210) → `_components/schedule-utils.ts`
  - `everyday/page.tsx`: 1962 → 1906 lines (−56) → `_components/everyday-utils.ts`
  - `dispatching/routes/page.tsx`: 1734 → 1544 lines (−190) → `_components/routes-utils.ts`
- **Dynamic imports**: `MessagingPanel` and `EmployeeNotesPanel` lazy-loaded with `next/dynamic`
- **Prefetching**: Week navigation chevrons prefetch adjacent week data on `onMouseEnter`
- **Component extraction**: `IconPicker` and `LUCIDE_ICONS` extracted from dropdowns page to shared `_components/icon-picker.tsx`
- **Layout fix**: `useAddRef` context moved from layout export to `_components/add-ref-context.tsx`

### Pass 5 — Smart Loading & Background Sync
- **Smart toasts**: `notify.silentSuccess` now accepts `{ startedAt }` — operations under 400ms are silent
- **Offline detection**: `NetworkStatusProvider` shows persistent toast when offline, auto-refetches on reconnect
- **Background indicator**: Pulsing sky-blue dot in site header when any query/mutation is in-flight
- **Mutation queue**: Failed network mutations queued in memory (max 20), replayed on reconnect
- **offlineFirst mode**: Added `networkMode: 'offlineFirst'` to query and mutation defaults
- **Debounced mutations**: `useDebouncedMutation(hook, 300)` prevents double-click request duplication
- **MutationCache**: Global error handler detects network failures and queues retries

### Pass 6 — Verification & Production Readiness
- **Font fix**: Migrated Poppins from `next/font/google` (build-time) to runtime `<link>` to prevent build crashes when Google Fonts is unreachable
- **Layout exports fix**: Extracted `useAddRef` + `IconPicker` from page/layout files to shared `_components/` (Next.js 16 disallows non-standard named exports from these files)
- **TypeScript**: Zero errors on `npx tsc --noEmit`
- **Build**: Webpack compiles successfully; Turbopack blocked by OS-level port binding issue (unrelated to code)

### Files Created
| File | Purpose |
|------|---------|
| `lib/notify.ts` | Centralized toast gateway |
| `lib/query/optimistic.ts` | Optimistic mutation factory |
| `lib/query/useDebouncedMutation.ts` | Double-click prevention |
| `components/providers/network-status.tsx` | Offline/online detection + retry queue |
| `scheduling/_components/schedule-utils.ts` | Extracted scheduling utilities |
| `everyday/_components/everyday-utils.ts` | Extracted everyday utilities |
| `dispatching/routes/_components/routes-utils.ts` | Extracted routes utilities |
| `admin/settings/general/_components/icon-picker.tsx` | Shared IconPicker component |
| `admin/settings/general/_components/add-ref-context.tsx` | Shared AddRef context |
