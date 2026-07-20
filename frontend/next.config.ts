import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      { source: '/profiles/:path*', destination: `${api}/profiles/:path*` },
      { source: '/profiles', destination: `${api}/profiles/` },
      { source: '/jobs/:path*', destination: `${api}/jobs/:path*` },
      { source: '/jobs', destination: `${api}/jobs/` },
      { source: '/roasts/:path*', destination: `${api}/roasts/:path*` },
      { source: '/roasts', destination: `${api}/roasts/` },
      { source: '/auth/:path*', destination: `${api}/auth/:path*` },
      { source: '/credits/:path*', destination: `${api}/credits/:path*` },
      { source: '/payments/:path*', destination: `${api}/payments/:path*` },
      { source: '/admin/:path*', destination: `${api}/admin/:path*` },
      { source: '/notifications/:path*', destination: `${api}/notifications/:path*` },
      { source: '/notifications', destination: `${api}/notifications` },
      { source: '/account/:path*', destination: `${api}/account/:path*` },
      { source: '/account', destination: `${api}/account` },
      { source: '/extension/:path*', destination: `${api}/extension/:path*` },
      { source: '/progress/:path*', destination: `${api}/progress/:path*` },
      { source: '/health', destination: `${api}/health` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
