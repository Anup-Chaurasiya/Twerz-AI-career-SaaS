'use client';

import type { CSSProperties } from 'react';
import { COMPARE_ROWS, PERSONAS, TESTIMONIALS, TRUST_ITEMS } from '@/components/landing/staticData';
import { CompareMark } from '@/components/landing/ui';

export function LandingComparisonSection() {
  return (
    <section id="compare" className="lp-section lp-section-compare">
      <div className="lp-container">
        <div className="lp-section-head lp-section-head--center reveal">
          <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Why Twerz</div>
          <h2 className="lp-section-title reveal reveal-d1">Why Twerz beats templates and ChatGPT.</h2>
        </div>
        <div className="compare-table reveal reveal-d2">
          <div className="compare-header">
            <div className="compare-cell compare-cell--label" />
            <div className="compare-cell">Manual Editing</div>
            <div className="compare-cell">Template Sites</div>
            <div className="compare-cell compare-cell--highlight">Twerz</div>
          </div>
          {COMPARE_ROWS.map((row) => (
            <div key={row.label} className="compare-row">
              <div className="compare-cell compare-cell--label">{row.label}</div>
              <div className="compare-cell"><CompareMark val={row.manual} /></div>
              <div className="compare-cell"><CompareMark val={row.template} /></div>
              <div className="compare-cell compare-cell--highlight"><CompareMark val={row.twerz} highlight /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingTestimonialsSection() {
  return (
    <section id="testimonials" className="lp-section lp-section-testimonials">
      <div className="lp-container">
        <div className="lp-section-head lp-section-head--center reveal">
          <div className="lp-eyebrow lp-eyebrow--center"><span className="lp-eyebrow-line" /> Social Proof</div>
          <h2 className="lp-section-title reveal reveal-d1">Results that show up in inboxes.</h2>
        </div>
        <div className="testimonials-grid reveal reveal-d2">
          {TESTIMONIALS.map((t) => (
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
  );
}

export function LandingPersonasSection() {
  return (
    <section id="personas" className="lp-section lp-section-personas">
      <div className="lp-container">
        <div className="personas-grid reveal reveal-d2">
          {PERSONAS.map((p) => (
            <article key={p.title} className="persona-card" style={{ '--accent': p.accent } as CSSProperties}>
              <span className="persona-icon">{p.icon}</span>
              <h3 className="persona-title">{p.title}</h3>
              <p className="persona-desc">{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingTrustSection() {
  return (
    <section className="lp-section lp-section-trust reveal">
      <div className="lp-container">
        <div className="trust-grid">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="trust-item">
              <span className="trust-icon">{t.icon}</span>
              <div className="trust-title">{t.title}</div>
              <div className="trust-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingCtaSection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="lp-section lp-section-cta cta-band">
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,90,31,0.04),rgba(56,189,248,0.02),rgba(52,211,153,0.02))', borderTop: '1px solid rgba(255,90,31,0.12)', borderBottom: '1px solid #E2E8F0' }} />
      <div className="reveal" style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: 'normal', lineHeight: 1.2, marginBottom: 16 }}>Your next application starts here.</h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>Join thousands of job seekers who&apos;ve landed interviews with Twerz.</p>
        <button type="button" onClick={onGetStarted} className="btn-primary" style={{ padding: '16px 48px', fontSize: 14, borderRadius: 12 }}>Start Free — No Card Required</button>
      </div>
    </section>
  );
}
