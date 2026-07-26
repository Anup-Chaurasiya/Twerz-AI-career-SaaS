import Link from 'next/link';
import { CREDITS_PER_TAILOR, JOB_HUNT_PRO_PLAN } from '@/lib/marketing/content';

type PricingProCardProps = {
  variant?: 'marketing' | 'landing';
  onGetStarted?: () => void;
};

export default function PricingProCard({ variant = 'marketing', onGetStarted }: PricingProCardProps) {
  const plan = JOB_HUNT_PRO_PLAN;

  if (variant === 'landing') {
    return (
      <div
        className="reveal reveal-d2"
        style={{
          marginBottom: 32,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(255,90,31,0.05))',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 18,
          padding: '28px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: plan.accent, textTransform: 'uppercase', marginBottom: 8 }}>
            {plan.badge}
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{plan.name}</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>{plan.credits}</p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>{plan.bestFor} · {CREDITS_PER_TAILOR} credits per resume</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {plan.features.map((f) => (
              <li key={f} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f}</li>
            ))}
          </ul>
        </div>
        <div style={{ textAlign: 'right', minWidth: 160 }}>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{plan.price}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{plan.per}</div>
          <button
            type="button"
            onClick={onGetStarted}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 10,
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: 'none',
              color: '#fff',
            }}
          >
            Get Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <article
      className="mkt-pricing-card mkt-pricing-card--featured"
      style={{ borderColor: 'rgba(99,102,241,0.35)', background: 'linear-gradient(160deg, rgba(99,102,241,0.06), #fff)', marginBottom: 28, gridColumn: '1 / -1' }}
    >
      <span className="mkt-pricing-badge" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>{plan.badge}</span>
      <div className="mkt-pricing-name">{plan.name}</div>
      <div className="mkt-pricing-price">{plan.price}</div>
      <div className="mkt-pricing-per">{plan.per}</div>
      <div className="mkt-pricing-credits">{plan.credits}</div>
      <div className="mkt-pricing-best">Best for: {plan.bestFor}</div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 12px' }}>{CREDITS_PER_TAILOR} credits per tailored resume</p>
      <ul className="mkt-list">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <Link href="/login" className="mkt-btn-primary" style={{ display: 'inline-flex', marginTop: 8, textDecoration: 'none' }}>
        Subscribe — sign in to buy
      </Link>
    </article>
  );
}
