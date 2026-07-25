'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { authApi } from '@/lib/api/endpoints';
import GuestResumeUpload from '@/components/GuestResumeUpload';
import { loadGuestProfileSession } from '@/lib/guestProfile';

type Accent = { color: string; soft: string };

type WallStats = {
  total_resumes_tailored: number;
  total_roasts_completed: number;
  avg_ats_score_improvement: number | null;
  has_improvement_data: boolean;
};

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

function CompareMark({ val, highlight }: { val: boolean | string; highlight?: boolean }) {
  if (val === true) {
    return (
      <span className={`compare-mark compare-mark--yes${highlight ? ' compare-mark--highlight' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      </span>
    );
  }
  if (typeof val === 'string') {
    return <span className="compare-mark compare-mark--partial">{val}</span>;
  }
  return (
    <span className="compare-mark compare-mark--no">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
    </span>
  );
}

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

  const faqs = [
    { q: 'What is an ATS?', a: 'An Applicant Tracking System (ATS) is software used by employers to filter resumes before a human ever sees them. Up to 75% of resumes are rejected by ATS before reaching a recruiter.' },
    { q: 'How does ATS Beater work?', a: 'Upload your base resume, paste a job description, and our AI analyzes the job requirements to generate a perfectly tailored, ATS-optimized resume in LaTeX-precision PDF format.' },
    { q: 'Is my resume data safe?', a: 'Yes. Your resume data is encrypted and stored securely. We never share your data with third parties. You can delete your data at any time.' },
    { q: 'How many free credits do I get?', a: 'You get 3 free resume tailors every day. They reset at midnight UTC, and no credit card is needed to start.' },
    { q: 'What file formats are supported?', a: 'We accept PDF resume files today. DOC support is coming soon. The output is always a clean, professionally formatted PDF.' },
    { q: 'How many applications can I make with 1 credit?', a: 'Each credit gives you one tailored resume + cover letter for one job. Your 3 daily free credits reset every day at midnight.' },
  ];

  const formatStat = (n: number) => {
    if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
    return `${n}+`;
  };

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

  const features: { title: string; desc: string; tag: string; accent: Accent; icon: ReactNode; visual: ReactNode }[] = [
    {
      title: 'Keyword Matching',
      desc: 'AI reads the job description and weaves must-have keywords into your bullets — naturally, never stuffed.',
      tag: 'ATS Optimization',
      accent: { color: '#38bdf8', soft: 'rgba(56,189,248,0.12)' },
      icon: (
        <svg {...iconProps}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--keywords">
          <div className="feat-kw-row"><span className="feat-kw-from">JD:</span> React · TypeScript · AWS</div>
          <div className="feat-kw-arrow">↓ woven into</div>
          <div className="feat-kw-result">Built scalable React dashboards serving 2M+ users on AWS…</div>
        </div>
      ),
    },
    {
      title: 'AI Chat Editing',
      desc: 'Refine any section with streaming AI — like a career coach sitting next to you.',
      tag: 'Live Editing',
      accent: { color: '#fb923c', soft: 'rgba(251,146,60,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--chat">
          <div className="feat-chat-bubble feat-chat-bubble--user">Make my summary more impact-focused</div>
          <div className="feat-chat-bubble feat-chat-bubble--ai">Updated — led with a quantified outcome ✓</div>
        </div>
      ),
    },
    {
      title: 'LaTeX PDF Output',
      desc: 'Professional typesetting — not a Canva template. Recruiters notice the difference.',
      tag: 'Export',
      accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--pdf">
          <div className="feat-pdf-mini"><div className="feat-pdf-line feat-pdf-line--h" /><div className="feat-pdf-line" /><div className="feat-pdf-line" /><div className="feat-pdf-line feat-pdf-line--short" /></div>
          <span className="feat-pdf-label">LaTeX · Print-ready</span>
        </div>
      ),
    },
    {
      title: 'Resume Roast',
      desc: 'Brutally honest ATS review with scores before you waste an application.',
      tag: 'Quality Check',
      accent: { color: '#fb7185', soft: 'rgba(251,113,133,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--roast">
          <div className="feat-roast-score"><span>62</span><small>/100</small></div>
          <div className="feat-roast-items"><span className="feat-roast-fail">✗ Missing metrics</span><span className="feat-roast-ok">✓ Clean sections</span></div>
        </div>
      ),
    },
    {
      title: 'Instant Generation',
      desc: 'Full tailored resume in under 60 seconds. Apply while the posting is still fresh.',
      tag: 'Speed',
      accent: { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--speed">
          <div className="feat-speed-bar"><div className="feat-speed-fill" /></div>
          <span className="feat-speed-label">Generating… 47s</span>
        </div>
      ),
    },
    {
      title: 'Multi-language',
      desc: 'English, Norwegian, French, German, Spanish, Italian & Russian from one profile.',
      tag: 'Global',
      accent: { color: '#22d3ee', soft: 'rgba(34,211,238,0.12)' },
      icon: (
        <svg {...iconProps}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--lang">
          {['EN', 'FR', 'DE', 'NO', 'ES'].map((l) => (
            <span key={l} className="feat-lang-chip">{l}</span>
          ))}
        </div>
      ),
    },
  ];

  const compareRows = [
    { label: 'Tailored per job description', manual: false, template: false, beater: true },
    { label: 'Real keyword matching', manual: false, template: false, beater: true },
    { label: 'LaTeX-quality PDF output', manual: false, template: 'Partial', beater: true },
    { label: 'AI chat editing', manual: false, template: false, beater: true },
    { label: 'ATS score before applying', manual: false, template: false, beater: true },
    { label: 'Under 60 seconds', manual: false, template: true, beater: true },
  ];

  const testimonials = [
    {
      quote: 'I went from zero callbacks to 4 interviews in two weeks. The keyword matching is scary accurate.',
      name: 'Priya S.',
      role: 'Software Engineer',
      company: 'Bangalore',
      initials: 'PS',
      accent: '#38bdf8',
    },
    {
      quote: 'LaTeX output looks so much cleaner than Canva templates. Recruiters actually commented on my resume format.',
      name: 'Marcus T.',
      role: 'Product Manager',
      company: 'London',
      initials: 'MT',
      accent: '#ff5a1f',
    },
    {
      quote: 'The roast feature saved me — I had no idea my resume was failing ATS parsing on section headers.',
      name: 'Ananya R.',
      role: 'Data Analyst',
      company: 'Mumbai',
      initials: 'AR',
      accent: '#34d399',
    },
  ];

  const personas = [
    { title: 'New Graduates', desc: 'Turn one college resume into role-specific versions for every application.', icon: '🎓', accent: '#38bdf8' },
    { title: 'Career Switchers', desc: 'Reframe your experience to match a new industry without starting from scratch.', icon: '🔄', accent: '#fbbf24' },
    { title: 'Senior Engineers', desc: 'Highlight the right tech stack and leadership signals for each senior role.', icon: '⚡', accent: '#ff5a1f' },
    { title: 'Active Job Hunters', desc: 'Apply to 10+ roles a day with tailored resumes — not copy-paste spam.', icon: '🎯', accent: '#34d399' },
  ];

  const trustItems = [
    { title: 'Encrypted Storage', desc: 'Resume data encrypted at rest', icon: '🔒' },
    { title: 'Delete Anytime', desc: 'Full data deletion on request', icon: '🗑️' },
    { title: 'No Data Selling', desc: 'We never sell your information', icon: '🛡️' },
    { title: 'DPDP Compliant', desc: 'Built for India privacy standards', icon: '🇮🇳' },
  ];

  const howItWorks: { n: string; title: string; desc: string; accent: Accent; icon: ReactNode; preview: ReactNode }[] = [
    {
      n: '01',
      title: 'Upload Your Resume',
      desc: 'Drop your PDF — we parse experience, skills, and achievements into a structured profile in seconds.',
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
              <span>Drop PDF or click to upload</span>
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

  const navLinkStyle: CSSProperties = {
    fontSize: 13.5, fontWeight: 500, color: '#64748B',
    textDecoration: 'none', transition: 'color 0.2s', padding: '4px 0',
  };

  return (
    <div className="lp-root">
      <div className="lp-fx" aria-hidden>
        <div className="dot-grid" />
        <div className="ambient-orb ambient-orb--a" />
        <div className="ambient-orb ambient-orb--b" />
        <div className="ambient-orb ambient-orb--c" />
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
            <span style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 19, color: '#0F172A', letterSpacing: '-0.3px' }}>
              ATS<span style={{ color: '#ff5a1f' }}>Beater</span>
            </span>
          </div>

          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {([['#how-it-works', 'How It Works'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']] as const).map(([href, label]) => (
              <a key={href} href={href} style={navLinkStyle}
                onClick={(e) => scrollToHash(e, href)}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}>
                {label}
              </a>
            ))}
            <button onClick={scrollToUpload}
              style={{ background: 'linear-gradient(135deg, #ff5a1f, #ff7043)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '9px 22px', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 16px rgba(255,90,31,0.3)', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 24px rgba(255,90,31,0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 16px rgba(255,90,31,0.3)'; }}>
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
          <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: '20px 24px', background: 'rgba(255,255,255,0.98)', borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
            {([['#how-it-works', 'How It Works'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']] as const).map(([href, label]) => (
              <a key={href} href={href} onClick={(e) => scrollToHash(e, href)}
                style={{ display: 'block', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', padding: '10px 0', borderBottom: '1px solid #E2E8F0', textDecoration: 'none' }}>
                {label}
              </a>
            ))}
            <button onClick={() => { scrollToUpload(); }}
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
                <span style={{ display: 'block', background: 'linear-gradient(180deg,#0F172A 30%,#334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Beat the ATS,
                </span>
                <span style={{ display: 'block' }}>
                  <span style={{ background: 'linear-gradient(180deg,#0F172A 30%,#334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Land the </span>
                  <span style={{ color: '#ff5a1f' }}>Interview</span>
                </span>
              </h1>

              <p style={{ fontSize: 17, lineHeight: 1.78, color: '#475569', maxWidth: 500, marginBottom: 36 }}>
                Upload your resume, paste a job description, and get an ATS-optimized tailored resume in seconds. Powered by AI and LaTeX precision.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 52 }}>
                <button onClick={scrollToUpload}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg, #ff5a1f, #ff7043)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 24px rgba(255,90,31,0.35)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 32px rgba(255,90,31,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 24px rgba(255,90,31,0.35)'; }}>
                  Start Free Now
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <a href="#how-it-works"
                  onClick={(e) => scrollToHash(e, '#how-it-works')}
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 28px', borderRadius: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#0F172A', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s ease', textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,90,31,0.4)'; e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.background = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.background = '#F1F5F9'; }}>
                  See How It Works
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'stretch', paddingTop: 28, borderTop: '1px solid #E2E8F0' }}>
                {[
                  { val: '10k+', label: 'Job Seekers', color: '#0F172A' },
                  { val: '95%', label: 'ATS Pass Rate', color: '#ff5a1f' },
                  { val: '< 60s', label: 'Generation Time', color: '#10b981' },
                ].map((stat, idx) => (
                  <div key={stat.label} style={{ flex: 1, textAlign: 'center', position: 'relative', paddingTop: 6, paddingBottom: 6 }}>
                    {idx > 0 && <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 1, background: '#E2E8F0' }} />}
                    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 700, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{stat.val}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 5 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fade-slide-in stagger-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="hero-mock" style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 0 40px rgba(255,90,31,0.06)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="led-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: '#64748B', userSelect: 'none' }}>AI RESUME EDITOR</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['#ef4444', '#fbbf24', '#34d399'].map((c) => (
                      <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
                    ))}
                  </div>
                </div>

                <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
                  <div className="msg-fade-in delay-1" style={{ alignSelf: 'flex-end', maxWidth: '82%', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 12.5, color: '#0F172A', lineHeight: 1.55 }}>
                    Tailor my resume for this Senior React Developer role at Stripe
                  </div>
                  <div className="msg-fade-in delay-2" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid rgba(56,189,248,0.35)', fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#0284C7', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    <span className="pulse-blue" style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }} />
                    analyze_job_requirements
                  </div>
                  <div className="msg-fade-in delay-3" style={{ alignSelf: 'flex-start', maxWidth: '82%', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
                    Analyzing the job requirements... Adding emphasis on TypeScript, React hooks, and performance optimization to your experience section.
                  </div>
                  <div className="msg-fade-in delay-4" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid rgba(52,211,153,0.35)', fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#059669', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    <span className="pulse-emerald" style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                    update_resume_section
                  </div>
                  <div className="msg-fade-in delay-5" style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '4px 14px 14px 14px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(16,185,129,0.08)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#047857', marginBottom: 3 }}>Resume tailored!</p>
                      <p style={{ fontSize: 11.5, color: '#059669', lineHeight: 1.5 }}>Your ATS match score is now <strong style={{ color: '#047857' }}>94%</strong>. Ready to generate PDF.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======= STATS BAND ======= */}
      <section className="lp-stats-band reveal">
        <div className="lp-container">
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

      {/* ======= TRY IT — GUEST UPLOAD ======= */}
      <section id="upload-resume" ref={uploadSectionRef} className="lp-section lp-section-upload reveal">
        <div className="lp-container">
          <div className="upload-section-grid">
            <div className="upload-section-copy reveal reveal-d1">
              <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> Get Started</div>
              <h2 className="lp-section-title" style={{ marginBottom: 16 }}>Tailor your resume for any job in under 60 seconds</h2>
              <p className="lp-section-sub" style={{ marginBottom: 28, maxWidth: 440 }}>
                Paste a job description and get an ATS-optimized, honestly tailored PDF — with fit score, keyword matching, and LaTeX-quality formatting. Upload your base resume to begin.
              </p>
              <ul className="upload-section-list">
                {[
                  'Tailored per job — keywords woven from your real experience',
                  'Honest fit score + gap analysis before you apply',
                  '3 free tailors per day — no credit card needed',
                ].map((item) => (
                  <li key={item}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
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
            <h2 className="lp-section-title reveal reveal-d1">Three Steps to Your Dream Job</h2>
            <p className="lp-section-sub reveal reveal-d2">From upload to interview-ready PDF — the same flow thousands of job seekers use every day.</p>
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

      {/* ======= FEATURES ======= */}
      <section id="features" className="lp-section lp-section-features">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Features</div>
            <h2 className="lp-section-title reveal reveal-d1">Everything You Need to Win</h2>
            <p className="lp-section-sub reveal reveal-d2">Not a template filler. A full AI workspace built for people who take their job search seriously.</p>
          </div>

          <div className="features-grid-v2">
            {features.map((f) => (
              <article
                key={f.title}
                className="feature-card-v2"
                style={{ '--accent': f.accent.color, '--accent-soft': f.accent.soft } as CSSProperties}
              >
                <div className="feature-card-v2-head">
                  <div className="feature-icon">{f.icon}</div>
                  <span className="feature-tag">{f.tag}</span>
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
                {f.visual}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======= COMPARISON ======= */}
      <section id="compare" className="lp-section lp-section-compare">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Why ATS Beater</div>
            <h2 className="lp-section-title reveal reveal-d1">Stop Sending the Same Resume Everywhere</h2>
            <p className="lp-section-sub reveal reveal-d2">Generic templates and manual edits weren&apos;t built for modern ATS filters.</p>
          </div>
          <div className="compare-table reveal reveal-d2">
            <div className="compare-header">
              <div className="compare-cell compare-cell--label" />
              <div className="compare-cell">Manual Editing</div>
              <div className="compare-cell">Template Sites</div>
              <div className="compare-cell compare-cell--highlight">ATS Beater</div>
            </div>
            {compareRows.map((row) => (
              <div key={row.label} className="compare-row">
                <div className="compare-cell compare-cell--label">{row.label}</div>
                <div className="compare-cell"><CompareMark val={row.manual} /></div>
                <div className="compare-cell"><CompareMark val={row.template} /></div>
                <div className="compare-cell compare-cell--highlight"><CompareMark val={row.beater} highlight /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= TESTIMONIALS ======= */}
      <section id="testimonials" className="lp-section lp-section-testimonials">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Social Proof</div>
            <h2 className="lp-section-title reveal reveal-d1">Loved by Job Seekers</h2>
            <p className="lp-section-sub reveal reveal-d2">Real results from people who stopped guessing and started tailoring.</p>
          </div>
          <div className="testimonials-grid reveal reveal-d2">
            {testimonials.map((t) => (
              <article key={t.name} className="testimonial-card" style={{ '--accent': t.accent } as CSSProperties}>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.initials}</div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role} · {t.company}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======= PERSONAS ======= */}
      <section id="personas" className="lp-section lp-section-personas">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Built For You</div>
            <h2 className="lp-section-title reveal reveal-d1">Every Stage of Your Career</h2>
            <p className="lp-section-sub reveal reveal-d2">Whether you&apos;re applying to your first role or your fifth senior position.</p>
          </div>
          <div className="personas-grid reveal reveal-d2">
            {personas.map((p) => (
              <article key={p.title} className="persona-card" style={{ '--accent': p.accent } as CSSProperties}>
                <span className="persona-icon">{p.icon}</span>
                <h3 className="persona-title">{p.title}</h3>
                <p className="persona-desc">{p.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======= TRUST ======= */}
      <section className="lp-section lp-section-trust reveal">
        <div className="lp-container">
          <div className="trust-grid">
            {trustItems.map((t) => (
              <div key={t.title} className="trust-item">
                <span className="trust-icon">{t.icon}</span>
                <div className="trust-title">{t.title}</div>
                <div className="trust-desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= PRICING ======= */}
      <section id="pricing" className="lp-section lp-section-pricing">
        <div className="lp-container">
          <div className="lp-section-head reveal">
            <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> Pricing</div>
            <h2 className="lp-section-title reveal reveal-d1">Simple, Transparent Pricing</h2>
          </div>

          <div className="reveal reveal-d2" style={{ background: 'linear-gradient(135deg,rgba(255,90,31,0.1),rgba(251,191,36,0.06))', border: '1px solid rgba(255,90,31,0.2)', borderRadius: 14, padding: '14px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
            </svg>
            <p style={{ fontSize: 15, color: 'var(--orange)', fontWeight: 600, margin: 0 }}><strong>3 free resume tailors per day</strong> — no credit card needed</p>
          </div>

          <div className="pricing-grid reveal reveal-d2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 24 }}>
            {[
              { name: 'DAY PASS', price: '₹49', per: '10 credits', credits: '≈ 10 applications', features: ['10 AI resume tailorings', 'Chat editing', 'PDF download', 'LaTeX formatting'], featured: false, bestFor: 'Trying it for the first time', accent: '#38bdf8' },
              { name: 'SPRINT', price: '₹99', per: '30 credits', credits: '≈ 30 applications', features: ['30 AI resume tailorings', 'Unlimited roasts', 'Chat editing', 'Priority processing', 'All languages'], featured: true, badge: 'Most Popular', bestFor: 'Active job hunting (2–3 weeks)', accent: '#ff5a1f' },
              { name: 'JOB HUNT', price: '₹199', per: '75 credits', credits: '≈ 75 applications', features: ['75 AI resume tailorings', 'Unlimited roasts', 'Chat editing', 'Priority AI', 'All languages', 'Extended support'], featured: false, bestFor: 'Intensive search campaigns', accent: '#34d399' },
            ].map((plan, i) => (
              <div
                key={plan.name}
                className={`pricing-card reveal reveal-d${i + 1}${plan.featured ? ' featured' : ''}`}
                style={{
                  background: plan.featured ? 'linear-gradient(160deg,rgba(255,90,31,0.06),#FFFFFF)' : '#FFFFFF',
                  border: `1px solid ${plan.featured ? 'rgba(255,90,31,0.35)' : '#E2E8F0'}`,
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
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #E2E8F0' }}>{plan.credits}</div>
                <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F5F9' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.accent} strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleLogin} style={{ width: '100%', padding: 14, borderRadius: 10, fontFamily: 'Inter', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease', background: plan.featured ? 'linear-gradient(135deg,var(--orange),#D13600)' : '#F1F5F9', border: plan.featured ? '1px solid rgba(255,90,31,0.4)' : '1px solid #E2E8F0', color: plan.featured ? '#fff' : '#0F172A' }}>
                  Get Started
                </button>
              </div>
            ))}
          </div>

          <div className="reveal reveal-d3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px 32px', marginTop: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Get <strong style={{ color: 'var(--orange)' }}>3 free credits every day</strong> just by signing up. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* ======= FAQ ======= */}
      <section id="faq" className="lp-section lp-section-faq">
        <div className="lp-container">
          <div className="lp-section-head reveal">
            <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> FAQ</div>
            <h2 className="lp-section-title reveal reveal-d1">Frequently Asked Questions</h2>
          </div>
          <div className="reveal reveal-d2" style={{ maxWidth: 720 }}>
            {faqs.map((faq, i) => (
              <div key={faq.q} className="faq-item" style={{ borderBottom: '1px solid #E2E8F0' }}>
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
      <section className="lp-section lp-section-cta cta-band">
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,90,31,0.04),rgba(56,189,248,0.02),rgba(52,211,153,0.02))', borderTop: '1px solid rgba(255,90,31,0.12)', borderBottom: '1px solid #E2E8F0' }} />
        <div className="reveal" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Ready to Beat the ATS?</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>Join thousands of job seekers who&apos;ve landed interviews with ATS Beater.</p>
          <button onClick={handleLogin} className="btn-primary" style={{ padding: '16px 48px', fontSize: 14, borderRadius: 12 }}>Start Free — No Card Required</button>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer style={{ padding: '48px 0 32px', borderTop: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div className="lp-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, paddingBottom: 32, borderBottom: '1px solid #E2E8F0', marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 12 }}>ATS<span style={{ color: 'var(--orange)' }}>Beater</span></div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 280, lineHeight: 1.6 }}>AI-powered resume tailoring to help you land your dream job. Powered by Cydratech.</p>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Product</div>
                {([['Features', '#features'], ['Pricing', '#pricing'], ['FAQ', '#faq']] as const).map(([l, href]) => (
                  <a key={l} href={href} onClick={(e) => scrollToHash(e, href)} style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, transition: 'color 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; }}
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
