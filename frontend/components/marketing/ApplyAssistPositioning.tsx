import { APPLY_ASSIST_POSITIONING } from '@/lib/marketing/content';

export default function ApplyAssistPositioning() {
  return (
    <section className="mkt-card" style={{ marginBottom: 32, padding: 24 }}>
      <p style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
        Apply Assist vs auto-apply bots
      </p>
      <h2 style={{ margin: '0 0 12px', fontSize: 22, lineHeight: 1.35 }}>{APPLY_ASSIST_POSITIONING.headline}</h2>
      <p style={{ margin: '0 0 20px', color: 'var(--text-dim)', lineHeight: 1.6 }}>{APPLY_ASSIST_POSITIONING.subhead}</p>
      <div className="mkt-grid" style={{ gap: 16 }}>
        {APPLY_ASSIST_POSITIONING.comparisons.map((row) => (
          <article key={row.name} className="mkt-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{row.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{row.pitch}</div>
            <div style={{ fontSize: 13, color: '#34d399' }}>{row.counter}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
