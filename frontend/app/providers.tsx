'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BodyRouteManager } from '@/components/BodyRouteManager';

function AuthInitializer() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    // /login owns OAuth token capture + session restore.
    if (window.location.pathname === '/login') return;
    fetchMe();
  }, [fetchMe]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BodyRouteManager />
      <AuthInitializer />
      <ErrorBoundary>{children}</ErrorBoundary>
    </QueryClientProvider>
  );
}
