'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { RoastResult } from '@/types';

interface Props {
  shareId: string;
  roastData: RoastResult;
  createdAt: string;
}

export function RoastShareView({ shareId, roastData: data, createdAt }: Props) {
  const scoreColor = data.score > 70 ? 'var(--green)' : data.score > 40 ? 'var(--amber)' : 'var(--red)';
  const roastLine = data.roast_points?.[0]?.text || data.headline || 'Resume roasted.';
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/roast/${shareId}`
      : `/roast/${shareId}`;

  const downloadShareCard = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, '#0B1628');
    grad.addColorStop(1, '#162B45');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    ctx.fillStyle = '#FB4100';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('ATS BEATER', 80, 100);

    ctx.fillStyle = '#8BA3C7';
    ctx.font = '20px monospace';
    ctx.fillText('RESUME ROAST', 80, 140);

    ctx.fillStyle = data.score > 70 ? '#10B981' : data.score > 40 ? '#F59E0B' : '#EF4444';
    ctx.font = 'bold 160px monospace';
    ctx.fillText(String(data.score), 80, 360);
    ctx.fillStyle = '#8BA3C7';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('/100', 80 + ctx.measureText(String(data.score)).width + 16, 360);

    ctx.fillStyle = '#E8F1FF';
    ctx.font = 'bold 36px sans-serif';
    const headline = `"${(data.headline || 'Roasted').slice(0, 60)}"`;
    wrapText(ctx, headline, 80, 440, 920, 48);

    ctx.fillStyle = '#A8BDD6';
    ctx.font = '28px sans-serif';
    wrapText(ctx, roastLine.slice(0, 160), 80, 560, 920, 40);

    ctx.fillStyle = '#01A9DB';
    ctx.font = '22px monospace';
    ctx.fillText(shareUrl.replace(/^https?:\/\//, '').slice(0, 60), 80, 980);

    const a = document.createElement('a');
    a.download = `ats-beater-roast-${shareId}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [data.headline, data.score, roastLine, shareId, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        typeof window !== 'undefined' ? window.location.href : shareUrl
      );
    } catch {
      /* ignore */
    }
  };

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

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={downloadShareCard}>
              Download share card
            </button>
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={copyLink}>
              Copy link
            </button>
          </div>
          <Link
            href={`/login?next=/dashboard/jobs/new&utm_source=roast_share&share_id=${encodeURIComponent(shareId)}`}
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex' }}
          >
            Fix this resume for a real JD — free tailor credit after signup
          </Link>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
            Stop guessing. Paste a job description and get an ATS-scored, truthful tailored resume — not a roast.
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, fontFamily: 'JetBrains Mono' }}>
            Shared roast · {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    const test = `${line}${words[n]} `;
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, yy);
      line = `${words[n]} `;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}
