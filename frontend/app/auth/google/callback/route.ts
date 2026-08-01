import { NextRequest, NextResponse } from 'next/server';
import { getApiBase } from '@/lib/api/baseUrl';

/**
 * Google OAuth redirect URI (registered in Google Console as www.twerz.com/...).
 * Forwards the authorization code to the API where CSRF validation runs.
 */
export function GET(request: NextRequest) {
  const apiBase = getApiBase();
  const target = new URL('/auth/google/callback', apiBase);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target.toString(), 307);
}
