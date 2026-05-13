/**
 * useDebouncedMutation — wraps a TanStack useMutation so that rapid-fire
 * triggers within `delayMs` are collapsed into a single request.
 *
 * Usage:
 *   const { mutate } = useDebouncedMutation(useDeleteTicket, 300);
 *   <Button onClick={() => mutate({ id })}>Delete</Button>
 *
 * Two clicks within 300 ms fire only one DELETE request.
 */

import { useRef, useCallback } from "react";
import type { UseMutateFunction } from "@tanstack/react-query";

/**
 * @param mutationHook  A TanStack mutation hook (e.g. useDeleteTicket).
 *                      Must return `{ mutate, ...rest }`.
 * @param delayMs       Debounce window in ms (default 300).
 */
export function useDebouncedMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  mutationHook: () => {
    mutate: UseMutateFunction<TData, TError, TVariables, TContext>;
    [key: string]: any;
  },
  delayMs = 300,
) {
  const { mutate, ...rest } = mutationHook();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallRef = useRef<number>(0);

  const debouncedMutate: UseMutateFunction<TData, TError, TVariables, TContext> = useCallback(
    (variables: TVariables, options?: any) => {
      const now = Date.now();
      const elapsed = now - lastCallRef.current;

      // If within the debounce window, cancel the previous timer and reschedule
      if (timerRef.current && elapsed < delayMs) {
        clearTimeout(timerRef.current);
      }

      lastCallRef.current = now;

      // Schedule the actual mutation after the debounce window
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        mutate(variables, options);
      }, delayMs);
    },
    [mutate, delayMs],
  );

  return { mutate: debouncedMutate, ...rest };
}
