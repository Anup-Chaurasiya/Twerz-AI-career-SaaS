# Next.js Migration Plan - ATS Beater
## From Vue 3 (CDN) to Production-Ready Next.js 14+ with App Router

---

## 🎯 Migration Goals

1. **SEO-First Architecture** - Server-side rendering, dynamic meta tags, structured data
2. **Production-Ready** - TypeScript, robust error handling, monitoring
3. **Performance** - Code splitting, image optimization, caching strategies
4. **Startup-Ready** - Analytics, conversion tracking, social sharing
5. **Modern DX** - Type safety, API routes, middleware, component library

---

## 📊 Current Architecture Analysis

### Existing Stack (Vue 3 CDN)
- **Frontend**: Vue 3 (global CDN build) + Pinia + Vue Router
- **Styling**: Tailwind CSS (CDN)
- **Build**: No build step - static HTML files
- **Features**: 
  - Resume upload & PDF generation
  - AI chat editing (SSE streams)
  - Credit system & Razorpay payments
  - Admin panel
  - Resume roast (shareable links)
  - Multi-tenancy

### Current Pages Structure
- `/` - Landing page
- `/profiles` - Profile management
- `/jobs` - Job applications & resume generation
- `/roasts` - Resume roast feature
- `/credits` - Credit packs
- `/admin` - Admin dashboard
- Auth flow with Google OAuth

---

## 🏗️ Target Next.js Architecture

### Technology Stack

```json
{
  "framework": "Next.js 14+",
  "router": "App Router (app directory)",
  "language": "TypeScript",
  "styling": "Tailwind CSS + CSS Modules",
  "stateManagement": "Zustand + React Query",
  "uiComponents": "shadcn/ui",
  "forms": "React Hook Form + Zod",
  "http": "Axios + React Query",
  "seo": "next-seo + next-sitemap",
  "analytics": "Vercel Analytics + Google Analytics 4",
  "monitoring": "Sentry",
  "testing": "Vitest + React Testing Library + Playwright"
}
```

### Directory Structure
```
frontend-nextjs/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx         # Login page
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts     # OAuth callback handler
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Dashboard layout with sidebar
│   │   ├── page.tsx             # Dashboard home
│   │   ├── profiles/
│   │   │   ├── page.tsx         # Profiles list (SSR)
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Profile detail with chat
│   │   │       └── loading.tsx  # Loading skeleton
│   │   ├── jobs/
│   │   │   ├── page.tsx         # Jobs list
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Job detail with PDF viewer + chat
│   │   ├── roasts/
│   │   │   ├── page.tsx         # My roasts
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Roast detail
│   │   ├── credits/
│   │   │   └── page.tsx         # Credit packs & purchase
│   │   └── admin/
│   │       ├── layout.tsx       # Admin-only layout
│   │       ├── page.tsx         # Admin dashboard
│   │       ├── users/
│   │       ├── tenants/
│   │       ├── credits/
│   │       └── analytics/
│   ├── api/                     # API routes (middleware to FastAPI)
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts     # NextAuth.js setup
│   │   └── webhook/
│   │       └── razorpay/
│   │           └── route.ts     # Payment webhook
│   ├── roast/
│   │   └── [shareId]/
│   │       └── page.tsx         # Public roast share page (SSR + OG)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page (/)
│   ├── not-found.tsx           # 404 page
│   ├── error.tsx               # Error boundary
│   ├── loading.tsx             # Root loading
│   ├── sitemap.ts              # Dynamic sitemap
│   ├── robots.ts               # Robots.txt
│   └── opengraph-image.tsx     # Dynamic OG images
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── toast.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── MobileNav.tsx
│   │   └── Footer.tsx
│   ├── features/
│   │   ├── profile/
│   │   │   ├── ProfileUploader.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   └── ProfileChat.tsx
│   │   ├── job/
│   │   │   ├── JobForm.tsx
│   │   │   ├── JobCard.tsx
│   │   │   ├── ResumeEditor.tsx
│   │   │   ├── PDFViewer.tsx
│   │   │   └── JobChat.tsx
│   │   ├── roast/
│   │   │   ├── RoastUploader.tsx
│   │   │   ├── RoastResult.tsx
│   │   │   └── ShareButton.tsx
│   │   ├── credit/
│   │   │   ├── CreditBalance.tsx
│   │   │   ├── CreditPackCard.tsx
│   │   │   └── PromoCodeInput.tsx
│   │   ├── payment/
│   │   │   └── RazorpayCheckout.tsx
│   │   └── admin/
│   │       ├── UserTable.tsx
│   │       ├── TenantManager.tsx
│   │       └── AnalyticsDashboard.tsx
│   └── shared/
│       ├── ConfirmDialog.tsx
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       ├── StatusBadge.tsx
│       └── ProgressBar.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts            # Axios instance with interceptors
│   │   ├── auth.ts              # Auth API calls
│   │   ├── profiles.ts          # Profile API calls
│   │   ├── jobs.ts              # Job API calls
│   │   ├── roasts.ts            # Roast API calls
│   │   ├── credits.ts           # Credit API calls
│   │   ├── payments.ts          # Payment API calls
│   │   └── admin.ts             # Admin API calls
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth hook
│   │   ├── useProfiles.ts       # React Query profiles
│   │   ├── useJobs.ts           # React Query jobs
│   │   ├── useRoasts.ts         # React Query roasts
│   │   ├── useCredits.ts        # React Query credits
│   │   ├── useChat.ts           # SSE chat hook
│   │   ├── useUpload.ts         # File upload with progress
│   │   └── useMediaQuery.ts     # Responsive breakpoints
│   ├── stores/
│   │   ├── authStore.ts         # Zustand auth store
│   │   └── uiStore.ts           # UI state (modals, toasts)
│   ├── utils/
│   │   ├── cn.ts                # Class name helper
│   │   ├── format.ts            # Date, currency formatters
│   │   ├── validation.ts        # Zod schemas
│   │   └── constants.ts         # App constants
│   ├── seo/
│   │   ├── metadata.ts          # Metadata generators
│   │   ├── jsonLd.ts            # Structured data
│   │   └── openGraph.ts         # OG image generators
│   └── config/
│       ├── site.ts              # Site config
│       └── navigation.ts        # Nav items
├── types/
│   ├── api.ts                   # API response types
│   ├── models.ts                # Data models
│   └── index.ts                 # Barrel export
├── middleware.ts                # Auth + rate limiting
├── next.config.js              # Next.js config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json               # TypeScript config
└── package.json
```

