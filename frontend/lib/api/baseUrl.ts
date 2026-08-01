/**
 * Shared API base URL for axios, SSE, and direct fetch calls.
 * Production: direct https://api.twerz.com (no Vercel proxy hop).
 * Development: NEXT_PUBLIC_API_URL or localhost:8000; empty string uses Next.js rewrites.
 */
export function getApiBase(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return '';
  }
  return 'https://api.twerz.com';
}
