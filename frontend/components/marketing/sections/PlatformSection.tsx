import { PLATFORM_CATEGORIES } from '@/lib/marketing/content';

export default function PlatformSection() {
  return (
    <div className="mkt-grid mkt-grid--2">
      {PLATFORM_CATEGORIES.map((category) => (
        <article key={category.title} className="mkt-card">
          <h2 className="mkt-card-title">{category.title}</h2>
          <ul className="mkt-list">
            {category.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