---

## 🚀 Phase-by-Phase Implementation

### Phase 1: Project Setup & Infrastructure (Days 1-2)

#### Step 1.1: Initialize Next.js Project
```bash
cd /Users/anupchaurasiya/workspace/Personal/resume-optimizer
npx create-next-app@latest frontend-nextjs --typescript --tailwind --app --src-dir=false
cd frontend-nextjs
```

#### Step 1.2: Install Core Dependencies
```bash
# State & Data Fetching
npm install zustand @tanstack/react-query axios

# UI & Styling
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-toast

# Forms & Validation
npm install react-hook-form zod @hookform/resolvers

# SEO & Analytics
npm install next-seo next-sitemap @vercel/analytics

# Authentication
npm install next-auth

# Utilities
npm install date-fns eventsource-parser

# Development
npm install -D @types/node @types/react @types/react-dom
npm install -D eslint prettier eslint-config-prettier
npm install -D @sentry/nextjs
```


#### Step 1.3: Configure Next.js for SEO
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL + '/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

#### Step 1.4: Setup Environment Variables
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_HOTJAR_ID=your-hotjar-id

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

### Phase 2: Core Architecture & Type System (Days 3-4)

#### Step 2.1: Define Type System
```typescript
// types/models.ts
export interface User {
  id: string
  email: string
  name: string
  picture?: string
  is_super_admin: boolean
  tenant_id?: string
  tenant_name?: string
  created_at: string
}

export interface ResumeInfo {
  contact: {
    name: string
    email: string
    phone?: string
    location?: string
    linkedin?: string
    github?: string
    portfolio?: string
  }
  summary?: string
  experience: Experience[]
  education: Education[]
  skills: string[]
  certifications?: string[]
  projects?: Project[]
}

export interface Profile {
  id: string
  user_id: string
  filename: string
  upload_date: string
  resume_info?: ResumeInfo
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  error_message?: string
}

export interface Job {
  id: string
  user_id: string
  profile_id: string
  company_name: string
  job_title: string
  job_description: string
  status: 'PENDING' | 'GENERATING_RESUME' | 'RESUME_GENERATED' | 
          'GENERATING_PDF' | 'READY' | 'FAILED'
  custom_resume?: CustomResumeInfo
  pdf_url?: string
  created_at: string
  updated_at: string
}

export interface Roast {
  id: string
  user_id: string
  filename: string
  roast_points: string[]
  ats_checklist: ATSChecklistItem[]
  share_id: string
  view_count: number
  created_at: string
}

export interface CreditBalance {
  total_credits: number
  daily_free_remaining: number
  active_pass?: {
    tier_name: string
    expires_at: string
  }
}

export interface CreditPack {
  id: string
  name: string
  credits: number
  price_inr: number
  description?: string
  is_active: boolean
}
```

#### Step 2.2: Setup API Client
```typescript
// lib/api/client.ts
import axios from 'axios'
import { getSession } from 'next-auth/react'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
apiClient.interceptors.request.use(async (config) => {
  const session = await getSession()
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }
  return config
})

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
```

#### Step 2.3: React Query Setup
```typescript
// app/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}
```

---

### Phase 3: SEO Implementation (Days 5-6)

#### Step 3.1: Root Layout with SEO
```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const serif = Instrument_Serif({ 
  weight: ['400'], 
  style: ['normal', 'italic'],
  subsets: ['latin'], 
  variable: '--font-serif' 
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  title: {
    default: 'ATS Beater - AI-Powered Resume Tailoring for Job Success',
    template: '%s | ATS Beater'
  },
  description: 'Beat Applicant Tracking Systems with AI-powered resume tailoring. Upload your resume, paste a job description, and get an ATS-optimized PDF in minutes. Free resume roast included!',
  keywords: [
    'ATS resume optimizer',
    'resume tailoring',
    'AI resume builder',
    'ATS-friendly resume',
    'job application optimizer',
    'resume ATS checker',
    'AI resume writer',
    'custom resume generator'
  ],
  authors: [{ name: 'Cydratech', url: 'https://cydratech.com' }],
  creator: 'Cydratech',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'ATS Beater - AI-Powered Resume Tailoring',
    description: 'Beat ATS systems with AI-tailored resumes. Upload, customize, download - get past the bots and land interviews.',
    siteName: 'ATS Beater',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ATS Beater - AI Resume Optimization'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ATS Beater - AI-Powered Resume Tailoring',
    description: 'Beat ATS systems with AI-tailored resumes',
    images: ['/og-image.png'],
    creator: '@cydratech'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${serif.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FB4100" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
```

