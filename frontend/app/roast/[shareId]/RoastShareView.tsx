'use client';

import Link from 'next/link';
import { RoastResult } from '@/types';

interface Props {
  shareId: string;
  roastData: RoastResult;
  createdAt: string;
}

export function RoastShareView({ shareId, roastData: data, createdAt }: Props) {
  const scoreColor = data.score > 70 ? 'var(--green)' : data.score > 40 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--deep)', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: 3, color: 'var(--text-dim)', textDecoration: 'none', textTransform: 'uppercase' }}>
            ATS Beater
          </Link>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: 2, color: 'var(--orange)', textTransform: 'uppercase', marginTop: 8 }}>
            Resume Roast
          </div>
        </div>

        <div className="widget-card fade-slide-in" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 900, fontFamily: 'JetBrains Mono', color: scoreColor, letterSpacing: -4, lineHeight: 1, marginBottom: 12 }}>
            {data.score}
            <span style={{ fontSize: 24, color: 'var(--text-dim)' }}>/100</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>&ldquo;{data.headline}&rdquo;</h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{data.verdict}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
          <div className="widget-card">
            <div className="section-label" style={{ color: 'var(--orange)' }}>The Roast</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {data.roast_points?.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: 14, background: 'rgba(251,65,0,0.04)', border: '1px solid rgba(251,65,0,0.1)', borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <span>{p.emoji}</span>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="widget-card">
            <div className="section-label" style={{ color: 'var(--teal)' }}>Constructive Feedback</div>
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {data.actual_feedback}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Fix My Resume with AI
          </Link>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 16, fontFamily: 'JetBrains Mono' }}>
            Shared roast · {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
