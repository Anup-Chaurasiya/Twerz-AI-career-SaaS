'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BodyRouteManager } from '@/components/BodyRouteManager';

/** Public routes — skip auth API on first paint (marketing + landing). */
const PUBLIC_PATH_PREFIXES = [
  '/',
  '/login',
  '/features',
  '/platform',
  '/pricing',
  '/how-it-works',
  '/faq',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/dpdp',
  '/roast',
  '/extension',
];

function isPublicPath(path: string): boolean {
  if (path === '/') return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => prefix !== '/' && (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

function AuthInitializer() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/login') return;

    const state = useAuthStore.getState();
    if (!localStorage.getItem('token')) {
      state.fetchMe();
      return;
    }
    if (state.isLoggedIn && state.user) return;

    // Defer auth check on public pages so navigation stays snappy.
    if (isPublicPath(path)) {
      setTimeout(() => {
        void useAuthStore.getState().fetchMe({ force: true });
      }, 0);
      return;
    }

    state.fetchMe({ force: true });
  }, []);
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
