'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * TanStack Query provider.
 *
 * Defaults are tuned for a live, judged demo rather than a long-running app:
 *
 * - `staleTime` of 5 minutes: results are the output of a batch scoring run, not a
 *   real-time feed, so refetching mid-presentation would only add latency.
 * - No refetch on window focus: alt-tabbing to the slide deck and back must not
 *   trigger a reload and a flash of skeletons.
 * - One retry: a transient failure recovers without the presenter clicking, but a
 *   genuinely down backend surfaces its error state quickly instead of hanging.
 * - `keepPreviousData` behaviour is opted into per-hook via `placeholderData`, so
 *   paging the ranked table does not blank the rows.
 *
 * The client is created inside component state so it is never shared between
 * requests during server rendering.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
            retryDelay: 400,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
