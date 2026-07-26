'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { authApi } from '@/lib/api/endpoints';
import SiteFooter from '@/components/marketing/SiteFooter';
import { loadGuestProfileSession } from '@/lib/guestProfile';
import { ScoreRing, formatStat, iconProps, type WallStats } from '@/components/landing/ui';
import { UPLOAD_HIGHLIGHTS, PLATFORM_CATEGORIES } from '@/components/landing/staticData';
import { HOMEPAGE_HIGHLIGHTS, COMPANY } from '@/lib/marketing/content';
import LandingFeaturesGrid from '@/components/landing/LandingFeaturesGrid';
import LandingNav from '@/components/landing/sections/LandingNav';
import GuestResumeUpload from '@/components/GuestResumeUpload';
import LandingFaqSection from '@/components/landing/sections/LandingFaqSection';
import LandingPricingSection from '@/components/landing/sections/LandingPricingSection';
import {
  LandingComparisonSection,
  LandingCtaSection,
  LandingPersonasSection,
  LandingTestimonialsSection,
  LandingTrustSection,
} from '@/components/landing/sections/LandingSocialSections';

const HeroCardsShowcase = dynamic(() => import('@/components/HeroCardsShowcase'), {
  loading: () => <div className="hero-cards-wrap" style={{ minHeight: 420 }} />,
});