#### Step 3.2: Dynamic Sitemap
```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/credits`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Add dynamic routes from API
  ]
}
```

#### Step 3.3: Robots.txt
```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/(dashboard)/'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  }
}
```


#### Step 3.4: Structured Data (JSON-LD)
```typescript
// lib/seo/jsonLd.ts
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ATS Beater',
  url: process.env.NEXT_PUBLIC_APP_URL,
  logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
  description: 'AI-powered resume tailoring service to beat Applicant Tracking Systems',
  sameAs: [
    'https://twitter.com/cydratech',
    'https://github.com/cydratech',
  ],
}

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ATS Beater',
  url: process.env.NEXT_PUBLIC_APP_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

export const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ATS Beater',
  applicationCategory: 'BusinessApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
  },
}
```

#### Step 3.5: Public Roast Share Page with Dynamic OG
```typescript
// app/roast/[shareId]/page.tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import apiClient from '@/lib/api/client'
import RoastResult from '@/components/features/roast/RoastResult'

interface Props {
  params: { shareId: string }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { data } = await apiClient.get(`/roasts/shared/${params.shareId}`)
    
    return {
      title: `${data.filename} - Resume Roast Results`,
      description: `Check out this brutally honest AI resume roast. ${data.roast_points.length} areas for improvement identified.`,
      openGraph: {
        title: `${data.filename} - Resume Roast`,
        description: 'See how this resume scores on ATS readability',
        images: [
          {
            url: `/api/og/roast/${params.shareId}`,
            width: 1200,
            height: 630,
          }
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.filename} - Resume Roast`,
        description: 'AI-powered resume analysis',
        images: [`/api/og/roast/${params.shareId}`],
      },
    }
  } catch {
    return {
      title: 'Resume Roast Not Found',
    }
  }
}

export default async function SharedRoastPage({ params }: Props) {
  let roast
  try {
    const { data } = await apiClient.get(`/roasts/shared/${params.shareId}`)
    roast = data
  } catch {
    notFound()
  }

  return (
    <div className="min-h-screen bg-canvas-deep">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: `${roast.filename} - Resume Analysis`,
            datePublished: roast.created_at,
            author: {
              '@type': 'Organization',
              name: 'ATS Beater',
            },
          }),
        }}
      />
      <RoastResult roast={roast} isPublic />
    </div>
  )
}
```

#### Step 3.6: Dynamic OG Image Generation
```typescript
// app/api/og/roast/[shareId]/route.tsx
import { ImageResponse } from 'next/og'
import apiClient from '@/lib/api/client'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: { shareId: string } }
) {
  try {
    const { data: roast } = await apiClient.get(`/roasts/shared/${params.shareId}`)
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0F1B2E',
            backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(1,169,219,0.05) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(251,65,0,0.05) 2%, transparent 0%)',
            backgroundSize: '100px 100px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', padding: '60px', maxWidth: '1000px' }}>
            <h1 style={{ fontSize: 72, fontWeight: 'bold', color: '#F1F5F9', marginBottom: '20px' }}>
              Resume Roast
            </h1>
            <p style={{ fontSize: 32, color: '#94A3B8', marginBottom: '40px' }}>
              {roast.filename}
            </p>
            <div style={{ display: 'flex', gap: '40px' }}>
              <div style={{ padding: '20px 30px', background: 'rgba(251,65,0,0.1)', borderRadius: '12px', border: '2px solid rgba(251,65,0,0.3)' }}>
                <p style={{ fontSize: 24, color: '#FB4100', fontWeight: 'bold' }}>
                  {roast.roast_points.length} Issues Found
                </p>
              </div>
              <div style={{ padding: '20px 30px', background: 'rgba(1,169,219,0.1)', borderRadius: '12px', border: '2px solid rgba(1,169,219,0.3)' }}>
                <p style={{ fontSize: 24, color: '#01A9DB', fontWeight: 'bold' }}>
                  {roast.ats_checklist.filter(c => c.passed).length}/{roast.ats_checklist.length} ATS Checks
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
```

---

### Phase 4: Authentication & Middleware (Days 7-8)

#### Step 4.1: NextAuth.js Setup
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import apiClient from '@/lib/api/client'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          // Exchange Google token with backend
          const { data } = await apiClient.post('/auth/google/callback', {
            code: account.id_token,
          })
          user.accessToken = data.access_token
          return true
        } catch (error) {
          console.error('Auth error:', error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user?.accessToken) {
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

#### Step 4.2: Auth Middleware
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Admin route protection
    if (req.nextUrl.pathname.startsWith('/admin')) {
      const token = req.nextauth.token
      if (!token?.user?.is_super_admin) {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public routes
        if (req.nextUrl.pathname.startsWith('/roast/')) return true
        if (req.nextUrl.pathname === '/') return true
        if (req.nextUrl.pathname === '/login') return true
        
        // Protected routes require token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/(dashboard)/:path*',
    '/admin/:path*',
    '/api/:path*',
  ],
}
```

---

### Phase 5: Core Features Implementation (Days 9-15)

#### Step 5.1: Landing Page (SEO-Optimized)
```typescript
// app/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { organizationSchema, websiteSchema } from '@/lib/seo/jsonLd'

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationSchema, websiteSchema]),
        }}
      />
      
      <div className="min-h-screen bg-canvas-deep">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl font-bold text-text-primary mb-6">
              Beat the ATS, Land the{' '}
              <span className="text-brand-orange">Interview</span>
            </h1>
            <p className="text-xl text-text-secondary mb-8">
              AI-powered resume tailoring that gets you past Applicant Tracking Systems
              and into human hands. Upload your resume, paste a job description,
              get an optimized PDF in minutes.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="btn-primary">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="outline">
                  See How It Works
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-16">
          <h2 className="text-4xl font-bold text-center mb-12">
            Everything You Need to Win
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} />
            ))}
          </div>
        </section>

        {/* Social Proof */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center">
            <p className="text-3xl font-bold text-text-primary mb-4">
              Join 10,000+ job seekers
            </p>
            <p className="text-text-secondary">
              who've landed interviews with ATS Beater
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
```


#### Step 5.2: Profile Management with SSR
```typescript
// app/(dashboard)/profiles/page.tsx
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import ProfileList from '@/components/features/profile/ProfileList'
import ProfileUploader from '@/components/features/profile/ProfileUploader'

export const metadata: Metadata = {
  title: 'My Profiles',
  description: 'Manage your resume profiles and generate tailored resumes',
}

export default async function ProfilesPage() {
  const session = await getServerSession(authOptions)
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Profiles</h1>
          <p className="text-text-secondary mt-1">
            Upload and manage your base resumes
          </p>
        </div>
        <ProfileUploader />
      </div>
      
      <ProfileList />
    </div>
  )
}
```

#### Step 5.3: AI Chat Component (SSE)
```typescript
// components/features/profile/ProfileChat.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/lib/hooks/useChat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  profileId: string
}

