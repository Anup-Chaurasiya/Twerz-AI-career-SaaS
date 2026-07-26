import { FAQS } from '@/lib/marketing/content';

export default function FaqSection() {
  return (
    <div className="mkt-faq">
      {FAQS.map((faq) => (
        <details key={faq.q} className="mkt-faq-item">
          <summary>{faq.q}</summary>
          <p>{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
