import type { CSSProperties } from 'react';
import { FEATURES } from '@/lib/marketing/content';
import { iconProps } from '@/components/landing/ui';

type Accent = { color: string; soft: string };

export type LandingFeatureItem = {
  title: string;
  desc: string;
  tag: string;
};

const TAG_META: Record<string, { accent: Accent; shortTag: string }> = {
  'Tailor & Score': { accent: { color: '#6366f1', soft: 'rgba(99,102,241,0.12)' }, shortTag: 'Score' },
  'Edit & Export': { accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' }, shortTag: 'Export' },
  'Apply Smarter': { accent: { color: '#fb923c', soft: 'rgba(251,146,60,0.12)' }, shortTag: 'Apply' },
  'Track & Grow': { accent: { color: '#8b5cf6', soft: 'rgba(139,92,246,0.12)' }, shortTag: 'Track' },
  'Free Tools': { accent: { color: '#38bdf8', soft: 'rgba(56,189,248,0.12)' }, shortTag: 'Free' },
  Speed: { accent: { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' }, shortTag: 'Speed' },
  Honesty: { accent: { color: '#ff5a1f', soft: 'rgba(255,90,31,0.12)' }, shortTag: 'Honesty' },
  Score: { accent: { color: '#6366f1', soft: 'rgba(99,102,241,0.12)' }, shortTag: 'Score' },
  Apply: { accent: { color: '#fb923c', soft: 'rgba(251,146,60,0.12)' }, shortTag: 'Apply' },
  Edit: { accent: { color: '#34d399', soft: 'rgba(52,211,153,0.12)' }, shortTag: 'Edit' },
  Export: { accent: { color: '#14b8a6', soft: 'rgba(20,184,166,0.12)' }, shortTag: 'Export' },
  'Coming soon': { accent: { color: '#8b5cf6', soft: 'rgba(139,92,246,0.12)' }, shortTag: 'Soon' },
};

const DEFAULT_META = TAG_META['Tailor & Score'];

function FeatureIcon({ title }: { title: string }) {
  const t = title.toLowerCase();
  if (t.includes('upload') || t.includes('pdf') || t.includes('docx')) {
    return (
      <svg {...iconProps}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    );
  }
  if (t.includes('chat') || t.includes('outreach') || t.includes('cover letter') || t.includes('interview prep')) {
    return (
      <svg {...iconProps}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (t.includes('analytics') || t.includes('tracker') || t.includes('tracking')) {
    return (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (t.includes('linkedin') || t.includes('referral') || t.includes('network')) {
    return (
      <svg {...iconProps}>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  }
  if (t.includes('roast') || t.includes('ats') || t.includes('fit') || t.includes('evidence') || t.includes('gap') || t.includes('invent')) {
    return (
      <svg {...iconProps}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  if (t.includes('instant') || t.includes('speed') || t.includes('generation')) {
    return (
      <svg {...iconProps}>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
  }
  if (t.includes('language')) {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (t.includes('extension') || t.includes('chrome') || t.includes('auto-apply')) {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  if (t.includes('promo') || t.includes('time pass') || t.includes('credit')) {
    return (
      <svg {...iconProps}>
        <path d="M20 12V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12v4" />
        <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
        <path d="M18 12a2 2 0 0 0-2 2v4h4v-4a2 2 0 0 0-2-2z" />
      </svg>
    );
  }
  if (t.includes('template')) {
    return (
      <svg {...iconProps}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    );
  }
  if (t.includes('delete') || t.includes('export') || t.includes('account') || t.includes('latex')) {
    return (
      <svg {...iconProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (t.includes('keyword')) {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function FeatureVisual({ title, tag, accent }: { title: string; tag: string; accent: Accent }) {
  const t = title.toLowerCase();

  if (t.includes('upload') && t.includes('docx')) {
    return (
      <div className="feat-visual feat-visual--upload">
        <div className="feat-upload-zone">
          <span className="feat-upload-label">Drop resume here</span>
          <div className="feat-upload-formats">
            <span>PDF</span>
            <span>DOCX</span>
          </div>
        </div>
      </div>
    );
  }

  if (t.includes('ats score') || t.includes('fit score') || t.includes('public ats') || t.includes('before')) {
    return (
      <div className="feat-visual feat-visual--roast">
        <div className="feat-roast-score" style={{ color: accent.color }}>
          <span>{t.includes('before') ? '62→93' : t.includes('fit') ? '87' : '78'}</span>
          {!t.includes('before') && <small>/100</small>}
        </div>
        <div className="feat-roast-items">
          <span className="feat-roast-ok">✓ Honest scoring</span>
        </div>
      </div>
    );
  }

  if (t.includes('never invent') || t.includes('invents a skill')) {
    return (
      <div className="feat-visual feat-visual--keywords">
        <div className="feat-kw-row"><span className="feat-kw-from">JD:</span> Okta · SAML · SSO</div>
        <div className="feat-kw-arrow">↓ evidence check</div>
        <div className="feat-kw-result" style={{ color: accent.color }}>Missing — not added to resume</div>
      </div>
    );
  }

  if (t.includes('evidence report')) {
    return (
      <div className="feat-visual feat-visual--keywords">
        <div className="feat-kw-row"><span className="feat-kw-from">●</span> Python — SUPPORTED</div>
        <div className="feat-kw-row"><span className="feat-kw-from">◐</span> Kubernetes — PARTIAL</div>
        <div className="feat-kw-result" style={{ color: accent.color }}>Copy & share with recruiter</div>
      </div>
    );
  }

  if (t.includes('keyword')) {
    return (
      <div className="feat-visual feat-visual--keywords">
        <div className="feat-kw-row"><span className="feat-kw-from">JD:</span> React · TypeScript · AWS</div>
        <div className="feat-kw-arrow">↓ woven into bullets</div>
        <div className="feat-kw-result">Built scalable React dashboards on AWS…</div>
      </div>
    );
  }

  if (t.includes('chat') || t.includes('cover letter') || t.includes('interview prep')) {
    return (
      <div className="feat-visual feat-visual--chat">
        <div className="feat-chat-bubble feat-chat-bubble--ai">
          {t.includes('chat') ? 'Make the summary more concise…' : 'Evidence-grounded copy — never generic filler'}
        </div>
      </div>
    );
  }

  if (t.includes('latex') || t.includes('docx export') || t.includes('recompile') || t.includes('template')) {
    return (
      <div className="feat-visual feat-visual--pdf">
        {t.includes('template') ? (
          <div className="feat-visual feat-visual--lang" style={{ marginBottom: 8 }}>
            {['Classic', 'Compact', 'Modern'].map((l) => (
              <span key={l} className="feat-lang-chip">{l}</span>
            ))}
          </div>
        ) : (
          <div className="feat-pdf-mini">
            <div className="feat-pdf-line feat-pdf-line--h" />
            <div className="feat-pdf-line" />
            <div className="feat-pdf-line feat-pdf-line--short" />
          </div>
        )}
        <span className="feat-pdf-label">{t.includes('template') ? 'Pick before download' : 'PDF + DOCX'}</span>
      </div>
    );
  }

  if (t.includes('language')) {
    return (
      <div className="feat-visual feat-visual--lang">
        {['EN', 'FR', 'DE', 'NO', 'ES'].map((l) => (
          <span key={l} className="feat-lang-chip">{l}</span>
        ))}
      </div>
    );
  }

  if (t.includes('instant') || t.includes('generation')) {
    return (
      <div className="feat-visual feat-visual--speed">
        <div className="feat-speed-bar"><div className="feat-speed-fill" /></div>
        <span className="feat-speed-label">Under 60 seconds</span>
      </div>
    );
  }

  if (t.includes('tracker') || t.includes('analytics') || t.includes('auto-apply')) {
    return (
      <div className="feat-visual feat-visual--speed">
        <span className="feat-speed-label">
          {t.includes('auto-apply') ? 'Tailor → Fit check → Apply' : 'Saved · Applied · Interview · Offer'}
        </span>
        <div className="feat-speed-bar"><div className="feat-speed-fill" style={{ width: t.includes('auto-apply') ? '72%' : '55%' }} /></div>
      </div>
    );
  }

  if (t.includes('referral') || t.includes('promo')) {
    return (
      <div className="feat-visual feat-visual--lang">
        {['Credits', 'Time pass', 'Promo'].map((l) => (
          <span key={l} className="feat-lang-chip">{l}</span>
        ))}
      </div>
    );
  }

  return (
    <div className="feat-visual feat-visual--keywords">
      <div className="feat-kw-result" style={{ color: accent.color }}>{tag}</div>
    </div>
  );
}

export default function LandingFeaturesGrid({ features = FEATURES }: { features?: readonly LandingFeatureItem[] }) {
  return (
    <div className="features-grid-v2">
      {features.map((feature, index) => {
        const meta = TAG_META[feature.tag] ?? DEFAULT_META;
        const style = {
          '--accent': meta.accent.color,
          '--accent-soft': meta.accent.soft,
        } as CSSProperties;

        return (
          <article
            key={feature.title}
            className={`feature-card-v2 reveal${index % 3 === 1 ? ' reveal-d1' : index % 3 === 2 ? ' reveal-d2' : ''}`}
            style={style}
          >
            <div className="feature-card-v2-head">
              <div className="feature-icon">
                <FeatureIcon title={feature.title} />
              </div>
              <span className="feature-tag">{meta.shortTag}</span>
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-desc">{feature.desc}</p>
            <FeatureVisual title={feature.title} tag={feature.tag} accent={meta.accent} />
          </article>
        );
      })}
    </div>
  );
}
