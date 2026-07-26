'use client';

import { LANDING_FAQS } from '@/components/landing/staticData';

type LandingFaqSectionProps = {
  openFaq: number | null;
  onToggle: (index: number) => void;
};

export default function LandingFaqSection({ openFaq, onToggle }: LandingFaqSectionProps) {
  return (
    <section id="faq" className="lp-section lp-section-faq">
      <div className="lp-container">
        <div className="lp-section-head reveal">
          <div className="lp-eyebrow"><span className="lp-eyebrow-line" /> FAQ</div>
          <h2 className="lp-section-title reveal reveal-d1">Frequently Asked Questions</h2>
        </div>
        <div className="reveal reveal-d2" style={{ maxWidth: 720 }}>
          {LANDING_FAQS.map((faq, i) => (
            <div key={faq.q} className="faq-item" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => onToggle(i)}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', padding: '20px 0', cursor: 'pointer', fontFamily: 'Inter', fontSize: 16, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
              >
                {faq.q}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={openFaq === i ? '#ff5a1f' : 'currentColor'} strokeWidth="2" style={{ flexShrink: 0, color: openFaq === i ? '#ff5a1f' : 'var(--text-dim)', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease, color 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {openFaq === i ? (
                <div className="faq-answer" style={{ paddingBottom: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{faq.a}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
