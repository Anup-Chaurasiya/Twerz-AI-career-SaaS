'use client';

import Link from 'next/link';
import type { CSSProperties, MouseEvent } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { NAV_LINKS } from '@/components/landing/ui';

type LandingNavProps = {
  scrolled: boolean;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  onScrollToHash: (e: MouseEvent<HTMLAnchorElement>, hash: string) => void;
};

const navLinkStyle: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 500,
  color: '#64748B',
  textDecoration: 'none',
  transition: 'color 0.2s',
  padding: '4px 0',
};

const navCtaStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #ff5a1f, #ff7043)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '9px 22px',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 16px rgba(255,90,31,0.3)',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function LandingNav({
  scrolled,
  mobileOpen,
  onToggleMobile,
  onScrollToHash,
}: LandingNavProps) {
  return (
    <nav className={scrolled ? 'lp-nav lp-nav--scrolled' : 'lp-nav'}>
      <div className="lp-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <BrandLogo />
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {NAV_LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              style={navLinkStyle}
              onClick={(e) => onScrollToHash(e, href)}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
            >
              {label}
            </a>
          ))}
          <Link href="/login" style={navCtaStyle}>
            Get Started
          </Link>
        </div>
        <button type="button" onClick={onToggleMobile} className="hamburger-btn" aria-label="Toggle menu">
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
            <a
              key={href}
              href={href}
              onClick={(e) => onScrollToHash(e, href)}
              style={{ display: 'block', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', padding: '10px 0', borderBottom: '1px solid #E2E8F0', textDecoration: 'none' }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={onToggleMobile}
            style={{
              ...navCtaStyle,
              marginTop: 8,
              width: '100%',
              padding: '12px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}
