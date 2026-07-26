import { HOW_IT_WORKS } from '@/lib/marketing/content';

export default function HowItWorksSection() {
  return (
    <div className="mkt-steps">
      {HOW_IT_WORKS.map((step) => (
        <article key={step.step} className="mkt-step">
          <div className="mkt-step-num">{step.step}</div>
          <div>
            <h2 className="mkt-card-title">{step.title}</h2>
            <p className="mkt-card-desc">{step.desc}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
