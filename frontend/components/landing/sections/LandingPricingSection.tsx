'use client';

import { PRICING_PLANS } from '@/components/landing/staticData';

type LandingPricingSectionProps = {
  onGetStarted: () => void;
};

export default function LandingPricingSection({ onGetStarted }: LandingPricingSectionProps) {
  return (
    <section id="pricing" className="lp-section lp-section-pricing">
      <div className="lp-container">
        <div className="lp-section-head reveal">
          <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> Pricing</div>
          <h2 className="lp-section-title reveal reveal-d1">Start free. Scale when you&apos;re hunting hard.</h2>
          <p className="lp-section-sub reveal reveal-d2">Twerz credits · simple billing</p>
        </div>
        <div className="reveal reveal-d2" style={{ background: 'linear-gradient(135deg,rgba(255,90,31,0.1),rgba(251,191,36,0.06))', border: '1px solid rgba(255,90,31,0.2)', borderRadius: 14, padding: '14px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <p style={{ fontSize: 15, color: 'var(--orange)', fontWeight: 600, margin: 0 }}><strong>3 free resume tailors per day</strong> — no credit card needed</p>
        </div>
        <div className="pricing-grid reveal reveal-d2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 24 }}>
          {PRICING_PLANS.map((plan, i) => (
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
              {'badge' in plan && plan.badge ? (
                <span className="pricing-badge">{plan.badge}</span>
              ) : null}
              <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginBottom: 4 }}>{plan.price}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{plan.per}</div>
              <div style={{ fontSize: 12, color: plan.accent, marginBottom: 20, fontWeight: 600 }}>Best for: {plan.bestFor}</div>
              <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F5F9' }}>
                    {f}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onGetStarted} style={{ width: '100%', padding: 14, borderRadius: 10, fontFamily: 'Inter', fontWeight: 600, fontSize: 13, cursor: 'pointer', background: plan.featured ? 'linear-gradient(135deg,var(--orange),#D13600)' : '#F1F5F9', border: plan.featured ? '1px solid rgba(255,90,31,0.4)' : '1px solid #E2E8F0', color: plan.featured ? '#fff' : '#0F172A' }}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