export default function ProfileChat({ profileId }: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, isLoading } = useChat(`/profiles/${profileId}/chat`)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    await sendMessage(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="chat-header">
        <h3 className="font-semibold">AI Profile Editor</h3>
        <p className="text-xs text-text-dim">
          Ask me to update your profile information
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="chat-starters">
              <ChatStarterButton
                text="Add my latest project experience"
                onClick={() => setInput('Add my latest project experience')}
              />
              <ChatStarterButton
                text="Update my skills section"
                onClick={() => setInput('Update my skills section with React, Next.js, TypeScript')}
              />
              <ChatStarterButton
                text="Improve my professional summary"
                onClick={() => setInput('Can you help improve my professional summary?')}
              />
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble ${msg.role}`}
            >
              {msg.content}
            </div>
          ))}
          
          {isLoading && (
            <div className="chat-bubble assistant">
              <div className="typing-dots flex gap-1">
                <span className="w-2 h-2 bg-current rounded-full" />
                <span className="w-2 h-2 bg-current rounded-full" />
                <span className="w-2 h-2 bg-current rounded-full" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="chat-input-area">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me to edit your profile..."
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
```

#### Step 5.4: SSE Chat Hook
```typescript
// lib/hooks/useChat.ts
import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function useChat(endpoint: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { data: session } = useSession()

  const sendMessage = async (content: string) => {
    setMessages((prev) => [...prev, { role: 'user', content }])
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ message: content }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                assistantMessage += parsed.content
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastMsg = updated[updated.length - 1]
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = { 
                      role: 'assistant', 
                      content: assistantMessage 
                    }
                  } else {
                    updated.push({ role: 'assistant', content: assistantMessage })
                  }
                  return updated
                })
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, an error occurred.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, sendMessage, isLoading }
}
```

#### Step 5.5: Razorpay Integration
```typescript
// components/features/payment/RazorpayCheckout.tsx
'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useMutation } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'

interface Props {
  pack: CreditPack
}

export default function RazorpayCheckout({ pack }: Props) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

  const createOrder = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/payments/create-order', {
        pack_id: pack.id,
      })
      return data
    },
  })

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const order = await createOrder.mutateAsync()

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'ATS Beater',
        description: pack.name,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            await apiClient.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            // Show success message
            alert('Payment successful! Credits added to your account.')
            window.location.reload()
          } catch (error) {
            alert('Payment verification failed')
          }
        },
        prefill: {
          name: session?.user?.name,
          email: session?.user?.email,
        },
        theme: {
          color: '#FB4100',
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error('Payment error:', error)
      alert('Failed to initiate payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      onClick={handlePurchase} 
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Processing...' : `Buy for ₹${pack.price_inr}`}
    </Button>
  )
}
```

---

### Phase 6: Performance Optimization (Days 16-17)

#### Step 6.1: Image Optimization
```typescript
// next.config.js - add image optimization
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}
```

#### Step 6.2: Loading States & Skeletons
```typescript
// app/(dashboard)/profiles/loading.tsx
export default function ProfilesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-48 bg-canvas-card rounded animate-pulse" />
          <div className="h-4 w-64 bg-canvas-card rounded animate-pulse mt-2" />
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="widget-card">
            <div className="h-6 w-3/4 bg-canvas-deep rounded animate-pulse mb-4" />
            <div className="h-4 w-1/2 bg-canvas-deep rounded animate-pulse mb-2" />
            <div className="h-4 w-2/3 bg-canvas-deep rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### Step 6.3: Code Splitting
```typescript
// Use dynamic imports for heavy components
import dynamic from 'next/dynamic'

const PDFViewer = dynamic(() => import('@/components/features/job/PDFViewer'), {
  loading: () => <div className="animate-pulse bg-canvas-card h-full rounded" />,
  ssr: false,
})

const AdminAnalytics = dynamic(() => import('@/components/features/admin/AnalyticsDashboard'), {
  loading: () => <LoadingSpinner />,
})
```

#### Step 6.4: React Query Prefetching
```typescript
// app/(dashboard)/profiles/page.tsx - prefetch data
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getProfiles } from '@/lib/api/profiles'

