'use client'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { NetworkStatusProvider } from '@/components/providers/network-status'

/**
 * Detect whether an error is a network-level failure (not a 4xx/5xx response).
 * Network errors are TypeError("Failed to fetch") or similar connectivity issues.
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return false; // intentional abort
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const mutationCache = new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Only queue network failures — not 4xx/5xx application errors
        if (isNetworkError(error) && mutation.options.mutationFn) {
          const queueFn = (window as any).__networkRetryQueue;
          if (typeof queueFn === 'function') {
            const label = (mutation.options as any).mutationKey?.[0] ?? 'mutation';
            queueFn(
              () => mutation.options.mutationFn!(_variables as any, {} as any),
              String(label),
            );
          }
        }
      },
    });

    const qc = new QueryClient({
      mutationCache,
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          gcTime: 10 * 60_000,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
          refetchOnMount: false,
          retry: 1,
          networkMode: 'offlineFirst',
        },
        mutations: {
          networkMode: 'offlineFirst',
        },
      },
    });

    // Dropdowns, route types, WST options, modules
    qc.setQueryDefaults(['admin', 'dropdowns'], { staleTime: Infinity });
    qc.setQueryDefaults(['admin', 'routeTypes'], { staleTime: Infinity });
    qc.setQueryDefaults(['admin', 'wst'], { staleTime: Infinity });
    qc.setQueryDefaults(['admin', 'modules'], { staleTime: Infinity });

    // Users, roles, app config
    qc.setQueryDefaults(['admin', 'users'], { staleTime: 10 * 60_000 });
    qc.setQueryDefaults(['admin', 'roles'], { staleTime: 10 * 60_000 });
    qc.setQueryDefaults(['admin', 'config'], { staleTime: 10 * 60_000 });

    // Employees list, fleet vehicles
    qc.setQueryDefaults(['employees', 'list'], { staleTime: 5 * 60_000 });
    qc.setQueryDefaults(['fleet', 'vehicles'], { staleTime: 5 * 60_000 });

    // Schedules, dispatching routes
    qc.setQueryDefaults(['schedules'], { staleTime: 30_000 });
    qc.setQueryDefaults(['dispatching', 'routes'], { staleTime: 30_000 });

    // Messaging live status, confirmation status
    qc.setQueryDefaults(['messaging', 'liveStatus'], { staleTime: 0, refetchOnMount: 'always' });
    qc.setQueryDefaults(['dispatching', 'confirmations'], { staleTime: 0, refetchOnMount: 'always' });
    qc.setQueryDefaults(['schedules', 'confirmations'], { staleTime: 0, refetchOnMount: 'always' });

    return qc;
  })

  return (
    <QueryClientProvider client={client}>
      <NetworkStatusProvider />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
