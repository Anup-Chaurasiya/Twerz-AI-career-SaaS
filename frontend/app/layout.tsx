import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://resume.twerz'),
  title: {
    default: 'Shortlyst — AI Resume Tailoring for Every Job',
    template: '%s | Shortlyst',
  },
  description:
    'Shortlyst turns one profile into role-perfect PDFs — with honest fit scores, zero fabricated skills, and LaTeX-grade output. A product of Twerz.',
  keywords: [
    'Shortlyst',
    'Twerz',
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
    title: 'Shortlyst — AI Resume Tailoring for Every Job',
    description:
      'Role-perfect resumes with honest fit scores — no fabricated skills. Powered by Twerz.',
    siteName: 'Shortlyst by Twerz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shortlyst — AI Resume Tailoring for Every Job',
    description: 'Role-perfect resumes with honest fit scores. A product of Twerz.',
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
