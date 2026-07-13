'use client';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api/endpoints';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.body.classList.add('public-page');
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const shouldBeScrolled = window.scrollY > 10;
        setScrolled((current) => current === shouldBeScrolled ? current : shouldBeScrolled);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll);
    return () => {
      document.body.classList.remove('public-page');
      document.body.style.overflow = '';
      document.body.style.height = '';
      window.removeEventListener('scroll', onScroll);
    };
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

  const features = [
    { icon: '\U0001f3af', title: 'Keyword Matching', desc: 'AI extracts exact keywords from job descriptions and weaves them naturally into your resume.' },
    { icon: '\U0001f916', title: 'AI Chat Editing', desc: 'Chat with our AI to refine any section of your resume in real-time with streaming responses.' },
    { icon: '\U0001f4c4', title: 'LaTeX PDF Output', desc: 'Professional, pixel-perfect PDF generated from LaTeX \u2014 no flimsy document templates.' },
    { icon: '\U0001f525', title: 'Resume Roast', desc: 'Get a brutally honest AI review of your resume with ATS compatibility scores.' },
    { icon: '\u26a1', title: 'Instant Generation', desc: 'Get your tailored resume in under 60 seconds. Apply faster than the competition.' },
    { icon: '\U0001f30d', title: 'Multi-language', desc: 'Generate resumes in English, Norwegian, French, German, Spanish, Italian, and Russian.' },
  ];

  /* ---- shared hover helpers (inline-style only, no Tailwind) ---- */
  const navLinkStyle: React.CSSProperties = {
    fontSize: 13.5, fontWeight: 500, color: '#71717a',
    textDecoration: 'none', transition: 'color 0.2s', padding: '4px 0',
  };

  return (
    <div style={{ background: 'var(--deep)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* ---- background ---- */}
      <div className="dot-grid" aria-hidden />
      <div className="ambient-orb" style={{ width: 600, height: 600, top: -200, right: -100, background: 'rgba(255,90,31,0.04)' }} aria-hidden />
      <div className="ambient-orb" style={{ width: 500, height: 500, bottom: -100, left: -100, background: 'rgba(255,255,255,0.02)', animationDelay: '-8s' }} aria-hidden />

      {/* ======= NAVBAR ======= */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 68, display: 'flex', alignItems: 'center',
        background: scrolled ? 'rgba(9,9,11,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.35)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,90,31,0.08)', border: '1px solid rgba(255,90,31,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35"/>
                <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                <path d="M16 14a2 2 0 0 0-2 2"/><path d="M16 22a2 2 0 0 1 2-2"/>
                <path d="M20 14a2 2 0 0 1 2 2"/><path d="M20 22a2 2 0 0 0 2-2"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 19, color: '#fff', letterSpacing: '-0.3px' }}>
              ATS<span style={{ color: '#ff5a1f' }}>Beater</span>
            </span>
          </div>

          {/* Desktop links — hidden on mobile via CSS class */}
          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {[['#how-it-works','How It Works'],['#features','Features'],['#pricing','Pricing'],['#faq','FAQ']].map(([href,label]) => (
              <a key={href} href={href} style={navLinkStyle}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
                {label}
              </a>
            ))}
            <button onClick={handleLogin}
              style={{ background: '#ff5a1f', color: '#fff', border: '1px solid rgba(255,90,31,0.3)', borderRadius: 10, padding: '9px 22px', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s ease', boxShadow: '0 0 20px rgba(255,90,31,0.2)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(255,90,31,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,90,31,0.2)'; }}>
              Get Started
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="hamburger-btn" aria-label="Toggle menu">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: '20px 24px', background: 'rgba(9,9,11,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {[['#how-it-works','How It Works'],['#features','Features'],['#pricing','Pricing'],['#faq','FAQ']].map(([href,label]) => (
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
        <div style={{ position: 'absolute', width: 600, height: 600, top: -150, right: -100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,90,31,0.07), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px', position: 'relative', zIndex: 1, width: '100%' }}>
          <div className="hero-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

            {/* ---------- LEFT: copy ---------- */}
            <div className="fade-slide-in">

              {/* Pill badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 10px', borderRadius: 100, background: 'linear-gradient(135deg,rgba(255,90,31,0.12),rgba(255,90,31,0.04))', border: '1px solid rgba(255,90,31,0.22)', marginBottom: 28, boxShadow: '0 0 20px rgba(255,90,31,0.08)', userSelect: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.813 15.904L9 21l8.982-11.795H14.18l.818-5.096L6 16l3.813-.096z"/>
                </svg>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#ff5a1f', letterSpacing: '0.6px' }}>AI-Powered Resume Tailoring</span>
              </div>

              {/* Heading */}
              <h1 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(42px,5vw,72px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.03em', marginBottom: 22 }}>
                <span style={{ display: 'block', background: 'linear-gradient(180deg,#ffffff 30%,#94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Beat the ATS,
                </span>
                <span style={{ display: 'block' }}>
                  <span style={{ background: 'linear-gradient(180deg,#ffffff 30%,#94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Land the </span>
                  <span style={{ color: '#ff5a1f', position: 'relative', display: 'inline-block' }}>
                    Interview
                    <span style={{ position: 'absolute', left: 0, bottom: 2, width: '100%', height: 4, background: 'rgba(255,90,31,0.18)', borderRadius: 4, filter: 'blur(2px)' }} />
                  </span>
                </span>
              </h1>

              {/* Description */}
              <p style={{ fontSize: 17, lineHeight: 1.78, color: '#e4e4e7', maxWidth: 500, marginBottom: 36 }}>
                Upload your resume, paste a job description, and get an ATS-optimized tailored resume in seconds. Powered by AI and LaTeX precision.
              </p>

              {/* CTA buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 52 }}>
                <button onClick={handleLogin}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg,#ff5a1f,#e04e1b)', border: '1px solid rgba(255,90,31,0.3)', color: '#fff', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 12, letterSpacing: '1.2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s ease', boxShadow: '0 0 28px rgba(255,90,31,0.28)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03) translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(255,90,31,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 0 28px rgba(255,90,31,0.28)'; }}>
                  Start Free Now
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                  </svg>
                </button>
                <a href="#how-it-works"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 12, letterSpacing: '0.8px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s ease', textDecoration: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,90,31,0.4)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                  See How It Works
                </a>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', alignItems: 'stretch', paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { val: '10k+',  label: 'Job Seekers',      color: '#ffffff' },
                  { val: '95%',   label: 'ATS Pass Rate',    color: '#ff5a1f' },
                  { val: '< 60s', label: 'Generation Time',  color: '#10b981' },
                ].map((stat, idx) => (
                  <div key={stat.label} style={{ flex: 1, textAlign: 'center', position: 'relative', paddingTop: 6, paddingBottom: 6 }}>
                    {idx > 0 && <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 1, background: 'rgba(255,255,255,0.08)' }} />}
                    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 700, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{stat.val}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 5 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ---------- RIGHT: AI editor card ---------- */}
            <div className="fade-slide-in stagger-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 460, background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(63,63,70,0.7)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>

                {/* Card header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(63,63,70,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(9,9,11,0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="led-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: '#71717a', userSelect: 'none' }}>AI RESUME EDITOR</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#3f3f46' }} />)}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>

                  {/* User */}
                  <div className="msg-fade-in delay-1" style={{ alignSelf: 'flex-end', maxWidth: '82%', background: 'rgba(63,63,70,0.5)', border: '1px solid rgba(63,63,70,0.4)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 12.5, color: '#e4e4e7', lineHeight: 1.55 }}>
                    Tailor my resume for this Senior React Developer role at Stripe
                  </div>

                  {/* Tool: analyze */}
                  <div className="msg-fade-in delay-2" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(63,63,70,0.5)', fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#38bdf8', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    <span className="pulse-blue" style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }} />
                    analyze_job_requirements
                  </div>

                  {/* Bot */}
                  <div className="msg-fade-in delay-3" style={{ alignSelf: 'flex-start', maxWidth: '82%', background: 'rgba(9,9,11,0.35)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 12.5, color: '#a1a1aa', lineHeight: 1.55 }}>
                    Analyzing the job requirements... Adding emphasis on TypeScript, React hooks, and performance optimization to your experience section.
                  </div>

                  {/* Tool: update */}
                  <div className="msg-fade-in delay-4" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 8, background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(63,63,70,0.5)', fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: '#34d399', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    <span className="pulse-emerald" style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                    update_resume_section
                  </div>

                  {/* Success */}
                  <div className="msg-fade-in delay-5" style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: '4px 14px 14px 14px', padding: '11px 14px', boxShadow: '0 0 24px rgba(16,185,129,0.06)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#a7f3d0', marginBottom: 3 }}>Resume tailored!</p>
                      <p style={{ fontSize: 11.5, color: '#6ee7b7', lineHeight: 1.5 }}>Your ATS match score is now <strong style={{ color: '#a7f3d0' }}>94%</strong>. Ready to generate PDF.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>{/* /hero grid */}
        </div>{/* /container */}
      </section>

      {/* ======= HOW IT WORKS ======= */}
      <section id="how-it-works" style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> How It Works
          </div>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>Three Steps to Your Dream Job</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, marginTop: 56, background: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden' }}>
            {[
              { n: '01', icon: '\U0001f4e4', title: 'Upload Your Resume', desc: 'Upload your existing PDF resume. Our AI extracts all your experience, skills, and achievements.' },
              { n: '02', icon: '\U0001f916', title: 'Paste Job Description', desc: 'Copy any job posting and paste it in. Our AI identifies the key requirements, keywords, and ATS filters.' },
              { n: '03', icon: '\U0001f4c4', title: 'Download Perfect PDF', desc: 'Get a beautifully formatted, LaTeX-generated PDF that sails through ATS and impresses human reviewers.' },
            ].map((step) => (
              <div key={step.n} style={{ background: 'var(--deep)', padding: '40px 32px', position: 'relative', transition: 'all 0.3s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(24,24,27,0.8)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--deep)'; }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 64, fontWeight: 800, color: 'rgba(255,255,255,0.04)', lineHeight: 1, position: 'absolute', top: 20, right: 24 }}>{step.n}</div>
                <div style={{ fontSize: 32, marginBottom: 24 }}>{step.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.3px' }}>{step.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= FEATURES ======= */}
      <section id="features" style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> Features
          </div>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>Everything You Need to Win</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 2, marginTop: 56, background: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden' }}>
            {features.map((f) => (
              <div key={f.title} style={{ background: 'var(--deep)', padding: '36px 32px', transition: 'all 0.3s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(24,24,27,0.8)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--deep)'; }}>
                <div style={{ fontSize: 28, marginBottom: 20 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{f.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= PRICING ======= */}
      <section id="pricing" style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> Pricing
          </div>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>Simple, Transparent Pricing</h2>
          <div style={{ background: 'rgba(255,90,31,0.06)', border: '1px solid rgba(255,90,31,0.15)', borderRadius: 12, padding: '16px 24px', marginBottom: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--orange)', fontWeight: 600 }}>\U0001f381 <strong>3 free resume tailors per day</strong> \u2014 no credit card needed</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginTop: 56 }}>
            {[
              { name: 'DAY PASS',  price: '\u20b949',  per: '10 credits', credits: '\u2248 10 applications', features: ['10 AI resume tailorings','Chat editing','PDF download','LaTeX formatting'], featured: false, bestFor: 'Trying it for the first time' },
              { name: 'SPRINT',    price: '\u20b999',  per: '30 credits', credits: '\u2248 30 applications', features: ['30 AI resume tailorings','Unlimited roasts','Chat editing','Priority processing','All languages'], featured: true, badge: 'Most Popular', bestFor: 'Active job hunting (2\u20133 weeks)' },
              { name: 'JOB HUNT', price: '\u20b9199', per: '75 credits', credits: '\u2248 75 applications', features: ['75 AI resume tailorings','Unlimited roasts','Chat editing','Priority AI','All languages','Extended support'], featured: false, bestFor: 'Intensive search campaigns' },
            ].map((plan) => (
              <div key={plan.name} style={{ background: plan.featured ? 'linear-gradient(135deg,rgba(255,90,31,0.06),rgba(24,24,27,0.8))' : 'rgba(24,24,27,0.6)', border: `1px solid ${plan.featured ? 'rgba(255,90,31,0.3)' : 'var(--card-border)'}`, borderRadius: 16, padding: '36px 28px', position: 'relative', transition: 'all 0.3s ease' }}>
                {plan.badge && <div style={{ position: 'absolute', top: -12, right: 20, background: 'linear-gradient(135deg,var(--orange),#D13600)', color: '#fff', padding: '4px 14px', borderRadius: 100, fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{plan.badge}</div>}
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{plan.name}</div>
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>{plan.price}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{plan.per}</div>
                <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 20, fontWeight: 600 }}>Best for: {plan.bestFor}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{plan.credits}</div>
                <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleLogin} style={{ width: '100%', padding: 14, borderRadius: 8, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s ease', background: plan.featured ? 'linear-gradient(135deg,var(--orange),#D13600)' : 'transparent', border: plan.featured ? '1px solid rgba(255,90,31,0.4)' : '1px solid rgba(255,255,255,0.1)', color: plan.featured ? '#fff' : 'var(--text-secondary)' }}>Get Started</button>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '24px 32px', marginTop: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Get <strong style={{ color: 'var(--orange)' }}>3 free credits every day</strong> just by signing up. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* ======= FAQ ======= */}
      <section id="faq" style={{ padding: '100px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--orange)' }} /> FAQ
          </div>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 48 }}>Frequently Asked Questions</h2>
          <div style={{ maxWidth: 720 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', padding: '20px 0', cursor: 'pointer', fontFamily: 'Inter', fontSize: 16, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  {faq.q}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-dim)', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {openFaq === i && <div style={{ paddingBottom: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= CTA BAND ======= */}
      <section style={{ padding: '80px 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,90,31,0.04),rgba(255,255,255,0.02))', borderTop: '1px solid rgba(255,90,31,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Ready to Beat the ATS?</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>Join thousands of job seekers who\u2019ve landed interviews with ATS Beater.</p>
          <button onClick={handleLogin} className="btn-primary" style={{ padding: '16px 48px', fontSize: 14 }}>Start Free \u2014 No Card Required</button>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer style={{ padding: '48px 0 32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 12 }}>ATS<span style={{ color: 'var(--orange)' }}>Beater</span></div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 280, lineHeight: 1.6 }}>AI-powered resume tailoring to help you land your dream job. Powered by Cydratech.</p>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Product</div>
                {['Features','Pricing','FAQ'].map(l => <div key={l} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, cursor: 'pointer' }}>{l}</div>)}
              </div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Legal</div>
                {['Privacy Policy','Terms of Service'].map(l => <div key={l} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, cursor: 'pointer' }}>{l}</div>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>\u00a9 2025 Cydratech. All rights reserved.</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>Built with \u2764\ufe0f for job seekers</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
