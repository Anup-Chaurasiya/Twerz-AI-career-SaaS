import { FEATURES } from '@/lib/marketing/content';

const TAG_ORDER = [
  'Tailor & Score',
  'Edit & Export',
  'Apply Smarter',
  'Track & Grow',
  'Free Tools',
  'Speed',
] as const;

export default function FeaturesSection() {
  const grouped = TAG_ORDER.map((tag) => ({
    tag,
    items: FEATURES.filter((f) => f.tag === tag),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mkt-features">
      {grouped.map((group) => (
        <section key={group.tag} className="mkt-features-group">
          <h2 className="mkt-features-group-title">{group.tag}</h2>
          <div className="mkt-grid">
            {group.items.map((feature) => (
              <article key={feature.title} className="mkt-card">
                <span className="mkt-card-tag">{feature.tag}</span>
                <h3 className="mkt-card-title">{feature.title}</h3>
                <p className="mkt-card-desc">{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