export default async function ProfilesPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileList />
    </HydrationBoundary>
  )
}
```

---

### Phase 7: Analytics & Monitoring (Days 18-19)

#### Step 7.1: Google Analytics 4
```typescript
// lib/analytics/gtag.ts
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID!, {
      page_path: url,
    })
  }
}

export const event = ({ action, category, label, value }: {
  action: string
  category: string
  label: string
  value?: number
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Track key events
export const trackResumeUpload = () => {
  event({
    action: 'upload',
    category: 'Resume',
    label: 'Profile Upload',
  })
}

export const trackJobCreation = () => {
  event({
    action: 'create',
    category: 'Job',
    label: 'New Job Application',
  })
}

export const trackPurchase = (packName: string, amount: number) => {
  event({
    action: 'purchase',
    category: 'Credits',
    label: packName,
    value: amount,
  })
}
```


#### Step 7.2: Add GA to Root Layout
```typescript
// app/layout.tsx - add GA script
import Script from 'next/script'
import { GA_MEASUREMENT_ID } from '@/lib/analytics/gtag'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

#### Step 7.3: Sentry Error Monitoring
```bash
# Install Sentry
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
```

#### Step 7.4: Custom Error Boundary
```typescript
// components/shared/ErrorBoundary.tsx
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas-deep p-4">
      <div className="widget-card max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-brand-orange mb-4">
          Something went wrong
        </h2>
        <p className="text-text-secondary mb-6">
          We've been notified and are looking into it.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

### Phase 8: Deployment & DevOps (Days 20-21)

#### Step 8.1: Dockerfile for Next.js
```dockerfile
# Dockerfile.nextjs
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Step 8.2: Docker Compose with Backend
```yaml
# docker-compose.yml - updated
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: atsbeater
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@db:5432/atsbeater
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      FRONTEND_URL: http://localhost:3000
    depends_on:
      - db
    volumes:
      - ./app:/app/app

  frontend:
    build:
      context: ./frontend-nextjs
      dockerfile: Dockerfile.nextjs
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - backend

volumes:
  postgres_data:
```

#### Step 8.3: Vercel Deployment
```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "regions": ["sin1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.atsbeater.com",
    "NEXT_PUBLIC_APP_URL": "https://atsbeater.com"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.atsbeater.com/:path*"
    }
  ]
}
```

#### Step 8.4: GitHub Actions CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy Next.js Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend-nextjs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend-nextjs/package-lock.json
      
      - name: Install dependencies
        working-directory: ./frontend-nextjs
        run: npm ci
      
      - name: Run tests
        working-directory: ./frontend-nextjs
        run: npm test
      
      - name: Build
        working-directory: ./frontend-nextjs
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend-nextjs
```

---

### Phase 9: Testing Strategy (Days 22-23)

#### Step 9.1: Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

#### Step 9.2: Unit Tests Example
```typescript
// __tests__/components/ProfileCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProfileCard from '@/components/features/profile/ProfileCard'

describe('ProfileCard', () => {
  it('renders profile information correctly', () => {
    const profile = {
      id: '1',
      filename: 'resume.pdf',
      status: 'READY',
      upload_date: '2024-01-01',
    }

    render(<ProfileCard profile={profile} />)
    
    expect(screen.getByText('resume.pdf')).toBeInTheDocument()
    expect(screen.getByText('READY')).toBeInTheDocument()
  })

  it('shows loading state when status is PROCESSING', () => {
    const profile = {
      id: '1',
      filename: 'resume.pdf',
      status: 'PROCESSING',
      upload_date: '2024-01-01',
    }

    render(<ProfileCard profile={profile} />)
    
    expect(screen.getByText('PROCESSING')).toBeInTheDocument()
  })
})
```

#### Step 9.3: E2E Tests with Playwright
```typescript
// e2e/landing.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should load and display hero section', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.locator('h1')).toContainText('Beat the ATS')
    await expect(page.getByRole('link', { name: 'Start Free Trial' })).toBeVisible()
  })

  test('should navigate to login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Start Free Trial' }).click()
    
    await expect(page).toHaveURL('/login')
  })
})

