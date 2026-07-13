'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
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
    { icon: '🎯', title: 'Keyword Matching', desc: 'AI extracts exact keywords from job descriptions and weaves them naturally into your resume.' },
    { icon: '🤖', title: 'AI Chat Editing', desc: 'Chat with our AI to refine any section of your resume in real-time with streaming responses.' },
    { icon: '📄', title: 'LaTeX PDF Output', desc: 'Professional, pixel-perfect PDF generated from LaTeX — no flimsy document templates.' },
    { icon: '🔥', title: 'Resume Roast', desc: 'Get a brutally honest AI review of your resume with ATS compatibility scores.' },
    { icon: '⚡', title: 'Instant Generation', desc: 'Get your tailored resume in under 60 seconds. Apply faster than the competition.' },
    { icon: '🌍', title: 'Multi-language', desc: 'Generate resumes in English, Norwegian, French, German, Spanish, Italian, and Russian.' },
  ];

  return (
    <div style={{ background: 'var(--deep)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Background */}
      <div className="dot-grid" aria-hidden />
      <div className="scanline-overlay" aria-hidden />
      <div className="ambient-orb" style={{ width: 600, height: 600, top: -200, right: -100, background: 'rgba(251,65,0,0.06)' }} aria-hidden />
      <div className="ambient-orb" style={{ width: 500, height: 500, bottom: -100, left: -100, background: 'rgba(1,169,219,0.04)', animationDelay: '-8s' }} aria-hidden />

      {/* Navbar */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} style={{ zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, rgba(251,65,0,0.15), rgba(251,65,0,0.05))', border: '1px solid rgba(251,65,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FB4100" strokeWidth="2"><path d="M20 10V8a2.4 2.4 0 0 0-.706-1.704l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4.35"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M16 14a2 2 0 0 0-2 2"/><path d="M16 22a2 2 0 0 1-2-2"/><path d="M20 14a2 2 0 0 1 2 2"/><path d="M20 22a2 2 0 0 0 2-2"/></svg>
            </div>
            <span>ATS<span style={{ color: 'var(--orange)' }}>Beater</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="nav-links-desktop">
            <a href="#how-it-works" style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>How It Works</a>
            <a href="#features" style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>Features</a>
            <a href="#pricing" style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>Pricing</a>
            <a href="#faq" style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}>FAQ</a>
            <button onClick={handleLogin} style={{ background: 'linear-gradient(135deg, var(--orange), #D13600)', border: '1px solid rgba(251,65,0,0.4)', color: '#fff', padding: '10px 24px', borderRadius: 4, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s ease' }}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-grid" />
        <div style={{ position: 'absolute', width: 600, height: 600, top: -200, right: -100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,65,0,0.08), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <div className="fade-slide-in">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 8px', borderRadius: 100, background: 'rgba(1,169,219,0.06)', border: '1px solid rgba(1,169,219,0.15)', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: 'var(--teal)', letterSpacing: '0.5px', marginBottom: 32 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: 'var(--teal)', opacity: 0.3, animation: 'pulse-dot 2s ease-in-out infinite' }} />
                </div>
                AI-Powered Resume Tailoring
              </div>
              <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-3px', marginBottom: 24 }}>
                Beat the ATS,{' '}<br />
                Land the{' '}
                <span style={{ fontFamily: 'Instrument Serif', fontWeight: 400, fontStyle: 'italic', background: 'linear-gradient(135deg, var(--teal), #47d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Interview</span>
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--text-secondary)', maxWidth: 520, marginBottom: 40 }}>
                Upload your resume, paste a job description, and get an ATS-optimized tailored resume in seconds. Powered by AI and LaTeX precision.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button onClick={handleLogin} className="btn-primary" style={{ padding: '16px 36px', fontSize: 13 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  Start Free Now
                </button>
                <a href="#how-it-works" className="btn-secondary" style={{ padding: '16px 32px' }}>See How It Works</a>
              </div>
              <div style={{ display: 'flex', gap: 48, marginTop: 56, paddingTop: 32, borderTop: '1px solid rgba(1,169,219,0.08)' }}>
                {[['10k+', 'Job Seekers'], ['95%', 'ATS Pass Rate'], ['< 60s', 'Generation Time']].map(([val, label]) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 800, letterSpacing: -1, color: val.includes('95') ? 'var(--teal)' : val.includes('60') ? 'var(--green)' : 'var(--text-primary)' }}>{val}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fade-slide-in stagger-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 460, background: 'var(--sidebar-bg)', borderRadius: 16, border: '1px solid var(--card-border)', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 8px rgba(251,65,0,0.4)' }} />
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px' }}>AI RESUME EDITOR</span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 260 }}>
                  {[
                    { role: 'user', text: 'Tailor my resume for this Senior React Developer role at Stripe' },
                    { role: 'tool', text: '⚙ analyze_job_requirements' },
                    { role: 'bot', text: 'Analyzing the job requirements... Adding emphasis on TypeScript, React hooks, and performance optimization to your experience section.' },
                    { role: 'tool', text: '⚙ update_resume_section' },
                    { role: 'bot', text: '✅ Resume tailored! Your ATS match score is now 94%. Ready to generate PDF.' },
                  ].map((msg, i) => (
                    <div key={i} style={{ maxWidth: '82%', padding: msg.role === 'tool' ? '5px 10px' : '10px 14px', borderRadius: msg.role === 'tool' ? 6 : 12, fontSize: msg.role === 'tool' ? 10 : 12.5, lineHeight: 1.5, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'rgba(251,65,0,0.12)' : msg.role === 'tool' ? 'rgba(1,169,219,0.06)' : 'rgba(1,169,219,0.08)', border: msg.role === 'tool' ? '1px solid rgba(1,169,219,0.12)' : 'none', color: msg.role === 'tool' ? 'var(--teal)' : 'var(--text-primary)', fontFamily: msg.role === 'tool' ? 'JetBrains Mono' : 'Inter', letterSpacing: msg.role === 'tool' ? '0.3px' : 0, borderBottomRightRadius: msg.role === 'user' ? 4 : 12, borderBottomLeftRadius: msg.role !== 'user' ? 4 : 12 }}>{msg.text}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--teal)' }} /> How It Works
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20 }}>Three Steps to Your Dream Job</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginTop: 56, background: 'rgba(1,169,219,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            {[
              { n: '01', icon: '📤', color: 'var(--orange)', title: 'Upload Your Resume', desc: 'Upload your existing PDF resume. Our AI extracts all your experience, skills, and achievements.' },
              { n: '02', icon: '🤖', color: 'var(--teal)', title: 'Paste Job Description', desc: 'Copy any job posting and paste it in. Our AI identifies the key requirements, keywords, and ATS filters.' },
              { n: '03', icon: '📄', color: 'var(--green)', title: 'Download Perfect PDF', desc: 'Get a beautifully formatted, LaTeX-generated PDF that sails through ATS and impresses human reviewers.' },
            ].map((step) => (
              <div key={step.n} style={{ background: 'var(--deep)', padding: '40px 32px', position: 'relative', transition: 'all 0.3s ease' }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(7,37,61,0.5)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--deep)'; }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 64, fontWeight: 800, color: 'rgba(1,169,219,0.08)', lineHeight: 1, position: 'absolute', top: 20, right: 24 }}>{step.n}</div>
                <div style={{ fontSize: 32, marginBottom: 24 }}>{step.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.3px' }}>{step.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--teal)' }} /> Features
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20 }}>Everything You Need to Win</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, marginTop: 56, background: 'rgba(1,169,219,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            {features.map((f) => (
              <div key={f.title} style={{ background: 'var(--deep)', padding: '36px 32px', transition: 'all 0.3s ease' }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(7,37,61,0.4)'; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--deep)'; }}>
                <div style={{ fontSize: 28, marginBottom: 20 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{f.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '100px 0', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--teal)' }} /> Pricing
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20 }}>Simple, Transparent Pricing</h2>
          <div style={{ background: 'rgba(1,169,219,0.06)', border: '1px solid rgba(1,169,219,0.15)', borderRadius: 12, padding: '16px 24px', marginBottom: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--teal)', fontWeight: 600 }}>🎁 <strong>3 free resume tailors per day</strong> — no credit card needed</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 56 }}>
            {[
              { name: 'DAY PASS', price: '₹49', per: '10 credits', credits: '≈ 10 applications', features: ['10 AI resume tailorings', 'Chat editing', 'PDF download', 'LaTeX formatting'], featured: false, bestFor: 'Trying Vera for the first time' },
              { name: 'SPRINT', price: '₹99', per: '30 credits', credits: '≈ 30 applications', features: ['30 AI resume tailorings', 'Unlimited roasts', 'Chat editing', 'Priority processing', 'All languages'], featured: true, badge: 'Most Popular', bestFor: 'Active job hunting (2–3 weeks)' },
              { name: 'JOB HUNT', price: '₹199', per: '75 credits', credits: '≈ 75 applications', features: ['75 AI resume tailorings', 'Unlimited roasts', 'Chat editing', 'Priority AI', 'All languages', 'Extended support'], featured: false, bestFor: 'Intensive search campaigns' },
            ].map((plan) => (
              <div key={plan.name} style={{ background: plan.featured ? 'linear-gradient(135deg, rgba(251,65,0,0.06), rgba(22,43,69,0.8))' : 'rgba(22,43,69,0.6)', border: `1px solid ${plan.featured ? 'rgba(251,65,0,0.3)' : 'var(--card-border)'}`, borderRadius: 16, padding: '36px 28px', position: 'relative', transition: 'all 0.3s ease' }}>
                {plan.badge && <div style={{ position: 'absolute', top: -12, right: 20, background: 'linear-gradient(135deg, var(--orange), #D13600)', color: '#fff', padding: '4px 14px', borderRadius: 100, fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{plan.badge}</div>}
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{plan.name}</div>
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>{plan.price}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{plan.per}</div>
                <div style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 20, fontWeight: 600 }}>Best for: {plan.bestFor}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(1,169,219,0.08)' }}>{plan.credits}</div>
                <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleLogin} style={{ width: '100%', padding: 14, borderRadius: 4, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s ease', background: plan.featured ? 'linear-gradient(135deg, var(--orange), #D13600)' : 'transparent', border: plan.featured ? '1px solid rgba(251,65,0,0.4)' : '1px solid rgba(1,169,219,0.2)', color: plan.featured ? '#fff' : 'var(--teal)' }}>Get Started</button>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(1,169,219,0.04)', border: '1px solid rgba(1,169,219,0.12)', borderRadius: 12, padding: '24px 32px', marginTop: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Get <strong style={{ color: 'var(--teal)' }}>3 free credits every day</strong> just by signing up. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '100px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 1, background: 'var(--teal)' }} /> FAQ
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 48 }}>Frequently Asked Questions</h2>
          <div style={{ maxWidth: 720 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(1,169,219,0.08)' }}>
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

      {/* CTA Band */}
      <section style={{ padding: '80px 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(251,65,0,0.04), rgba(1,169,219,0.04))', borderTop: '1px solid rgba(251,65,0,0.08)', borderBottom: '1px solid rgba(1,169,219,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 16 }}>Ready to Beat the ATS?</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>Join thousands of job seekers who've landed interviews with ATS Beater.</p>
          <button onClick={handleLogin} className="btn-primary" style={{ padding: '16px 48px', fontSize: 14 }}>Start Free — No Card Required</button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '48px 0 32px', borderTop: '1px solid rgba(1,169,219,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, paddingBottom: 32, borderBottom: '1px solid rgba(1,169,219,0.06)', marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 16, marginBottom: 12 }}>ATS<span style={{ color: 'var(--orange)' }}>Beater</span></div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 280, lineHeight: 1.6 }}>AI-powered resume tailoring to help you land your dream job. Powered by Cydratech.</p>
            </div>
            <div style={{ display: 'flex', gap: 48 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Product</div>
                {['Features', 'Pricing', 'FAQ'].map(l => <div key={l} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, cursor: 'pointer' }}>{l}</div>)}
              </div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Legal</div>
                {['Privacy Policy', 'Terms of Service'].map(l => <div key={l} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, cursor: 'pointer' }}>{l}</div>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>© 2025 Cydratech. All rights reserved.</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>Built with ❤️ for job seekers</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
