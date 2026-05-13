/**
 * Generic optimistic-mutation factory for TanStack Query.
 *
 * Usage:
 *   const config = makeOptimisticMutation({
 *     mutationFn: (vars) => fetch(...),
 *     queryKey: qk.hr.tickets,
 *     updater: (old, vars) => [...old, vars],
 *     successMsg: "Ticket created",
 *     errorMsg: "Couldn't create ticket",
 *   });
 *   const mutation = useMutation(config);
 *
 * Returns a full `useMutation` options object with:
 *  - onMutate: cancels queries → snapshots → applies updater
 *  - onError:  rolls back from snapshot → shows error toast
 *  - onSettled: invalidates queryKey for background revalidation
 */

import type { QueryClient, QueryKey, UseMutationOptions } from "@tanstack/react-query";
import { notify } from "@/lib/notify";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface OptimisticMutationConfig<
  TData = unknown,
  TVariables = unknown,
  TQueryData = unknown,
> {
  /** The async function that performs the actual request. */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * The queryKey(s) to optimistically update + invalidate.
   * Can be a single key or an array of keys.
   */
  queryKey: QueryKey | QueryKey[];

  /**
   * Pure function that produces the new cache value from the old data and
   * mutation variables. Return `undefined` to skip the optimistic cache write
   * (useful when you don't know the shape of existing data, e.g. creates
   * without a list cache).
   */
  updater?: (oldData: TQueryData | undefined, variables: TVariables) => TQueryData | undefined;

  /** Optional success message — shown via notify.silentSuccess. */
  successMsg?: string;

  /** Optional error message — shown via notify.error on failure. */
  errorMsg?: string;

  /**
   * Additional queryKeys to invalidate on settlement (e.g. dashboard KPIs
   * that depend on the mutated data).
   */
  extraInvalidateKeys?: QueryKey[];

  /** Called after successful mutation (after cache is revalidated). */
  onSuccess?: (data: TData, variables: TVariables) => void;
}

/* ── Context passed between lifecycle hooks ────────────────────────────────── */

interface OptimisticContext<TQueryData = unknown> {
  snapshots: Map<string, TQueryData | undefined>;
  startedAt: number;
}

/* ── Helper: normalise single key to array ────────────────────────────────── */

function normaliseKeys(input: QueryKey | QueryKey[]): QueryKey[] {
  if (input.length === 0) return [];
  // If the first element is itself an array, treat input as QueryKey[]
  if (Array.isArray(input[0])) return input as QueryKey[];
  return [input] as QueryKey[];
}

/* ── Factory ───────────────────────────────────────────────────────────────── */

/**
 * Returns a useMutation-compatible options object that handles:
 *  1. Cancelling in-flight queries
 *  2. Snapshotting previous cache state
 *  3. Applying optimistic UI via `updater`
 *  4. Rolling back on error
 *  5. Background revalidation on settle
 *
 * The caller must provide `queryClient` when consuming this from a hook.
 * See `makeOptimisticHook` below for a shortcut that handles that.
 */
export function makeOptimisticMutation<
  TData = unknown,
  TVariables = unknown,
  TQueryData = unknown,
>(
  config: OptimisticMutationConfig<TData, TVariables, TQueryData>,
  queryClient: QueryClient,
): UseMutationOptions<TData, Error, TVariables, OptimisticContext<TQueryData>> {
  const keys = normaliseKeys(config.queryKey);

  return {
    mutationFn: config.mutationFn,

    /* ── 1. Optimistic update ──────────────────────────────────────────── */
    onMutate: async (variables) => {
      const snapshots = new Map<string, TQueryData | undefined>();

      // Cancel running queries for every key
      for (const key of keys) {
        await queryClient.cancelQueries({ queryKey: key });
      }

      // Snapshot + optimistically update each key
      for (const key of keys) {
        const keyStr = JSON.stringify(key);
        const previous = queryClient.getQueryData<TQueryData>(key);
        snapshots.set(keyStr, previous);

        if (config.updater && previous !== undefined) {
          const next = config.updater(previous, variables);
          if (next !== undefined) {
            queryClient.setQueryData<TQueryData>(key, next);
          }
        }
      }

      return { snapshots, startedAt: Date.now() };
    },

    /* ── 2. Rollback on error ─────────────────────────────────────────── */
    onError: (_err, _variables, context) => {
      if (context?.snapshots) {
        for (const key of keys) {
          const keyStr = JSON.stringify(key);
          const prev = context.snapshots.get(keyStr);
          if (prev !== undefined) {
            queryClient.setQueryData(key, prev);
          }
        }
      }
      notify.error(config.errorMsg ?? "Couldn't save changes — try again");
    },

    /* ── 3. Success feedback ──────────────────────────────────────────── */
    onSuccess: (data, variables, context) => {
      if (config.successMsg) {
        const startedAt = context?.startedAt ?? Date.now();
        const elapsed = Date.now() - startedAt;
        if (elapsed > 400) {
          notify.success(config.successMsg);
        } else {
          notify.silentSuccess(config.successMsg, { startedAt });
        }
      }
      config.onSuccess?.(data, variables);
    },

    /* ── 4. Revalidate on settle (success or failure) ─────────────────── */
    onSettled: () => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (config.extraInvalidateKeys) {
        for (const key of config.extraInvalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  };
}
