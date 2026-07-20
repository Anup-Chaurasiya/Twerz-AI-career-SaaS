'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { authApi } from '@/lib/api/endpoints';

type Accent = { color: string; soft: string };

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('public-page');
    // Never set body.style.overflow — inline overflow:auto overrides CSS and
    // allows horizontal drag-scroll (content slides off to the right).
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow-x');
    document.body.style.removeProperty('overflow-y');
    document.documentElement.style.removeProperty('overflow-x');

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
    return () => {
      document.body.classList.remove('public-page');
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await authApi.getGoogleLoginUrl();
      window.location.href = res.data.url;
    } catch {
      window.location.href = '/login';
    }
  };

  const faqs = [
    { q: 'What is an ATS?', a: 'An Applicant Tracking System (ATS) is software used by employers to filter resumes before a human ever sees them. Up to 75% of resumes are rejected by ATS before reaching a recruiter.' },
    { q: 'How does ATS Beater work?', a: 'Upload your base resume, paste a job description, and our AI analyzes the job requirements to generate a perfectly tailored, ATS-optimized resume in LaTeX-precision PDF format.' },
    { q: 'Is my resume data safe?', a: 'Yes. Your resume data is encrypted and stored securely. We never share your data with third parties. You can delete your data at any time.' },
    { q: 'How many free credits do I get?', a: 'You get 3 free resume tailors every day. They reset at midnight UTC, and no credit card is needed to start.' },
    { q: 'What file formats are supported?', a: 'We accept PDF resume files today. DOC support is coming soon. The output is always a clean, professionally formatted PDF.' },
    { q: 'How many applications can I make with 1 credit?', a: 'Each credit gives you one tailored resume + cover letter for one job. Your 3 daily free credits reset every day at midnight.' },
  ];

  const features: { title: string; desc: string; accent: Accent; icon: ReactNode }[] = [
    {
      title: 'Keyword Matching',
      desc: 'AI extracts exact keywords from job descriptions and weaves them naturally into your resume.',
      accent: { color: '#38bdf8', soft: 'rgba(56,189,248,0.12)' },
      icon: (
        <svg {...iconProps}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
      ),
    },
    {
      title: 'AI Chat Editing',
      desc: 'Chat with our AI to refine any section of your resume in real-time with streaming responses.',
      accent: { color: '#fb923c', soft: 'rgba(251,146,60,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /></svg>
      ),
    },
    {
      title: 'LaTeX PDF Output',
      desc: 'Professional, pixel-perfect PDF generated from LaTeX — no flimsy document templates.',
      accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
      ),
    },
    {
      title: 'Resume Roast',
      desc: 'Get a brutally honest AI review of your resume with ATS compatibility scores.',
      accent: { color: '#fb7185', soft: 'rgba(251,113,133,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
      ),
    },
    {
      title: 'Instant Generation',
      desc: 'Get your tailored resume in under 60 seconds. Apply faster than the competition.',
      accent: { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
      ),
    },
    {
      title: 'Multi-language',
      desc: 'Generate resumes in English, Norwegian, French, German, Spanish, Italian, and Russian.',
      accent: { color: '#22d3ee', soft: 'rgba(34,211,238,0.12)' },
      icon: (
        <svg {...iconProps}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
      ),
    },
  ];

  const howItWorks: { n: string; title: string; desc: string; accent: Accent; icon: ReactNode }[] = [
    {
      n: '01',
      title: 'Upload Your Resume',
      desc: 'Upload your existing PDF resume. Our AI extracts all your experience, skills, and achievements.',
      accent: { color: '#38bdf8', soft: 'rgba(56,189,248,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
      ),
    },
    {
      n: '02',
      title: 'Paste Job Description',
      desc: 'Copy any job posting and paste it in. Our AI identifies the key requirements, keywords, and ATS filters.',
      accent: { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 14l2 2 4-4" /></svg>
      ),
    },
    {
      n: '03',
      title: 'Download Perfect PDF',
      desc: 'Get a beautifully formatted, LaTeX-generated PDF that sails through ATS and impresses human reviewers.',
      accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      ),
    },
  ];

  const navLinkStyle: CSSProperties = {
    fontSize: 13.5, fontWeight: 500, color: '#71717a',
    textDecoration: 'none', transition: 'color 0.2s', padding: '4px 0',
  };

  return (
    <div ref={rootRef} className="lp-root">
      <div className="lp-fx" aria-hidden>
        <div className="dot-grid" />
        <div className="ambient-orb ambient-orb--a" />
        <div className="ambient-orb ambient-orb--b" />
      </div>

      {/* ======= NAVBAR ======= */}
      <nav className={scrolled ? 'lp-nav lp-nav--scrolled' : 'lp-nav'}>
        <div className="lp-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,90,31,0.08)', border: '1px solid rgba(255,90,31,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35" />
                <path d="M14 2v5a1 1 0 0 0 1 1h5" />
                <path d="M16 14a2 2 0 0 0-2 2" /><path d="M16 22a2 2 0 0 1 2-2" />
                <path d="M20 14a2 2 0 0 1 2 2" /><path d="M20 22a2 2 0 0 0 2-2" />
              </svg>
            </div>
            <span style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 19, color: '#fff', letterSpacing: '-0.3px' }}>
              ATS<span style={{ color: '#ff5a1f' }}>Beater</span>
            </span>
          </div>

          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {([['#how-it-works', 'How It Works'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']] as const).map(([href, label]) => (
              <a key={href} href={href} style={navLinkStyle}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}>
                {label}
              </a>
            ))}
            <button onClick={handleLogin}
              style={{ background: '#ff5a1f', color: '#fff', border: '1px solid rgba(255,90,31,0.3)', borderRadius: 10, padding: '9px 22px', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', boxShadow: '0 0 20px rgba(255,90,31,0.2)', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(255,90,31,0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,90,31,0.2)'; }}>
              Get Started
            </button>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="hamburger-btn" aria-label="Toggle menu">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: '20px 24px', background: 'rgba(9,9,11,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {([['#how-it-works', 'How It Works'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']] as const).map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textDecoration: 'none' }}>
                {label}
              </a>
            ))}
            <button onClick={() => { setMobileOpen(false); handleLogin(); }}
              style={{ marginTop: 8, width: '100%', padding: '12px', borderRadius: 10, background: '#ff5a1f', color: '#fff', border: 'none', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
              Get Started
            </button>
          </div>
        )}
      </nav>

      {/* ======= HERO ======= */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 120, paddingBottom: 80, overflow: 'hidden' }}>
        <div className="hero-grid" />

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
                <span style={{ display: 'block', background: 'linear-gradient(180deg,#ffffff 30%,#94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Beat the ATS,
                </span>
                <span style={{ display: 'block' }}>
                  <span style={{ background: 'linear-gradient(180deg,#ffffff 30%,#94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Land the </span>
                  <span style={{ color: '#ff5a1f' }}>Interview</span>
                </span>
              </h1>

              <p style={{ fontSize: 17, lineHeight: 1.78, color: '#e4e4e7', maxWidth: 500, marginBottom: 36 }}>
                Upload your resume, paste a job description, and get an ATS-optimized tailored resume in seconds. Powered by AI and LaTeX precision.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 52 }}>
                <button onClick={handleLogin}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg,#ff5a1f,#e04e1b)', border: '1px solid rgba(255,90,31,0.3)', color: '#fff', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 12, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', boxShadow: '0 0 28px rgba(255,90,31,0.28)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(255,90,31,0.45)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 28px rgba(255,90,31,0.28)'; }}>
                  Start Free Now
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <a href="#how-it-works"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 12, letterSpacing: '0.8px', textTransform: 'uppercase', cursor: 'pointer', transition: 'border-color 0.2s ease, color 0.2s ease, background 0.2s ease', textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,90,31,0.4)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                  See How It Works
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'stretch', paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { val: '10k+', label: 'Job Seekers', color: '#ffffff' },
                  { val: '95%', label: 'ATS Pass Rate', color: '#ff5a1f' },
                  { val: '< 60s', label: 'Generation Time', color: '#10b981' },
                ].map((stat, idx) => (
                  <div key={stat.label} style={{ flex: 1, textAlign: 'center', position: 'relative', paddingTop: 6, paddingBottom: 6 }}>
                    {idx > 0 && <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 1, background: 'rgba(255,255,255,0.08)' }} />}
                    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 700, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{stat.val}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 5 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fade-slide-in stagger-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="hero-mock" style={{ width: '100%', maxWidth: 460, background: 'rgba(24,24,27,0.95)', border: '1px solid rgba(63,63,70,0.7)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(63,63,70,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(9,9,11,0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="led-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: '#71717a', userSelect: 'none' }}>AI RESUME EDITOR</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['#ef4444', '#fbbf24', '#34d399'].map((c) => (
                      <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
                    ))}
                  </div>
                </div>

                <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
                  <div className="msg-fade-in delay-1" style={{ alignSelf: 'flex-end', maxWidth: '82%', background: 'rgba(63,63,70,0.5)', border: '1px solid rgba(63,63,70,0.4)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 12.5, color: '#e4e4e7', lineHeight: 1.55 }}>
                    Tailor my resume for this Senior React Developer role at Stripe
                  </div>
                  <div className="msg-fade-in delay-2" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(56,189,248,0.25)', fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#38bdf8', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    <span className="pulse-blue" style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }} />
                    analyze_job_requirements
                  </div>
                  <div className="msg-fade-in delay-3" style={{ alignSelf: 'flex-start', maxWidth: '82%', background: 'rgba(9,9,11,0.35)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 12.5, color: '#a1a1aa', lineHeight: 1.55 }}>
                    Analyzing the job requirements... Adding emphasis on TypeScript, React hooks, and performance optimization to your experience section.
                  </div>
                  <div className="msg-fade-in delay-4" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(52,211,153,0.25)', fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#34d399', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    <span className="pulse-emerald" style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                    update_resume_section
                  </div>
                  <div className="msg-fade-in delay-5" style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: '4px 14px 14px 14px', padding: '11px 14px', boxShadow: '0 0 24px rgba(16,185,129,0.06)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#a7f3d0', marginBottom: 3 }}>Resume tailored!</p>
                      <p style={{ fontSize: 11.5, color: '#6ee7b7', lineHeight: 1.5 }}>Your ATS match score is now <strong style={{ color: '#a7f3d0' }}>94%</strong>. Ready to generate PDF.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======= HOW IT WORKS ======= */}
      <section id="how-it-works" style={{ padding: '100px 0', position: 'relative', overflow: 'hidden' }}>
        <div className="lp-container">
          <div className="reveal" style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> How It Works
          </div>
          <h2 className="reveal reveal-d1" style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 12 }}>Three Steps to Your Dream Job</h2>
          <p className="reveal reveal-d2" style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, marginBottom: 8, lineHeight: 1.6 }}>From upload to interview-ready PDF — no templates, no guesswork.</p>

          <div className="reveal reveal-d2 lp-panel" style={{ marginTop: 48 }}>
            <div className="hiw-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
              {howItWorks.map((step, i) => (
                <div
                  key={step.n}
                  className={`lp-card reveal reveal-d${i + 1}`}
                  style={{ '--accent': step.accent.color } as CSSProperties}
                >
                  <div className="lp-step-num">{step.n}</div>
                  <div className="lp-icon" style={{ marginBottom: 24 }}>{step.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.3px' }}>{step.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.desc}</div>
                  <div style={{ marginTop: 20, height: 3, width: 40, borderRadius: 2, background: `linear-gradient(90deg, ${step.accent.color}, transparent)` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======= FEATURES ======= */}
      <section id="features" style={{ padding: '100px 0', position: 'relative', overflow: 'hidden' }}>
        <div className="lp-container" style={{ position: 'relative' }}>
          <div className="reveal" style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> Features
          </div>
          <h2 className="reveal reveal-d1" style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 12 }}>Everything You Need to Win</h2>
          <p className="reveal reveal-d2" style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, lineHeight: 1.6 }}>A full toolkit built for serious job seekers — not another resume template site.</p>

          <div className="reveal reveal-d2 lp-panel" style={{ marginTop: 48 }}>
            <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={`lp-card reveal reveal-d${(i % 6) + 1}`}
                  style={{ '--accent': f.accent.color } as CSSProperties}
                >
                  <div className="lp-icon" style={{ marginBottom: 20 }}>{f.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.title}
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.accent.color, boxShadow: `0 0 10px ${f.accent.color}` }} />
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======= PRICING ======= */}
      <section id="pricing" style={{ padding: '100px 0', position: 'relative', overflow: 'hidden' }}>
        <div className="lp-container">
          <div className="reveal" style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> Pricing
          </div>
          <h2 className="reveal reveal-d1" style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>Simple, Transparent Pricing</h2>

          <div className="reveal reveal-d2" style={{ background: 'linear-gradient(135deg,rgba(255,90,31,0.1),rgba(251,191,36,0.06))', border: '1px solid rgba(255,90,31,0.2)', borderRadius: 14, padding: '16px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
            </svg>
            <p style={{ fontSize: 15, color: 'var(--orange)', fontWeight: 600, margin: 0 }}><strong>3 free resume tailors per day</strong> — no credit card needed</p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginTop: 40 }}>
            {[
              { name: 'DAY PASS', price: '₹49', per: '10 credits', credits: '≈ 10 applications', features: ['10 AI resume tailorings', 'Chat editing', 'PDF download', 'LaTeX formatting'], featured: false, bestFor: 'Trying it for the first time', accent: '#38bdf8' },
              { name: 'SPRINT', price: '₹99', per: '30 credits', credits: '≈ 30 applications', features: ['30 AI resume tailorings', 'Unlimited roasts', 'Chat editing', 'Priority processing', 'All languages'], featured: true, badge: 'Most Popular', bestFor: 'Active job hunting (2–3 weeks)', accent: '#ff5a1f' },
              { name: 'JOB HUNT', price: '₹199', per: '75 credits', credits: '≈ 75 applications', features: ['75 AI resume tailorings', 'Unlimited roasts', 'Chat editing', 'Priority AI', 'All languages', 'Extended support'], featured: false, bestFor: 'Intensive search campaigns', accent: '#34d399' },
            ].map((plan, i) => (
              <div
                key={plan.name}
                className={`pricing-card reveal reveal-d${i + 1}${plan.featured ? ' featured' : ''}`}
                style={{
                  background: plan.featured ? 'linear-gradient(160deg,rgba(255,90,31,0.1),rgba(24,24,27,0.92))' : 'rgba(24,24,27,0.7)',
                  border: `1px solid ${plan.featured ? 'rgba(255,90,31,0.35)' : 'var(--card-border)'}`,
                  borderRadius: 18,
                  padding: '36px 28px',
                  position: 'relative',
                }}
              >
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, right: 20, background: 'linear-gradient(135deg,var(--orange),#D13600)', color: '#fff', padding: '4px 14px', borderRadius: 100, fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: plan.accent, boxShadow: `0 0 12px ${plan.accent}` }} />
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase' }}>{plan.name}</div>
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>{plan.price}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{plan.per}</div>
                <div style={{ fontSize: 12, color: plan.accent, marginBottom: 20, fontWeight: 600 }}>Best for: {plan.bestFor}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{plan.credits}</div>
                <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.accent} strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleLogin} style={{ width: '100%', padding: 14, borderRadius: 10, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', transition: 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease', background: plan.featured ? 'linear-gradient(135deg,var(--orange),#D13600)' : 'transparent', border: plan.featured ? '1px solid rgba(255,90,31,0.4)' : '1px solid rgba(255,255,255,0.1)', color: plan.featured ? '#fff' : 'var(--text-secondary)' }}>
                  Get Started
                </button>
              </div>
            ))}
          </div>

          <div className="reveal reveal-d3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '24px 32px', marginTop: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Get <strong style={{ color: 'var(--orange)' }}>3 free credits every day</strong> just by signing up. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* ======= FAQ ======= */}
      <section id="faq" style={{ padding: '100px 0', overflow: 'hidden' }}>
        <div className="lp-container">
          <div className="reveal" style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> FAQ
          </div>
          <h2 className="reveal reveal-d1" style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 48 }}>Frequently Asked Questions</h2>
          <div className="reveal reveal-d2" style={{ maxWidth: 720 }}>
            {faqs.map((faq, i) => (
              <div key={faq.q} className="faq-item" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', padding: '20px 0', cursor: 'pointer', fontFamily: 'Inter', fontSize: 16, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  {faq.q}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={openFaq === i ? '#ff5a1f' : 'currentColor'} strokeWidth="2" style={{ flexShrink: 0, color: openFaq === i ? '#ff5a1f' : 'var(--text-dim)', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease, color 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {openFaq === i && <div className="faq-answer" style={{ paddingBottom: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= CTA BAND ======= */}
      <section className="cta-band" style={{ padding: '100px 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,90,31,0.06),rgba(56,189,248,0.03),rgba(52,211,153,0.03))', borderTop: '1px solid rgba(255,90,31,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }} />
        <div className="reveal" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Ready to Beat the ATS?</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>Join thousands of job seekers who&apos;ve landed interviews with ATS Beater.</p>
          <button onClick={handleLogin} className="btn-primary" style={{ padding: '16px 48px', fontSize: 14, borderRadius: 12 }}>Start Free — No Card Required</button>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer style={{ padding: '48px 0 32px', borderTop: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div className="lp-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 12 }}>ATS<span style={{ color: 'var(--orange)' }}>Beater</span></div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 280, lineHeight: 1.6 }}>AI-powered resume tailoring to help you land your dream job. Powered by Cydratech.</p>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Product</div>
                {([['Features', '#features'], ['Pricing', '#pricing'], ['FAQ', '#faq']] as const).map(([l, href]) => (
                  <a key={l} href={href} style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, transition: 'color 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                    {l}
                  </a>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Legal</div>
                {['Privacy Policy', 'Terms of Service'].map((l) => (
                  <div key={l} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, cursor: 'pointer' }}>{l}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>© 2025 Cydratech. All rights reserved.</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>Built with ♥ for job seekers</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