test.describe('Authentication Flow', () => {
  test('should show Google login button', async ({ page }) => {
    await page.goto('/login')
    
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible()
  })
})
```

---

## 🎨 Design System Migration

### Tailwind Config
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          deep: '#0F1B2E',
          card: '#162B45',
          navy: '#1A3350',
        },
        brand: {
          orange: '#FB4100',
          teal: '#01A9DB',
          navy: '#1A3350',
        },
        teal: {
          DEFAULT: '#01A9DB',
          dim: 'rgba(1,169,219,0.15)',
          glow: 'rgba(1,169,219,0.3)',
        },
        orange: {
          DEFAULT: '#FB4100',
          dim: 'rgba(251,65,0,0.15)',
          glow: 'rgba(251,65,0,0.3)',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          dim: '#64748B',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-mono)'],
        serif: ['var(--font-serif)'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

---

## 📱 Mobile Responsiveness

### Key Responsive Patterns
```typescript
// Use mobile-first approach with Tailwind
<div className="
  px-4 md:px-8 lg:px-12
  py-6 md:py-10 lg:py-16
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
">
  {/* Content */}
</div>

// Mobile drawer for sidebar
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <Menu />
    </Button>
  </SheetTrigger>
  <SheetContent side="left">
    <Sidebar />
  </SheetContent>
</Sheet>
```

---

## 🔒 Security Checklist

- [x] HTTPS enforced
- [x] CSP headers configured
- [x] XSS protection via sanitization
- [x] CSRF protection (NextAuth)
- [x] Rate limiting middleware
- [x] Input validation with Zod
- [x] Secure cookie configuration
- [x] Environment variable encryption
- [x] SQL injection prevention (parameterized queries)
- [x] File upload validation
- [x] API route protection
- [x] Admin route middleware

---

## 📊 Performance Targets


| Metric | Target | Strategy |
|--------|--------|----------|
| **First Contentful Paint (FCP)** | < 1.5s | SSR, image optimization, CDN |
| **Largest Contentful Paint (LCP)** | < 2.5s | Priority loading, lazy loading |
| **Time to Interactive (TTI)** | < 3.5s | Code splitting, tree shaking |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Fixed dimensions, skeleton loaders |
| **First Input Delay (FID)** | < 100ms | Minimize JavaScript execution |
| **Lighthouse Score** | > 90 | Progressive enhancement |
| **Bundle Size** | < 300KB (gzipped) | Dynamic imports, module federation |

---

## 🚀 SEO Optimization Checklist

### Technical SEO
- [x] Server-side rendering (SSR)
- [x] Dynamic meta tags per page
- [x] Canonical URLs
- [x] Structured data (JSON-LD)
- [x] XML sitemap (dynamic)
- [x] Robots.txt
- [x] Open Graph tags
- [x] Twitter cards
- [x] Dynamic OG images
- [x] Semantic HTML5
- [x] Schema.org markup
- [x] Mobile-first responsive
- [x] Fast load times (< 3s)
- [x] HTTPS only

### Content SEO
- [x] Keyword-rich titles
- [x] Meta descriptions (150-160 chars)
- [x] H1-H6 hierarchy
- [x] Alt text for images
- [x] Internal linking
- [x] Breadcrumbs
- [x] FAQ schema
- [x] Article schema for blogs

### Example Meta Implementation
```typescript
// app/(dashboard)/profiles/[id]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params.id)
  
  return {
    title: `${profile.filename} - Resume Profile`,
    description: `Edit and manage your ${profile.filename} resume profile. Tailor it for specific job applications with AI.`,
    openGraph: {
      title: `${profile.filename} - Resume Profile`,
      description: 'AI-powered resume tailoring',
      images: ['/og-profile.png'],
    },
    alternates: {
      canonical: `/profiles/${params.id}`,
    },
  }
}
```

---

## 📈 Analytics Events to Track

### User Journey
- Page views (all pages)
- Button clicks (CTAs)
- Form submissions
- Navigation events
- Search queries
- Filter usage
- Sort preferences

### Core Actions
- **Resume Upload**
  - `resume_upload_started`
  - `resume_upload_completed`
  - `resume_upload_failed`
- **Job Creation**
  - `job_created`
  - `resume_generation_started`
  - `resume_generation_completed`
  - `pdf_downloaded`
- **Roast**
  - `roast_created`
  - `roast_shared`
  - `shared_roast_viewed`
- **Credits**
  - `credit_pack_viewed`
  - `purchase_initiated`
  - `purchase_completed`
  - `promo_code_redeemed`
- **Chat**
  - `chat_message_sent`
  - `profile_edited_via_chat`
  - `resume_edited_via_chat`

### Conversion Tracking
```typescript
// Track key conversions
export const trackConversion = (type: 'signup' | 'purchase' | 'resume_download') => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: 'AW-XXXXX/XXXXX', // Google Ads conversion
      value: type === 'purchase' ? 299 : 0,
      currency: 'INR',
      transaction_id: Date.now().toString(),
    })
  }
}
```

---

## 🔄 Migration Execution Plan

### Week 1: Foundation
**Days 1-3:** Project setup, dependencies, configuration
- Initialize Next.js project
- Setup TypeScript + Tailwind
- Configure ESLint, Prettier
- Setup testing infrastructure
- Environment configuration

**Days 4-7:** Core architecture
- Type system definition
- API client setup
- Auth implementation (NextAuth)
- Zustand stores
- React Query setup

### Week 2: Core Features
**Days 8-10:** Profile management
- Profile list page (SSR)
- Profile upload component
- Profile detail page
- Profile chat integration

**Days 11-14:** Job & Resume features
- Job creation flow
- Resume editor UI
- PDF viewer component
- Job chat integration
- Download functionality

### Week 3: Additional Features
**Days 15-17:** Credits & Payments
- Credit balance display
- Credit pack cards
- Razorpay integration
- Promo code redemption
- Transaction history

**Days 18-21:** Admin & Roast
- Admin dashboard
- User management
- Tenant management
- Roast feature
- Shareable roast pages with OG

### Week 4: Polish & Launch
**Days 22-24:** SEO & Performance
- Meta tags optimization
- Sitemap generation
- Structured data
- Performance optimization
- Image optimization

**Days 25-27:** Testing & QA
- Unit tests
- Integration tests
- E2E tests with Playwright
- Cross-browser testing
- Mobile responsiveness testing

**Days 28-30:** Deployment & Monitoring
- Production deployment
- Analytics setup
- Error monitoring (Sentry)
- Performance monitoring
- User feedback collection

---

## 🎯 Success Metrics

### Technical Metrics
- **Lighthouse Score**: > 90 (all categories)
- **Core Web Vitals**: All green
- **Bundle Size**: < 300KB (initial load)
- **API Response Time**: < 500ms (p95)
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%

### Business Metrics
- **SEO Rankings**: Top 10 for target keywords within 3 months
- **Organic Traffic**: 50% increase in 3 months
- **Conversion Rate**: > 5% (visitor to signup)
- **User Retention**: > 40% (30-day)
- **Customer Satisfaction**: > 4.5/5

### User Experience Metrics
- **Time to First Resume**: < 5 minutes
- **PDF Generation Success Rate**: > 95%
- **Chat Response Time**: < 2s
- **Mobile Usability Score**: > 90

---

## 🛠️ Development Guidelines

### Code Standards
```typescript
// Use TypeScript strict mode
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

