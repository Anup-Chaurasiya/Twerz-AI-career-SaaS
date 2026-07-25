'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { authApi } from '@/lib/api/endpoints';
import GuestResumeUpload from '@/components/GuestResumeUpload';
import HeroCardsShowcase from '@/components/HeroCardsShowcase';
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

function BrandLogo({ onClick }: { onClick?: () => void }) {
  return (
    <a href="/" className="brand-logo" onClick={onClick}>
      <div className="brand-logo-mark">S</div>
      <div className="brand-logo-text">
        <span className="brand-logo-name">Shortlyst</span>
        <span className="brand-logo-by">by Twerz</span>
      </div>
    </a>
  );
}

function ScoreRing({ score, color, size = 88 }: { score: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

const NAV_LINKS = [
  ['#how-it-works', 'How It Works'],
  ['#platform', 'Platform'],
  ['#features', 'Features'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
] as const;

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
    { q: 'How does Shortlyst work?', a: 'Upload your base resume, paste a job description, and our AI analyzes the job requirements to generate a perfectly tailored, ATS-optimized resume in LaTeX-precision PDF format — with an honest fit score before you spend a credit.' },
    { q: 'What is Twerz?', a: 'Twerz is the company behind Shortlyst. We build AI-powered career tools designed for honest, evidence-grounded job applications — starting with resume tailoring on resume.twerz.' },
    { q: 'Is my resume data safe?', a: 'Yes. Your resume data is encrypted and stored securely. We never share your data with third parties. You can delete your data at any time. Shortlyst is built with DPDP Act compliance for India.' },
    { q: 'How many free credits do I get?', a: 'You get 3 free resume tailors every day. They reset at midnight UTC, and no credit card is needed to start.' },
    { q: 'What file formats are supported?', a: 'We accept PDF resume files today. DOC support is coming soon. The output is always a clean, professionally formatted PDF or DOCX.' },
    { q: 'How many applications can I make with 1 credit?', a: 'Each credit gives you one tailored resume + cover letter for one job. Your 3 daily free credits reset every day at midnight.' },
  ];

  const formatStat = (n: number) => {
    if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
    return `${n}+`;
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

  const uploadHighlights = [
    { title: 'Honest Fit Score', desc: 'Strong · Stretch · Mismatch + red gaps', accent: '#6366f1', icon: '◉' },
    { title: 'Evidence Keywords', desc: 'JD keywords woven from real experience', accent: '#38bdf8', icon: '◎' },
    { title: 'LaTeX + DOCX', desc: 'Print-ready PDF and editable DOCX export', accent: '#34d399', icon: '▣' },
    { title: 'Cover Letters', desc: 'Role-specific letter with every tailor', accent: '#fb923c', icon: '✉' },
    { title: 'Interview Prep', desc: 'STAR stories, questions, elevator pitch', accent: '#fbbf24', icon: '★' },
    { title: 'App Tracker', desc: 'Kanban board from saved to offer', accent: '#8b5cf6', icon: '▦' },
    { title: '3 Free / Day', desc: 'No credit card needed to start', accent: '#ff5a1f', icon: '⚡' },
    { title: 'Encrypted · DPDP', desc: 'India privacy standards built in', accent: '#10b981', icon: '🔒' },
  ];

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
      desc: 'Structure once → tailor → edit → cover letter → interview prep → track until offer.',
      accent: '#34d399',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
      ),
    },
  ];

  const platformCategories = [
    {
      title: 'Tailor & Score',
      accent: '#ff5a1f',
      icon: '◉',
      items: [
        { name: 'Fit analysis (free pre-check)', badge: 'Free' },
        { name: 'ATS score before → after' },
        { name: 'Keyword matching' },
        { name: 'Gap fixer (evidence only)' },
        { name: 'Anti-fabrication guard' },
        { name: 'Profile enhancement' },
      ],
    },
    {
      title: 'Edit & Export',
      accent: '#38bdf8',
      icon: '✎',
      items: [
        { name: 'AI chat editor' },
        { name: 'LaTeX PDF output' },
        { name: 'DOCX export' },
        { name: 'Version history + restore' },
        { name: 'Free PDF recompile' },
        { name: 'Multi-language support' },
      ],
    },
    {
      title: 'Apply Smarter',
      accent: '#fbbf24',
      icon: '→',
      items: [
        { name: 'Cover letter generator' },
        { name: 'Interview prep packet' },
        { name: 'LinkedIn optimizer' },
        { name: 'Outreach assist' },
        { name: 'Public ATS check' },
        { name: 'Networking contacts' },
      ],
    },
    {
      title: 'Track & Grow',
      accent: '#6366f1',
      icon: '▦',
      items: [
        { name: 'Kanban application tracker' },
        { name: 'Personal analytics' },
        { name: 'Referral program' },
        { name: 'Resume roast + share' },
        { name: 'Chrome extension (JD capture)' },
        { name: 'Promo codes & time passes' },
      ],
    },
  ];

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
    {
      title: 'Fit Score & Gap Analysis',
      desc: 'Strong, Stretch, or Mismatch — with red gaps listed before you spend a credit on tailoring.',
      tag: 'Intelligence',
      accent: { color: '#6366f1', soft: 'rgba(99,102,241,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--roast">
          <div className="feat-roast-score" style={{ color: '#6366f1' }}><span>78</span><small>/100</small></div>
          <div className="feat-roast-items"><span className="feat-roast-ok">✓ React</span><span className="feat-roast-fail">✗ Kubernetes</span></div>
        </div>
      ),
    },
    {
      title: 'Cover Letter Generator',
      desc: 'Role-specific cover letter generated alongside every tailored resume — evidence-grounded, never generic.',
      tag: 'Apply',
      accent: { color: '#fb923c', soft: 'rgba(251,146,60,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--chat">
          <div className="feat-chat-bubble feat-chat-bubble--ai">Dear hiring team — my 4 years building React systems aligns with…</div>
        </div>
      ),
    },
    {
      title: 'Interview Prep Packet',
      desc: 'Likely questions, STAR stories from your resume, elevator pitch, and gaps to study before the call.',
      tag: 'Apply',
      accent: { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--lang">
          {['STAR', 'Q&A', 'Pitch'].map((l) => (
            <span key={l} className="feat-lang-chip">{l}</span>
          ))}
        </div>
      ),
    },
    {
      title: 'Application Tracker',
      desc: 'Kanban board from Saved → Applied → Interview → Offer. Notes, follow-ups, and fit scores on every card.',
      tag: 'Workflow',
      accent: { color: '#8b5cf6', soft: 'rgba(139,92,246,0.12)' },
      icon: (
        <svg {...iconProps}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--speed">
          <span className="feat-speed-label">Saved · Applied · Interview · Offer</span>
          <div className="feat-speed-bar"><div className="feat-speed-fill" style={{ width: '55%' }} /></div>
        </div>
      ),
    },
    {
      title: 'LinkedIn Optimizer',
      desc: 'Headline, About section, and Skills list optimized from your profile — optionally flavored by a target JD.',
      tag: 'Profile',
      accent: { color: '#0ea5e9', soft: 'rgba(14,165,233,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--keywords">
          <div className="feat-kw-result">Senior Engineer · React · TypeScript · AWS</div>
        </div>
      ),
    },
    {
      title: 'Chrome Extension',
      desc: 'Capture job descriptions from any job page and create a Shortlyst job in one click.',
      tag: 'Workflow',
      accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' },
      icon: (
        <svg {...iconProps}><circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--keywords">
          <div className="feat-kw-row"><span className="feat-kw-from">JD captured</span> → Shortlyst job created</div>
        </div>
      ),
    },
    {
      title: 'Referral Program',
      desc: 'Share your link — both you and your friend get bonus credits when they complete their first tailor.',
      tag: 'Growth',
      accent: { color: '#ff5a1f', soft: 'rgba(255,90,31,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--lang">
          {['You +2', 'Friend +2'].map((l) => (
            <span key={l} className="feat-lang-chip">{l}</span>
          ))}
        </div>
      ),
    },
    {
      title: 'Personal Analytics',
      desc: 'Conversion rates by fit band vs platform benchmarks — see when tailoring pays off.',
      tag: 'Insights',
      accent: { color: '#6366f1', soft: 'rgba(99,102,241,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--speed">
          <span className="feat-speed-label">Fit ≥70 → 3× interview rate</span>
          <div className="feat-speed-bar"><div className="feat-speed-fill" style={{ width: '68%' }} /></div>
        </div>
      ),
    },
    {
      title: 'Public ATS Check',
      desc: 'No signup required — upload any PDF for an instant ATS parseability score and checklist.',
      tag: 'Free Tool',
      accent: { color: '#38bdf8', soft: 'rgba(56,189,248,0.12)' },
      icon: (
        <svg {...iconProps}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
      ),
      visual: (
        <div className="feat-visual feat-visual--roast">
          <div className="feat-roast-score" style={{ color: '#38bdf8' }}><span>72</span><small>/100</small></div>
          <div className="feat-roast-items"><span className="feat-roast-ok">✓ Free · No signup</span></div>
        </div>
      ),
    },
  ];
  const compareRows = [
    { label: 'Tailored per job description', manual: false, template: false, shortlyst: true },
    { label: 'Real keyword matching', manual: false, template: false, shortlyst: true },
    { label: 'Honest fit score (no fabrication)', manual: false, template: false, shortlyst: true },
    { label: 'LaTeX-quality PDF output', manual: false, template: 'Partial', shortlyst: true },
    { label: 'AI chat editing', manual: false, template: false, shortlyst: true },
    { label: 'Cover letter + interview prep', manual: false, template: false, shortlyst: true },
    { label: 'Application tracker built-in', manual: false, template: false, shortlyst: true },
    { label: 'ATS score before applying', manual: false, template: false, shortlyst: true },
    { label: 'Free daily credits', manual: false, template: false, shortlyst: true },
    { label: 'Under 60 seconds', manual: false, template: true, shortlyst: true },
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
          <BrandLogo />

          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} style={navLinkStyle}
                onClick={(e) => scrollToHash(e, href)}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}>
                {label}
              </a>
            ))}
            <a href="https://twerz.com" className="twerz-badge" target="_blank" rel="noopener noreferrer">
              Powered by Twerz
            </a>
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
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={(e) => scrollToHash(e, href)}
                style={{ display: 'block', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', padding: '10px 0', borderBottom: '1px solid #E2E8F0', textDecoration: 'none' }}>
                {label}
              </a>
            ))}
            <a href="https://twerz.com" className="twerz-badge" style={{ alignSelf: 'flex-start', marginTop: 8 }} target="_blank" rel="noopener noreferrer">
              Powered by Twerz
            </a>
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
        <div className="hero-mesh" aria-hidden />

        <div className="lp-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <div className="fade-slide-in">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 10px', borderRadius: 100, background: 'linear-gradient(135deg,rgba(255,90,31,0.14),rgba(99,102,241,0.08))', border: '1px solid rgba(255,90,31,0.28)', marginBottom: 28, userSelect: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.813 15.904L9 21l8.982-11.795H14.18l.818-5.096L6 16l3.813-.096z" />
                </svg>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#ff5a1f', letterSpacing: '0.6px' }}>Shortlyst · Job Hunt OS</span>
              </div>

              <h1 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(42px,5vw,72px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.03em', marginBottom: 22 }}>
                <span style={{ display: 'block', color: '#ff5a1f' }}>Every job</span>
                <span style={{ display: 'block', background: 'linear-gradient(180deg,#0F172A 30%,#334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  deserves its own resume.
                </span>
              </h1>

              <p style={{ fontSize: 17, lineHeight: 1.78, color: '#475569', maxWidth: 520, marginBottom: 36 }}>
                Shortlyst turns one profile into role-perfect PDFs — with honest fit scores, zero fabricated skills, and LaTeX-grade output. A product of Twerz.
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
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Why Shortlyst</div>
            <h2 className="lp-section-title reveal reveal-d1">AI that won&apos;t lie on your resume.</h2>
            <p className="lp-section-sub reveal reveal-d2">Generic AI invents skills. Templates ignore the job. Shortlyst only amplifies what you actually have.</p>
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
                  <span>Shortlyst</span>
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

      {/* ======= FEATURES ======= */}
      <section id="features" className="lp-section lp-section-features">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Features</div>
            <h2 className="lp-section-title reveal reveal-d1">Built for people who apply seriously.</h2>
            <p className="lp-section-sub reveal reveal-d2">A complete job-hunt workspace — not a one-off PDF generator.</p>
          </div>

          <div className="features-grid-v2">
            {features.map((f) => (
              <article
                key={f.title}
                className="feature-card-v2 reveal"
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

      {/* ======= COMPARISON ======= */}
      <section id="compare" className="lp-section lp-section-compare">
        <div className="lp-container">
          <div className="lp-section-head lp-section-head--center reveal">
            <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Why Shortlyst</div>
            <h2 className="lp-section-title reveal reveal-d1">Why Shortlyst beats templates and ChatGPT.</h2>
            <p className="lp-section-sub reveal reveal-d2">Generic tools weren&apos;t built for honest, role-specific applications at scale.</p>
          </div>
          <div className="compare-table reveal reveal-d2">
            <div className="compare-header">
              <div className="compare-cell compare-cell--label" />
              <div className="compare-cell">Manual Editing</div>
              <div className="compare-cell">Template Sites</div>
              <div className="compare-cell compare-cell--highlight">Shortlyst</div>
            </div>
            {compareRows.map((row) => (
              <div key={row.label} className="compare-row">
                <div className="compare-cell compare-cell--label">{row.label}</div>
                <div className="compare-cell"><CompareMark val={row.manual} /></div>
                <div className="compare-cell"><CompareMark val={row.template} /></div>
                <div className="compare-cell compare-cell--highlight"><CompareMark val={row.shortlyst} highlight /></div>
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
            <h2 className="lp-section-title reveal reveal-d1">Results that show up in inboxes.</h2>
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
            <h2 className="lp-section-title reveal reveal-d1">Whether it&apos;s your first role or your fifth.</h2>
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
            <h2 className="lp-section-title reveal reveal-d1">Start free. Scale when you&apos;re hunting hard.</h2>
            <p className="lp-section-sub reveal reveal-d2">Shortlyst credits · powered by Twerz billing</p>
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
                <button onClick={() => handleLogin()} style={{ width: '100%', padding: 14, borderRadius: 10, fontFamily: 'Inter', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease', background: plan.featured ? 'linear-gradient(135deg,var(--orange),#D13600)' : '#F1F5F9', border: plan.featured ? '1px solid rgba(255,90,31,0.4)' : '1px solid #E2E8F0', color: plan.featured ? '#fff' : '#0F172A' }}>
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
          <h2 style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Your next application starts here.</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>Join thousands of job seekers who&apos;ve landed interviews with Shortlyst.</p>
          <button onClick={() => handleLogin()} className="btn-primary" style={{ padding: '16px 48px', fontSize: 14, borderRadius: 12 }}>Start Free — No Card Required</button>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div>
              <BrandLogo />
              <p className="lp-footer-brand-desc">
                AI resume tailoring for serious job seekers. Upload once, tailor for every role — with honest fit scores and LaTeX-grade output.
              </p>
              <a href="https://twerz.com" className="twerz-badge" target="_blank" rel="noopener noreferrer">
                Powered by Twerz
              </a>
            </div>
            <div>
              <div className="lp-footer-col-title">Product</div>
              {([['Features', '#features'], ['Platform', '#platform'], ['Pricing', '#pricing'], ['How It Works', '#how-it-works'], ['FAQ', '#faq']] as const).map(([l, href]) => (
                <a key={l} href={href} className="lp-footer-link" onClick={(e) => scrollToHash(e, href)}>{l}</a>
              ))}
            </div>
            <div>
              <div className="lp-footer-col-title">Company</div>
              <a href="https://twerz.com" className="lp-footer-link" target="_blank" rel="noopener noreferrer">About Twerz</a>
              <span className="lp-footer-link">Careers</span>
              <span className="lp-footer-link">Contact</span>
            </div>
            <div>
              <div className="lp-footer-col-title">Legal</div>
              <span className="lp-footer-link">Privacy Policy</span>
              <span className="lp-footer-link">Terms of Service</span>
              <span className="lp-footer-link">DPDP Compliance</span>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>© 2026 <span className="lp-footer-twerz">Twerz</span>. All rights reserved.</p>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Shortlyst is a product of Twerz.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="lp-footer-domain">resume.twerz</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Made in India</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
