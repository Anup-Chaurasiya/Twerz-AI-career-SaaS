'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { roastsApi } from '@/lib/api/endpoints';
import { Roast } from '@/types';
import { getStatusColor } from '@/lib/utils';

export default function RoastDetailPage() {
  const { id } = useParams();
  const [roast, setRoast] = useState<Roast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchRoast = async () => {
      try {
        const res = await roastsApi.get(Number(id));
        setRoast(res.data);
        if (res.data.status === 'PENDING' || res.data.status === 'PROCESSING') {
          interval = setTimeout(fetchRoast, 3000);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load roast');
        setLoading(false);
      }
    };
    fetchRoast();
    return () => clearTimeout(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-lg" style={{ marginBottom: 16, borderTopColor: 'var(--orange)' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)', marginBottom: 8, fontFamily: 'JetBrains Mono' }}>ROASTING IN PROGRESS</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>The AI is currently analyzing your resume&apos;s weaknesses. Prepare to be offended (constructively).</p>
      </div>
    );
  }

  if (error && !roast) {
    return (
      <div className="page-scroll">
        <div className="widget-card card-warning" style={{ color: 'var(--red)' }}>{error}</div>
        <Link href="/dashboard/roasts" className="btn-secondary" style={{ marginTop: 24, display: 'inline-block' }}>← Back to Roasts</Link>
      </div>
    );
  }

  if (!roast || !roast.roast_data) return null;
  const data = roast.roast_data;

  return (
    <div className="page-scroll" style={{ background: 'linear-gradient(to bottom, rgba(251,65,0,0.03), var(--deep))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <Link href="/dashboard/roasts" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.2s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Roasts
        </Link>
        <button className="btn-ghost" onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/roast/${roast.share_id}`);
          alert('Share link copied to clipboard!');
        }}>
          🔗 Share Roast
        </button>
      </div>

      <div className="widget-card fade-slide-in" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, background: 'radial-gradient(circle, rgba(251,65,0,0.1), transparent 70%)', filter: 'blur(40px)', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 64, fontWeight: 900, fontFamily: 'JetBrains Mono', color: data.score > 70 ? 'var(--green)' : data.score > 40 ? 'var(--amber)' : 'var(--red)', letterSpacing: -4, lineHeight: 1, marginBottom: 12 }}>
            {data.score}
            <span style={{ fontSize: 24, color: 'var(--text-dim)', letterSpacing: 0 }}>/100</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>&ldquo;{data.headline}&rdquo;</h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>{data.verdict}</p>
        </div>
      </div>

      <div className="dash-grid-2" style={{ marginBottom: 24 }}>
        <div className="widget-card fade-slide-in stagger-1">
          <div className="section-label" style={{ color: 'var(--orange)' }}>The Roast 🔥</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {data.roast_points.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '16px', background: 'rgba(251,65,0,0.04)', border: '1px solid rgba(251,65,0,0.1)', borderRadius: 8 }}>
                <div style={{ fontSize: 24 }}>{p.emoji}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="widget-card fade-slide-in stagger-2">
          <div className="section-label" style={{ color: 'var(--teal)' }}>Constructive Feedback 💡</div>
          <div style={{ padding: '20px', background: 'rgba(1,169,219,0.04)', border: '1px solid rgba(1,169,219,0.1)', borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {data.actual_feedback}
          </div>
        </div>
      </div>

      <div className="widget-card fade-slide-in stagger-3">
        <div className="section-label" style={{ color: 'var(--text-primary)' }}>ATS Checklist 🤖</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 16 }}>
          {data.ats_checklist.map((item, i) => (
            <div key={i} style={{ padding: '16px', background: item.passed ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${item.passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 16 }}>{item.passed ? '✅' : '❌'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