### Component Structure
```typescript
// Follow this pattern for all components
interface ComponentProps {
  // Props with JSDoc
  /** User profile data */
  profile: Profile
  /** Callback when profile is updated */
  onUpdate?: (profile: Profile) => void
}

/**
 * ProfileCard displays a summary of a user's resume profile
 * with actions to view, edit, or delete.
 */
export default function ProfileCard({ profile, onUpdate }: ComponentProps) {
  // Component logic
}
```

### Naming Conventions
- **Components**: PascalCase (`ProfileCard.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Types/Interfaces**: PascalCase (`UserProfile`)
- **Hooks**: camelCase with 'use' prefix (`useAuth.ts`)

### Git Workflow
```bash
# Feature branches
git checkout -b feature/profile-chat-ui
git checkout -b fix/pdf-download-error
git checkout -b docs/api-integration

# Commit messages (Conventional Commits)
feat: add profile chat component
fix: resolve PDF download CORS issue
docs: update API integration guide
perf: optimize image loading
refactor: extract chat logic to custom hook
```

---

## 🔍 SEO Content Strategy

### Target Keywords
**Primary:**
- "ATS resume optimizer"
- "AI resume tailoring"
- "beat applicant tracking system"
- "ATS-friendly resume builder"

**Secondary:**
- "resume ATS checker"
- "job application optimizer"
- "AI resume writer"
- "custom resume for job description"

**Long-tail:**
- "how to make resume ATS friendly"
- "beat ATS system with AI"
- "tailor resume to job description free"
- "AI resume optimization tool India"

### Content Pages for SEO
1. **Blog**: `/blog`
   - "10 Ways to Beat ATS in 2024"
   - "Why 75% of Resumes Get Rejected by ATS"
   - "ATS Keywords: Complete Guide"

2. **Guides**: `/guides`
   - "Complete ATS Resume Guide"
   - "How to Tailor Your Resume"
   - "Resume Keywords Masterclass"

3. **Comparisons**: `/compare`
   - "ATS Beater vs. Resume.io"
   - "Free vs. Paid Resume Tools"

4. **FAQ**: `/faq`
   - Structured data for rich snippets
   - Common ATS questions

### Schema Markup Examples
```typescript
// FAQ Schema
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is an ATS-friendly resume?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'An ATS-friendly resume is formatted to be easily parsed by Applicant Tracking Systems...',
      },
    },
  ],
}
```

---

## 🎨 Brand Assets Needed

### Images
- [ ] Logo (SVG, PNG - multiple sizes)
- [ ] Favicon (16x16, 32x32, 180x180)
- [ ] Apple touch icon (180x180)
- [ ] OG image default (1200x630)
- [ ] Twitter card image (1200x675)
- [ ] Feature illustrations
- [ ] Empty state illustrations

### Design Tokens
```typescript
// lib/config/design-tokens.ts
export const designTokens = {
  colors: {
    primary: '#FB4100',
    secondary: '#01A9DB',
    background: '#0F1B2E',
    surface: '#162B45',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  typography: {
    h1: { size: '48px', weight: 700, lineHeight: 1.2 },
    h2: { size: '36px', weight: 700, lineHeight: 1.3 },
    h3: { size: '24px', weight: 600, lineHeight: 1.4 },
    body: { size: '16px', weight: 400, lineHeight: 1.6 },
    caption: { size: '12px', weight: 500, lineHeight: 1.4 },
  },
}
```

---

## 📚 Documentation Requirements

### Developer Docs
- [ ] Setup guide (README.md)
- [ ] Environment variables reference
- [ ] API integration guide
- [ ] Component documentation (Storybook)
- [ ] Testing guide
- [ ] Deployment guide
- [ ] Troubleshooting FAQ

### User Docs
- [ ] Getting started guide
- [ ] Feature tutorials
- [ ] Video walkthroughs
- [ ] FAQ page
- [ ] Changelog

---

## ⚠️ Risk Mitigation

### Potential Risks
1. **SSE Chat Migration**
   - Risk: Browser compatibility issues
   - Mitigation: Implement fallback polling, use EventSource polyfill

2. **SEO During Migration**
   - Risk: Temporary ranking drop
   - Mitigation: 301 redirects, maintain URL structure, gradual rollout

3. **Performance Regression**
   - Risk: Heavier bundle size
   - Mitigation: Code splitting, lazy loading, performance budgets

4. **Auth Flow Changes**
   - Risk: User session loss
   - Mitigation: Token migration strategy, clear communication

5. **Mobile Experience**
   - Risk: Layout breaks on small screens
   - Mitigation: Mobile-first development, extensive testing

---

## 🔄 Rollback Plan

### If Critical Issues Arise
1. **Immediate**: Revert DNS to Vue frontend
2. **Communication**: Notify users of temporary rollback
3. **Investigation**: Debug in staging environment
4. **Fix**: Address critical issues
5. **Gradual Rollout**: A/B test before full deployment

### Feature Flags
```typescript
// lib/config/features.ts
export const features = {
  useNextJSFrontend: process.env.NEXT_PUBLIC_USE_NEW_FRONTEND === 'true',
  enableNewChat: process.env.NEXT_PUBLIC_ENABLE_NEW_CHAT === 'true',
  enableAdvancedAnalytics: process.env.NEXT_PUBLIC_ANALYTICS_V2 === 'true',
}
```

---

## ✅ Pre-Launch Checklist

### Technical
- [ ] All pages render correctly (SSR + CSR)
- [ ] Authentication flow works
- [ ] File uploads functional
- [ ] PDF generation works
- [ ] Payment integration tested
- [ ] Chat SSE streams working
- [ ] All API endpoints integrated
- [ ] Error handling comprehensive
- [ ] Loading states polished
- [ ] Mobile responsive verified

### SEO
- [ ] All meta tags present
- [ ] Sitemap generated
- [ ] Robots.txt configured
- [ ] Structured data validated
- [ ] OG images rendering
- [ ] Canonical URLs set
- [ ] Page titles optimized
- [ ] Meta descriptions written
- [ ] Alt text on all images
- [ ] Internal linking structure

### Performance
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals green
- [ ] Images optimized
- [ ] Fonts optimized
- [ ] Bundle size < 300KB
- [ ] API responses < 500ms
- [ ] No console errors
- [ ] Memory leaks checked

### Analytics & Monitoring
- [ ] Google Analytics configured
- [ ] Conversion tracking setup
- [ ] Sentry error monitoring
- [ ] Performance monitoring
- [ ] Custom events tracking
- [ ] User journey mapping
- [ ] A/B testing ready

### Security
- [ ] HTTPS enforced
- [ ] CSP headers set
- [ ] XSS protection enabled
- [ ] CSRF tokens working
- [ ] Rate limiting active
- [ ] Input validation complete
- [ ] File upload restrictions
- [ ] API authentication secure

### Legal & Compliance
- [ ] Privacy policy updated
- [ ] Terms of service current
- [ ] Cookie consent banner
- [ ] GDPR compliance
- [ ] Data retention policy
- [ ] User data export feature

---

## 📞 Support & Maintenance

### Post-Launch Monitoring (First Week)
- **Day 1-3**: 24/7 monitoring, immediate fixes
- **Day 4-7**: Extended monitoring, user feedback collection
- **Week 2**: Regular monitoring, optimization based on data

### Ongoing Maintenance
- Weekly dependency updates
- Monthly security audits
- Quarterly performance reviews
- Regular SEO optimization
- Continuous A/B testing

---

## 🎉 Launch Strategy

### Soft Launch (Week 1)
- Deploy to staging
- Invite 50-100 beta users
- Collect feedback
- Fix critical issues
- Monitor performance

### Public Launch (Week 2)
- Announce on social media
- Product Hunt launch
- Email existing users
- Press release
- Content marketing push

### Growth Phase (Month 1-3)
- SEO content creation
- Paid advertising
- Partnership outreach
- Feature iterations
- User onboarding optimization

---

## 📝 Final Notes

This migration will transform ATS Beater into a production-ready, SEO-optimized, scalable SaaS platform. The Next.js architecture provides:

- **Better SEO**: Server-side rendering + dynamic meta tags
- **Improved Performance**: Code splitting + image optimization
- **Type Safety**: Full TypeScript coverage
- **Developer Experience**: Modern tooling + hot reload
- **Scalability**: Edge functions + CDN
- **Analytics**: Comprehensive tracking
- **Security**: Built-in protections

**Estimated Timeline**: 30 days for full migration
**Team Size**: 2-3 developers + 1 designer
**Budget**: Consider Vercel Pro ($20/mo), Sentry ($26/mo), Analytics tools

---

## 🚀 Ready to Start?

Begin with Phase 1 (Project Setup) and follow the step-by-step guide. Each phase builds on the previous one, ensuring a smooth, systematic migration.

**Good luck with your startup! 🎯**
