'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          gcTime: 5 * 60_000,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
          refetchOnMount: false,
          retry: 1,
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
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
