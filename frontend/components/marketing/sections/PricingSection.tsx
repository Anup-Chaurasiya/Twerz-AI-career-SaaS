import PricingProCard from '@/components/marketing/PricingProCard';
import { PRICING_PLANS, PRICING_FOOTNOTE } from '@/lib/marketing/content';

export default function PricingSection() {
  return (
    <>
      <div className="mkt-banner">
        <strong>100 credits on signup + 20 free credits daily</strong> — no credit card needed
      </div>
      <PricingProCard variant="marketing" />
      <div className="section-label" style={{ marginBottom: 12, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        One-time credit packs
      </div>
      <div className="mkt-pricing-grid">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`mkt-pricing-card${plan.featured ? ' mkt-pricing-card--featured' : ''}`}
          >
            {'badge' in plan && plan.badge ? (
              <span className="mkt-pricing-badge">{plan.badge}</span>
            ) : null}
            <div className="mkt-pricing-name">{plan.name}</div>
            <div className="mkt-pricing-price">{plan.price}</div>
            <div className="mkt-pricing-per">{plan.per}</div>
            <div className="mkt-pricing-best">Best for: {plan.bestFor}</div>
            <div className="mkt-pricing-credits">{plan.credits}</div>
            <ul className="mkt-list">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 8, maxWidth: 720 }}>
        {PRICING_FOOTNOTE}
      </p>
    </>
  );
}
