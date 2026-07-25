'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect } from 'react';

function applyBodyScrollClasses(pathname: string) {
  const isDashboard = pathname.startsWith('/dashboard');
  const isAuth = pathname === '/login';

  document.body.classList.remove('scroll-lock', 'dashboard-app', 'public-page');
  if (isDashboard) {
    document.body.classList.add('scroll-lock', 'dashboard-app');
  } else if (isAuth) {
    document.body.classList.add('scroll-lock');
  }

  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('height');
  document.documentElement.removeAttribute('data-scroll');
}

/** Syncs body scroll-lock for dashboard/login. Landing uses native document scroll. */
export function BodyRouteManager() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    applyBodyScrollClasses(pathname);
  }, [pathname]);

  return null;
}
