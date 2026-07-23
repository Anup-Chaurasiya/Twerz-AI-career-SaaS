import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ATS Beater — AI Resume Tailoring',
    template: '%s | ATS Beater',
  },
  description: 'Upload your resume, paste a job description, and get an ATS-optimized tailored resume in seconds. Powered by AI.',
  keywords: ['ATS resume optimizer', 'resume tailoring', 'AI resume builder', 'ATS-friendly resume'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'ATS Beater — AI Resume Tailoring',
    description: 'Beat ATS systems with AI-tailored resumes.',
    siteName: 'ATS Beater',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATS Beater — AI Resume Tailoring',
    description: 'Beat ATS systems with AI-tailored resumes',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
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
        <meta name="theme-color" content="#09090b" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </body>
    </html>
  );
}
