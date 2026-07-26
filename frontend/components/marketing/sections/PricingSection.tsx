import { PRICING_PLANS } from '@/lib/marketing/content';

export default function PricingSection() {
  return (
    <>
      <div className="mkt-banner">
        <strong>3 free resume tailors per day</strong> — no credit card needed
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
    </>
  );
}
