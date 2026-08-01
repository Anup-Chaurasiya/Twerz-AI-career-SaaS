import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://resume.twerz'),
  title: {
    default: 'Twerz — AI Resume Tailoring for Every Job',
    template: '%s | Twerz',
  },
  description:
    'Twerz turns one profile into role-perfect PDFs — with honest fit scores, zero fabricated skills, and LaTeX-grade output.',
  keywords: [
    'Twerz',
    'resume.twerz',
    'ATS resume optimizer',
    'resume tailoring',
    'AI resume builder',
    'honest fit score',
    'job hunt OS',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://resume.twerz',
    title: 'Twerz — AI Resume Tailoring for Every Job',
    description:
      'Role-perfect resumes with honest fit scores — no fabricated skills.',
    siteName: 'Twerz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Twerz — AI Resume Tailoring for Every Job',
    description: 'Role-perfect resumes with honest fit scores.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="auto" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#E8EDF4" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