type Accent = { color: string; soft: string };

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [wallStats, setWallStats] = useState<WallStats | null>(null);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const next = window.scrollY > 10;
        setScrolled((prev) => (prev === next ? prev : next));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToHash = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    const revealVisible = (node: Element) => {
      node.classList.add('visible');
    };

    const nodes = document.querySelectorAll('.lp-root .reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealVisible(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );

    nodes.forEach((node) => io.observe(node));

    const fallback = window.setTimeout(() => {
      nodes.forEach((node) => revealVisible(node));
    }, 1200);

    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    fetch('/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setWallStats(data); })
      .catch(() => {});
  }, []);

  const uploadSectionRef = useRef<HTMLDivElement>(null);

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setMobileOpen(false);
  };

  const handleLogin = async (guestToken?: string) => {
    try {
      const ref = typeof window !== 'undefined'
        ? sessionStorage.getItem('signup_referral_code') || undefined
        : undefined;
      const token = guestToken || loadGuestProfileSession()?.guestToken;
      const res = await authApi.getGoogleLoginUrl(ref, token);
      window.location.href = res.data.url;
    } catch {
      window.location.href = '/login?guest=1';
    }
  };

  const heroStats = [
    {
      val: wallStats ? formatStat(wallStats.total_resumes_tailored) : '10k+',
      label: 'Resumes Tailored',
      color: '#0F172A',
    },
    {
      val: wallStats?.has_improvement_data && wallStats.avg_ats_score_improvement != null
        ? `+${Math.round(wallStats.avg_ats_score_improvement)}%`
        : '+32%',
      label: 'ATS Score Lift',
      color: '#ff5a1f',
    },
    {
      val: '< 60s',
      label: 'Generation Time',
      color: '#10b981',
    },
  ];

  const uploadHighlights = UPLOAD_HIGHLIGHTS;

  const honestPillars = [
    {
      title: 'No fabricated skills',
      desc: 'Keywords mirror your profile only — never invents Okta, SAML, or metrics you don\'t have.',
      accent: '#6366f1',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
      ),
    },
    {
      title: 'Fit Score before you spend',
      desc: 'Strong · Stretch · Mismatch labels with red gaps — know when a role is a stretch before applying.',
      accent: '#ff5a1f',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
      ),
    },
    {
      title: 'End-to-end, not one PDF',
      desc: 'Structure once → tailor → edit → outreach → cover letter → interview prep → track until offer.',
      accent: '#34d399',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
      ),
    },
  ];

  const platformCategories = PLATFORM_CATEGORIES.map((cat, i) => ({
    title: cat.title,
    accent: ['#ff5a1f', '#38bdf8', '#fbbf24', '#6366f1'][i],
    icon: ['◉', '✎', '→', '▦'][i],
    items: cat.items.map((name) => ({
      name,
      ...(name.toLowerCase().includes('free') ? { badge: 'Free' as const } : {}),
    })),
  }));

  const statsBand = [
    {
      val: wallStats ? formatStat(wallStats.total_resumes_tailored) : '10k+',
      label: 'Resumes Tailored',
      color: '#0F172A',
    },
    {
      val: wallStats?.has_improvement_data && wallStats.avg_ats_score_improvement != null
        ? `+${Math.round(wallStats.avg_ats_score_improvement)}%`
        : '+32%',
      label: 'Avg ATS Score Lift',
      color: '#ff5a1f',
    },
    {
      val: '< 60s',
      label: 'Generation Time',
      color: '#34d399',
    },
    {
      val: wallStats ? formatStat(wallStats.total_roasts_completed) : '5k+',
      label: 'Resumes Roasted',
      color: '#38bdf8',
    },
  ];

  const howItWorks: { n: string; title: string; desc: string; accent: Accent; icon: ReactNode; preview: ReactNode }[] = [
    {
      n: '01',
      title: 'Upload Your Resume',
      desc: 'Drop your PDF or DOCX — we parse experience, skills, and achievements into a structured profile in seconds.',
      accent: { color: '#38bdf8', soft: 'rgba(56,189,248,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
      ),
      preview: (
        <div className="hiw-preview hiw-preview--upload">
          <div className="hiw-preview-bar"><span className="hiw-preview-dot" style={{ background: '#38bdf8' }} />resume.pdf · 842 KB</div>
          <div className="hiw-preview-body">
            <div className="hiw-upload-zone">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              <span>Drop PDF/DOCX or click to upload</span>
            </div>
            <div className="hiw-parse-lines">
              <div className="hiw-parse-line" style={{ width: '88%' }} />
              <div className="hiw-parse-line" style={{ width: '72%' }} />
              <div className="hiw-parse-line" style={{ width: '94%' }} />
            </div>
          </div>
        </div>
      ),
    },
    {
      n: '02',
      title: 'Paste Job Description',
      desc: 'Paste any job posting. AI extracts must-have keywords, skills, and ATS filters automatically.',
      accent: { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 14l2 2 4-4" /></svg>
      ),
      preview: (
        <div className="hiw-preview hiw-preview--jd">
          <div className="hiw-preview-bar"><span className="hiw-preview-dot" style={{ background: '#fbbf24' }} />Senior React Developer · Stripe</div>
          <div className="hiw-preview-body">
            <p className="hiw-jd-text">Looking for <mark>React</mark>, <mark>TypeScript</mark>, and <mark>Node.js</mark> experience with scalable systems…</p>
            <div className="hiw-keyword-chips">
              {['React', 'TypeScript', 'Node.js', 'AWS'].map((kw) => (
                <span key={kw} className="hiw-kw-chip">{kw}</span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      n: '03',
      title: 'Download Perfect PDF',
      desc: 'Get a LaTeX-precision PDF tailored to the role — ATS-ready and polished for human reviewers.',
      accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      ),
      preview: (
        <div className="hiw-preview hiw-preview--pdf">
          <div className="hiw-preview-bar"><span className="hiw-preview-dot" style={{ background: '#34d399' }} />tailored-resume.pdf</div>
          <div className="hiw-preview-body hiw-pdf-body">
            <div className="hiw-pdf-page">
              <div className="hiw-pdf-line hiw-pdf-line--title" />
              <div className="hiw-pdf-line" style={{ width: '60%' }} />
              <div className="hiw-pdf-line" style={{ width: '85%' }} />
              <div className="hiw-pdf-line" style={{ width: '70%' }} />
            </div>
            <div className="hiw-score-badge">
              <span className="hiw-score-val">94%</span>
              <span className="hiw-score-label">ATS Match</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="lp-root">
      <div className="lp-fx" aria-hidden>
        <div className="dot-grid" />
        <div className="ambient-orb ambient-orb--a" />
        <div className="ambient-orb ambient-orb--b" />
        <div className="ambient-orb ambient-orb--c" />
      </div>

      <LandingNav
        scrolled={scrolled}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen(!mobileOpen)}
        onScrollToHash={scrollToHash}
      />

      {/* ======= HERO ======= */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 108, paddingBottom: 48, overflow: 'hidden' }}>
        <div className="hero-grid" />
        <div className="hero-mesh" aria-hidden />

        <div className="lp-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <div className="fade-slide-in">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 10px', borderRadius: 100, background: 'linear-gradient(135deg,rgba(255,90,31,0.14),rgba(251,191,36,0.06))', border: '1px solid rgba(255,90,31,0.28)', marginBottom: 28, userSelect: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.813 15.904L9 21l8.982-11.795H14.18l.818-5.096L6 16l3.813-.096z" />
                </svg>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#ff5a1f', letterSpacing: '0.6px' }}>AI-Powered Resume Tailoring</span>
              </div>

              <h1 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(42px,5vw,72px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.03em', marginBottom: 22 }}>
                <span style={{ display: 'block', color: '#ff5a1f' }}>Every job</span>
                <span style={{ display: 'block', background: 'linear-gradient(180deg,#0F172A 30%,#334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  deserves its own resume.
                </span>
              </h1>

              <p style={{ fontSize: 17, lineHeight: 1.78, color: '#475569', maxWidth: 520, marginBottom: 16 }}>
                Twerz turns one profile into role-perfect PDFs — upload your resume, paste a job description, and get an ATS-optimized, LaTeX-grade tailored resume in under 60 seconds.
              </p>

              <p style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: '#64748b',
                maxWidth: 520,
                marginBottom: 24,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(255,90,31,0.06), rgba(251,191,36,0.04))',
                border: '1px solid rgba(255,90,31,0.18)',
              }}>
                <span style={{ fontWeight: 600, color: '#ff5a1f' }}>Zero fabricated skills.</span>{' '}
                {COMPANY.honestyCallout}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                <button onClick={scrollToUpload}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg, #ff5a1f, #ff7043)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 24px rgba(255,90,31,0.35)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 32px rgba(255,90,31,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 24px rgba(255,90,31,0.35)'; }}>
                  Start Free Now
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <a href="#platform"
                  onClick={(e) => scrollToHash(e, '#platform')}
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 28px', borderRadius: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#0F172A', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease', textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F1F5F9'; }}>
                  See Platform
                </a>
              </div>

              <div className="hero-stats-row">
                {heroStats.map((stat, idx) => (
                  <div key={stat.label} className="hero-stat-item">
                    {idx > 0 && <div className="hero-stat-divider" aria-hidden />}
                    <div className="hero-stat-val" style={{ color: stat.color }}>{stat.val}</div>
                    <div className="hero-stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <HeroCardsShowcase />
          </div>
        </div>
      </section>

      {/* ======= STATS BAND ======= */}
      <section className="lp-stats-band reveal">
        <div className="lp-container">
          <p className="lp-stats-intro reveal">Trusted by job seekers tailoring at scale</p>
          <div className="lp-stats-grid">
            {statsBand.map((s) => (
              <div key={s.label} className="lp-stat-item">
                <div className="lp-stat-val" style={{ color: s.color }}>{s.val}</div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= HONEST AI ======= */}
      <section className="lp-section-honest reveal">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Why Twerz</div>
            <h2 className="lp-section-title reveal reveal-d1">AI that won&apos;t lie on your resume.</h2>
            <p className="lp-section-sub reveal reveal-d2">Generic AI invents skills. Templates ignore the job. Twerz only amplifies what you actually have.</p>
          </div>
          <div className="honest-pillars-grid">
            {honestPillars.map((p, i) => (
              <article
                key={p.title}
                className={`honest-pillar reveal reveal-d${i + 1}`}
                style={{ '--accent': p.accent } as CSSProperties}
              >
                <div className="honest-pillar-icon">{p.icon}</div>
                <h3 className="honest-pillar-title">{p.title}</h3>
                <p className="honest-pillar-desc">{p.desc}</p>
              </article>
            ))}
          </div>
          <div className="honest-score-visual reveal reveal-d3">
            <div className="honest-score-compare">
              <div className="honest-score-item">
                <div className="honest-score-ring">
                  <ScoreRing score={62} color="#fb7185" />
                  <span className="honest-score-val honest-score-val--before">62</span>
                </div>
                <span className="honest-score-label">Before</span>
              </div>
              <span className="honest-score-arrow" aria-hidden>→</span>
              <div className="honest-score-item">
                <div className="honest-score-ring">
                  <ScoreRing score={94} color="#10b981" />
                  <span className="honest-score-val honest-score-val--after">94</span>
                </div>
                <span className="honest-score-label honest-score-label--stack">
                  <span>After</span>
                  <span>Twerz</span>
                </span>
              </div>
            </div>
            <div className="honest-score-copy">
              <p className="honest-score-copy-title">Average ATS lift</p>
              <p className="honest-score-copy-desc">Real keywords from your experience — never stuffed, never fabricated.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======= TRY IT — GUEST UPLOAD ======= */}
      <section id="upload-resume" ref={uploadSectionRef} className="lp-section lp-section-upload reveal">
        <div className="lp-container">
          <div className="lp-section-head reveal">
            <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> Get Started</div>
            <h2 className="lp-section-title reveal reveal-d1">Try it now — upload once, tailor forever.</h2>
            <p className="lp-section-sub reveal reveal-d2">
              Paste a job description and get an ATS-optimized, honestly tailored PDF — with fit score, keyword matching, and LaTeX-quality formatting.
            </p>
          </div>
          <div className="upload-section-grid">
            <div className="upload-highlight-bento reveal reveal-d1">
              {uploadHighlights.map((h) => (
                <div
                  key={h.title}
                  className="upload-highlight-card"
                  style={{ '--accent': h.accent } as CSSProperties}
                >
                  <div className="upload-highlight-icon">{h.icon}</div>
                  <div className="upload-highlight-title">{h.title}</div>
                  <div className="upload-highlight-desc">{h.desc}</div>
                </div>
              ))}
            </div>
            <div className="upload-section-panel reveal reveal-d2">
              <GuestResumeUpload variant="section" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= HOW IT WORKS ======= */}
      <section id="how-it-works" className="lp-section lp-section-hiw">
        <div className="lp-container">
          <div className="lp-section-head reveal">
            <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> How It Works</div>
            <h2 className="lp-section-title reveal reveal-d1">From PDF to interview-ready in three steps.</h2>
            <p className="lp-section-sub reveal reveal-d2">The same flow thousands of job seekers use every day on resume.twerz.</p>
          </div>

          <div className="hiw-flow">
            {howItWorks.map((step, i) => (
              <div key={step.n} className="hiw-flow-item">
                <article
                  className="hiw-step-card"
                  style={{ '--accent': step.accent.color, '--accent-soft': step.accent.soft } as CSSProperties}
                >
                  <div className="hiw-step-header">
                    <div className="hiw-step-badge">{step.n}</div>
                    <div className="hiw-step-icon">{step.icon}</div>
                  </div>
                  <h3 className="hiw-step-title">{step.title}</h3>
                  <p className="hiw-step-desc">{step.desc}</p>
                  {step.preview}
                </article>
                {i < howItWorks.length - 1 && (
                  <div className="hiw-connector" aria-hidden>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= FEATURES (curated highlights — full 33-feature list lives on /features) ======= */}
      <section id="features" className="lp-section lp-section-features">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Why it&apos;s different</div>
            <h2 className="lp-section-title reveal reveal-d1">The one thing every other AI resume tool gets wrong.</h2>
            <p className="lp-section-sub reveal reveal-d2">Hallucinated skills and generic bullets are the #1 complaint about AI resume builders. Here&apos;s how Twerz avoids both.</p>
          </div>

          <LandingFeaturesGrid features={HOMEPAGE_HIGHLIGHTS} />

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
            <a href="/features" className="lp-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderRadius: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#0F172A', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              See all 33 features
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ======= PLATFORM ======= */}
      <section id="platform" className="lp-section lp-section-platform">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Platform</div>
            <h2 className="lp-section-title reveal reveal-d1">The complete job-hunt workspace.</h2>
            <p className="lp-section-sub reveal reveal-d2">Everything from fit analysis to offer tracking — one profile, every application.</p>
          </div>
          <div className="platform-grid reveal reveal-d2">
            {platformCategories.map((cat) => (
              <article
                key={cat.title}
                className="platform-category"
                style={{ '--accent': cat.accent } as CSSProperties}
              >
                <div className="platform-category-head">
                  <div className="platform-category-icon">{cat.icon}</div>
                  <h3 className="platform-category-title">{cat.title}</h3>
                </div>
                <ul className="platform-feature-list">
                  {cat.items.map((item) => (
                    <li key={item.name}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span>{item.name}</span>
                      {'badge' in item && item.badge && <span className="platform-badge">{item.badge}</span>}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingComparisonSection />
      <LandingTestimonialsSection />
      <LandingPersonasSection />
      <LandingTrustSection />
      <LandingPricingSection onGetStarted={() => handleLogin()} />
      <LandingFaqSection openFaq={openFaq} onToggle={(i) => setOpenFaq(openFaq === i ? null : i)} />
      <LandingCtaSection onGetStarted={() => handleLogin()} />

      <SiteFooter />
    </div>
  );
}
