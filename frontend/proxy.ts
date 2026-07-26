import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/roast', '/features', '/platform', '/pricing', '/how-it-works', '/faq', '/about', '/contact', '/privacy', '/terms', '/dpdp'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith('/roast/'));
  if (isPublic) return NextResponse.next();
  // Auth check is done client-side; proxy just passes through
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
