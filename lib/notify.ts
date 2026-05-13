/**
 * Centralized notification wrapper.
 *
 * This is the ONLY file (besides components/ui/sonner.tsx) that should import
 * from the "sonner" package. All application code should use `notify.*` instead
 * of `toast.*` directly.
 */
import { toast, type ExternalToast } from "sonner";

export type NotifyOptions = ExternalToast;

export const notify = {
  /**
   * Success toast — auto-dismisses in 2.5 s (inherits Toaster default).
   */
  success(message: string, opts?: NotifyOptions) {
    return toast.success(message, { duration: 2500, ...opts });
  },

  /**
   * Error toast — stays on-screen until the user explicitly closes it.
   */
  error(message: string, opts?: NotifyOptions) {
    return toast.error(message, { duration: Infinity, ...opts });
  },

  /**
   * Informational toast — auto-dismisses in 2.5 s.
   */
  info(message: string, opts?: NotifyOptions) {
    return toast.info(message, { duration: 2500, ...opts });
  },

  /**
   * Warning toast — auto-dismisses in 4 s (slightly longer for visibility).
   */
  warning(message: string, opts?: NotifyOptions) {
    return toast.warning(message, { duration: 4000, ...opts });
  },

  /**
   * Loading toast — shows a spinner. Returns the toast id so callers can
   * update or dismiss it later via `notify.success(msg, { id })`.
   */
  loading(message: string, opts?: NotifyOptions) {
    return toast.loading(message, opts);
  },

  /**
   * Custom / bare toast — used for confirmation dialogs or rich content
   * (action buttons, descriptions, etc.). Maps to sonner's bare `toast()`.
   */
  custom(message: string, opts?: NotifyOptions) {
    return toast(message, opts);
  },

  /**
   * Promise toast — shows loading → success / error states automatically.
   */
  promise<T>(
    promiseFn: Promise<T> | (() => Promise<T>),
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) {
    return toast.promise(promiseFn, msgs);
  },

  /**
   * Silent success — only shows a toast if the operation took ≥400 ms.
   * For fast operations (optimistic CRUD), the UI update IS the confirmation.
   *
   * @param message  Toast text.
   * @param opts     Standard toast options + optional `startedAt` timestamp.
   */
  silentSuccess(
    message: string,
    opts?: NotifyOptions & { startedAt?: number },
  ) {
    const { startedAt, ...rest } = opts ?? {};
    if (startedAt !== undefined) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 400) {
        // Fast operation — UI update is the confirmation, skip toast.
        return undefined as unknown as string | number;
      }
    }
    // Slow operation or no startedAt — show a brief confirmation toast.
    return toast.success(message, { duration: 2500, ...rest });
  },

  /**
   * Dismiss one toast by id, or all toasts if no id is provided.
   */
  dismiss(id?: string | number) {
    return toast.dismiss(id);
  },
} as const;
