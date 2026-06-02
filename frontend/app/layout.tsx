import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0F1B2E" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </body>
    </html>
  );
}
